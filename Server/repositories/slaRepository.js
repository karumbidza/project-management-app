// FOLLO SRP
/**
 * SLA Repository
 * Pure Prisma data-access layer for SLA task operations.
 * No auth, no HTTP, no side-effects — just queries.
 */

import prisma from "../configs/prisma.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK QUERIES (SLA-specific includes)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const findTaskWithAccess = (taskId) =>
  prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      project: {
        include: {
          workspace: { include: { members: { select: { userId: true, role: true } } } },
          members: { select: { userId: true, role: true } },
        },
      },
    },
  });

export const updateTask = (taskId, data) =>
  prisma.task.update({ where: { id: taskId }, data });

export const updateTaskWithIncludes = (taskId, data) =>
  prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

export const findUserById = (userId) =>
  prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

export const findTaskCreator = (taskId) =>
  prisma.task.findUnique({
    where: { id: taskId },
    select: { createdById: true },
  });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMENT QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createSystemComment = async (taskId, content, triggeredByUserId = null) => {
  const task = await findTaskCreator(taskId);
  return prisma.comment.create({
    data: {
      taskId,
      userId: triggeredByUserId || task.createdById,
      content,
      type: 'TEXT',
    },
  });
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA EVENT QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const findSlaEvents = (taskId, limit = 50) =>
  prisma.slaEvent.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

export const findContractorScore = (userId) =>
  prisma.contractorScore.findUnique({ where: { userId } });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REMEDIATION QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createRemediationTask = (data) =>
  prisma.task.create({ data });

export const incrementOnTimeCount = (taskId) =>
  prisma.task.update({
    where: { id: taskId },
    data: { slaOnTimeCount: { increment: 1 } },
  });
