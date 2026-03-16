// FOLLO SRP
// FOLLO WORKFLOW
// FOLLO ACCESS
// FOLLO AUTOSTART
/**
 * Task Service
 * Business logic for tasks, dependencies, comments, and activities.
 * Orchestrates repository, cache, email, notifications, realtime, and Inngest.
 */

import * as taskRepo from "../repositories/taskRepository.js";
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
  ValidationError,
} from "../utils/errors.js";
import {
  TASK_STATUS,
  ACTIVITY_TYPE,
  ERROR_CODES,
  LIMITS,
} from "../utils/constants.js";
import emailService from "../utils/emailService.js";
import { createNotification } from "../utils/notificationService.js";
import { withCache, invalidateCache, invalidateCachePattern, CACHE_KEYS, CACHE_TTL } from "../lib/cache.js";
import { requireProjectManager } from "../utils/permissions.js";
import { inngest } from "../inngest/client.js";
import { SLA_EVENT_TYPE, logSlaEvent } from "../lib/sla.js";
import { io } from "../server.js";
import prisma from "../configs/prisma.js";
import { updateTaskPriority, recalculateAfterDependencyChange } from "../lib/priorityCalculator.js";

// FOLLO WORKFLOW — valid status transitions (system-controlled)
const VALID_TRANSITIONS = {
  'TODO':             ['IN_PROGRESS'],
  'IN_PROGRESS':      ['PENDING_APPROVAL', 'BLOCKED'],
  'BLOCKED':          ['IN_PROGRESS'],
  'PENDING_APPROVAL': ['DONE', 'IN_PROGRESS'],
  'DONE':             [],
};

// Invalidate all caches that include task lists for a project/workspace
function invalidateTaskCaches(projectId, workspaceId) {
  invalidateCache(CACHE_KEYS.projectTasks(projectId));
  invalidateCache(CACHE_KEYS.workspaceProjects(workspaceId));
  // User-level caches are keyed by userId which we don't always have here,
  // so invalidate all user workspace/project caches by prefix
  invalidateCachePattern('workspaces:');
  invalidateCachePattern('myprojects:');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const calculateDelay = (task) => {
  if (!task.plannedEndDate) return { isDelayed: false, delayDays: 0 };

  const now = new Date();
  const plannedEnd = new Date(task.plannedEndDate);
  const actualEnd = task.actualEndDate ? new Date(task.actualEndDate) : null;

  if (task.status === TASK_STATUS.COMPLETED && actualEnd) {
    const delayDays = Math.ceil((actualEnd - plannedEnd) / (1000 * 60 * 60 * 24));
    return { isDelayed: delayDays > 0, delayDays: Math.max(0, delayDays) };
  }

  if (task.status !== TASK_STATUS.COMPLETED && now > plannedEnd) {
    const delayDays = Math.ceil((now - plannedEnd) / (1000 * 60 * 60 * 24));
    return { isDelayed: true, delayDays };
  }

  return { isDelayed: false, delayDays: 0 };
};

const hasCircularDependency = async (taskId, predecessorId, visited = new Set()) => {
  if (taskId === predecessorId) return true;
  if (visited.has(predecessorId)) return false;

  visited.add(predecessorId);

  const predecessors = await taskRepo.findPredecessors(predecessorId);
  for (const dep of predecessors) {
    if (await hasCircularDependency(taskId, dep.predecessorId, visited)) {
      return true;
    }
  }
  return false;
};

function checkTaskAccess(task, userId) {
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to access this task',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }
}

// FOLLO ACCESS: Only workspace admins/owners or project owners/managers can modify dependencies
function checkManagerAccess(task, userId) {
  checkTaskAccess(task, userId);
  const ws = task.project.workspace;
  const isWsAdmin = ws?.ownerId === userId || ws?.members?.some(m => m.userId === userId && m.role === 'ADMIN');
  const isProjManager = task.project.members.some(m => m.userId === userId && (m.role === 'OWNER' || m.role === 'MANAGER'));
  if (!isWsAdmin && !isProjManager) {
    throw new AuthorizationError(
      'Only project managers can modify dependencies',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getProjectTasks(projectId, userId) {
  const project = await taskRepo.findProjectWithAccessInfo(projectId);
  if (!project) throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);

  const wsMember = project.workspace?.members?.find(m => m.userId === userId);
  const isProjectMember = project.members.some(m => m.userId === userId);
  if (!wsMember && !isProjectMember) {
    throw new AuthorizationError('Not authorized to view tasks in this project', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // FOLLO ACCESS: Admins/owners see all tasks; regular members see only their assigned tasks
  const isManager = wsMember?.role === 'ADMIN' || project.workspace?.ownerId === userId
    || project.members.some(m => m.userId === userId && (m.role === 'OWNER' || m.role === 'MANAGER'));

  const tasks = await withCache(
    CACHE_KEYS.projectTasks(projectId),
    CACHE_TTL.TASK_LIST,
    () => taskRepo.findTasksByProject(projectId)
  );

  const filtered = isManager ? tasks : tasks.filter(t => t.assigneeId === userId);

  // FOLLO AUTOSTART — auto-start TODO tasks whose plannedStartDate has arrived
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const autoStartPromises = filtered
    .filter(t => t.status === 'TODO' && t.plannedStartDate &&
      new Date(t.plannedStartDate).setHours(0, 0, 0, 0) <= todayMs)
    .map(async (t) => {
      const now = new Date();

      // Unassigned tasks get auto-blocked instead of auto-started
      if (!t.assigneeId) {
        if (t.slaStatus !== 'BLOCKED') {
          await taskRepo.updateTask(t.id, {
            status: 'BLOCKED',
            slaStatus: 'BLOCKED',
            blockerRaisedAt: now,
            blockerDescription: 'Task blocked — no assignee',
            slaClockPausedAt: now,
          });
          t.status = 'BLOCKED';
          t.slaStatus = 'BLOCKED';
          t.blockerDescription = 'Task blocked — no assignee';
          logSlaEvent(prisma, { taskId: t.id, type: SLA_EVENT_TYPE.BLOCKER_RAISED, triggeredBy: 'system', metadata: { reason: 'unassigned at start date' } })
            .catch(err => console.error('[SLA] auto-block logSlaEvent failed:', err));
        }
        return;
      }

      await taskRepo.updateTask(t.id, {
        status: 'IN_PROGRESS',
        actualStartDate: now,
        slaClockStartedAt: now,
      });
      t.status = 'IN_PROGRESS';
      t.actualStartDate = now;
      logSlaEvent(prisma, { taskId: t.id, type: SLA_EVENT_TYPE.CLOCK_STARTED, triggeredBy: 'system' })
        .catch(err => console.error('[SLA] auto-start logSlaEvent failed:', err));
    });
  if (autoStartPromises.length > 0) {
    await Promise.all(autoStartPromises);
    invalidateCache(CACHE_KEYS.projectTasks(projectId));
  }

  return filtered.map(task => ({ ...task, ...calculateDelay(task) }));
}

export async function getTaskById(taskId, userId) {
  const cacheKey = `task:${taskId}`;

  const task = await withCache(cacheKey, 30, () => taskRepo.findTaskById(taskId));
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError('Not authorized to view this task', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  return { ...task, ...calculateDelay(task) };
}

export async function createTask(projectId, userId, body) {
  const {
    title, description, priority, status, type,
    due_date, plannedStartDate, plannedEndDate, assigneeId,
  } = body;

  const project = await taskRepo.findProjectWithAccessInfo(projectId);
  if (!project) throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);

  const isWorkspaceMember = project.workspace?.members?.some(m => m.userId === userId) || false;
  const isProjectMember = project.members.some(m => m.userId === userId);
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError('Not authorized to create tasks in this project', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  await requireProjectManager(userId, projectId);

  if (project._count.tasks >= LIMITS.MAX_TASKS_PER_PROJECT) {
    throw new ConflictError(`Maximum ${LIMITS.MAX_TASKS_PER_PROJECT} tasks per project`, ERROR_CODES.LIMIT_EXCEEDED);
  }

  let assigneeUser = null;
  if (assigneeId) {
    assigneeUser = await taskRepo.findUserById(assigneeId);
    if (!assigneeUser) throw new ValidationError(`Assignee user not found: ${assigneeId}`, ERROR_CODES.VALIDATION_ERROR);
  }

  const creatorUser = await taskRepo.findUserById(userId);
  if (!creatorUser) throw new ValidationError(`Creator user not found: ${userId}`, ERROR_CODES.VALIDATION_ERROR);

  const finalDueDate = due_date ? new Date(due_date) : plannedEndDate ? new Date(plannedEndDate) : null;
  if (!finalDueDate) throw new ValidationError('Due date or end date is required', ERROR_CODES.VALIDATION_ERROR);

  const autoStart = plannedStartDate &&
    new Date(plannedStartDate).setHours(0,0,0,0) <= new Date().setHours(0,0,0,0);
  // If autostart but no assignee → block instead of starting
  const autoBlock = autoStart && !assigneeId;
  const now = new Date();

  const task = await taskRepo.createTask({
    title,
    description: description || null,
    priority: priority || 'LOW',
    // FOLLO AUTOSTART — if plannedStartDate is today or past, auto-start (or auto-block if unassigned)
    status: autoBlock ? 'BLOCKED' : autoStart ? 'IN_PROGRESS' : 'TODO',
    type: type || 'TASK',
    dueDate: finalDueDate,
    plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
    plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : finalDueDate,
    // FOLLO GANTT-2 — baseline dates (frozen on creation, never updated)
    baselineDueDate:      finalDueDate,
    baselinePlannedStart: plannedStartDate ? new Date(plannedStartDate) : null,
    baselinePlannedEnd:   plannedEndDate ? new Date(plannedEndDate) : finalDueDate,
    ...(autoStart && !autoBlock && { actualStartDate: now, slaClockStartedAt: now }),
    ...(autoBlock && {
      slaStatus: 'BLOCKED',
      blockerRaisedAt: now,
      blockerDescription: 'Task blocked — no assignee',
      slaClockPausedAt: now,
    }),
    projectId,
    ...(assigneeId && { assigneeId }),
    createdById: userId,
  });

  await taskRepo.createActivity(task.id, userId, ACTIVITY_TYPE.TASK_CREATED, `Created task "${title}"`);

  // Invalidate caches so refreshes show the new task
  invalidateTaskCaches(projectId, project.workspaceId);

  // Non-blocking side-effects
  if (task.assignee && task.assignee.email && task.assignee.id !== userId) {
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

    emailService.sendTaskAssigned({
      to: task.assignee.email,
      assigneeName: task.assignee.name || 'there',
      taskTitle: task.title,
      projectName: task.project.name,
      dueDate: formatDate(task.dueDate),
      assignerName: task.createdBy?.name,
      priority: task.priority,
    }).catch(err => console.error('[Email] Failed to send task assignment:', err));

    createNotification({
      userId: task.assignee.id,
      type: 'TASK_ASSIGNED',
      title: 'New task assigned',
      message: `"${task.title}" in ${task.project.name}`,
      metadata: { taskId: task.id, projectId: task.projectId },
      url: `/projects/${task.projectId}/tasks/${task.id}`,
    });
  }

  io.to(`project:${task.projectId}`).emit('task_created', {
    task,
    projectId: task.projectId,
    createdById: userId,
  });

  if (task.plannedStartDate && task.assigneeId) {
    inngest.send({
      name: 'task/start-reminder',
      data: {
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        projectName: task.project?.name,
        assigneeId: task.assigneeId,
        assigneeName: task.assignee?.name,
        assigneeEmail: task.assignee?.email,
        plannedStartDate: task.plannedStartDate.toISOString(),
      },
    }).catch(err => console.error('[Inngest] task/start-reminder send failed:', err));
  }

  // Auto-blocked at creation — notify admins/PMs
  if (autoBlock) {
    inngest.send({
      name: 'blocker/raised',
      data: {
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        projectName: task.project?.name,
        assigneeName: 'System',
        description: 'Task blocked — no assignee',
      },
    }).catch(err => console.error('[Inngest] auto-block blocker/raised failed:', err));
  }

  return task;
}

export async function updateTask(taskId, userId, body) {
  const {
    title, description, priority, status, type,
    due_date, plannedStartDate, plannedEndDate,
    actualStartDate, actualEndDate,
    assigneeId, delayReason, priorityOverride,
  } = body;

  const task = await taskRepo.findTaskWithProject(taskId);
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  checkTaskAccess(task, userId);

  // FOLLO WORKFLOW — enforce valid status transitions
  if (status && status !== task.status) {
    const isAdmin = task.project.workspace?.members?.some(
      m => m.userId === userId && m.role === 'ADMIN'
    );
    // FOLLO AUTOSTART — PENDING_APPROVAL → DONE requires manager/admin approval
    if (task.status === 'PENDING_APPROVAL' && status === 'DONE') {
      const isWsOwner = task.project.workspace?.ownerId === userId;
      const isProjManager = task.project.members.some(
        m => m.userId === userId && (m.role === 'OWNER' || m.role === 'MANAGER')
      );
      if (!isAdmin && !isWsOwner && !isProjManager) {
        throw new AuthorizationError(
          'Only managers or admins can approve task completion'
        );
      }
    } else if (!isAdmin) {
      const allowed = VALID_TRANSITIONS[task.status] ?? [];
      if (!allowed.includes(status)) {
        throw new ValidationError(
          `Invalid transition: ${task.status} → ${status}`
        );
      }
    }
  }

  const sensitiveFields = ['title', 'description', 'dueDate', 'due_date', 'plannedStartDate',
    'plannedEndDate', 'priority', 'assigneeId', 'type'];
  const isUpdatingSensitiveField = sensitiveFields.some(f => body[f] !== undefined);
  if (isUpdatingSensitiveField) {
    await requireProjectManager(userId, task.projectId);
  }

  const changes = [];
  if (status && status !== task.status) changes.push({ field: 'status', old: task.status, new: status });
  if (assigneeId !== undefined && assigneeId !== task.assigneeId) changes.push({ field: 'assignee', old: task.assigneeId, new: assigneeId });
  if (priority && priority !== task.priority) changes.push({ field: 'priority', old: task.priority, new: priority });

  const updateData = {
    ...(title && { title }),
    ...(description !== undefined && { description }),
    ...(priority && { priority }),
    ...(status && { status }),
    ...(type && { type }),
    ...(due_date !== undefined && { dueDate: due_date ? new Date(due_date) : null }),
    ...(plannedStartDate !== undefined && { plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null }),
    ...(plannedEndDate !== undefined && { plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null }),
    ...(actualStartDate !== undefined && { actualStartDate: actualStartDate ? new Date(actualStartDate) : null }),
    ...(actualEndDate !== undefined && { actualEndDate: actualEndDate ? new Date(actualEndDate) : null }),
    ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
    ...(delayReason !== undefined && { delayReason }),
    ...(priorityOverride !== undefined && { priorityOverride }),
  };

  if (status === TASK_STATUS.IN_PROGRESS && !task.actualStartDate && !actualStartDate) {
    const now = new Date();
    updateData.actualStartDate = now;
    updateData.slaClockStartedAt = now;
  }

  if (status === TASK_STATUS.COMPLETED && !task.actualEndDate && !actualEndDate) {
    updateData.actualEndDate = new Date();
  }

  const updatedTask = await taskRepo.updateTask(taskId, updateData);

  invalidateCache(`task:${taskId}`);
  invalidateTaskCaches(task.projectId, task.project.workspaceId);

  // FOLLO WORKFLOW — recalculate priority when status or dueDate changes
  if (status || due_date !== undefined) {
    updateTaskPriority(taskId).catch(err => console.error('[Priority] recalc failed:', err));
  }

  if (status === TASK_STATUS.IN_PROGRESS && !task.actualStartDate && !actualStartDate) {
    logSlaEvent(prisma, {
      taskId,
      type: SLA_EVENT_TYPE.CLOCK_STARTED,
      triggeredBy: userId,
    }).catch(err => console.error('[SLA] logSlaEvent CLOCK_STARTED failed:', err));

    inngest.send({
      name: 'task/started',
      data: {
        taskId,
        taskTitle: updatedTask.title,
        projectId: updatedTask.projectId,
        projectName: updatedTask.project?.name,
        assigneeId: updatedTask.assigneeId,
        assigneeName: updatedTask.assignee?.name,
        dueDate: updatedTask.dueDate?.toISOString(),
      },
    }).catch(err => console.error('[SLA] inngest task/started failed:', err));
  }

  const delayInfo = calculateDelay(updatedTask);
  if (delayInfo.isDelayed) {
    await taskRepo.updateTaskPartial(taskId, { isDelayed: true, delayDays: delayInfo.delayDays });
  }

  for (const change of changes) {
    let activityType = ACTIVITY_TYPE.TASK_UPDATED;
    let activityDescription = `Updated ${change.field}`;

    if (change.field === 'status') {
      activityType = ACTIVITY_TYPE.STATUS_CHANGED;
      activityDescription = `Changed status from ${change.old} to ${change.new}`;
    } else if (change.field === 'assignee') {
      activityType = ACTIVITY_TYPE.ASSIGNEE_CHANGED;
      activityDescription = change.new ? 'Task assigned' : 'Task unassigned';

      if (change.new && change.new !== userId) {
        const newAssignee = await taskRepo.findUserById(change.new);
        if (newAssignee?.email) {
          const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
          const assigner = await taskRepo.findUserById(userId);
          emailService.sendTaskAssigned({
            to: newAssignee.email,
            assigneeName: newAssignee.name || 'there',
            taskTitle: updatedTask.title,
            projectName: updatedTask.project.name,
            dueDate: formatDate(updatedTask.dueDate),
            assignerName: assigner?.name,
            priority: updatedTask.priority,
          }).catch(err => console.error('[Email] Failed to send task reassignment:', err));

          createNotification({
            userId: change.new,
            type: 'TASK_ASSIGNED',
            title: 'Task reassigned to you',
            message: `"${updatedTask.title}" in ${updatedTask.project.name}`,
            metadata: { taskId, projectId: updatedTask.projectId },
            url: `/projects/${updatedTask.projectId}/tasks/${taskId}`,
          });
        }
      }
    }

    await taskRepo.createActivity(taskId, userId, activityType, activityDescription, change.old, change.new);
  }

  const result = { ...updatedTask, ...delayInfo };

  io.to(`project:${updatedTask.projectId}`).emit('task_updated', {
    task: result,
    projectId: updatedTask.projectId,
    lastUpdatedById: userId,
  });

  return result;
}

export async function deleteTask(taskId, userId) {
  const task = await taskRepo.findTaskWithProject(taskId);
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  checkTaskAccess(task, userId);
  await requireProjectManager(userId, task.project.id);

  await taskRepo.deleteTask(taskId);

  // Invalidate caches so refreshes reflect deletion
  invalidateTaskCaches(task.project.id, task.project.workspaceId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEPENDENCIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function addDependency(taskId, userId, body) {
  const { predecessorId, lagDays = 0 } = body;

  if (!predecessorId) throw new ValidationError('predecessorId is required');
  if (taskId === predecessorId) throw new ValidationError('A task cannot depend on itself');

  const [successor, predecessor] = await Promise.all([
    taskRepo.findTaskWithProject(taskId),
    prisma.task.findUnique({ where: { id: predecessorId } }),
  ]);

  if (!successor) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  if (!predecessor) throw new NotFoundError('Predecessor task not found', ERROR_CODES.TASK_NOT_FOUND);

  if (successor.projectId !== predecessor.projectId) {
    throw new ValidationError('Dependencies must be within the same project');
  }

  checkManagerAccess(successor, userId);

  if (await hasCircularDependency(taskId, predecessorId)) {
    throw new ValidationError('This would create a circular dependency');
  }

  const existing = await taskRepo.findExistingDependency(taskId, predecessorId);
  if (existing) throw new ConflictError('Dependency already exists', ERROR_CODES.ALREADY_EXISTS);

  const dependency = await taskRepo.createDependency({
    successorId: taskId,
    predecessorId,
    lagDays: lagDays || 0,
  });

  await taskRepo.createActivity(
    taskId, userId,
    ACTIVITY_TYPE.DEPENDENCY_ADDED,
    `Added dependency on "${predecessor.title}"`,
    null,
    { predecessorId, title: predecessor.title }
  );

  // FOLLO WORKFLOW — recalculate priority for both tasks
  recalculateAfterDependencyChange(taskId, predecessorId)
    .catch(err => console.error('[Priority] dep-add recalc failed:', err));

  return dependency;
}

export async function removeDependency(taskId, dependencyId, userId) {
  const task = await taskRepo.findTaskWithProject(taskId);
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  checkManagerAccess(task, userId);

  const dependency = await taskRepo.findDependencyById(dependencyId);
  if (!dependency || dependency.successorId !== taskId) {
    throw new NotFoundError('Dependency not found', ERROR_CODES.NOT_FOUND);
  }

  await taskRepo.deleteDependency(dependencyId);

  await taskRepo.createActivity(
    taskId, userId,
    ACTIVITY_TYPE.DEPENDENCY_REMOVED,
    `Removed dependency on "${dependency.predecessor.title}"`
  );

  // FOLLO WORKFLOW — recalculate priority for both tasks
  recalculateAfterDependencyChange(taskId, dependency.predecessorId)
    .catch(err => console.error('[Priority] dep-remove recalc failed:', err));
}

export async function getDependencies(taskId, userId) {
  const task = await taskRepo.findTaskWithDependencies(taskId);
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  checkTaskAccess(task, userId);

  return {
    predecessors: task.predecessors,
    successors: task.successors,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function addComment(taskId, userId, body) {
  const {
    content, type = 'TEXT',
    url, fileKey, thumbnailUrl, duration, sizeBytes, fileName,
    muxUploadId, muxAssetId, muxPlaybackId,
  } = body;

  const commentType = (type || 'TEXT').toUpperCase();
  const isMediaComment = ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'].includes(commentType);

  if (!isMediaComment && (!content || String(content).trim().length === 0)) {
    throw new ValidationError('Comment content is required for text comments');
  }
  if (isMediaComment && !url) {
    throw new ValidationError('URL is required for media comments');
  }

  const task = await taskRepo.findTaskWithAssigneeAndProject(taskId);
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  checkTaskAccess(task, userId);

  const commentData = {
    taskId, userId, type: commentType,
    content: content?.trim() || null,
  };

  if (isMediaComment) {
    commentData.url = url;
    if (fileKey) commentData.fileKey = fileKey;
    if (thumbnailUrl) commentData.thumbnailUrl = thumbnailUrl;
    if (duration !== undefined) commentData.duration = duration;
    if (sizeBytes !== undefined) commentData.sizeBytes = sizeBytes;
    if (fileName) commentData.fileName = fileName;
    if (muxUploadId) commentData.muxUploadId = muxUploadId;
    if (muxAssetId) commentData.muxAssetId = muxAssetId;
    if (muxPlaybackId) commentData.muxPlaybackId = muxPlaybackId;
  }

  const comment = await taskRepo.createComment(commentData);

  invalidateCache(`task:${taskId}`);

  // Fire-and-forget side-effects
  const activityMsg = isMediaComment ? `Shared ${commentType.toLowerCase()}` : 'Added a comment';
  taskRepo.createActivity(taskId, userId, ACTIVITY_TYPE.COMMENT_ADDED, activityMsg)
    .catch(err => console.error('[Activity] Failed to log:', err));

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const taskUrl = `${appUrl}/taskDetails?projectId=${task.projectId}&taskId=${taskId}`;

  const recipientMap = new Map();

  if (task.assignee && task.assigneeId !== userId && task.assignee.email) {
    recipientMap.set(task.assigneeId, {
      email: task.assignee.email,
      name: task.assignee.name || 'Team Member',
    });
  }

  taskRepo.findDistinctCommenters(taskId, userId).then(priorComments => {
    for (const c of priorComments) {
      if (c.user?.email && !recipientMap.has(c.userId)) {
        recipientMap.set(c.userId, { email: c.user.email, name: c.user.name || 'Team Member' });
      }
    }

    const recipients = Array.from(recipientMap.values());
    if (recipients.length > 0) {
      emailService.sendBatchCommentNotifications(recipients, {
        commenterName: comment.user?.name || 'A team member',
        taskTitle: task.title,
        projectName: task.project.name,
        commentPreview: content?.trim() || (isMediaComment ? `Shared a ${commentType.toLowerCase()}` : ''),
        taskUrl,
        isMedia: isMediaComment,
      }).catch(err => console.error('[Comment Notification] Error:', err));
    }

    for (const [recipientId] of recipientMap) {
      createNotification({
        userId: recipientId,
        type: 'COMMENT_ADDED',
        title: 'New comment',
        message: `${comment.user?.name || 'Someone'} commented on "${task.title}"`,
        metadata: { taskId, projectId: task.projectId, commentId: comment.id },
        url: `/projects/${task.projectId}/tasks/${taskId}`,
      });
    }
  }).catch(err => console.error('[Comment Notification] Failed to fetch commenters:', err));

  return comment;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function getActivities(taskId, userId) {
  const task = await taskRepo.findTaskWithProject(taskId);
  if (!task) throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);

  checkTaskAccess(task, userId);

  return taskRepo.findActivities(taskId);
}
