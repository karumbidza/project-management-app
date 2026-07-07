// FOLLO ENGINE
// FOLLO SRP
/**
 * Subtask Controller
 * Thin HTTP wrapper — delegates to subtaskService.
 */

import { asyncHandler } from "../utils/errors.js";
import { sendSuccess, sendCreated, sendNoContent } from "../utils/response.js";
import * as subtaskService from "../services/subtaskService.js";

// GET /api/v1/tasks/:taskId/breakdown
export const getBreakdown = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const data = await subtaskService.getBreakdown(taskId, userId);
  sendSuccess(res, data);
});

// POST /api/v1/tasks/:taskId/subtasks
export const createSubtask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const subtask = await subtaskService.createSubtask(taskId, userId, req.body);
  sendCreated(res, subtask, 'Subtask created');
});

// PATCH /api/v1/tasks/subtasks/:subtaskId
export const updateSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.params;
  const { userId } = await req.auth();
  const subtask = await subtaskService.updateSubtask(subtaskId, userId, req.body);
  sendSuccess(res, subtask, 'Subtask updated');
});

// DELETE /api/v1/tasks/subtasks/:subtaskId
export const deleteSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.params;
  const { userId } = await req.auth();
  await subtaskService.deleteSubtask(subtaskId, userId);
  sendNoContent(res);
});

// PATCH /api/v1/tasks/subtasks/:subtaskId/complete
export const toggleSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.params;
  const { userId } = await req.auth();
  const result = await subtaskService.toggleSubtask(subtaskId, userId, req.body.isComplete);
  sendSuccess(res, result);
});

// POST /api/v1/tasks/:taskId/breakdown/submit
export const submitBreakdown = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const data = await subtaskService.submitBreakdown(taskId, userId);
  sendSuccess(res, data, 'Breakdown submitted for approval');
});

// POST /api/v1/tasks/:taskId/breakdown/approve
export const approveBreakdown = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const data = await subtaskService.approveBreakdown(taskId, userId);
  sendSuccess(res, data, 'Breakdown approved');
});

// POST /api/v1/tasks/:taskId/breakdown/reject
export const rejectBreakdown = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const data = await subtaskService.rejectBreakdown(taskId, userId, req.body.reason);
  sendSuccess(res, data, 'Breakdown sent back for revision');
});
