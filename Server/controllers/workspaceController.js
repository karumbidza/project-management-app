// FOLLO AUTH-FIX
// FOLLO PERF
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
  invalidateCachePattern(CACHE_KEYS.userWorkspaces(userId));

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
    return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
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
                  slaStatus: true,
                  completionWeight: true,
                  plannedStartDate: true,
                  plannedEndDate: true,
                  actualStartDate: true,
                  extensionStatus: true,
                  blockerRaisedAt: true,
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

  // Find workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { projects: { select: { id: true } } },
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

  // Delete workspace (cascades to members, projects, tasks via Prisma schema)
  await prisma.workspace.delete({
    where: { id: workspaceId },
  });

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