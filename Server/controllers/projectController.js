/**
 * Project Controller
 * Handles project CRUD and project member management
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
  sendNoContent,
} from "../utils/response.js";
import { getUserByEmail } from "../utils/userService.js";
import { 
  PROJECT_ROLES, 
  WORKSPACE_ROLES, 
  LIMITS, 
  ERROR_CODES 
} from "../utils/constants.js";
import emailService from "../utils/emailService.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get all projects in a workspace
 * GET /api/v1/projects/workspace/:workspaceId
 */
export const getWorkspaceProjects = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { userId } = await req.auth();

  // Verify user is workspace member
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!membership) {
    throw new AuthorizationError(
      'Not a member of this workspace',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId },
    include: {
      owner: true,
      members: { include: { user: true } },
      tasks: { include: { assignee: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  sendSuccess(res, projects);
});

/**
 * Get all projects the current user is a member of (for non-workspace users)
 * GET /api/v1/projects/my-projects
 */
export const getMyProjects = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();

  // Get all projects where user is a member (direct project membership, not through workspace)
  const projectMemberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          owner: true,
          members: { include: { user: true } },
          tasks: { include: { assignee: true } },
          workspace: true,
        },
      },
    },
  });

  const projects = projectMemberships.map(pm => ({
    ...pm.project,
    myRole: pm.role, // Include the user's role in this project
  }));

  sendSuccess(res, projects);
});

/**
 * Get single project by ID
 * GET /api/v1/projects/:projectId
 */
export const getProjectById = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      members: { include: { user: true } },
      tasks: {
        include: {
          assignee: true,
          comments: { include: { user: true } },
          predecessors: { include: { predecessor: true } },
          successors: { include: { successor: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      workspace: { include: { members: true } },
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Check workspace membership OR project membership
  const isWorkspaceMember = project.workspace.members.some(m => m.userId === userId);
  const isProjectMember = project.members.some(m => m.userId === userId);
  const isOwner = project.ownerId === userId;

  if (!isWorkspaceMember && !isProjectMember && !isOwner) {
    throw new AuthorizationError(
      'Not authorized to view this project',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  sendSuccess(res, project);
});

/**
 * Create a new project
 * POST /api/v1/projects/workspace/:workspaceId
 * Body: { name, description?, status?, priority?, startDate?, endDate? }
 */
export const createProject = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { userId } = await req.auth();
  const { name, description, priority, status, startDate, endDate } = req.body;

  // Check workspace membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!membership) {
    throw new AuthorizationError(
      'Not a member of this workspace',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Check project limit
  const projectCount = await prisma.project.count({ where: { workspaceId } });
  if (projectCount >= LIMITS.MAX_PROJECTS_PER_WORKSPACE) {
    throw new ConflictError(
      `Maximum ${LIMITS.MAX_PROJECTS_PER_WORKSPACE} projects per workspace`,
      ERROR_CODES.LIMIT_EXCEEDED
    );
  }

  // Create project with owner as first member (OWNER role)
  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      priority: priority || 'MEDIUM',
      status: status || 'PLANNING',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      ownerId: userId,
      workspaceId,
      members: {
        create: {
          userId,
          role: PROJECT_ROLES.OWNER,
        },
      },
    },
    include: {
      owner: true,
      members: { include: { user: true } },
    },
  });

  sendCreated(res, project, 'Project created successfully');
});

/**
 * Update a project
 * PATCH /api/v1/projects/:projectId
 * Body: { name?, description?, status?, priority?, startDate?, endDate?, progress? }
 */
export const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const { name, description, priority, status, startDate, endDate, progress } = req.body;

  // Get project with members
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Check authorization: owner, manager, or contributor can update
  const membership = project.members.find(m => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const canEdit = isOwner || 
    (membership && [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER, PROJECT_ROLES.CONTRIBUTOR].includes(membership.role));

  if (!canEdit) {
    throw new AuthorizationError(
      'Not authorized to update this project',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(progress !== undefined && { progress }),
    },
    include: {
      owner: true,
      members: { include: { user: true } },
    },
  });

  sendSuccess(res, updatedProject, 'Project updated successfully');
});

/**
 * Delete a project
 * DELETE /api/v1/projects/:projectId
 */
export const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Only owner can delete
  if (project.ownerId !== userId) {
    throw new AuthorizationError(
      'Only the project owner can delete this project',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Cascading delete handled by Prisma schema
  await prisma.project.delete({ where: { id: projectId } });

  sendNoContent(res);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT MEMBER MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get all members of a project
 * GET /api/v1/projects/:projectId/members
 */
export const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { 
      members: { 
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      },
      workspace: { include: { members: true } },
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Check access
  const isWorkspaceMember = project.workspace.members.some(m => m.userId === userId);
  const isProjectMember = project.members.some(m => m.userId === userId);
  
  if (!isWorkspaceMember && !isProjectMember) {
    throw new AuthorizationError(
      'Not authorized to view project members',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  sendSuccess(res, project.members);
});

/**
 * Add member to project (or create invitation for new users)
 * POST /api/v1/projects/:projectId/members
 * Body: { email, role? }
 * 
 * Flow:
 * 1. If email exists in DB or Clerk → add directly
 * 2. If email not found → create pending invitation
 */
export const addProjectMember = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const { email, role } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // Get project with members and workspace
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { 
      members: true,
      workspace: { include: { members: true } },
      invitations: { where: { status: 'PENDING' } },
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Check if requester can add members (owner or manager)
  const requesterMembership = project.members.find(m => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const canManage = isOwner || 
    (requesterMembership && [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER].includes(requesterMembership.role));

  if (!canManage) {
    throw new AuthorizationError(
      'Only project owners and managers can add members',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Determine role (default CONTRIBUTOR, can't add as OWNER)
  const memberRole = role && role !== PROJECT_ROLES.OWNER 
    ? role 
    : PROJECT_ROLES.CONTRIBUTOR;

  // Try to find the user (checks local DB and Clerk)
  const userToAdd = await getUserByEmail(normalizedEmail);
  
  if (userToAdd) {
    // ════════════════════════════════════════════════
    // CASE 1: User exists → Add directly
    // ════════════════════════════════════════════════
    
    // Check if already a member
    const existingMember = project.members.find(m => m.userId === userToAdd.id);
    if (existingMember) {
      throw new ConflictError(
        'User is already a project member',
        ERROR_CODES.ALREADY_EXISTS
      );
    }

    // Check member limit
    if (project.members.length >= LIMITS.MAX_MEMBERS_PER_PROJECT) {
      throw new ConflictError(
        `Maximum ${LIMITS.MAX_MEMBERS_PER_PROJECT} members per project`,
        ERROR_CODES.LIMIT_EXCEEDED
      );
    }

    // Add to project
    const member = await prisma.projectMember.create({
      data: {
        userId: userToAdd.id,
        projectId,
        role: memberRole,
      },
      include: { user: true },
    });

    // Also add to workspace if not already a member
    const isWorkspaceMember = project.workspace.members.some(m => m.userId === userToAdd.id);
    if (!isWorkspaceMember) {
      await prisma.workspaceMember.create({
        data: {
          userId: userToAdd.id,
          workspaceId: project.workspaceId,
          role: WORKSPACE_ROLES.MEMBER,
        },
      });
    }

    // Cancel any pending invitation for this email/project
    await prisma.invitation.updateMany({
      where: { email: normalizedEmail, projectId, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    // Send notification email to the added user
    const inviter = await prisma.user.findUnique({ where: { id: userId } });
    emailService.sendProjectInvite({
      to: userToAdd.email,
      inviteeName: userToAdd.name,
      projectName: project.name,
      workspaceName: project.workspace.name || 'your workspace',
      inviterName: inviter?.name || 'A team member',
      role: memberRole,
    }).catch(err => console.error('[Email] Failed to send project add notification:', err));

    return sendCreated(res, { 
      type: 'member',
      member,
      message: `${userToAdd.name} added to project`
    }, 'Member added to project');

  } else {
    // ════════════════════════════════════════════════
    // CASE 2: User doesn't exist → Create invitation
    // ════════════════════════════════════════════════
    
    // Check if invitation already exists
    const existingInvite = project.invitations.find(i => i.email === normalizedEmail);
    if (existingInvite) {
      throw new ConflictError(
        'An invitation has already been sent to this email',
        ERROR_CODES.ALREADY_EXISTS
      );
    }

    // Create invitation (expires in 7 days)
    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        projectId,
        role: memberRole,
        invitedById: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: { 
        project: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    // Send invitation email
    emailService.sendProjectInvite({
      to: normalizedEmail,
      inviteeName: null,
      projectName: invitation.project.name,
      workspaceName: project.workspace.name || 'your workspace',
      inviterName: invitation.invitedBy.name,
      role: memberRole,
    }).catch(err => console.error('[Email] Failed to send project invite:', err));

    return sendCreated(res, {
      type: 'invitation',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        projectName: invitation.project.name,
        invitedBy: invitation.invitedBy.name,
        expiresAt: invitation.expiresAt,
      },
      message: `Invitation sent to ${normalizedEmail}. They will be added when they sign up.`
    }, 'Invitation created');
  }
});

/**
 * Update project member role
 * PATCH /api/v1/projects/:projectId/members/:memberId
 * Body: { role }
 */
export const updateProjectMemberRole = asyncHandler(async (req, res) => {
  const { projectId, memberId } = req.params;
  const { userId } = await req.auth();
  const { role } = req.body;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Only owner can change roles
  if (project.ownerId !== userId) {
    throw new AuthorizationError(
      'Only the project owner can change member roles',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  // Find target member
  const targetMember = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember || targetMember.projectId !== projectId) {
    throw new NotFoundError('Member not found', ERROR_CODES.NOT_FOUND);
  }

  // Can't change owner's role or make someone else owner
  if (targetMember.role === PROJECT_ROLES.OWNER || role === PROJECT_ROLES.OWNER) {
    throw new AuthorizationError(
      'Cannot change or assign OWNER role',
      ERROR_CODES.INVALID_OPERATION
    );
  }

  const updatedMember = await prisma.projectMember.update({
    where: { id: memberId },
    data: { role },
    include: { user: true },
  });

  sendSuccess(res, updatedMember, 'Member role updated');
});

/**
 * Remove member from project
 * DELETE /api/v1/projects/:projectId/members/:memberId
 */
export const removeProjectMember = asyncHandler(async (req, res) => {
  const { projectId, memberId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  // Find target member
  const targetMember = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember || targetMember.projectId !== projectId) {
    throw new NotFoundError('Member not found', ERROR_CODES.NOT_FOUND);
  }

  // Can't remove the owner
  if (targetMember.role === PROJECT_ROLES.OWNER) {
    throw new AuthorizationError(
      'Cannot remove the project owner',
      ERROR_CODES.INVALID_OPERATION
    );
  }

  // Check authorization: owner, manager, or self-removal
  const requesterMembership = project.members.find(m => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const isSelfRemoval = targetMember.userId === userId;
  const canRemove = isOwner || 
    isSelfRemoval ||
    (requesterMembership && [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER].includes(requesterMembership.role));

  if (!canRemove) {
    throw new AuthorizationError(
      'Not authorized to remove this member',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  await prisma.projectMember.delete({ where: { id: memberId } });

  sendNoContent(res);
});
