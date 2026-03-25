/**
 * Production-grade authorization service
 * Handles permission checks for workspaces, projects, and tasks
 */

import prisma from '../configs/prisma.js';
import { AuthorizationError, NotFoundError } from './errors.js';
import { WORKSPACE_ROLES, PROJECT_ROLES } from './constants.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE AUTHORIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user is a member of workspace
 * @param {string} userId
 * @param {string} workspaceId
 * @returns {Promise<Object>} WorkspaceMember record
 * @throws {AuthorizationError} If user is not a member
 */
export async function requireWorkspaceMember(userId, workspaceId) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
  });

  if (!membership) {
    throw new AuthorizationError('You are not a member of this workspace');
  }

  return membership;
}

/**
 * Check if user is admin of workspace
 * @param {string} userId
 * @param {string} workspaceId
 * @returns {Promise<Object>} WorkspaceMember record
 * @throws {AuthorizationError} If user is not admin
 */
export async function requireWorkspaceAdmin(userId, workspaceId) {
  const membership = await requireWorkspaceMember(userId, workspaceId);

  if (membership.role !== WORKSPACE_ROLES.ADMIN) {
    throw new AuthorizationError('Only workspace admins can perform this action');
  }

  return membership;
}

/**
 * Get user's workspace membership with workspace data
 * @param {string} userId
 * @param {string} workspaceId
 * @returns {Promise<Object|null>} Membership with workspace or null
 */
export async function getWorkspaceMembership(userId, workspaceId) {
  return prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId },
    },
    include: {
      workspace: true,
    },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT AUTHORIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user can access project
 * User can access if:
 * 1. They are the project owner, OR
 * 2. They are a project member, OR
 * 3. They are a workspace admin
 * 
 * @param {string} userId
 * @param {string} projectId
 * @returns {Promise<{project: Object, membership: Object|null, role: string}>}
 * @throws {NotFoundError} If project not found
 * @throws {AuthorizationError} If user cannot access
 */
export async function requireProjectAccess(userId, projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        where: { userId },
      },
      workspace: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundError('Project');
  }

  // Check if user is project owner
  if (project.ownerId === userId) {
    return { 
      project, 
      membership: null, 
      role: PROJECT_ROLES.OWNER 
    };
  }

  // Check if user is an active project member (isActive=false = disabled, treat as no access)
  const projectMembership = project.members[0];
  if (projectMembership && projectMembership.isActive !== false) {
    return {
      project,
      membership: projectMembership,
      role: projectMembership.role
    };
  }

  // Check if user is workspace admin (admins can access all projects)
  const workspaceMembership = project.workspace.members[0];
  if (workspaceMembership?.role === WORKSPACE_ROLES.ADMIN) {
    return { 
      project, 
      membership: workspaceMembership, 
      role: PROJECT_ROLES.MANAGER // Workspace admins get manager access
    };
  }

  throw new AuthorizationError('You do not have access to this project');
}

/**
 * Check if user can manage project (owner, manager, or workspace admin)
 * @param {string} userId
 * @param {string} projectId
 * @returns {Promise<Object>} Project with access info
 * @throws {AuthorizationError} If user cannot manage
 */
export async function requireProjectManager(userId, projectId) {
  const access = await requireProjectAccess(userId, projectId);

  const managerRoles = [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER];
  if (!managerRoles.includes(access.role)) {
    throw new AuthorizationError('Only project owners and managers can perform this action');
  }

  return access;
}

/**
 * Check if user is project owner or workspace admin
 * @param {string} userId
 * @param {string} projectId
 * @returns {Promise<Object>} Project
 * @throws {AuthorizationError} If user is not owner
 */
export async function requireProjectOwner(userId, projectId) {
  const access = await requireProjectAccess(userId, projectId);

  if (access.role !== PROJECT_ROLES.OWNER) {
    throw new AuthorizationError('Only the project owner can perform this action');
  }

  return access;
}

/**
 * Get user's project membership
 * @param {string} userId
 * @param {string} projectId
 * @returns {Promise<Object|null>} ProjectMember record or null
 */
export async function getProjectMembership(userId, projectId) {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
    include: {
      project: true,
    },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK AUTHORIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user can access task
 * User can access if they have access to the parent project
 * @param {string} userId
 * @param {string} taskId
 * @returns {Promise<{task: Object, projectAccess: Object}>}
 * @throws {NotFoundError} If task not found
 * @throws {AuthorizationError} If user cannot access
 */
export async function requireTaskAccess(userId, taskId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      assignee: true,
    },
  });

  if (!task) {
    throw new NotFoundError('Task');
  }

  const projectAccess = await requireProjectAccess(userId, task.projectId);

  return { task, projectAccess };
}

/**
 * Check if user can edit task
 * User can edit if:
 * 1. They are the task assignee, OR
 * 2. They are a project owner/manager
 * 
 * @param {string} userId
 * @param {string} taskId
 * @returns {Promise<{task: Object, projectAccess: Object}>}
 * @throws {AuthorizationError} If user cannot edit
 */
export async function requireTaskEditor(userId, taskId) {
  const { task, projectAccess } = await requireTaskAccess(userId, taskId);

  const canEdit = 
    task.assigneeId === userId ||
    [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER].includes(projectAccess.role);

  if (!canEdit) {
    throw new AuthorizationError('You can only edit tasks assigned to you');
  }

  return { task, projectAccess };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA AUTHORIZATION (FOLLO SLA — Phase 8)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Require task assignee — only the person assigned to the task
 */
export async function requireTaskAssignee(userId, taskId) {
  const { task, projectAccess } = await requireTaskAccess(userId, taskId);
  if (task.assigneeId !== userId) {
    throw new AuthorizationError('Only the task assignee can perform this action');
  }
  return { task, projectAccess };
}

/**
 * Require PM or Admin for a task's project
 * PM = project OWNER, MANAGER, or workspace ADMIN
 */
export async function requireTaskPMOrAdmin(userId, taskId) {
  const { task, projectAccess } = await requireTaskAccess(userId, taskId);
  const managerRoles = [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER];
  if (!managerRoles.includes(projectAccess.role)) {
    throw new AuthorizationError('Only project managers or workspace admins can perform this action');
  }
  return { task, projectAccess };
}

/**
 * Express middleware: require authenticated user is a workspace member.
 * Reads workspaceId from req.query or req.body.
 */
export function requireWorkspaceMemberMiddleware(req, res, next) {
  const userId = req.userId;
  const workspaceId = req.query.workspaceId || req.body?.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'workspaceId is required' } });
  }
  requireWorkspaceMember(userId, workspaceId)
    .then(() => next())
    .catch(next);
}

/**
 * Express middleware: require workspace admin role.
 * Reads workspaceId from req.query or req.body.
 */
export function requireWorkspaceAdminMiddleware(req, res, next) {
  const userId = req.userId;
  const workspaceId = req.query.workspaceId || req.body?.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'workspaceId is required' } });
  }
  requireWorkspaceAdmin(userId, workspaceId)
    .then(() => next())
    .catch(next);
}
