import prisma from "../configs/prisma.js";
import { z } from "zod";

// Validation schemas
const createTaskSchema = z.object({
    title: z.string().min(1, "Task title is required").max(200),
    description: z.string().max(2000).optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).default("TODO"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    due_date: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

// Get all tasks in a project
export const getProjectTasks = async (req, res) => {
    try {
        const { projectId } = req.params;

        const tasks = await prisma.task.findMany({
            where: { projectId },
            include: {
                assignee: true,
                comments: {
                    include: { user: true },
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
    }
};

// Get single task by ID
export const getTaskById = async (req, res) => {
    try {
        const { taskId } = req.params;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                assignee: true,
                project: {
                    include: {
                        workspace: true
                    }
                },
                comments: {
                    include: { user: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task', details: error.message });
    }
};

// Create a new task
export const createTask = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { userId } = await req.auth();
        
        // Validate input
        const validationResult = createTaskSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: validationResult.error.errors 
            });
        }

        const { title, description, priority, status, due_date, assigneeId } = validationResult.data;

        // Check if project exists and user has access
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { 
                members: true,
                workspace: {
                    include: { members: true }
                }
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is a workspace member
        const isWorkspaceMember = project.workspace.members.some(m => m.userId === userId);
        if (!isWorkspaceMember) {
            return res.status(403).json({ error: 'Not authorized to create tasks in this project' });
        }

        const task = await prisma.task.create({
            data: {
                title,
                description,
                priority,
                status,
                due_date: due_date ? new Date(due_date) : null,
                projectId,
                assigneeId: assigneeId || null,
            },
            include: {
                assignee: true,
                project: true
            }
        });

        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task', details: error.message });
    }
};

// Update a task
export const updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { userId } = await req.auth();

        // Validate input
        const validationResult = updateTaskSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: validationResult.error.errors 
            });
        }

        const { title, description, priority, status, due_date, assigneeId } = validationResult.data;

        // Check if task exists
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: {
                        workspace: { include: { members: true } }
                    }
                }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if user is a workspace member
        const isWorkspaceMember = task.project.workspace.members.some(m => m.userId === userId);
        if (!isWorkspaceMember) {
            return res.status(403).json({ error: 'Not authorized to update this task' });
        }

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(priority && { priority }),
                ...(status && { status }),
                ...(due_date && { due_date: new Date(due_date) }),
                ...(assigneeId !== undefined && { assigneeId: assigneeId || null })
            },
            include: {
                assignee: true,
                project: true
            }
        });

        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task', details: error.message });
    }
};

// Delete a task
export const deleteTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { userId } = await req.auth();

        // Check if task exists
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: {
                        workspace: { include: { members: true } }
                    }
                }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if user is a workspace member
        const isWorkspaceMember = task.project.workspace.members.some(m => m.userId === userId);
        if (!isWorkspaceMember) {
            return res.status(403).json({ error: 'Not authorized to delete this task' });
        }

        await prisma.task.delete({
            where: { id: taskId }
        });

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task', details: error.message });
    }
};

// Add comment to task
export const addTaskComment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { userId } = await req.auth();
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        // Check if task exists
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    include: {
                        workspace: { include: { members: true } }
                    }
                }
            }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if user is a workspace member
        const isWorkspaceMember = task.project.workspace.members.some(m => m.userId === userId);
        if (!isWorkspaceMember) {
            return res.status(403).json({ error: 'Not authorized to comment on this task' });
        }

        const comment = await prisma.comment.create({
            data: {
                content: content.trim(),
                taskId,
                userId
            },
            include: { user: true }
        });

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment', details: error.message });
    }
};
