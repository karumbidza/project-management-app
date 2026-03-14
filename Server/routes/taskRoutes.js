/**
 * Task Routes
 * /api/v1/tasks
 */

import express from "express";
import {
  getProjectTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  addTaskDependency,
  removeTaskDependency,
  getTaskDependencies,
  getTaskActivities,
  recalculateTaskPriority,
} from "../controllers/taskController.js";
import { 
  validate, 
  createTaskSchema, 
  updateTaskSchema,
  createDependencySchema,
  createCommentSchema,
} from "../utils/validators.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT-SCOPED TASK ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/tasks/project/:projectId - Get all tasks in project
router.get("/project/:projectId", getProjectTasks);

// POST /api/v1/tasks/project/:projectId - Create task in project
router.post(
  "/project/:projectId", 
  validate(createTaskSchema), 
  createTask
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDIVIDUAL TASK ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/tasks/:taskId - Get task by ID
router.get("/:taskId", getTaskById);

// PATCH /api/v1/tasks/:taskId - Update task
router.patch("/:taskId", validate(updateTaskSchema), updateTask);

// PUT /api/v1/tasks/:taskId - Update task (legacy)
router.put("/:taskId", validate(updateTaskSchema), updateTask);

// DELETE /api/v1/tasks/:taskId - Delete task
router.delete("/:taskId", deleteTask);

// FOLLO WORKFLOW — recalculate priority for a task
router.post("/:taskId/recalculate-priority", recalculateTaskPriority);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK DEPENDENCY ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/tasks/:taskId/dependencies - Get task dependencies
router.get("/:taskId/dependencies", getTaskDependencies);

// POST /api/v1/tasks/:taskId/dependencies - Add dependency
router.post(
  "/:taskId/dependencies", 
  validate(createDependencySchema), 
  addTaskDependency
);

// DELETE /api/v1/tasks/:taskId/dependencies/:dependencyId - Remove dependency
router.delete("/:taskId/dependencies/:dependencyId", removeTaskDependency);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK COMMENT ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/v1/tasks/:taskId/comments - Add comment
router.post(
  "/:taskId/comments", 
  validate(createCommentSchema), 
  addTaskComment
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK ACTIVITY ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/tasks/:taskId/activities - Get task activity log
router.get("/:taskId/activities", getTaskActivities);

export default router;
