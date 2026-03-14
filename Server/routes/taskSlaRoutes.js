// FOLLO SLA
// FOLLO WORKFLOW
/**
 * Task SLA Routes
 * /api/v1/tasks — mounted alongside existing task routes
 * All routes are NEW additions — existing task routes are untouched.
 */

import express from "express";
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
router.post("/:taskId/submit", submitTask);

// POST /api/v1/tasks/:taskId/approve — PM/admin approves
router.post("/:taskId/approve", approveTask);

// POST /api/v1/tasks/:taskId/reject — PM/admin rejects (body: { reason })
router.post("/:taskId/reject", rejectTask);

// POST /api/v1/tasks/:taskId/blocker — assignee raises blocker
router.post("/:taskId/blocker", raiseBlocker);

// POST /api/v1/tasks/:taskId/blocker/resolve — PM/admin resolves blocker
router.post("/:taskId/blocker/resolve", resolveBlocker);

// POST /api/v1/tasks/:taskId/request-info — PM asks assignee for info (FOLLO WORKFLOW)
router.post("/:taskId/request-info", requestMoreInfo);

// GET /api/v1/tasks/:taskId/sla — full SLA summary
router.get("/:taskId/sla", getTaskSla);

// FOLLO WORKFLOW — Deadline extension routes
// POST /api/v1/tasks/:taskId/extension/request — assignee requests extension
router.post("/:taskId/extension/request", requestExtension);

// POST /api/v1/tasks/:taskId/extension/approve — PM approves extension
router.post("/:taskId/extension/approve", approveExtension);

// POST /api/v1/tasks/:taskId/extension/deny — PM denies extension
router.post("/:taskId/extension/deny", denyExtension);

export default router;
