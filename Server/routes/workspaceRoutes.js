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
} from "../controllers/workspaceController.js";
import { validate, createWorkspaceSchema, addWorkspaceMemberSchema } from "../utils/validators.js";
import { writeLimiter } from "../middlewares/rateLimiter.js";

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

// DELETE /api/v1/workspaces/:workspaceId - Delete workspace (owner only)
workspaceRouter.delete("/:workspaceId", writeLimiter, deleteWorkspace);

// POST /api/v1/workspaces/add-member - Add member to workspace
workspaceRouter.post(
  "/add-member",
  writeLimiter,
  validate(addWorkspaceMemberSchema),
  addMemberToWorkspace
);

export default workspaceRouter;