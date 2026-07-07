// FOLLO ENGINE
/**
 * Subtask / Breakdown Routes
 * Mounted under /api/v1/tasks (alongside taskRoutes & taskSlaRoutes).
 */

import express from "express";
import {
  getBreakdown,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtask,
  submitBreakdown,
  approveBreakdown,
  rejectBreakdown,
} from "../controllers/subtaskController.js";
import {
  validate,
  createSubtaskSchema,
  updateSubtaskSchema,
  toggleSubtaskSchema,
  rejectBreakdownSchema,
} from "../utils/validators.js";
import { writeLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// ━━━ Breakdown (per task) ━━━
router.get("/:taskId/breakdown", getBreakdown);
router.post("/:taskId/subtasks", writeLimiter, validate(createSubtaskSchema), createSubtask);
router.post("/:taskId/breakdown/submit", writeLimiter, submitBreakdown);
router.post("/:taskId/breakdown/approve", writeLimiter, approveBreakdown);
router.post("/:taskId/breakdown/reject", writeLimiter, validate(rejectBreakdownSchema), rejectBreakdown);

// ━━━ Individual subtask ━━━
router.patch("/subtasks/:subtaskId", writeLimiter, validate(updateSubtaskSchema), updateSubtask);
router.delete("/subtasks/:subtaskId", writeLimiter, deleteSubtask);
router.patch("/subtasks/:subtaskId/complete", writeLimiter, validate(toggleSubtaskSchema), toggleSubtask);

export default router;
