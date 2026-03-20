// FOLLO AUDIT
// FOLLO SLA
// FOLLO WORKFLOW
/**
 * Task SLA Routes
 * /api/v1/tasks — mounted alongside existing task routes
 * All routes are NEW additions — existing task routes are untouched.
 */

import express from "express";
import { writeLimiter } from "../middlewares/rateLimiter.js";
import {
  submitTask,
  approveTask,
  rejectTask,
  raiseBlocker,
  resolveBlocker,
  getTaskSla,
  requestMoreInfo,
  requestExtension,
  approveExtension,
  denyExtension,
} from "../controllers/slaController.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA WORKFLOW ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/v1/tasks/:taskId/submit — assignee submits for approval
router.post("/:taskId/submit", writeLimiter, submitTask);

// POST /api/v1/tasks/:taskId/approve — PM/admin approves
router.post("/:taskId/approve", writeLimiter, approveTask);

// POST /api/v1/tasks/:taskId/reject — PM/admin rejects (body: { reason })
router.post("/:taskId/reject", writeLimiter, rejectTask);

// POST /api/v1/tasks/:taskId/blocker — assignee raises blocker
router.post("/:taskId/blocker", writeLimiter, raiseBlocker);

// POST /api/v1/tasks/:taskId/blocker/resolve — PM/admin resolves blocker
router.post("/:taskId/blocker/resolve", writeLimiter, resolveBlocker);

// POST /api/v1/tasks/:taskId/request-info — PM asks assignee for info (FOLLO WORKFLOW)
router.post("/:taskId/request-info", writeLimiter, requestMoreInfo);

// GET /api/v1/tasks/:taskId/sla — full SLA summary
router.get("/:taskId/sla", getTaskSla);

// FOLLO WORKFLOW — Deadline extension routes
// POST /api/v1/tasks/:taskId/extension/request — assignee requests extension
router.post("/:taskId/extension/request", writeLimiter, requestExtension);

// POST /api/v1/tasks/:taskId/extension/approve — PM approves extension
router.post("/:taskId/extension/approve", writeLimiter, approveExtension);

// POST /api/v1/tasks/:taskId/extension/deny — PM denies extension
router.post("/:taskId/extension/deny", writeLimiter, denyExtension);

export default router;
