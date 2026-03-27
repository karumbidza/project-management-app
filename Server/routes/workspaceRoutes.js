// FOLLO ACCESS-SEC
// FOLLO SECURITY
// FOLLO CARD-HISTORY
/**
 * Workspace Routes
 * /api/v1/workspaces
 */

import express from "express";
import {
  getUserWorkspaces,
  createWorkspace,
  syncWorkspace,
  addMemberToWorkspace,
  deleteWorkspace,
  getAllUsers,
  getDashboardStats,
  getDashboardHistory,
  getMyRole,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from "../controllers/workspaceController.js";
import { validate, createWorkspaceSchema, addWorkspaceMemberSchema } from "../utils/validators.js";
import { writeLimiter } from "../middlewares/rateLimiter.js";
import { requireWorkspaceMembership } from "../middlewares/requireWorkspaceMember.js";

const workspaceRouter = express.Router();

// GET /api/v1/workspaces - Get all workspaces for user
workspaceRouter.get("/", getUserWorkspaces);

// POST /api/v1/workspaces - Create new workspace
workspaceRouter.post("/", writeLimiter, validate(createWorkspaceSchema), createWorkspace);

// POST /api/v1/workspaces/sync - Sync workspace from Clerk org
workspaceRouter.post("/sync", writeLimiter, syncWorkspace);

// GET /api/v1/workspaces/users - Get all system users (admin only)
workspaceRouter.get("/users", getAllUsers);

// FOLLO CARD-HISTORY
workspaceRouter.get("/dashboard/stats", getDashboardStats);
workspaceRouter.get("/dashboard/history", getDashboardHistory);

// GET /api/v1/workspaces/:workspaceId/my-role - Get caller's role in workspace
// FOLLO ACCESS-SEC — must be before /:workspaceId to avoid route conflict
workspaceRouter.get("/:workspaceId/my-role", getMyRole);

// PATCH /api/v1/workspaces/:workspaceId/members/:userId/role - Update member role (admin only)
// FOLLO ACCESS-SEC — must be before /:workspaceId DELETE to avoid route shadowing
workspaceRouter.patch(
  "/:workspaceId/members/:userId/role",
  writeLimiter,
  requireWorkspaceMembership,
  updateWorkspaceMemberRole
);

// DELETE /api/v1/workspaces/:workspaceId/members/:userId - Remove member (admin only)
workspaceRouter.delete(
  "/:workspaceId/members/:userId",
  writeLimiter,
  requireWorkspaceMembership,
  removeWorkspaceMember
);

// DELETE /api/v1/workspaces/:workspaceId - Delete workspace (owner only)
workspaceRouter.delete("/:workspaceId", writeLimiter, requireWorkspaceMembership, deleteWorkspace);

// POST /api/v1/workspaces/add-member - Add member to workspace
workspaceRouter.post(
  "/add-member",
  writeLimiter,
  requireWorkspaceMembership,
  validate(addWorkspaceMemberSchema),
  addMemberToWorkspace
);

export default workspaceRouter;