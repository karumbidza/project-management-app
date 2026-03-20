// FOLLO AUDIT
// FOLLO PROJECT-OVERVIEW
import prisma from '../configs/prisma.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { asyncHandler } from '../utils/errors.js';
import { ValidationError, AuthorizationError, NotFoundError } from '../utils/errors.js';

// PM + Admin = OWNER or MANAGER roles
const PM_ROLES = ['OWNER', 'MANAGER'];

async function requirePMorAdmin(userId, projectId) {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { role: true },
  });
  return member && PM_ROLES.includes(member.role);
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

  const io = req.app.get('io');
  if (io) io.to(`project:${projectId}`).emit('project_comment_added', comment);

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
  if (io) io.to(`project:${projectId}`).emit('project_comment_deleted', { commentId });

  return sendSuccess(res, { deleted: true });
});
