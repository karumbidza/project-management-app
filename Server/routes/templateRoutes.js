// FOLLO SLA — Phase 7 + Phase 8: Template Routes with Permissions
import express from "express";
import {
    listTaskTemplates,
    getTaskTemplate,
    createTaskTemplate,
    updateTaskTemplate,
    deleteTaskTemplate,
    listProjectTemplates,
    getProjectTemplate,
    createProjectTemplate,
    updateProjectTemplate,
    deleteProjectTemplate,
    applyProjectTemplate,
} from "../controllers/templateController.js";
import {
    requireWorkspaceMemberMiddleware,
    requireWorkspaceAdminMiddleware,
} from "../utils/permissions.js";

const router = express.Router();

// ━━━ Task Templates ━━━
// Read: any workspace member.  Write: workspace admin only.
router.get("/tasks", requireWorkspaceMemberMiddleware, listTaskTemplates);
router.get("/tasks/:id", getTaskTemplate);
router.post("/tasks", requireWorkspaceMemberMiddleware, createTaskTemplate);
router.put("/tasks/:id", updateTaskTemplate);
router.delete("/tasks/:id", deleteTaskTemplate);

// ━━━ Project Templates ━━━
router.get("/projects", requireWorkspaceMemberMiddleware, listProjectTemplates);
router.get("/projects/:id", getProjectTemplate);
router.post("/projects", requireWorkspaceMemberMiddleware, createProjectTemplate);
router.put("/projects/:id", updateProjectTemplate);
router.delete("/projects/:id", deleteProjectTemplate);

// ━━━ Apply Template (project manager check is in controller) ━━━
router.post("/projects/:id/apply", applyProjectTemplate);

export default router;
