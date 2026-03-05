import prisma from "../configs/prisma.js";
import { z } from "zod";

// Validation schemas
const createProjectSchema = z.object({
    name: z.string().min(1, "Project name is required").max(100),
    description: z.string().max(500).optional(),
    status: z.enum(["ACTIVE", "PLANNING", "COMPLETED", "ON_HOLD", "CANCELLED"]).default("PLANNING"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// Get all projects in a workspace
export const getWorkspaceProjects = async (req, res) => {
    try {
        const { workspaceId } = req.params;

        const projects = await prisma.project.findMany({
            where: { workspaceId },
            include: {
                owner: true,
                members: { include: { user: true } },
                tasks: {
                    include: { assignee: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
    }
};

// Get single project by ID
export const getProjectById = async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                owner: true,
                members: { include: { user: true } },
                tasks: {
                    include: {
                        assignee: true,
                        comments: { include: { user: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                workspace: true
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project', details: error.message });
    }
};

// Create a new project
export const createProject = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { userId } = await req.auth();
        
        // Validate input
        const validationResult = createProjectSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: validationResult.error.errors 
            });
        }

        const { name, description, priority, status, start_date, end_date } = validationResult.data;

        // Check if user is a member of the workspace
        const membership = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId,
                    workspaceId
                }
            }
        });

        if (!membership) {
            return res.status(403).json({ error: 'Not a member of this workspace' });
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                priority,
                status,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
                team_lead: userId,
                workspaceId,
            },
            include: {
                owner: true,
                members: true
            }
        });

        // Add creator as project member
        await prisma.projectMember.create({
            data: {
                userId,
                projectId: project.id
            }
        });

        res.status(201).json(project);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project', details: error.message });
    }
};

// Update a project
export const updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { userId } = await req.auth();

        // Validate input
        const validationResult = updateProjectSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: validationResult.error.errors 
            });
        }

        const { name, description, priority, status, start_date, end_date, progress } = validationResult.data;

        // Check if user is project owner or member
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: true }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const isMember = project.members.some(m => m.userId === userId) || project.team_lead === userId;
        if (!isMember) {
            return res.status(403).json({ error: 'Not authorized to update this project' });
        }

        const updatedProject = await prisma.project.update({
            where: { id: projectId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(priority && { priority }),
                ...(status && { status }),
                ...(start_date && { start_date: new Date(start_date) }),
                ...(end_date && { end_date: new Date(end_date) }),
                ...(progress !== undefined && { progress })
            },
            include: {
                owner: true,
                members: { include: { user: true } }
            }
        });

        res.json(updatedProject);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project', details: error.message });
    }
};

// Delete a project
export const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { userId } = await req.auth();

        // Check if user is project owner
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        if (project.team_lead !== userId) {
            return res.status(403).json({ error: 'Only project owner can delete the project' });
        }

        await prisma.project.delete({
            where: { id: projectId }
        });

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project', details: error.message });
    }
};
