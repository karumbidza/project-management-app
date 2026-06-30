// FOLLO AUDIT
// FOLLO PROJECT-OVERVIEW
import prisma from '../configs/prisma.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';
import { ValidationError, AuthorizationError, NotFoundError } from '../utils/errors.js';

// PM + Admin = OWNER or MANAGER roles
const PM_ROLES = ['OWNER', 'MANAGER'];

// Project chat is restricted to project managers. "Manager" here means a project
// OWNER/MANAGER member, the project owner (who may not have a ProjectMember row),
// OR a workspace ADMIN — matching requireProjectManager elsewhere. The previous
// check only looked at ProjectMember.role, locking owners/admins out of their
// own project's chat.
async function requirePMorAdmin(userId, projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true, isActive: true } },
      workspace: {
        select: { members: { where: { userId, role: 'ADMIN' }, select: { id: true } } },
      },
    },
  });
  if (!project) return false;
  if (project.ownerId === userId) return true;
  if (project.members.some((m) => m.isActive !== false && PM_ROLES.includes(m.role))) return true;
  if ((project.workspace?.members?.length || 0) > 0) return true;
  return false;
}

const USER_SELECT = { id: true, name: true, image: true };

export const getProjectComments = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { projectId } = req.params;
  const { limit = 50, before } = req.query;

  const allowed = await requirePMorAdmin(userId, projectId);
  if (!allowed) {
    throw new AuthorizationError('Project chat is for OWNER and MANAGER only.');
  }

  const comments = await prisma.projectComment.findMany({
    where: {
      projectId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    select: {
      id: true, content: true, createdAt: true, userId: true,
      user: { select: USER_SELECT },
    },
    orderBy: { createdAt: 'asc' },
    take: parseInt(limit, 10),
  });

  return sendSuccess(res, comments);
});

export const addProjectComment = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { projectId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) throw new ValidationError('Message cannot be empty');

  const allowed = await requirePMorAdmin(userId, projectId);
  if (!allowed) {
    throw new AuthorizationError('Project chat is for OWNER and MANAGER only.');
  }

  const comment = await prisma.projectComment.create({
    data: { content: content.trim(), projectId, userId },
    select: {
      id: true, content: true, createdAt: true, userId: true,
      user: { select: USER_SELECT },
    },
  });

  // Emit only to the managers room — project chat is OWNER/MANAGER-only, so it
  // must not be broadcast to every member joined to the project room.
  const io = req.app.get('io');
  if (io) io.to(`project:${projectId}:managers`).emit('project_comment_added', comment);

  return sendCreated(res, comment);
});

export const deleteProjectComment = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { projectId, commentId } = req.params;

  const comment = await prisma.projectComment.findUnique({
    where: { id: commentId },
    select: { userId: true, projectId: true },
  });

  if (!comment || comment.projectId !== projectId) {
    throw new NotFoundError('Comment not found');
  }

  const isAdmin = await prisma.projectMember.findFirst({
    where: { projectId, userId, role: { in: ['OWNER', 'MANAGER'] } },
  });

  if (comment.userId !== userId && !isAdmin) {
    throw new AuthorizationError('Not authorised to delete this message');
  }

  await prisma.projectComment.delete({ where: { id: commentId } });

  const io = req.app.get('io');
  if (io) io.to(`project:${projectId}:managers`).emit('project_comment_deleted', { commentId });

  return sendSuccess(res, { deleted: true });
});
