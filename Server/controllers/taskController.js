// FOLLO PERF
// FOLLO SRP
// FOLLO WORKFLOW
/**
 * Task Controller
 * Thin HTTP wrapper — delegates business logic to taskService.
 */

import { asyncHandler } from "../utils/errors.js";
import { sendSuccess, sendCreated, sendNoContent } from "../utils/response.js";
import * as taskService from "../services/taskService.js";
import { updateTaskPriority } from "../lib/priorityCalculator.js";
import prisma from "../configs/prisma.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK CRUD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getProjectTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const tasks = await taskService.getProjectTasks(projectId, userId);
  sendSuccess(res, tasks);
});

export const getTaskById = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const task = await taskService.getTaskById(taskId, userId);
  sendSuccess(res, task);
});

export const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const task = await taskService.createTask(projectId, userId, req.body);
  sendCreated(res, task, 'Task created successfully');
});

export const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const result = await taskService.updateTask(taskId, userId, req.body);
  sendSuccess(res, result);
});

export const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  await taskService.deleteTask(taskId, userId);
  sendNoContent(res);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK DEPENDENCIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const addTaskDependency = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const dependency = await taskService.addDependency(taskId, userId, req.body);
  sendCreated(res, dependency, 'Dependency added');
});

export const removeTaskDependency = asyncHandler(async (req, res) => {
  const { taskId, dependencyId } = req.params;
  const { userId } = await req.auth();
  await taskService.removeDependency(taskId, dependencyId, userId);
  sendNoContent(res);
});

export const getTaskDependencies = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const deps = await taskService.getDependencies(taskId, userId);
  sendSuccess(res, deps);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK COMMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const addTaskComment = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const comment = await taskService.addComment(taskId, userId, req.body);
  // Return response IMMEDIATELY — side-effects are fire-and-forget inside the service
  sendCreated(res, comment, 'Comment added');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK ACTIVITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getTaskActivities = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const activities = await taskService.getActivities(taskId, userId);
  sendSuccess(res, activities);
});

// FOLLO WORKFLOW — recalculate priority for a single task
export const recalculateTaskPriority = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  await updateTaskPriority(taskId);
  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, priority: true, priorityOverride: true },
  });
  sendSuccess(res, updated);
});
