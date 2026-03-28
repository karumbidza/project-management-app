// FOLLO AUDIT
// FOLLO PERF
// FOLLO FIX
// FOLLO SLA
// FOLLO ACCESS
// FOLLO INSTANT
// FOLLO WS-FIX2
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
  ValidationError,
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
import { withCache, invalidateCachePattern, invalidateCache, CACHE_KEYS, CACHE_TTL } from "../lib/cache.js";
import { userSelect, taskListSelect, memberSelect, projectListSelect } from "../lib/selectShapes.js";
import { io } from "../server.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get all projects in a workspace
 * GET /api/v1/projects/workspace/:workspaceId
 * FOLLO PERF: Cached for 2 minutes
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

  const projects = await withCache(
    CACHE_KEYS.workspaceProjects(workspaceId),
    CACHE_TTL.PROJECT_LIST,
    async () => {
      return prisma.project.findMany({
        where: { workspaceId },
        select: {
          ...projectListSelect,
          owner: { select: userSelect },
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
              assignee: { select: { id: true, name: true, image: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  );

  sendSuccess(res, projects);
});

/**
 * Get all projects the current user can access
 * GET /api/v1/projects/my-projects
 * FOLLO ACCESS: Admins/owners see ALL workspace projects.
 *               Members see only projects where they are a ProjectMember
 *               OR have at least one task assigned.
 */
export const getMyProjects = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();

  const projects = await withCache(
    CACHE_KEYS.userProjects(userId),
    CACHE_TTL.PROJECT_LIST,
    async () => {
      // Determine if user is admin/owner in ANY workspace
      const workspaceMemberships = await prisma.workspaceMember.findMany({
        where: { userId },
        include: { workspace: { select: { ownerId: true } } },
      });

      const adminWorkspaceIds = workspaceMemberships
        .filter(wm => wm.role === 'ADMIN' || wm.workspace.ownerId === userId)
        .map(wm => wm.workspaceId);

      const memberWorkspaceIds = workspaceMemberships
        .filter(wm => !adminWorkspaceIds.includes(wm.workspaceId))
        .map(wm => wm.workspaceId);

      const projectSelect = {
        ...projectListSelect,
        owner: { select: userSelect },
        members: { select: memberSelect },
        tasks: {
          select: {
            id: true, title: true, type: true, status: true,
            priority: true, dueDate: true, isDelayed: true,
            assigneeId: true, slaStatus: true, completionWeight: true,
            plannedStartDate: true, plannedEndDate: true,
            actualStartDate: true, extensionStatus: true,
            blockerRaisedAt: true,
            assignee: { select: userSelect },
          },
        },
        workspace: { select: { id: true, name: true, slug: true } },
      };

      // FOLLO ACCESS: Admin workspaces — get ALL projects
      const adminProjects = adminWorkspaceIds.length > 0
        ? await prisma.project.findMany({
            where: { workspaceId: { in: adminWorkspaceIds } },
            select: projectSelect,
            orderBy: { createdAt: 'desc' },
          })
        : [];

      // FOLLO ACCESS: Member workspaces — only projects where user is a
      // ProjectMember OR has at least one assigned task
      let memberProjects = [];
      if (memberWorkspaceIds.length > 0) {
        const [byMembership, byAssignment] = await Promise.all([
          prisma.project.findMany({
            where: {
              workspaceId: { in: memberWorkspaceIds },
              members: { some: { userId } },
            },
            select: projectSelect,
          }),
          prisma.project.findMany({
            where: {
              workspaceId: { in: memberWorkspaceIds },
              tasks: { some: { assigneeId: userId } },
            },
            select: projectSelect,
          }),
        ]);

        const seen = new Set();
        memberProjects = [...byMembership, ...byAssignment].filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      }

      // Merge admin + member projects, deduplicate
      const seen = new Set();
      return [...adminProjects, ...memberProjects]
        .filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        })
        .map(p => {
          const pm = p.members?.find(m => m.userId === userId);
          return { ...p, myRole: pm?.role || 'MEMBER' };
        });
    }
  );

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
      pinnedLinks: { orderBy: { createdAt: 'asc' } }, // FOLLO PROJECT-OVERVIEW
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

  // FOLLO PROJECT-OVERVIEW — recent SLA activity for activity feed
  const recentActivity = await prisma.slaEvent.findMany({
    where: { task: { projectId } },
    select: {
      id: true, type: true, metadata: true, createdAt: true,
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  sendSuccess(res, { ...project, recentActivity });
});

/**
 * Create a new project
 * POST /api/v1/projects/workspace/:workspaceId
 * Body: { name, description?, status?, priority?, startDate?, endDate? }
 */
export const createProject = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { userId } = await req.auth();
  const { name, description, priority, status, startDate, endDate, templateId } = req.body;

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

  // FOLLO SLA: Apply project template if one was selected
  if (templateId) {
    try {
      const template = await prisma.projectTemplate.findUnique({
        where: { id: templateId },
        include: {
          tasks: {
            include: { taskTemplate: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (template && template.tasks.length > 0) {
        const anchorDate = startDate ? new Date(startDate) : new Date();
        const addDays = (date, days) => {
          const d = new Date(date);
          d.setDate(d.getDate() + days);
          return d;
        };

        // FOLLO FIX — Create all tasks in parallel instead of sequential N+1
        const createdTasks = await Promise.all(
          template.tasks.map(pt => {
            const tt = pt.taskTemplate;
            const taskStart = addDays(anchorDate, pt.offsetDays);
            const taskEnd = addDays(taskStart, Math.max(tt.durationDays - 1, 0));
            return prisma.task.create({
              data: {
                projectId: project.id,
                title: tt.name,
                description: tt.description,
                type: tt.type,
                priority: tt.priority,
                status: "TODO",
                assigneeId: userId,
                createdById: userId,
                plannedStartDate: taskStart,
                plannedEndDate: taskEnd,
                dueDate: taskEnd,
                completionWeight: tt.completionWeight,
                sortOrder: pt.sortOrder,
              },
            });
          })
        );

        // Create dependencies in bulk
        const deps = template.tasks
          .map((pt, i) => {
            if (pt.predecessorIndex == null) return null;
            const predId = createdTasks[pt.predecessorIndex]?.id;
            if (!predId) return null;
            return { predecessorId: predId, successorId: createdTasks[i].id };
          })
          .filter(Boolean);

        if (deps.length > 0) {
          await prisma.taskDependency.createMany({ data: deps });
        }
      }
    } catch (err) {
      // Template apply is best-effort — project is already created
      console.error('[createProject] Template apply failed:', err.message);
    }
  }

  // FOLLO PERF: Invalidate caches
  // FOLLO WS-FIX2: await all invalidations before responding so the next
  // fetchWorkspaces / fetchMyProjects always returns fresh data with the new project
  await Promise.all([
    invalidateCachePattern(CACHE_KEYS.userWorkspaces(userId)),
    invalidateCachePattern(CACHE_KEYS.userProjects(userId)),
    invalidateCachePattern(CACHE_KEYS.workspaceProjects(workspaceId)),
  ]);

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

  // FOLLO INSTANT: Invalidate project and workspace caches
  invalidateCachePattern(CACHE_KEYS.workspaceProjects(project.workspaceId));
  invalidateCache(CACHE_KEYS.project(projectId));
  for (const m of project.members) {
    invalidateCachePattern(CACHE_KEYS.userProjects(m.userId));
  }

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
    include: { members: { select: { userId: true } } },
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

  const memberIds = project.members.map(m => m.userId);

  // Cascading delete handled by Prisma schema
  await prisma.project.delete({ where: { id: projectId } });

  // FOLLO INSTANT: Invalidate workspace and user project caches for all members
  invalidateCachePattern(CACHE_KEYS.workspaceProjects(project.workspaceId));
  for (const memberId of memberIds) {
    invalidateCachePattern(CACHE_KEYS.userProjects(memberId));
    invalidateCachePattern(CACHE_KEYS.userWorkspaces(memberId));
  }

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
        orderBy: { joinedAt: 'asc' },
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

    // FOLLO INSTANT: Invalidate project member and user project caches
    invalidateCache(CACHE_KEYS.projectMembers(projectId));
    invalidateCachePattern(CACHE_KEYS.userProjects(userToAdd.id));
    invalidateCachePattern(CACHE_KEYS.userWorkspaces(userToAdd.id));

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

  // FOLLO INSTANT: Invalidate project member and user project caches
  invalidateCache(CACHE_KEYS.projectMembers(projectId));
  invalidateCachePattern(CACHE_KEYS.userProjects(targetMember.userId));

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

  // FOLLO ACCESS-SEC — null-out open task assignments for the removed member
  await prisma.task.updateMany({
    where: {
      projectId:  projectId,
      assigneeId: targetMember.userId,
      status:     { notIn: ['DONE', 'BLOCKED'] },
    },
    data: { assigneeId: null },
  });

  // Notify client so the removed member is redirected immediately
  io.emit('permission:revoked', {
    userId:    targetMember.userId,
    projectId,
  });

  // FOLLO INSTANT: Invalidate project member and user project caches
  invalidateCache(CACHE_KEYS.projectMembers(projectId));
  invalidateCachePattern(CACHE_KEYS.userProjects(targetMember.userId));

  sendNoContent(res);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOGGLE PROJECT MEMBER ACTIVE STATUS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const toggleProjectMember = asyncHandler(async (req, res) => {
  const { projectId, memberId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });

  if (!project) {
    throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  }

  const targetMember = await prisma.projectMember.findUnique({
    where: { id: memberId },
  });

  if (!targetMember || targetMember.projectId !== projectId) {
    throw new NotFoundError('Member not found', ERROR_CODES.NOT_FOUND);
  }

  // Can't disable the owner
  if (targetMember.role === PROJECT_ROLES.OWNER) {
    throw new AuthorizationError(
      'Cannot disable the project owner',
      ERROR_CODES.INVALID_OPERATION
    );
  }

  // Only owner or manager can toggle
  const requesterMembership = project.members.find(m => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const canToggle = isOwner ||
    (requesterMembership && [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER].includes(requesterMembership.role));

  if (!canToggle) {
    throw new AuthorizationError(
      'Not authorized to enable/disable members',
      ERROR_CODES.INSUFFICIENT_PERMISSIONS
    );
  }

  const updatedMember = await prisma.projectMember.update({
    where: { id: memberId },
    data: { isActive: !targetMember.isActive },
    include: { user: true },
  });

  // If member was just disabled, kick them out of the project in real-time
  if (!updatedMember.isActive) {
    io.emit('permission:revoked', {
      userId:    targetMember.userId,
      projectId,
    });
  }

  // FOLLO INSTANT: Invalidate project member and user project caches
  invalidateCache(CACHE_KEYS.projectMembers(projectId));
  invalidateCachePattern(CACHE_KEYS.userProjects(targetMember.userId));

  sendSuccess(res, updatedMember, `Member ${updatedMember.isActive ? 'enabled' : 'disabled'}`);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PINNED LINKS (FOLLO PROJECT-OVERVIEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getPinnedLinks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { select: { userId: true } },
      workspace: { include: { members: { select: { userId: true, role: true } } } },
    },
  });

  if (!project) throw new NotFoundError('Project not found');

  const isProjectMember = project.members.some(m => m.userId === userId);
  const isWorkspaceAdmin = project.workspace.members.some(m => m.userId === userId && m.role === 'ADMIN');
  const isOwner = project.ownerId === userId;

  if (!isProjectMember && !isWorkspaceAdmin && !isOwner) {
    throw new AuthorizationError('Not authorized to view pinned links');
  }

  const links = await prisma.projectLink.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });
  return sendSuccess(res, links);
});

export const addPinnedLink = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { projectId } = req.params;
  const { label, url, icon } = req.body;
  if (!label?.trim() || !url?.trim()) throw new ValidationError('Label and URL are required');
  const link = await prisma.projectLink.create({
    data: { projectId, label: label.trim(), url: url.trim(), icon: icon || null, pinnedBy: userId },
  });
  return sendCreated(res, link, 'Link added');
});

export const deletePinnedLink = asyncHandler(async (req, res) => {
  const { projectId, linkId } = req.params;
  const { userId } = await req.auth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { select: { userId: true } },
      workspace: { include: { members: { select: { userId: true, role: true } } } },
    },
  });

  if (!project) throw new NotFoundError('Project not found');

  const isProjectMember = project.members.some(m => m.userId === userId);
  const isWorkspaceAdmin = project.workspace.members.some(m => m.userId === userId && m.role === 'ADMIN');
  const isOwner = project.ownerId === userId;

  if (!isProjectMember && !isWorkspaceAdmin && !isOwner) {
    throw new AuthorizationError('Not authorized to delete pinned links');
  }

  await prisma.projectLink.delete({ where: { id: linkId } });
  return sendSuccess(res, { deleted: true });
});
