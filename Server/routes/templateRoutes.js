// FOLLO SLA — Phase 7 + Phase 8: Template Routes with Permissions
// FOLLO SECURITY
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
// FOLLO SECURITY — all routes require workspace membership
router.get("/tasks",     requireWorkspaceMemberMiddleware, listTaskTemplates);
router.get("/tasks/:id", requireWorkspaceMemberMiddleware, getTaskTemplate);
router.post("/tasks",    requireWorkspaceMemberMiddleware, createTaskTemplate);
router.put("/tasks/:id", requireWorkspaceMemberMiddleware, updateTaskTemplate);
router.delete("/tasks/:id", requireWorkspaceMemberMiddleware, deleteTaskTemplate);

// ━━━ Project Templates ━━━
// FOLLO SECURITY — all routes require workspace membership
router.get("/projects",     requireWorkspaceMemberMiddleware, listProjectTemplates);
router.get("/projects/:id", requireWorkspaceMemberMiddleware, getProjectTemplate);
router.post("/projects",    requireWorkspaceMemberMiddleware, createProjectTemplate);
router.put("/projects/:id", requireWorkspaceMemberMiddleware, updateProjectTemplate);
router.delete("/projects/:id", requireWorkspaceMemberMiddleware, deleteProjectTemplate);

// ━━━ Apply Template (project manager check is in controller) ━━━
// FOLLO SECURITY — workspace membership required before controller checks project role
router.post("/projects/:id/apply", requireWorkspaceMemberMiddleware, applyProjectTemplate);

export default router;
