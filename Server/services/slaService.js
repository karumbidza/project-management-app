// FOLLO SRP
// FOLLO INSTANT
/**
 * SLA Service
 * Business logic for task submission, approval, rejection, blockers, extensions, and SLA summary.
 * Orchestrates repository, SLA lib, notifications, Inngest, and realtime.
 */

import * as slaRepo from "../repositories/slaRepository.js";
import { invalidateCache, CACHE_KEYS } from "../lib/cache.js";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "../utils/errors.js";
import { inngest } from "../inngest/client.js";
import { io } from "../server.js";
import { createNotification, createBulkNotifications } from "../utils/notificationService.js";
import prisma from "../configs/prisma.js";
import {
  SLA_STATUS,
  SLA_EVENT_TYPE,
  calculateNetElapsedMs,
  calculateSlaStatus,
  pauseClockData,
  resumeClockData,
  stopClockData,
  updateContractorScore,
  logSlaEvent,
  isOnTime,
  isEarlyCompletion,
  overdueDays,
} from "../lib/sla.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isPMOrAdmin(userId, task) {
  const wsOwner = task.project.workspace?.ownerId === userId;
  const wsAdmin = task.project.workspace?.members?.some(
    (m) => m.userId === userId && m.role === 'ADMIN'
  );
  const projManager = task.project.members.some(
    (m) => m.userId === userId && (m.role === 'OWNER' || m.role === 'MANAGER')
  );
  const isProjectOwner = task.project.ownerId === userId;
  return wsOwner || wsAdmin || projManager || isProjectOwner;
}

function requirePMOrAdmin(userId, task) {
  if (!isPMOrAdmin(userId, task)) {
    throw new AuthorizationError('Only PM or workspace admin can perform this action');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBMIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function submitTask(taskId, userId, body) {
  const { completionNotes, completionPhotos, declaration } = body;

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  if (task.assigneeId !== userId) {
    throw new AuthorizationError('Only the task assignee can submit for approval');
  }

  if (task.slaStatus === SLA_STATUS.RESOLVED_ON_TIME || task.slaStatus === SLA_STATUS.RESOLVED_LATE) {
    throw new ValidationError('Task is already resolved');
  }
  if (task.slaStatus === SLA_STATUS.PENDING_APPROVAL) {
    throw new ValidationError('Task is already pending approval');
  }
  if (!completionNotes || completionNotes.trim().length < 20) {
    throw new ValidationError('Completion notes must be at least 20 characters');
  }
  if (!completionPhotos || !Array.isArray(completionPhotos) || completionPhotos.length < 1) {
    throw new ValidationError('At least one completion photo is required');
  }
  if (!declaration) {
    throw new ValidationError('You must confirm the declaration to submit');
  }

  const now = new Date();

  const updated = await slaRepo.updateTaskWithIncludes(taskId, {
    submittedAt: now,
    submittedById: userId,
    slaStatus: SLA_STATUS.PENDING_APPROVAL,
    status: 'PENDING_APPROVAL',
    completionNotes: completionNotes.trim(),
    completionPhotos,
    declarationConfirmed: true,
    ...pauseClockData(now),
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(task.projectId));

  await logSlaEvent(prisma, { taskId, type: SLA_EVENT_TYPE.SUBMITTED, triggeredBy: userId });

  if (task.rejectedAt) {
    await updateContractorScore(prisma, userId, taskId, 'RESUBMIT_RECOVERY');
  }

  const assigneeName = updated.assignee?.name || 'Assignee';
  await slaRepo.createSystemComment(
    taskId,
    `⏳ [System] @${assigneeName} submitted this task for approval\n📝 Notes: ${completionNotes.trim()}\n📸 ${completionPhotos.length} photo(s) attached\n✅ Declaration confirmed`,
    userId
  );

  await inngest.send({
    name: 'follo/task.submitted',
    data: {
      taskId, taskTitle: updated.title, projectId: updated.projectId,
      projectName: updated.project.name, assigneeId: userId, assigneeName,
      isLate: task.dueDate ? now > new Date(task.dueDate) : false,
    },
  });

  io.to(`project:${task.projectId}`).emit('task_updated', {
    task: updated, projectId: task.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: 'Task submitted for approval' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APPROVE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function approveTask(taskId, userId) {
  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  requirePMOrAdmin(userId, task);

  if (task.slaStatus === SLA_STATUS.RESOLVED_ON_TIME || task.slaStatus === SLA_STATUS.RESOLVED_LATE) {
    throw new ValidationError('Task is already resolved');
  }

  const now = new Date();
  const onTime = isOnTime(task, now);
  const early = isEarlyCompletion(task, now);
  const finalStatus = onTime ? SLA_STATUS.RESOLVED_ON_TIME : SLA_STATUS.RESOLVED_LATE;
  const clockData = stopClockData(task, now);

  const updated = await slaRepo.updateTaskWithIncludes(taskId, {
    approvedAt: now, approvedById: userId,
    slaStatus: finalStatus, status: 'DONE',
    actualEndDate: task.actualEndDate || now,
    ...clockData,
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(updated.projectId));

  await logSlaEvent(prisma, { taskId, type: SLA_EVENT_TYPE.APPROVED, triggeredBy: userId, metadata: { onTime, early } });

  if (early) {
    await updateContractorScore(prisma, task.assigneeId, taskId, 'EARLY_COMPLETION');
  } else if (onTime) {
    await updateContractorScore(prisma, task.assigneeId, taskId, 'ON_TIME_APPROVAL');
  }

  if (onTime) {
    await slaRepo.incrementOnTimeCount(taskId);
  }

  const approverUser = await slaRepo.findUserById(userId);
  const approverName = approverUser?.name || 'Admin';
  const lateDays = overdueDays(task, now);
  const timeMsg = onTime ? 'on time' : `${lateDays} day${lateDays !== 1 ? 's' : ''} late`;

  await slaRepo.createSystemComment(taskId, `✅ [System] Task approved by @${approverName}. Completed ${timeMsg}`, userId);

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId, type: 'TASK_APPROVED', title: 'Task approved',
      message: `"${updated.title}" approved by ${approverName} — ${timeMsg}`,
      metadata: { taskId, projectId: updated.projectId },
      url: `/projects/${updated.projectId}/tasks/${taskId}`,
    });
  }

  await inngest.send({
    name: 'follo/task.approved',
    data: {
      taskId, taskTitle: updated.title, projectId: updated.projectId,
      projectName: updated.project.name, assigneeId: task.assigneeId,
      assigneeName: updated.assignee?.name, onTime,
    },
  });

  io.to(`project:${updated.projectId}`).emit('task_updated', {
    task: updated, projectId: updated.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: `Task approved — ${timeMsg}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REJECT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function rejectTask(taskId, userId, body) {
  const { reason } = body;
  if (!reason || !reason.trim()) throw new ValidationError('Rejection reason is required');

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  requirePMOrAdmin(userId, task);

  const now = new Date();
  const clockData = resumeClockData(task, now);
  const newSlaStatus = (task.dueDate && now > new Date(task.dueDate)) ? SLA_STATUS.BREACHED : SLA_STATUS.HEALTHY;

  const updated = await slaRepo.updateTaskWithIncludes(taskId, {
    rejectedAt: now, rejectedById: userId,
    rejectionReason: reason.trim(), submittedAt: null,
    slaStatus: newSlaStatus, status: 'IN_PROGRESS',
    ...clockData,
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(updated.projectId));

  await logSlaEvent(prisma, { taskId, type: SLA_EVENT_TYPE.REJECTED, triggeredBy: userId, metadata: { reason: reason.trim() } });
  await updateContractorScore(prisma, task.assigneeId, taskId, 'REJECTION');

  const rejecterUser = await slaRepo.findUserById(userId);
  const rejecterName = rejecterUser?.name || 'Admin';
  await slaRepo.createSystemComment(taskId, `❌ [System] Task rejected by @${rejecterName}. Reason: ${reason.trim()}`, userId);

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId, type: 'TASK_UPDATED', title: 'Task rejected',
      message: `"${updated.title}" rejected by ${rejecterName}: ${reason.trim()}`,
      metadata: { taskId, projectId: updated.projectId, reason: reason.trim() },
      url: `/projects/${updated.projectId}/tasks/${taskId}`,
    });
  }

  await inngest.send({
    name: 'follo/task.rejected',
    data: {
      taskId, taskTitle: updated.title, projectId: updated.projectId,
      projectName: updated.project.name, assigneeId: task.assigneeId,
      assigneeName: updated.assignee?.name, assigneeEmail: updated.assignee?.email,
      reason: reason.trim(),
    },
  });

  io.to(`project:${updated.projectId}`).emit('task_updated', {
    task: updated, projectId: updated.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: 'Task rejected' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RAISE BLOCKER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function raiseBlocker(taskId, userId, body) {
  const { description, mediaUrl, blockedByTaskId } = body;
  if (!description || !description.trim()) throw new ValidationError('Blocker description is required');

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  if (task.assigneeId !== userId) {
    throw new AuthorizationError('Only the task assignee can raise a blocker');
  }
  if (task.requiresPhotoOnBlock && !mediaUrl) {
    throw new ValidationError('Photo/media is required when raising a blocker on this task');
  }
  if (task.slaStatus === SLA_STATUS.BLOCKED) {
    throw new ValidationError('Task already has an active blocker');
  }

  const now = new Date();

  const updated = await slaRepo.updateTaskWithIncludes(taskId, {
    blockerRaisedAt: now, blockerRaisedById: userId,
    blockerDescription: description.trim(),
    slaStatus: SLA_STATUS.BLOCKED, status: 'BLOCKED',
    ...pauseClockData(now),
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(updated.projectId));

  await logSlaEvent(prisma, {
    taskId, type: SLA_EVENT_TYPE.BLOCKER_RAISED, triggeredBy: userId,
    metadata: { description: description.trim(), mediaUrl, blockedByTaskId },
  });

  await updateContractorScore(prisma, userId, taskId, 'BLOCKED_EXEMPT');

  const assigneeName = updated.assignee?.name || 'Assignee';
  let commentContent = `🚧 [BLOCKER] @${assigneeName} raised a quality blocker\nDescription: ${description.trim()}`;
  if (mediaUrl) commentContent += `\n📸 Media attached`;
  commentContent += `\nSLA clock paused ⏸️`;
  await slaRepo.createSystemComment(taskId, commentContent, userId);

  const pmAdminIds = [
    ...updated.project?.workspace?.members?.filter(m => m.role === 'ADMIN').map(m => m.userId) || [],
    ...task.project.members.filter(m => m.role === 'OWNER' || m.role === 'MANAGER').map(m => m.userId) || [],
  ].filter(id => id !== userId);
  createBulkNotifications([...new Set(pmAdminIds)], {
    type: 'BLOCKER_RAISED', title: 'Blocker raised',
    message: `${assigneeName} raised a blocker on "${updated.title}"`,
    metadata: { taskId, projectId: updated.projectId, description: description.trim() },
    url: `/projects/${updated.projectId}/tasks/${taskId}`,
  });

  await inngest.send({
    name: 'follo/blocker.raised',
    data: {
      taskId, taskTitle: updated.title, projectId: updated.projectId,
      projectName: updated.project.name, assigneeId: userId, assigneeName,
      description: description.trim(), mediaUrl, blockedByTaskId,
    },
  });

  io.to(`project:${updated.projectId}`).emit('task_updated', {
    task: updated, projectId: updated.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: 'Blocker raised — SLA clock paused' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESOLVE BLOCKER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function resolveBlocker(taskId, userId, body) {
  const { resolution, note, newTask } = body;

  const validResolutions = ['REMEDIATE', 'NEW_TASK', 'OVERRIDE'];
  if (!resolution || !validResolutions.includes(resolution)) {
    throw new ValidationError(`resolution must be one of: ${validResolutions.join(', ')}`);
  }
  if (!note || !note.trim()) throw new ValidationError('Resolution note is required');

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  requirePMOrAdmin(userId, task);

  if (task.slaStatus !== SLA_STATUS.BLOCKED) {
    throw new ValidationError('Task does not have an active blocker');
  }

  const now = new Date();
  const clockData = resumeClockData(task, now);
  const newSlaStatus = (task.dueDate && now > new Date(task.dueDate))
    ? SLA_STATUS.BREACHED
    : calculateSlaStatus({ ...task, slaStatus: SLA_STATUS.HEALTHY });

  const updated = await slaRepo.updateTaskWithIncludes(taskId, {
    blockerResolvedAt: now, blockerResolvedById: userId,
    blockerRaisedAt: null, blockerDescription: null,
    slaStatus: newSlaStatus, status: 'IN_PROGRESS',
    ...clockData,
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(updated.projectId));

  await logSlaEvent(prisma, {
    taskId, type: SLA_EVENT_TYPE.BLOCKER_RESOLVED, triggeredBy: userId,
    metadata: { resolution, note: note.trim() },
  });

  if (resolution === 'NEW_TASK' && newTask) {
    const { title, description: desc, assigneeId, dueDate } = newTask;
    if (title && assigneeId) {
      await slaRepo.createRemediationTask({
        title: `[Remediation] ${title}`,
        description: desc || `Remediation task created from blocker on "${task.title}"`,
        projectId: task.projectId, assigneeId, createdById: userId,
        dueDate: dueDate ? new Date(dueDate) : new Date(task.dueDate),
        status: 'TODO', priority: 'HIGH',
      });
    }
  }

  const resolverUser = await slaRepo.findUserById(userId);
  const resolverName = resolverUser?.name || 'Admin';
  await slaRepo.createSystemComment(
    taskId,
    `✅ [System] Blocker resolved by @${resolverName}. Resolution: ${resolution}. ${note.trim()}\nSLA clock resumed ▶️`,
    userId
  );

  await inngest.send({
    name: 'follo/blocker.resolved',
    data: {
      taskId, taskTitle: updated.title, projectId: updated.projectId,
      projectName: updated.project.name, assigneeId: task.assigneeId,
      assigneeName: updated.assignee?.name, assigneeEmail: updated.assignee?.email,
      resolution, note: note.trim(),
    },
  });

  io.to(`project:${updated.projectId}`).emit('task_updated', {
    task: updated, projectId: updated.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: `Blocker resolved — SLA clock resumed (${resolution})` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET SLA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getTaskSla(taskId, userId) {
  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  const isWs = task.project.workspace?.members?.some((m) => m.userId === userId);
  const isProj = task.project.members.some((m) => m.userId === userId);
  const isOwner = task.project.ownerId === userId;
  if (!isWs && !isProj && !isOwner) {
    throw new AuthorizationError('Not authorized to view this task');
  }

  const events = await slaRepo.findSlaEvents(taskId);
  const contractorScore = task.assigneeId ? await slaRepo.findContractorScore(task.assigneeId) : null;

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const now = new Date();

  return {
    slaStatus: task.slaStatus,
    netElapsedMs: calculateNetElapsedMs(task),
    dueDate: task.dueDate,
    isOverdue: due ? now > due : false,
    overdueDays: overdueDays(task, now),
    events,
    contractorScore,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST MORE INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function requestMoreInfo(taskId, userId, body) {
  const { question } = body;
  if (!question || !question.trim()) throw new ValidationError('A question is required');

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  requirePMOrAdmin(userId, task);

  const pmUser = await slaRepo.findUserById(userId);
  const pmName = pmUser?.name || 'PM';
  await slaRepo.createSystemComment(taskId, `❓ [Request for Info] @${pmName} asks: ${question.trim()}`, userId);

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId, type: 'TASK_UPDATED', title: 'More info requested',
      message: `${pmName} asked: "${question.trim().slice(0, 80)}"`,
      metadata: { taskId, projectId: task.projectId },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    });
  }

  io.to(`project:${task.projectId}`).emit('task_updated', {
    task: { ...task, _commentRefresh: true }, projectId: task.projectId, lastUpdatedById: userId,
  });

  return { data: { asked: true }, message: 'Question posted to task discussion' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST EXTENSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function requestExtension(taskId, userId, body) {
  const { reason, proposedDate } = body;
  if (!reason || !reason.trim()) throw new ValidationError('Extension reason is required');
  if (!proposedDate) throw new ValidationError('Proposed new deadline is required');

  const proposed = new Date(proposedDate);
  if (isNaN(proposed.getTime())) throw new ValidationError('Invalid proposed date');

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  if (task.assigneeId !== userId) {
    throw new AuthorizationError('Only the assignee can request a deadline extension');
  }
  if (task.extensionStatus === 'PENDING') {
    throw new ValidationError('An extension request is already pending');
  }

  const updated = await slaRepo.updateTask(taskId, {
    extensionStatus: 'PENDING',
    extensionRequestedAt: new Date(),
    extensionRequestedById: userId,
    extensionReason: reason.trim(),
    extensionProposedDate: proposed,
    extensionOriginalDueDate: task.extensionOriginalDueDate || task.dueDate,
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(task.projectId));

  await logSlaEvent(taskId, SLA_EVENT_TYPE.EXTENSION_REQUESTED || 'EXTENSION_REQUESTED', userId, {
    reason: reason.trim(),
    proposedDate: proposed.toISOString(),
    currentDueDate: task.dueDate?.toISOString(),
  });

  const assigneeName = task.assignee?.name || 'Assignee';
  await slaRepo.createSystemComment(
    taskId,
    `📅 [Extension Request] ${assigneeName} requested a deadline extension to ${proposed.toLocaleDateString()}. Reason: ${reason.trim()}`,
    userId
  );

  const pmIds = task.project.workspace?.members?.filter(m => m.role === 'ADMIN').map(m => m.userId) || [];
  const projPmIds = task.project.members?.filter(m => m.role === 'OWNER' || m.role === 'MANAGER').map(m => m.userId) || [];
  const allPmIds = [...new Set([...pmIds, ...projPmIds, task.project.ownerId].filter(Boolean))];

  for (const pmId of allPmIds) {
    createNotification({
      userId: pmId, type: 'TASK_UPDATED', title: 'Extension requested',
      message: `${assigneeName} requested an extension for "${task.title}"`,
      metadata: { taskId, projectId: task.projectId },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    });
  }

  io.to(`project:${task.projectId}`).emit('task_updated', {
    task: updated, projectId: task.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: 'Extension request submitted' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APPROVE EXTENSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function approveExtension(taskId, userId) {
  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  requirePMOrAdmin(userId, task);

  if (task.extensionStatus !== 'PENDING') {
    throw new ValidationError('No pending extension request to approve');
  }

  const updated = await slaRepo.updateTask(taskId, {
    extensionStatus: 'APPROVED',
    extensionApprovedAt: new Date(),
    extensionApprovedById: userId,
    dueDate: task.extensionProposedDate,
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(task.projectId));

  await logSlaEvent(taskId, SLA_EVENT_TYPE.EXTENSION_APPROVED || 'EXTENSION_APPROVED', userId, {
    newDueDate: task.extensionProposedDate?.toISOString(),
    originalDueDate: task.extensionOriginalDueDate?.toISOString(),
  });

  const pmUser = await slaRepo.findUserById(userId);
  const pmName = pmUser?.name || 'PM';
  await slaRepo.createSystemComment(
    taskId,
    `✅ [Extension Approved] ${pmName} approved the deadline extension. New deadline: ${task.extensionProposedDate?.toLocaleDateString()}`,
    userId
  );

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId, type: 'TASK_UPDATED', title: 'Extension approved',
      message: `Your extension request for "${task.title}" was approved. New deadline: ${task.extensionProposedDate?.toLocaleDateString()}`,
      metadata: { taskId, projectId: task.projectId },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    });
  }

  io.to(`project:${task.projectId}`).emit('task_updated', {
    task: updated, projectId: task.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: 'Extension approved — deadline updated' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DENY EXTENSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function denyExtension(taskId, userId, body) {
  const { reason } = body;

  const task = await slaRepo.findTaskWithAccess(taskId);
  if (!task) throw new NotFoundError('Task');

  requirePMOrAdmin(userId, task);

  if (task.extensionStatus !== 'PENDING') {
    throw new ValidationError('No pending extension request to deny');
  }

  const updated = await slaRepo.updateTask(taskId, {
    extensionStatus: 'DENIED',
    extensionDeniedAt: new Date(),
    extensionDeniedById: userId,
  });

  // FOLLO INSTANT: bust task + project task list caches
  invalidateCache(CACHE_KEYS.task(taskId));
  invalidateCache(CACHE_KEYS.projectTasks(task.projectId));

  await logSlaEvent(taskId, SLA_EVENT_TYPE.EXTENSION_DENIED || 'EXTENSION_DENIED', userId, {
    reason: reason?.trim() || 'No reason provided',
  });

  const pmUser = await slaRepo.findUserById(userId);
  const pmName = pmUser?.name || 'PM';
  await slaRepo.createSystemComment(
    taskId,
    `❌ [Extension Denied] ${pmName} denied the deadline extension.${reason?.trim() ? ` Reason: ${reason.trim()}` : ''}`,
    userId
  );

  if (task.assigneeId) {
    createNotification({
      userId: task.assigneeId, type: 'TASK_UPDATED', title: 'Extension denied',
      message: `Your extension request for "${task.title}" was denied${reason?.trim() ? `: ${reason.trim().slice(0, 80)}` : ''}`,
      metadata: { taskId, projectId: task.projectId },
      url: `/projects/${task.projectId}/tasks/${taskId}`,
    });
  }

  io.to(`project:${task.projectId}`).emit('task_updated', {
    task: updated, projectId: task.projectId, lastUpdatedById: userId,
  });

  return { data: updated, message: 'Extension request denied' };
}
