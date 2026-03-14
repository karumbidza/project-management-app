// FOLLO SLA — Phase 7: Task Template Library
import prisma from "../configs/prisma.js";
import { asyncHandler } from "../utils/errors.js";
import { sendSuccess, sendCreated } from "../utils/response.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../utils/errors.js";

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK TEMPLATES  (single-task blueprints)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** GET  /api/v1/templates/tasks?workspaceId=xxx */
export const listTaskTemplates = asyncHandler(async (req, res) => {
    const { workspaceId } = req.query;
    if (!workspaceId) throw new ValidationError("workspaceId is required");

    const templates = await prisma.taskTemplate.findMany({
        where: { workspaceId },
        include: { checklist: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" },
    });

    sendSuccess(res, templates);
});

/** GET  /api/v1/templates/tasks/:id */
export const getTaskTemplate = asyncHandler(async (req, res) => {
    const template = await prisma.taskTemplate.findUnique({
        where: { id: req.params.id },
        include: { checklist: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) throw new NotFoundError("Task template");
    sendSuccess(res, template);
});

/** POST /api/v1/templates/tasks */
export const createTaskTemplate = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const { workspaceId, name, description, type, priority, durationDays, completionWeight, checklist } = req.body;

    if (!workspaceId || !name) throw new ValidationError("workspaceId and name are required");

    const template = await prisma.taskTemplate.create({
        data: {
            workspaceId,
            name,
            description,
            type: type || "TASK",
            priority: priority || "MEDIUM",
            durationDays: durationDays ?? 1,
            completionWeight: completionWeight ?? 1,
            createdById: userId,
            checklist: checklist?.length
                ? { create: checklist.map((c, i) => ({ label: c.label, sortOrder: i })) }
                : undefined,
        },
        include: { checklist: { orderBy: { sortOrder: "asc" } } },
    });

    sendCreated(res, template);
});

/** PUT /api/v1/templates/tasks/:id */
export const updateTaskTemplate = asyncHandler(async (req, res) => {
    const existing = await prisma.taskTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError("Task template");

    const { name, description, type, priority, durationDays, completionWeight, checklist } = req.body;

    // If checklist provided, delete old + recreate
    const updated = await prisma.$transaction(async (tx) => {
        if (checklist !== undefined) {
            await tx.templateChecklistItem.deleteMany({ where: { templateId: existing.id } });
            if (checklist.length) {
                await tx.templateChecklistItem.createMany({
                    data: checklist.map((c, i) => ({ templateId: existing.id, label: c.label, sortOrder: i })),
                });
            }
        }
        return tx.taskTemplate.update({
            where: { id: existing.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(type !== undefined && { type }),
                ...(priority !== undefined && { priority }),
                ...(durationDays !== undefined && { durationDays }),
                ...(completionWeight !== undefined && { completionWeight }),
            },
            include: { checklist: { orderBy: { sortOrder: "asc" } } },
        });
    });

    sendSuccess(res, updated);
});

/** DELETE /api/v1/templates/tasks/:id */
export const deleteTaskTemplate = asyncHandler(async (req, res) => {
    const existing = await prisma.taskTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError("Task template");

    await prisma.taskTemplate.delete({ where: { id: existing.id } });
    sendSuccess(res, null, "Task template deleted");
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT TEMPLATES  (multi-task blueprints)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROJECT_TEMPLATE_INCLUDE = {
    tasks: {
        include: { taskTemplate: { include: { checklist: { orderBy: { sortOrder: "asc" } } } } },
        orderBy: { sortOrder: "asc" },
    },
};

/** GET  /api/v1/templates/projects?workspaceId=xxx */
export const listProjectTemplates = asyncHandler(async (req, res) => {
    const { workspaceId } = req.query;
    if (!workspaceId) throw new ValidationError("workspaceId is required");

    const templates = await prisma.projectTemplate.findMany({
        where: { workspaceId },
        include: PROJECT_TEMPLATE_INCLUDE,
        orderBy: { createdAt: "desc" },
    });

    sendSuccess(res, templates);
});

/** GET  /api/v1/templates/projects/:id */
export const getProjectTemplate = asyncHandler(async (req, res) => {
    const template = await prisma.projectTemplate.findUnique({
        where: { id: req.params.id },
        include: PROJECT_TEMPLATE_INCLUDE,
    });
    if (!template) throw new NotFoundError("Project template");
    sendSuccess(res, template);
});

/** POST /api/v1/templates/projects */
export const createProjectTemplate = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const { workspaceId, name, description, tasks } = req.body;

    if (!workspaceId || !name) throw new ValidationError("workspaceId and name are required");

    const template = await prisma.projectTemplate.create({
        data: {
            workspaceId,
            name,
            description,
            createdById: userId,
            tasks: tasks?.length
                ? {
                    create: tasks.map((t, i) => ({
                        taskTemplateId: t.taskTemplateId,
                        sortOrder: t.sortOrder ?? i,
                        offsetDays: t.offsetDays ?? 0,
                        predecessorIndex: t.predecessorIndex ?? null,
                    })),
                }
                : undefined,
        },
        include: PROJECT_TEMPLATE_INCLUDE,
    });

    sendCreated(res, template);
});

/** PUT /api/v1/templates/projects/:id */
export const updateProjectTemplate = asyncHandler(async (req, res) => {
    const existing = await prisma.projectTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError("Project template");

    const { name, description, tasks } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
        if (tasks !== undefined) {
            await tx.projectTemplateTask.deleteMany({ where: { projectTemplateId: existing.id } });
            if (tasks.length) {
                await tx.projectTemplateTask.createMany({
                    data: tasks.map((t, i) => ({
                        projectTemplateId: existing.id,
                        taskTemplateId: t.taskTemplateId,
                        sortOrder: t.sortOrder ?? i,
                        offsetDays: t.offsetDays ?? 0,
                        predecessorIndex: t.predecessorIndex ?? null,
                    })),
                });
            }
        }
        return tx.projectTemplate.update({
            where: { id: existing.id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
            },
            include: PROJECT_TEMPLATE_INCLUDE,
        });
    });

    sendSuccess(res, updated);
});

/** DELETE /api/v1/templates/projects/:id */
export const deleteProjectTemplate = asyncHandler(async (req, res) => {
    const existing = await prisma.projectTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new NotFoundError("Project template");

    await prisma.projectTemplate.delete({ where: { id: existing.id } });
    sendSuccess(res, null, "Project template deleted");
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APPLY TEMPLATE  (stamp tasks into a real project)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** POST /api/v1/templates/projects/:id/apply */
export const applyProjectTemplate = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const { projectId, startDate: rawStart, assigneeMap } = req.body;

    if (!projectId) throw new ValidationError("projectId is required");

    // Validate project exists
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { members: true },
    });
    if (!project) throw new NotFoundError("Project");

    // Check the user is a member with at least MANAGER role
    const member = project.members.find(m => m.userId === userId);
    if (!member || !["OWNER", "MANAGER"].includes(member.role)) {
        throw new AuthorizationError("Only project owners or managers can apply templates");
    }

    // Load template with tasks
    const template = await prisma.projectTemplate.findUnique({
        where: { id: req.params.id },
        include: {
            tasks: {
                include: { taskTemplate: true },
                orderBy: { sortOrder: "asc" },
            },
        },
    });
    if (!template) throw new NotFoundError("Project template");

    const anchorDate = rawStart ? new Date(rawStart) : new Date();

    // Create all tasks in a transaction
    const createdTasks = await prisma.$transaction(async (tx) => {
        const taskIds = []; // track created task IDs by template sort order

        for (const pt of template.tasks) {
            const tt = pt.taskTemplate;
            const taskStart = addDays(anchorDate, pt.offsetDays);
            const taskEnd = addDays(taskStart, Math.max(tt.durationDays - 1, 0));

            // Resolve assignee: use map if provided, else fall back to current user
            const assigneeId = assigneeMap?.[pt.sortOrder] || userId;

            const task = await tx.task.create({
                data: {
                    projectId,
                    title: tt.name,
                    description: tt.description,
                    type: tt.type,
                    priority: tt.priority,
                    status: "TODO",
                    assigneeId,
                    createdById: userId,
                    plannedStartDate: taskStart,
                    plannedEndDate: taskEnd,
                    dueDate: taskEnd,
                    completionWeight: tt.completionWeight,
                    sortOrder: pt.sortOrder,
                },
            });

            taskIds.push(task.id);

            // Wire predecessor dependency if specified
            if (pt.predecessorIndex !== null && pt.predecessorIndex !== undefined) {
                const predId = taskIds[pt.predecessorIndex];
                if (predId) {
                    await tx.taskDependency.create({
                        data: { predecessorId: predId, successorId: task.id },
                    });
                }
            }
        }

        return taskIds;
    });

    // Return the full tasks
    const tasks = await prisma.task.findMany({
        where: { id: { in: createdTasks } },
        include: {
            assignee: { select: { id: true, name: true, email: true, image: true } },
            predecessors: { include: { predecessor: { select: { id: true, title: true, status: true } } } },
            successors: { include: { successor: { select: { id: true, title: true, status: true } } } },
        },
        orderBy: { sortOrder: "asc" },
    });

    sendCreated(res, tasks, `Applied template "${template.name}" — ${tasks.length} tasks created`);
});
