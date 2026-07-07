// FOLLO ENGINE
// FOLLO SRP
/**
 * Subtask Repository
 * Pure Prisma data-access for subtasks and their line items.
 * No auth, no HTTP, no side-effects — just queries.
 */

import prisma from "../configs/prisma.js";

const subtaskInclude = {
  lineItems: { orderBy: { sortOrder: 'asc' } },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBTASK QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const findSubtasksByTask = (taskId) =>
  prisma.subtask.findMany({
    where: { taskId },
    include: subtaskInclude,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

export const findSubtaskById = (subtaskId, client = prisma) =>
  client.subtask.findUnique({
    where: { id: subtaskId },
    include: subtaskInclude,
  });

/** Lightweight rows for progress/date/cost rollups — no line items. */
export const findSubtaskRollupRows = (taskId, client = prisma) =>
  client.subtask.findMany({
    where: { taskId },
    select: {
      completionWeight: true,
      isComplete: true,
      quotedCost: true,
      plannedStartDate: true,
      plannedEndDate: true,
    },
  });

export const countSubtasks = (taskId, client = prisma) =>
  client.subtask.count({ where: { taskId } });

export const maxSortOrder = async (taskId, client = prisma) => {
  const row = await client.subtask.aggregate({
    where: { taskId },
    _max: { sortOrder: true },
  });
  return row._max.sortOrder ?? -1;
};

export const createSubtask = (data, client = prisma) =>
  client.subtask.create({ data, include: subtaskInclude });

export const updateSubtask = (subtaskId, data, client = prisma) =>
  client.subtask.update({ where: { id: subtaskId }, data, include: subtaskInclude });

export const deleteSubtask = (subtaskId, client = prisma) =>
  client.subtask.delete({ where: { id: subtaskId } });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINE ITEM QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const replaceLineItems = async (subtaskId, items, client = prisma) => {
  await client.subtaskLineItem.deleteMany({ where: { subtaskId } });
  if (items.length > 0) {
    await client.subtaskLineItem.createMany({
      data: items.map((it, i) => ({
        subtaskId,
        label: it.label,
        quantity: it.quantity,
        unitCost: it.unitCost,
        sortOrder: i,
      })),
    });
  }
};
