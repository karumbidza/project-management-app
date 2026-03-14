// FOLLO SRP
/**
 * SLA Controller
 * Thin HTTP wrapper — delegates business logic to slaService.
 */

import { asyncHandler } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import * as slaService from "../services/slaService.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA WORKFLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const submitTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.submitTask(taskId, userId, req.body);
  sendSuccess(res, data, message);
});

export const approveTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.approveTask(taskId, userId);
  sendSuccess(res, data, message);
});

export const rejectTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.rejectTask(taskId, userId, req.body);
  sendSuccess(res, data, message);
});

export const raiseBlocker = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.raiseBlocker(taskId, userId, req.body);
  sendSuccess(res, data, message);
});

export const resolveBlocker = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.resolveBlocker(taskId, userId, req.body);
  sendSuccess(res, data, message);
});

export const getTaskSla = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const slaData = await slaService.getTaskSla(taskId, userId);
  sendSuccess(res, slaData);
});

export const requestMoreInfo = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.requestMoreInfo(taskId, userId, req.body);
  sendSuccess(res, data, message);
});

export const requestExtension = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.requestExtension(taskId, userId, req.body);
  sendSuccess(res, data, message);
});

export const approveExtension = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.approveExtension(taskId, userId);
  sendSuccess(res, data, message);
});

export const denyExtension = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { userId } = await req.auth();
  const { data, message } = await slaService.denyExtension(taskId, userId, req.body);
  sendSuccess(res, data, message);
});
