// FOLLO PERF
// FOLLO SRP
/**
 * Task Repository
 * Pure Prisma data-access layer for tasks, dependencies, comments, and activities.
 * No auth, no HTTP, no side-effects — just queries.
 */

import prisma from "../configs/prisma.js";
import { taskListSelect, taskDetailSelect, userSelect } from "../lib/selectShapes.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const findTasksByProject = (projectId) =>
  prisma.task.findMany({
    where: { projectId },
    select: taskListSelect,
    orderBy: [
      { priority: 'desc' },
      { plannedEndDate: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 500,
  });

export const findTaskById = (taskId) =>
  prisma.task.findUnique({
    where: { id: taskId },
    select: taskDetailSelect,
  });

export const findTaskWithProject = (taskId) =>
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
  });

export const findTaskWithAssigneeAndProject = (taskId) =>
  prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, email: true, name: true } },
      project: {
        include: {
          workspace: { include: { members: true } },
          members: true,
        },
      },
    },
  });

export const findProjectWithAccessInfo = (projectId) =>
  prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: { include: { members: true } },
      members: true,
      _count: { select: { tasks: true } },
    },
  });

export const findUserById = (userId) =>
  prisma.user.findUnique({ where: { id: userId } });

export const createTask = (data) =>
  prisma.task.create({
    data,
    include: {
      assignee: true,
      createdBy: true,
      project: true,
    },
  });

export const updateTask = (taskId, data) =>
  prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      assignee: true,
      createdBy: true,
      project: true,
      predecessors: { include: { predecessor: true } },
      successors: { include: { successor: true } },
    },
  });

export const updateTaskPartial = (taskId, data) =>
  prisma.task.update({
    where: { id: taskId },
    data,
  });

export const deleteTask = (taskId) =>
  prisma.task.delete({ where: { id: taskId } });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEPENDENCY QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const findTaskWithDependencies = (taskId) =>
  prisma.task.findUnique({
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
          predecessor: { include: { assignee: true } },
        },
      },
      successors: {
        include: {
          successor: { include: { assignee: true } },
        },
      },
    },
  });

export const findPredecessors = (predecessorId) =>
  prisma.taskDependency.findMany({
    where: { successorId: predecessorId },
    select: { predecessorId: true },
  });

export const findExistingDependency = (taskId, predecessorId) =>
  prisma.taskDependency.findFirst({
    where: { successorId: taskId, predecessorId },
  });

export const createDependency = (data) =>
  prisma.taskDependency.create({
    data,
    include: {
      predecessor: { select: { id: true, title: true, status: true } },
      successor: { select: { id: true, title: true, status: true } },
    },
  });

export const findDependencyById = (dependencyId) =>
  prisma.taskDependency.findUnique({
    where: { id: dependencyId },
    include: { predecessor: true },
  });

export const deleteDependency = (dependencyId) =>
  prisma.taskDependency.delete({ where: { id: dependencyId } });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMENT QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createComment = (data) =>
  prisma.comment.create({
    data,
    include: { user: true },
  });

export const findDistinctCommenters = (taskId, excludeUserId) =>
  prisma.comment.findMany({
    where: { taskId, userId: { not: excludeUserId } },
    select: { userId: true, user: { select: { id: true, email: true, name: true } } },
    distinct: ['userId'],
  });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITY QUERIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const createActivity = (taskId, userId, type, message, oldValue = null, newValue = null) =>
  prisma.taskActivity.create({
    data: {
      taskId,
      userId,
      type,
      message,
      metadata: (oldValue || newValue) ? JSON.stringify({ old: oldValue, new: newValue }) : '{}',
    },
  });

export const findActivities = (taskId, limit = 50) =>
  prisma.taskActivity.findMany({
    where: { taskId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
