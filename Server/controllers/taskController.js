/**
 * Task Controller
 * Handles task CRUD, dependencies, comments, and activity tracking
 */

import prisma from "../configs/prisma.js";
import {
  asyncHandler,
  NotFoundError,
  ConflictError,
  AuthorizationError,
  ValidationError,
} from "../utils/errors.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../utils/response.js";
import { 
  TASK_STATUS,
  ACTIVITY_TYPE,
  ERROR_CODES,
  LIMITS,
} from "../utils/constants.js";
import emailService from "../utils/emailService.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate delay information for a task
 */
const calculateDelay = (task) => {
  if (!task.plannedEndDate) return { isDelayed: false, delayDays: 0 };
  
  const now = new Date();
  const plannedEnd = new Date(task.plannedEndDate);
  const actualEnd = task.actualEndDate ? new Date(task.actualEndDate) : null;
  
  // If completed, check if it was late
  if (task.status === TASK_STATUS.COMPLETED && actualEnd) {
    const delayDays = Math.ceil((actualEnd - plannedEnd) / (1000 * 60 * 60 * 24));
    return { isDelayed: delayDays > 0, delayDays: Math.max(0, delayDays) };
  }
  
  // If not completed, check if overdue
  if (task.status !== TASK_STATUS.COMPLETED && now > plannedEnd) {
    const delayDays = Math.ceil((now - plannedEnd) / (1000 * 60 * 60 * 24));
    return { isDelayed: true, delayDays };
  }
  
  return { isDelayed: false, delayDays: 0 };
};

/**
 * Log task activity
 */
const logActivity = async (taskId, userId, type, description, oldValue = null, newValue = null) => {
  return prisma.taskActivity.create({
    data: {
      taskId,
      userId,
      type,
      description,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
};

/**
 * Check for circular dependencies
 */
const hasCircularDependency = async (taskId, predecessorId, visited = new Set()) => {
  if (taskId === predecessorId) return true;
  if (visited.has(predecessorId)) return false;
  
  visited.add(predecessorId);
  
  const predecessors = await prisma.taskDependency.findMany({
    where: { successorId: predecessorId },
    select: { predecessorId: true },
  });
  
  for (const dep of predecessors) {
    if (await hasCircularDependency(taskId, dep.predecessorId, visited)) {
      return true;
    }
  }
  
  return false;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get all tasks in a project
 * GET /api/v1/tasks/project/:projectId
 */
export const getProjectTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();

  // Get project with access check
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { 
      workspace: { include: { members: true } },
      members: true,
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to view tasks in this project',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: true,
      createdBy: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 3, // Only latest 3 comments
      },
      predecessors: {
        include: { predecessor: { select: { id: true, title: true, status: true } } },
      },
      successors: {
        include: { successor: { select: { id: true, title: true, status: true } } },
      },
      _count: { select: { comments: true, activities: true } },
    },
    orderBy: [
      { priority: 'desc' },
      { plannedEndDate: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // Add delay info to each task
  const tasksWithDelay = tasks.map(task => ({
    ...task,
    ...calculateDelay(task),
  }));

  sendSuccess(res, tasksWithDelay);
});

/**
 * Get single task by ID
 * GET /api/v1/tasks/:taskId
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: true,
      createdBy: true,
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
      comments: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
      predecessors: {
        include: { 
          predecessor: { 
            select: { id: true, title: true, status: true, assignee: true, plannedEndDate: true } 
          } 
        },
      },
      successors: {
        include: { 
          successor: { 
            select: { id: true, title: true, status: true, assignee: true, plannedStartDate: true } 
          } 
        },
      },
      activities: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to view this task',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  sendSuccess(res, { ...task, ...calculateDelay(task) });
});

/**
 * Create a new task
 * POST /api/v1/tasks/project/:projectId
 * Body: { title, description?, status?, priority?, type?, due_date?, plannedStartDate?, plannedEndDate?, assigneeId? }
 */
export const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const { 
    title, description, priority, status, type,
    due_date, plannedStartDate, plannedEndDate, assigneeId 
  } = req.body;

  console.log('[createTask] Request:', { projectId, userId, assigneeId, title });

  // Get project with access check
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { 
      workspace: { include: { members: true } },
      members: true,
      _count: { select: { tasks: true } },
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  console.log('[createTask] Project found:', project.name, 'workspace members:', project.workspace?.members?.length, 'project members:', project.members?.length);

  // Check access
  const isWorkspaceMember = project.workspace?.members?.some(m => m.userId === userId) || false;
  const isProjectMember = project.members.some(m => m.userId === userId);
  
  console.log('[createTask] Access check:', { isWorkspaceMember, isProjectMember, userId });
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to create tasks in this project',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Check task limit
  if (project._count.tasks >= LIMITS.MAX_TASKS_PER_PROJECT) {
    throw new ConflictError(
      `Maximum ${LIMITS.MAX_TASKS_PER_PROJECT} tasks per project`,
      ERROR_CODES.LIMIT_EXCEEDED
    );
  }

  // Validate required fields
  if (!assigneeId) {
    throw new ValidationError('Assignee is required', ERROR_CODES.VALIDATION_ERROR);
  }

  // Validate assignee exists
  const assigneeUser = await prisma.user.findUnique({
    where: { id: assigneeId },
  });
  if (!assigneeUser) {
    throw new ValidationError(`Assignee user not found: ${assigneeId}`, ERROR_CODES.VALIDATION_ERROR);
  }

  // Validate creator exists
  const creatorUser = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!creatorUser) {
    throw new ValidationError(`Creator user not found: ${userId}`, ERROR_CODES.VALIDATION_ERROR);
  }

  // Determine dueDate - use due_date if provided, otherwise use plannedEndDate
  const finalDueDate = due_date ? new Date(due_date) : 
                       plannedEndDate ? new Date(plannedEndDate) : null;
  
  if (!finalDueDate) {
    throw new ValidationError('Due date or end date is required', ERROR_CODES.VALIDATION_ERROR);
  }

  // Create task
  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      priority: priority || 'MEDIUM',
      status: status || 'TODO',
      type: type || 'TASK',
      dueDate: finalDueDate,
      plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : finalDueDate,
      projectId,
      assigneeId,
      createdById: userId,
    },
    include: {
      assignee: true,
      createdBy: true,
      project: true,
    },
  });

  // Log activity
  await logActivity(task.id, userId, ACTIVITY_TYPE.TASK_CREATED, `Created task "${title}"`);

  // Send task assignment email (non-blocking)
  if (task.assignee && task.assignee.email && task.assignee.id !== userId) {
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    }) : null;
    
    emailService.sendTaskAssigned({
      to: task.assignee.email,
      assigneeName: task.assignee.name || 'there',
      taskTitle: task.title,
      projectName: task.project.name,
      dueDate: formatDate(task.dueDate),
      assignerName: task.createdBy?.name,
      priority: task.priority,
    }).catch(err => console.error('[Email] Failed to send task assignment:', err));
  }

  sendCreated(res, task, 'Task created successfully');
});

/**
 * Update a task
 * PATCH /api/v1/tasks/:taskId
 */
export const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { 
    title, description, priority, status, type,
    due_date, plannedStartDate, plannedEndDate, 
    actualStartDate, actualEndDate,
    assigneeId, delayReason
  } = req.body;

  // Get task with access check
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to update this task',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Track changes for activity log
  const changes = [];
  
  if (status && status !== task.status) {
    changes.push({ field: 'status', old: task.status, new: status });
  }
  if (assigneeId !== undefined && assigneeId !== task.assigneeId) {
    changes.push({ field: 'assignee', old: task.assigneeId, new: assigneeId });
  }
  if (priority && priority !== task.priority) {
    changes.push({ field: 'priority', old: task.priority, new: priority });
  }

  // Build update data
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
  };

  // Auto-set actualStartDate when status changes to IN_PROGRESS
  if (status === TASK_STATUS.IN_PROGRESS && !task.actualStartDate && !actualStartDate) {
    updateData.actualStartDate = new Date();
  }

  // Auto-set actualEndDate when status changes to COMPLETED
  if (status === TASK_STATUS.COMPLETED && !task.actualEndDate && !actualEndDate) {
    updateData.actualEndDate = new Date();
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      assignee: true,
      createdBy: true,
      project: true,
      predecessors: { include: { predecessor: true } },
      successors: { include: { successor: true } },
    },
  });

  // Calculate delay
  const delayInfo = calculateDelay(updatedTask);
  if (delayInfo.isDelayed) {
    await prisma.task.update({
      where: { id: taskId },
      data: { isDelayed: true, delayDays: delayInfo.delayDays },
    });
  }

  // Log activity for status changes
  for (const change of changes) {
    let activityType = ACTIVITY_TYPE.TASK_UPDATED;
    let description = `Updated ${change.field}`;
    
    if (change.field === 'status') {
      activityType = ACTIVITY_TYPE.STATUS_CHANGED;
      description = `Changed status from ${change.old} to ${change.new}`;
    } else if (change.field === 'assignee') {
      activityType = ACTIVITY_TYPE.ASSIGNEE_CHANGED;
      description = change.new ? 'Task assigned' : 'Task unassigned';
      
      // Send email to new assignee (non-blocking)
      if (change.new && change.new !== userId) {
        const newAssignee = await prisma.user.findUnique({ where: { id: change.new } });
        if (newAssignee?.email) {
          const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric' 
          }) : null;
          
          const assigner = await prisma.user.findUnique({ where: { id: userId } });
          emailService.sendTaskAssigned({
            to: newAssignee.email,
            assigneeName: newAssignee.name || 'there',
            taskTitle: updatedTask.title,
            projectName: updatedTask.project.name,
            dueDate: formatDate(updatedTask.dueDate),
            assignerName: assigner?.name,
            priority: updatedTask.priority,
          }).catch(err => console.error('[Email] Failed to send task reassignment:', err));
        }
      }
    }
    
    await logActivity(taskId, userId, activityType, description, change.old, change.new);
  }

  sendSuccess(res, { ...updatedTask, ...delayInfo });
});

/**
 * Delete a task
 * DELETE /api/v1/tasks/:taskId
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to delete this task',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Cascading delete handled by schema
  await prisma.task.delete({ where: { id: taskId } });

  sendNoContent(res);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK DEPENDENCIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Add a dependency to a task
 * POST /api/v1/tasks/:taskId/dependencies
 * Body: { predecessorId, lagDays? }
 */
export const addTaskDependency = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { predecessorId, lagDays = 0 } = req.body;

  if (!predecessorId) {
    throw new ValidationError('predecessorId is required');
  }

  if (taskId === predecessorId) {
    throw new ValidationError('A task cannot depend on itself');
  }

  // Get both tasks
  const [successor, predecessor] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: { include: { members: true } },
            members: true,
          },
        },
      },
    }),
    prisma.task.findUnique({ where: { id: predecessorId } }),
  ]);

  if (!successor) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  if (!predecessor) {
    throw new NotFoundError('Predecessor task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Must be in same project
  if (successor.projectId !== predecessor.projectId) {
    throw new ValidationError('Dependencies must be within the same project');
  }

  // Check access
  const isWorkspaceMember = successor.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = successor.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to manage task dependencies',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Check for circular dependency
  if (await hasCircularDependency(taskId, predecessorId)) {
    throw new ValidationError('This would create a circular dependency');
  }

  // Check if dependency already exists
  const existing = await prisma.taskDependency.findFirst({
    where: { successorId: taskId, predecessorId },
  });

  if (existing) {
    throw new ConflictError('Dependency already exists', ERROR_CODES.ALREADY_EXISTS);
  }

  // Create dependency
  const dependency = await prisma.taskDependency.create({
    data: {
      successorId: taskId,
      predecessorId,
      lagDays: lagDays || 0,
    },
    include: {
      predecessor: { select: { id: true, title: true, status: true } },
      successor: { select: { id: true, title: true, status: true } },
    },
  });

  // Log activity
  await logActivity(
    taskId, 
    userId, 
    ACTIVITY_TYPE.DEPENDENCY_ADDED, 
    `Added dependency on "${predecessor.title}"`,
    null,
    { predecessorId, title: predecessor.title }
  );

  sendCreated(res, dependency, 'Dependency added');
});

/**
 * Remove a dependency from a task
 * DELETE /api/v1/tasks/:taskId/dependencies/:dependencyId
 */
export const removeTaskDependency = asyncHandler(async (req, res) => {
  const { taskId, dependencyId } = req.params;
  const { userId } = await req.auth();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to manage task dependencies',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Find and delete dependency
  const dependency = await prisma.taskDependency.findUnique({
    where: { id: dependencyId },
    include: { predecessor: true },
  });

  if (!dependency || dependency.successorId !== taskId) {
    throw new NotFoundError('Dependency not found', ERROR_CODES.NOT_FOUND);
  }

  await prisma.taskDependency.delete({ where: { id: dependencyId } });

  // Log activity
  await logActivity(
    taskId, 
    userId, 
    ACTIVITY_TYPE.DEPENDENCY_REMOVED, 
    `Removed dependency on "${dependency.predecessor.title}"`
  );

  sendNoContent(res);
});

/**
 * Get all dependencies for a task
 * GET /api/v1/tasks/:taskId/dependencies
 */
export const getTaskDependencies = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
      predecessors: {
        include: { 
          predecessor: { 
            include: { assignee: true },
          } 
        },
      },
      successors: {
        include: { 
          successor: { 
            include: { assignee: true },
          } 
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to view task dependencies',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  sendSuccess(res, {
    predecessors: task.predecessors,
    successors: task.successors,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK COMMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Add comment to task
 * POST /api/v1/tasks/:taskId/comments
 * Body: { content }
 */
export const addTaskComment = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    throw new ValidationError('Comment content is required');
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to comment on this task',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      taskId,
      userId,
    },
    include: { user: true },
  });

  // Log activity
  await logActivity(taskId, userId, ACTIVITY_TYPE.COMMENT_ADDED, 'Added a comment');

  sendCreated(res, comment, 'Comment added');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK ACTIVITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get activity log for a task
 * GET /api/v1/tasks/:taskId/activities
 */
export const getTaskActivities = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found', ERROR_CODES.TASK_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = task.project.workspace?.members?.some(m => m.userId === userId);
  const isProjectMember = task.project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to view task activities',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const activities = await prisma.taskActivity.findMany({
    where: { taskId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  sendSuccess(res, activities);
});
