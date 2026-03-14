/**
 * Project Routes
 * /api/v1/projects
 */

import express from "express";
import {
  getWorkspaceProjects,
  getMyProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  toggleProjectMember,
} from "../controllers/projectController.js";
import { 
  validate, 
  createProjectSchema, 
  updateProjectSchema,
  addProjectMemberSchema,
} from "../utils/validators.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEMBER-SCOPED PROJECT ROUTES (for non-workspace users)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/projects/my-projects - Get all projects user is a member of
router.get("/my-projects", getMyProjects);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE-SCOPED PROJECT ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/projects/workspace/:workspaceId - Get all projects in workspace
router.get("/workspace/:workspaceId", getWorkspaceProjects);

// POST /api/v1/projects/workspace/:workspaceId - Create project in workspace
router.post(
  "/workspace/:workspaceId", 
  validate(createProjectSchema), 
  createProject
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDIVIDUAL PROJECT ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/projects/:projectId - Get project by ID
router.get("/:projectId", getProjectById);

// PATCH /api/v1/projects/:projectId - Update project
router.patch("/:projectId", validate(updateProjectSchema), updateProject);

// PUT /api/v1/projects/:projectId - Update project (legacy)
router.put("/:projectId", validate(updateProjectSchema), updateProject);

// DELETE /api/v1/projects/:projectId - Delete project
router.delete("/:projectId", deleteProject);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT MEMBER ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/projects/:projectId/members - Get all project members
router.get("/:projectId/members", getProjectMembers);

// POST /api/v1/projects/:projectId/members - Add member to project
router.post(
  "/:projectId/members", 
  validate(addProjectMemberSchema), 
  addProjectMember
);

// PATCH /api/v1/projects/:projectId/members/:memberId - Update member role
router.patch("/:projectId/members/:memberId", updateProjectMemberRole);

// DELETE /api/v1/projects/:projectId/members/:memberId - Remove member
router.delete("/:projectId/members/:memberId", removeProjectMember);

// PATCH /api/v1/projects/:projectId/members/:memberId/toggle - Enable/disable member
router.patch("/:projectId/members/:memberId/toggle", toggleProjectMember);

export default router;
