// FOLLO ACCESS-SEC
// FOLLO AUDIT
// FOLLO AUTH-FIX
// FOLLO PERF
// FOLLO ACTION-CARDS
// FOLLO CARD-HISTORY
// FOLLO GANTT-FINAL
// FOLLO INSTANT
// FOLLO WS-FIX
/**
 * Workspace Controller
 * Handles workspace CRUD and member management
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
} from "../utils/response.js";
import { ensureUserExists, getUserByEmail } from "../utils/userService.js";
import { WORKSPACE_ROLES, LIMITS, ERROR_CODES } from "../utils/constants.js";
import emailService from "../utils/emailService.js";
import { withCache, invalidateCachePattern, CACHE_KEYS, CACHE_TTL } from "../lib/cache.js";
import { userSelect, memberSelect, workspaceMemberSelect } from "../lib/selectShapes.js";

/**
 * Create a new workspace
 * POST /api/v1/workspaces
 * Body: { name, description? }
 */
export const createWorkspace = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { name, description } = req.body;

  // Ensure user exists in our database
  await ensureUserExists(userId);

  // Only first-time users (no memberships) or existing admins can create workspaces
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { role: true },
  });
  if (memberships.length > 0 && !memberships.some(m => m.role === WORKSPACE_ROLES.ADMIN)) {
    throw new AuthorizationError(
      'Only workspace admins can create new workspaces',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Check user's workspace limit
  const existingCount = await prisma.workspace.count({
    where: { ownerId: userId },
  });
  
  if (existingCount >= LIMITS.MAX_WORKSPACES_PER_USER) {
    throw new ConflictError(
      `Maximum ${LIMITS.MAX_WORKSPACES_PER_USER} workspaces allowed per user`,
      ERROR_CODES.LIMIT_EXCEEDED
    );
  }

  // Generate unique slug
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

  // Create workspace with owner as admin member
  const workspace = await prisma.workspace.create({
    data: {
      id: `ws_${Date.now().toString(36)}`,
      name,
      slug: uniqueSlug,
      description: description || null,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: WORKSPACE_ROLES.ADMIN,
        },
      },
    },
    include: {
      members: { include: { user: true } },
      projects: true,
      owner: true,
    },
  });

  // FOLLO PERF: Invalidate user's workspace cache
  // FOLLO WS-FIX: await so the cache is cleared before the response is sent
  await invalidateCachePattern(CACHE_KEYS.userWorkspaces(userId));

  sendCreated(res, workspace, 'Workspace created successfully');
});

/**
 * Sync workspace from Clerk organization
 * POST /api/v1/workspaces/sync
 * Body: { id, name, slug, ownerId, image_url }
 * Creates workspace using Clerk org ID if it doesn't exist
 */
export const syncWorkspace = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { id, name, slug, ownerId, image_url } = req.body;

  // Ensure user exists in our database
  await ensureUserExists(userId);

  // Only first-time users (no memberships) or existing admins can create workspaces
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { role: true },
  });
  if (memberships.length > 0 && !memberships.some(m => m.role === WORKSPACE_ROLES.ADMIN)) {
    throw new AuthorizationError(
      'Only workspace admins can create new workspaces',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Check if workspace already exists
  const existing = await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
      projects: true,
      owner: true,
    },
  });

  if (existing) {
    return sendSuccess(res, existing, 'Workspace already exists');
  }

  // Create workspace with Clerk org ID
  const workspace = await prisma.workspace.create({
    data: {
      id, // Use Clerk organization ID
      name,
      slug: slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      ownerId: ownerId || userId,
      image_url: image_url || null,
      members: {
        create: {
          userId: ownerId || userId,
          role: WORKSPACE_ROLES.ADMIN,
        },
      },
    },
    include: {
      members: { include: { user: true } },
      projects: true,
      owner: true,
    },
  });

  // FOLLO WS-FIX: Invalidate cache (both workspace list and project list) so the next
  // fetchWorkspaces returns the new workspace — syncWorkspace creates a member record too.
  await Promise.all([
    invalidateCachePattern(CACHE_KEYS.userWorkspaces(ownerId || userId)),
    invalidateCachePattern(CACHE_KEYS.userProjects(ownerId || userId)),
  ]);

  sendCreated(res, workspace, 'Workspace synced successfully');
});

/**
 * Get all workspaces for authenticated user
 * GET /api/v1/workspaces
 * FOLLO PERF: Optimized to NOT fetch all nested tasks/comments (was ~3s, now ~100ms)
 */
export const getUserWorkspaces = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();

  // FOLLO AUTH-FIX: Guard against stale/missing userId from Clerk session
  if (!userId) {
    throw new AuthorizationError('Not authenticated');
  }

  // Use cache for workspace list (2 min TTL)
  const workspaces = await withCache(
    CACHE_KEYS.userWorkspaces(userId),
    CACHE_TTL.WORKSPACE_LIST,
    async () => {
      // FOLLO PERF: Lightweight query - only fetch what's needed for list view
      // Tasks and comments are loaded separately when viewing a specific project
      return prisma.workspace.findMany({
        where: {
          members: { some: { userId } },
        },
        include: {
          members: { select: workspaceMemberSelect },
          projects: {
            include: {
              _count: { select: { tasks: true } },
              members: { select: memberSelect },
              tasks: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  priority: true,
                  dueDate: true,
                  isDelayed: true,
                  assigneeId: true,
                  projectId: true,
                  slaStatus: true,
                  completionWeight: true,
                  plannedStartDate: true,
                  plannedEndDate: true,
                  actualStartDate: true,
                  actualEndDate: true, // FOLLO GANTT-DONE
                  updatedAt: true,
                  // FOLLO ACTION-CARDS — fields for dashboard action panels
                  extensionStatus: true,
                  extensionReason: true,
                  extensionProposedDate: true,
                  extensionOriginalDueDate: true,
                  blockerRaisedAt: true,
                  blockerDescription: true,
                  completionNotes: true,
                  completionPhotos: true,
                  submittedAt: true,
                  assignee: { select: userSelect },
                },
              },
            },
          },
          owner: { select: userSelect },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  );

  sendSuccess(res, workspaces);
});

/**
 * Add member to workspace
 * POST /api/v1/workspaces/:workspaceId/members
 * Body: { email, role, message? }
 */
export const addMemberToWorkspace = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { email, role, workspaceId, message } = req.body;

  // Find user by email
  const userToAdd = await getUserByEmail(email);
  if (!userToAdd) {
    throw new NotFoundError(
      'User not found. They must sign up first before being invited.',
      ERROR_CODES.USER_NOT_FOUND
    );
  }

  // Fetch workspace with members
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: true },
  });

  if (!workspace) {
    throw new NotFoundError('Workspace not found', ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  // Check if requester is admin
  const requesterMember = workspace.members.find(
    (m) => m.userId === userId && m.role === WORKSPACE_ROLES.ADMIN
  );
  
  if (!requesterMember) {
    throw new AuthorizationError(
      'Only workspace admins can add members',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Check if already a member
  const existingMember = workspace.members.find((m) => m.userId === userToAdd.id);
  if (existingMember) {
    throw new ConflictError(
      'User is already a member of this workspace',
      ERROR_CODES.ALREADY_EXISTS
    );
  }

  // Check member limit
  if (workspace.members.length >= LIMITS.MAX_MEMBERS_PER_WORKSPACE) {
    throw new ConflictError(
      `Maximum ${LIMITS.MAX_MEMBERS_PER_WORKSPACE} members allowed per workspace`,
      ERROR_CODES.LIMIT_EXCEEDED
    );
  }

  // Add member
  const member = await prisma.workspaceMember.create({
    data: {
      userId: userToAdd.id,
      workspaceId,
      role: role || WORKSPACE_ROLES.MEMBER,
      message: message || null,
    },
    include: { user: true },
  });

  // Send notification email
  const inviter = await prisma.user.findUnique({ where: { id: userId } });
  emailService.sendWorkspaceInvite({
    to: userToAdd.email,
    inviteeName: userToAdd.name,
    workspaceName: workspace.name,
    inviterName: inviter?.name || 'A team member',
    role: role || WORKSPACE_ROLES.MEMBER,
  }).catch(err => console.error('[Email] Failed to send workspace invite:', err));

  // FOLLO INSTANT: Invalidate workspace and project caches for the newly added member
  invalidateCachePattern(CACHE_KEYS.userWorkspaces(userToAdd.id));
  invalidateCachePattern(CACHE_KEYS.userProjects(userToAdd.id));

  sendCreated(res, member, 'Member added to workspace successfully');
});

/**
 * Delete a workspace
 * DELETE /api/v1/workspaces/:workspaceId
 * Only workspace owner can delete
 */
export const deleteWorkspace = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { workspaceId } = req.params;

  // Find workspace and all its members (for cache invalidation)
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      projects: { select: { id: true } },
      members: { select: { userId: true } },
    },
  });

  if (!workspace) {
    throw new NotFoundError('Workspace not found', ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  // Only owner can delete workspace
  if (workspace.ownerId !== userId) {
    throw new AuthorizationError(
      'Only the workspace owner can delete this workspace',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Collect all member userIds before deletion (for cache busting)
  const memberIds = workspace.members.map(m => m.userId);

  // Delete workspace (cascades to members, projects, tasks via Prisma schema)
  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

  // Invalidate workspace + project cache for every member so stale data can't be served
  for (const memberId of memberIds) {
    invalidateCachePattern(CACHE_KEYS.userWorkspaces(memberId));
    invalidateCachePattern(CACHE_KEYS.userProjects(memberId));
  }

  sendSuccess(res, { id: workspaceId }, 'Workspace deleted successfully');
});

/**
 * Get all users in the system (for admin invite dropdown)
 * GET /api/v1/workspaces/users
 * Only workspace admins can list users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();

  // Verify caller is admin in at least one workspace
  const adminMembership = await prisma.workspaceMember.findFirst({
    where: { userId, role: WORKSPACE_ROLES.ADMIN },
  });

  if (!adminMembership) {
    throw new AuthorizationError(
      'Only workspace admins can list users',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { name: 'asc' },
  });

  sendSuccess(res, users);
});

// FOLLO GANTT-FINAL
function getTaskWeightServer(task) {
  if (task.completionWeight && task.completionWeight > 0) return task.completionWeight;
  const start = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
  const end   = task.dueDate ? new Date(task.dueDate)
              : task.plannedEndDate ? new Date(task.plannedEndDate) : null;
  if (start && end && end > start) return Math.max(1, Math.ceil((end - start) / 86400000));
  return 1;
}

/**
 * Get dashboard stats including monthly resolved counts
 * GET /api/v1/workspaces/dashboard/stats?workspaceId=xxx
 * FOLLO CARD-HISTORY
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { workspaceId } = req.query;

  if (!workspaceId) throw new ValidationError('workspaceId is required');

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!membership) throw new AuthorizationError('Not a workspace member');

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const projectIds = projects.map(p => p.id);

  // FOLLO CARD-HISTORY
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const baseWhere = {
    task: { projectId: { in: projectIds } },
    createdAt: { gte: monthStart },
  };

  const [
    approvalsResolvedThisMonth,
    blockersResolvedThisMonth,
    breachesResolvedThisMonth,
    extensionsResolvedThisMonth,
  ] = await Promise.all([
    prisma.slaEvent.count({ where: { ...baseWhere, type: { in: ['APPROVED', 'REJECTED'] } } }),
    prisma.slaEvent.count({ where: { ...baseWhere, type: 'BLOCKER_RESOLVED' } }),
    prisma.slaEvent.count({ where: { ...baseWhere, type: { in: ['BREACHED'] } } }),
    prisma.slaEvent.count({ where: { ...baseWhere, type: { in: ['EXTENSION_APPROVED', 'EXTENSION_DENIED'] } } }),
  ]);

  return sendSuccess(res, {
    approvalsResolvedThisMonth,
    blockersResolvedThisMonth,
    breachesResolvedThisMonth,
    extensionsResolvedThisMonth,
  });
});

/**
 * Get dashboard history events for a given set of SLA event types
 * GET /api/v1/workspaces/dashboard/history?workspaceId=xxx&types=APPROVED,REJECTED&limit=20
 * FOLLO CARD-HISTORY
 */
export const getDashboardHistory = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { workspaceId, types, limit = '20' } = req.query;

  if (!workspaceId) throw new ValidationError('workspaceId is required');

  // Access check
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!membership) throw new AuthorizationError('Not a workspace member');

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    select: { id: true },
  });
  const projectIds = projects.map(p => p.id);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const typeFilter = types ? { type: { in: types.split(',') } } : {};

  const events = await prisma.slaEvent.findMany({
    where: {
      task: { projectId: { in: projectIds } },
      createdAt: { gte: monthStart },
      ...typeFilter,
    },
    select: {
      id: true,
      type: true,
      metadata: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit, 10),
  });

  return sendSuccess(res, events);
});

// FOLLO ACCESS-SEC — PATCH /api/v1/workspaces/:workspaceId/members/:userId/role
export const updateWorkspaceMemberRole = asyncHandler(async (req, res) => {
  const { userId: callerId } = await req.auth();
  const { workspaceId, userId: targetUserId } = req.params;
  const { role } = req.body;

  if (!role) throw new ValidationError('role is required');

  const normalizedRole = String(role).toUpperCase();
  const validRoles = Object.values(WORKSPACE_ROLES);
  if (!validRoles.includes(normalizedRole)) {
    throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Caller must be admin
  const callerMembership = await prisma.workspaceMember.findUnique({
    where:  { userId_workspaceId: { userId: callerId, workspaceId } },
    select: { role: true },
  });
  if (!callerMembership || callerMembership.role !== WORKSPACE_ROLES.ADMIN) {
    throw new AuthorizationError('Only workspace admins can change member roles', ERROR_CODES.AUTHORIZATION_ERROR);
  }

  // Cannot change the workspace owner's role
  const workspace = await prisma.workspace.findUnique({
    where:  { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) throw new NotFoundError('Workspace not found', ERROR_CODES.NOT_FOUND_ERROR);
  if (workspace.ownerId === targetUserId) {
    throw new AuthorizationError("Cannot change the workspace owner's role", ERROR_CODES.AUTHORIZATION_ERROR);
  }

  const updated = await prisma.workspaceMember.update({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    data:  { role: normalizedRole },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Invalidate caches for affected user
  invalidateCachePattern(CACHE_KEYS.userWorkspaces(targetUserId));
  invalidateCachePattern(CACHE_KEYS.userProjects(targetUserId));

  sendSuccess(res, updated, 'Member role updated');
});

/**
 * Remove a member from a workspace
 * DELETE /api/v1/workspaces/:workspaceId/members/:userId
 * Admin/owner only. Cascades to project memberships + task unassignment.
 */
export const removeWorkspaceMember = asyncHandler(async (req, res) => {
  const { userId: callerId } = await req.auth();
  const { workspaceId, userId: targetUserId } = req.params;

  // Caller must be admin
  const callerMembership = await prisma.workspaceMember.findUnique({
    where:  { userId_workspaceId: { userId: callerId, workspaceId } },
    select: { role: true },
  });
  if (!callerMembership || callerMembership.role !== WORKSPACE_ROLES.ADMIN) {
    throw new AuthorizationError('Only workspace admins can remove members', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Cannot remove the workspace owner
  const workspace = await prisma.workspace.findUnique({
    where:  { id: workspaceId },
    select: { ownerId: true },
  });
  if (!workspace) throw new NotFoundError('Workspace not found', ERROR_CODES.NOT_FOUND_ERROR);
  if (workspace.ownerId === targetUserId) {
    throw new AuthorizationError('Cannot remove the workspace owner', ERROR_CODES.AUTHORIZATION_ERROR);
  }

  // Cannot remove yourself
  if (callerId === targetUserId) {
    throw new AuthorizationError('Cannot remove yourself from the workspace', ERROR_CODES.AUTHORIZATION_ERROR);
  }

  // Confirm target is actually a member
  const targetMembership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });
  if (!targetMembership) throw new NotFoundError('Member not found in workspace', ERROR_CODES.NOT_FOUND_ERROR);

  // Get all project IDs in this workspace for cascade
  const projects = await prisma.project.findMany({
    where:  { workspaceId },
    select: { id: true },
  });
  const projectIds = projects.map(p => p.id);

  // Cascade: remove project memberships + unassign open tasks
  if (projectIds.length > 0) {
    await prisma.projectMember.deleteMany({
      where: { userId: targetUserId, projectId: { in: projectIds } },
    });
    await prisma.task.updateMany({
      where: {
        projectId: { in: projectIds },
        assigneeId: targetUserId,
        status: { notIn: ['DONE'] },
      },
      data: { assigneeId: null },
    });
  }

  // Remove workspace membership
  await prisma.workspaceMember.delete({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });

  // Invalidate caches
  invalidateCachePattern(CACHE_KEYS.userWorkspaces(targetUserId));
  invalidateCachePattern(CACHE_KEYS.userProjects(targetUserId));
  invalidateCachePattern(CACHE_KEYS.userWorkspaces(callerId));

  // Real-time: kick the removed user out immediately
  const io = req.app.get('io');
  if (io) {
    io.emit('permission:revoked', { userId: targetUserId, workspaceId });
  }

  console.info(JSON.stringify({ level: 'info', event: 'workspace.member.removed', workspaceId, targetUserId, callerId, timestamp: new Date().toISOString() }));

  sendSuccess(res, { userId: targetUserId }, 'Member removed from workspace');
});

// FOLLO ACCESS-SEC — GET /api/v1/workspaces/:workspaceId/my-role
export const getMyRole = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { workspaceId } = req.params;

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  });

  if (!member) {
    return res.status(403).json({
      success: false,
      error: { code: 'workspace_access_revoked', message: 'You no longer have access to this workspace.' },
    });
  }

  sendSuccess(res, { role: member.role });
});