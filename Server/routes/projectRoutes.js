// FOLLO ACCESS-SEC
/**
 * Project Routes
 * /api/v1/projects
 */

// FOLLO PROJECT-OVERVIEW
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
  getPinnedLinks,
  addPinnedLink,
  deletePinnedLink,
} from "../controllers/projectController.js";
import {
  getProjectComments,
  addProjectComment,
  deleteProjectComment,
} from "../controllers/projectCommentController.js";
import { writeLimiter, commentLimiter } from "../middlewares/rateLimiter.js";
import { requireWorkspaceMembership } from "../middlewares/requireWorkspaceMember.js";
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
router.get("/workspace/:workspaceId", requireWorkspaceMembership, getWorkspaceProjects);

// POST /api/v1/projects/workspace/:workspaceId - Create project in workspace
router.post(
  "/workspace/:workspaceId",
  requireWorkspaceMembership,
  validate(createProjectSchema),
  writeLimiter,
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT COMMENT ROUTES (FOLLO PROJECT-OVERVIEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/:projectId/comments", getProjectComments);
router.post("/:projectId/comments", commentLimiter, addProjectComment);
router.delete("/:projectId/comments/:commentId", writeLimiter, deleteProjectComment);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PINNED LINKS ROUTES (FOLLO PROJECT-OVERVIEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get("/:projectId/links", getPinnedLinks);
router.post("/:projectId/links", writeLimiter, addPinnedLink);
router.delete("/:projectId/links/:linkId", writeLimiter, deletePinnedLink);

export default router;
