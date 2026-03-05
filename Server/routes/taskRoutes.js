import express from "express";
import { requireAuth } from "@clerk/express";
import {
    getProjectTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    addTaskComment
} from "../controllers/taskController.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth());

// Project task routes
router.get("/project/:projectId/tasks", getProjectTasks);
router.post("/project/:projectId/tasks", createTask);

// Individual task routes
router.get("/:taskId", getTaskById);
router.put("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);

// Task comments
router.post("/:taskId/comments", addTaskComment);

export default router;
