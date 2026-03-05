import express from "express";
import { requireAuth } from "@clerk/express";
import {
    getWorkspaceProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject
} from "../controllers/projectController.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth());

// Workspace project routes
router.get("/workspace/:workspaceId/projects", getWorkspaceProjects);
router.post("/workspace/:workspaceId/projects", createProject);

// Individual project routes
router.get("/:projectId", getProjectById);
router.put("/:projectId", updateProject);
router.delete("/:projectId", deleteProject);

export default router;
