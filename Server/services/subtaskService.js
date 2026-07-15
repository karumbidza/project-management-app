// FOLLO ENGINE
// FOLLO SRP
/**
 * Subtask Service
 * The contractor breakdown & quoting engine.
 *
 * Flow:  an awarded contractor breaks a task into priced, scheduled subtasks
 * (DRAFT) → submits the quote (SUBMITTED) → PM approves (APPROVED), which rolls
 * the quote into the project's committed cost and the subtask date-span into the
 * parent task's planned dates. Checking a subtask off then drives the task's %
 * and the project's progress — before the final task sign-off.
 */

import * as subtaskRepo from "../repositories/subtaskRepository.js";
import * as taskRepo from "../repositories/taskRepository.js";
import prisma from "../configs/prisma.js";
import {
  requireTaskAccess,
  requireTaskEditor,
  requireTaskPMOrAdmin,
} from "../utils/permissions.js";
import { NotFoundError, ConflictError, ValidationError } from "../utils/errors.js";
import { BREAKDOWN_STATUS, PROJECT_ROLES, ACTIVITY_TYPE } from "../utils/constants.js";
import { createNotification } from "../utils/notificationService.js";
import { recalculateProjectCompletion, taskCompletionFraction } from "../lib/projectCompletion.js";
import { io } from "../server.js";

const MANAGER_ROLES = [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER];
// Breakdown states in which the contractor may still edit/price subtasks.
const EDITABLE_STATES = [BREAKDOWN_STATUS.NONE, BREAKDOWN_STATUS.DRAFT, BREAKDOWN_STATUS.REJECTED];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const toNum = (d) => (d == null ? 0 : Number(d));

/** Quoted cost for a subtask: sum of line items when itemised, else the lump sum. */
function resolveQuotedCost(lineItems, lumpSum) {
  if (Array.isArray(lineItems) && lineItems.length > 0) {
    return lineItems.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitCost || 0), 0);
  }
  return Number(lumpSum || 0);
}

/** Strip money fields from subtasks the viewer isn't allowed to see. */
function shapeSubtask(st, canSeeCost) {
  const base = {
    id: st.id,
    taskId: st.taskId,
    title: st.title,
    description: st.description,
    sortOrder: st.sortOrder,
    plannedStartDate: st.plannedStartDate,
    plannedEndDate: st.plannedEndDate,
    completionWeight: st.completionWeight,
    isComplete: st.isComplete,
    completedAt: st.completedAt,
    createdById: st.createdById,
    createdAt: st.createdAt,
  };
  if (!canSeeCost) return base;
  return {
    ...base,
    quotedCost: toNum(st.quotedCost),
    actualCost: st.actualCost == null ? null : toNum(st.actualCost),
    lineItems: (st.lineItems || []).map((li) => ({
      id: li.id,
      label: li.label,
      quantity: toNum(li.quantity),
      unitCost: toNum(li.unitCost),
      lineTotal: toNum(li.quantity) * toNum(li.unitCost),
      sortOrder: li.sortOrder,
    })),
  };
}

/** Progress/cost summary for a set of subtasks. */
function summarise(subtasks, taskStatus) {
  const total = subtasks.length;
  const complete = subtasks.filter((s) => s.isComplete).length;
  const totalQuoted = subtasks.reduce((s, st) => s + toNum(st.quotedCost), 0);
  const totalActual = subtasks.reduce((s, st) => s + toNum(st.actualCost), 0);
  const pct = Math.round(
    taskCompletionFraction({ status: taskStatus, subtasks }) * 100,
  );
  return { total, complete, pct, totalQuoted, totalActual };
}

/** Project managers to notify about a breakdown submission. */
async function findProjectManagers(projectId, excludeUserId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { where: { role: { in: MANAGER_ROLES }, isActive: true }, select: { userId: true } },
    },
  });
  if (!project) return [];
  const ids = new Set([project.ownerId, ...project.members.map((m) => m.userId)]);
  ids.delete(excludeUserId);
  return [...ids];
}

function emitBreakdownChanged(projectId, taskId, progress) {
  try {
    io.to(`project:${projectId}`).emit('subtask_changed', { projectId, taskId, progress });
  } catch (err) {
    console.error('[Subtask] socket emit failed:', err.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// READ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getBreakdown(taskId, userId) {
  const { task, projectAccess } = await requireTaskAccess(userId, taskId);
  const isPM = MANAGER_ROLES.includes(projectAccess.role);
  const isAssignee = task.assigneeId === userId;
  const canManage = isPM || isAssignee;
  const canSeeCost = isPM || isAssignee;

  const subtasks = await subtaskRepo.findSubtasksByTask(taskId);

  return {
    taskId,
    breakdownStatus: task.breakdownStatus,
    breakdownSubmittedAt: task.breakdownSubmittedAt,
    breakdownApprovedAt: task.breakdownApprovedAt,
    breakdownRejectedAt: task.breakdownRejectedAt,
    breakdownRejectionReason: task.breakdownRejectionReason,
    canManage,
    canApprove: isPM,
    canSeeCost,
    summary: canSeeCost ? summarise(subtasks, task.status) : summariseNoCost(subtasks, task.status),
    subtasks: subtasks.map((s) => shapeSubtask(s, canSeeCost)),
  };
}

function summariseNoCost(subtasks, taskStatus) {
  const { total, complete, pct } = summarise(subtasks, taskStatus);
  return { total, complete, pct };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBTASK CRUD (contractor-owned, locked once submitted)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function assertEditable(task) {
  if (!EDITABLE_STATES.includes(task.breakdownStatus)) {
    throw new ConflictError(
      'The breakdown is submitted or approved and can no longer be edited',
    );
  }
}

export async function createSubtask(taskId, userId, body) {
  const { task } = await requireTaskEditor(userId, taskId);
  assertEditable(task);

  const quotedCost = resolveQuotedCost(body.lineItems, body.quotedCost);
  const sortOrder = (await subtaskRepo.maxSortOrder(taskId)) + 1;

  const created = await prisma.$transaction(async (tx) => {
    const st = await subtaskRepo.createSubtask(
      {
        taskId,
        title: body.title,
        description: body.description ?? null,
        sortOrder,
        plannedStartDate: body.plannedStartDate ? new Date(body.plannedStartDate) : null,
        plannedEndDate: body.plannedEndDate ? new Date(body.plannedEndDate) : null,
        quotedCost,
        completionWeight: body.completionWeight ?? 1,
        createdById: userId,
      },
      tx,
    );
    if (Array.isArray(body.lineItems) && body.lineItems.length > 0) {
      await subtaskRepo.replaceLineItems(st.id, body.lineItems, tx);
    }
    // First subtask moves the task from NONE (or REJECTED) into DRAFT.
    if (task.breakdownStatus !== BREAKDOWN_STATUS.DRAFT) {
      await taskRepo.updateTaskPartial(taskId, { breakdownStatus: BREAKDOWN_STATUS.DRAFT }, tx);
    }
    return st;
  });

  return subtaskRepo.findSubtaskById(created.id);
}

export async function updateSubtask(subtaskId, userId, body) {
  const subtask = await subtaskRepo.findSubtaskById(subtaskId);
  if (!subtask) throw new NotFoundError('Subtask');
  const { task } = await requireTaskEditor(userId, subtask.taskId);

  // actualCost may be recorded after approval; everything else needs an
  // editable (pre-submission) breakdown.
  const onlyActualCost =
    Object.keys(body).length === 1 && Object.prototype.hasOwnProperty.call(body, 'actualCost');
  if (!onlyActualCost) assertEditable(task);

  const data = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.plannedStartDate !== undefined)
    data.plannedStartDate = body.plannedStartDate ? new Date(body.plannedStartDate) : null;
  if (body.plannedEndDate !== undefined)
    data.plannedEndDate = body.plannedEndDate ? new Date(body.plannedEndDate) : null;
  if (body.completionWeight !== undefined) data.completionWeight = body.completionWeight;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.actualCost !== undefined) data.actualCost = body.actualCost;

  await prisma.$transaction(async (tx) => {
    if (body.lineItems !== undefined) {
      await subtaskRepo.replaceLineItems(subtaskId, body.lineItems ?? [], tx);
      data.quotedCost = resolveQuotedCost(body.lineItems, body.quotedCost ?? subtask.quotedCost);
    } else if (body.quotedCost !== undefined && (subtask.lineItems || []).length === 0) {
      // Only honour a lump sum when the subtask isn't itemised.
      data.quotedCost = Number(body.quotedCost);
    }
    if (Object.keys(data).length > 0) {
      await subtaskRepo.updateSubtask(subtaskId, data, tx);
    }
  });

  return subtaskRepo.findSubtaskById(subtaskId);
}

export async function deleteSubtask(subtaskId, userId) {
  const subtask = await subtaskRepo.findSubtaskById(subtaskId);
  if (!subtask) throw new NotFoundError('Subtask');
  const { task } = await requireTaskEditor(userId, subtask.taskId);
  assertEditable(task);

  await subtaskRepo.deleteSubtask(subtaskId);
  return { deleted: true };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPLETION (drives progress)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function toggleSubtask(subtaskId, userId, isComplete) {
  const subtask = await subtaskRepo.findSubtaskById(subtaskId);
  if (!subtask) throw new NotFoundError('Subtask');
  const { task } = await requireTaskEditor(userId, subtask.taskId);

  if (task.breakdownStatus !== BREAKDOWN_STATUS.APPROVED) {
    throw new ConflictError('Subtasks can only be checked off once the breakdown is approved');
  }

  await subtaskRepo.updateSubtask(subtaskId, {
    isComplete,
    completedAt: isComplete ? new Date() : null,
  });

  const progress = await recalculateProjectCompletion(task.projectId, prisma);
  emitBreakdownChanged(task.projectId, subtask.taskId, progress);

  const subtasks = await subtaskRepo.findSubtasksByTask(subtask.taskId);
  return {
    subtask: shapeSubtask(await subtaskRepo.findSubtaskById(subtaskId), true),
    projectProgress: progress,
    summary: summarise(subtasks, task.status),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BREAKDOWN LIFECYCLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function submitBreakdown(taskId, userId) {
  const { task } = await requireTaskEditor(userId, taskId);
  assertEditable(task);

  const count = await subtaskRepo.countSubtasks(taskId);
  if (count === 0) {
    throw new ValidationError('Add at least one subtask before submitting the breakdown');
  }

  await prisma.$transaction(async (tx) => {
    await taskRepo.updateTaskPartial(taskId, {
      breakdownStatus: BREAKDOWN_STATUS.SUBMITTED,
      breakdownSubmittedAt: new Date(),
      breakdownSubmittedById: userId,
      breakdownRejectionReason: null,
    }, tx);
    await taskRepo.createActivity(
      taskId,
      userId,
      ACTIVITY_TYPE.TASK_UPDATED,
      'Submitted task breakdown & quote for approval',
      null,
      null,
      tx,
    );
  });

  // Notify the PMs who can approve.
  const managers = await findProjectManagers(task.projectId, userId);
  for (const uid of managers) {
    createNotification({
      userId: uid,
      type: 'TASK_UPDATED',
      title: 'Breakdown awaiting approval',
      message: `A quote & schedule was submitted for "${task.title}"`,
      metadata: { taskId, projectId: task.projectId, kind: 'breakdown_submitted' },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    }).catch((e) => console.error('[Subtask] notify PM failed:', e.message));
  }

  emitBreakdownChanged(task.projectId, taskId, null);
  return getBreakdown(taskId, userId);
}

export async function approveBreakdown(taskId, userId) {
  const { task } = await requireTaskPMOrAdmin(userId, taskId);
  if (task.breakdownStatus !== BREAKDOWN_STATUS.SUBMITTED) {
    throw new ConflictError('Only a submitted breakdown can be approved');
  }

  const rows = await subtaskRepo.findSubtaskRollupRows(taskId);
  // Roll the subtask date-span into the parent task's planned window.
  const starts = rows.map((r) => r.plannedStartDate).filter(Boolean);
  const ends = rows.map((r) => r.plannedEndDate).filter(Boolean);
  const rolledStart = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
  const rolledEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

  await prisma.$transaction(async (tx) => {
    const data = {
      breakdownStatus: BREAKDOWN_STATUS.APPROVED,
      breakdownApprovedAt: new Date(),
      breakdownApprovedById: userId,
    };
    if (rolledStart) data.plannedStartDate = rolledStart;
    if (rolledEnd) data.plannedEndDate = rolledEnd;
    await taskRepo.updateTaskPartial(taskId, data, tx);
    await taskRepo.createActivity(
      taskId,
      userId,
      ACTIVITY_TYPE.TASK_UPDATED,
      'Approved task breakdown & quote',
      null,
      null,
      tx,
    );
  });

  const progress = await recalculateProjectCompletion(task.projectId, prisma);

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId,
      type: 'TASK_UPDATED',
      title: 'Breakdown approved',
      message: `Your quote & schedule for "${task.title}" was approved`,
      metadata: { taskId, projectId: task.projectId, kind: 'breakdown_approved' },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    }).catch((e) => console.error('[Subtask] notify assignee failed:', e.message));
  }

  emitBreakdownChanged(task.projectId, taskId, progress);
  return getBreakdown(taskId, userId);
}

export async function rejectBreakdown(taskId, userId, reason) {
  const { task } = await requireTaskPMOrAdmin(userId, taskId);
  if (task.breakdownStatus !== BREAKDOWN_STATUS.SUBMITTED) {
    throw new ConflictError('Only a submitted breakdown can be rejected');
  }

  await prisma.$transaction(async (tx) => {
    await taskRepo.updateTaskPartial(taskId, {
      breakdownStatus: BREAKDOWN_STATUS.REJECTED,
      breakdownRejectedAt: new Date(),
      breakdownRejectionReason: reason ?? null,
    });
    await taskRepo.createActivity(
      taskId,
      userId,
      ACTIVITY_TYPE.TASK_UPDATED,
      reason ? `Rejected breakdown: ${reason}` : 'Rejected task breakdown',
      null,
      null,
      tx,
    );
  });

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId,
      type: 'TASK_UPDATED',
      title: 'Breakdown sent back',
      message: `Your breakdown for "${task.title}" needs revision${reason ? `: ${reason}` : ''}`,
      metadata: { taskId, projectId: task.projectId, kind: 'breakdown_rejected' },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    }).catch((e) => console.error('[Subtask] notify assignee failed:', e.message));
  }

  emitBreakdownChanged(task.projectId, taskId, null);
  return getBreakdown(taskId, userId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT COST ROLLUP (budget vs committed vs actual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Committed = sum of quoted cost across subtasks whose task breakdown is
 * APPROVED. Actual = sum of recorded actualCost. Used by the project overview.
 */
export async function getProjectCostRollup(projectId) {
  const rows = await prisma.subtask.findMany({
    where: { task: { projectId, breakdownStatus: BREAKDOWN_STATUS.APPROVED } },
    select: { quotedCost: true, actualCost: true },
  });
  const committed = rows.reduce((s, r) => s + toNum(r.quotedCost), 0);
  const actual = rows.reduce((s, r) => s + toNum(r.actualCost), 0);
  return { committed, actual, subtaskCount: rows.length };
}
