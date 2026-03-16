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
} from "../controllers/workspaceController.js";
import { validate, createWorkspaceSchema, addWorkspaceMemberSchema } from "../utils/validators.js";

const workspaceRouter = express.Router();

// GET /api/v1/workspaces - Get all workspaces for user
workspaceRouter.get("/", getUserWorkspaces);

// POST /api/v1/workspaces - Create new workspace
workspaceRouter.post("/", validate(createWorkspaceSchema), createWorkspace);

// POST /api/v1/workspaces/sync - Sync workspace from Clerk org
workspaceRouter.post("/sync", syncWorkspace);

// GET /api/v1/workspaces/users - Get all system users (admin only)
workspaceRouter.get("/users", getAllUsers);

// DELETE /api/v1/workspaces/:workspaceId - Delete workspace (owner only)
workspaceRouter.delete("/:workspaceId", deleteWorkspace);

// POST /api/v1/workspaces/add-member - Add member to workspace
workspaceRouter.post(
  "/add-member", 
  validate(addWorkspaceMemberSchema), 
  addMemberToWorkspace
);

export default workspaceRouter;