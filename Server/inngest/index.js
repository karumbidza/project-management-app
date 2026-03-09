import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import emailService from "../utils/emailService.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });


//ingest Function to save user data to the database when a user is created in Clerk
// Also processes any pending invitations for this user's email
const syncUserCreation = inngest.createFunction(
    {id: "sync-user-from-clerk"},
    { event: "clerk/user.created" },
    async ({ event,}) => {
        const {data} = event;
        const email = data?.email_addresses[0]?.email_address?.toLowerCase();
        
        // Create the user
        const user = await prisma.user.create({
            data: {
                id: data.id,
                email: email,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        });

        // Check for pending invitations for this email
        if (email) {
            const pendingInvitations = await prisma.invitation.findMany({
                where: {
                    email: email,
                    status: 'PENDING',
                    expiresAt: { gte: new Date() },
                },
                include: {
                    project: { include: { workspace: true } },
                },
            });

            // Process each invitation
            for (const invitation of pendingInvitations) {
                try {
                    // Add user to the project ONLY (not workspace - members access projects directly)
                    await prisma.projectMember.create({
                        data: {
                            userId: user.id,
                            projectId: invitation.projectId,
                            role: invitation.role,
                        },
                    });

                    // NOTE: We intentionally do NOT add members to workspaces
                    // Members access projects directly, not through workspaces

                    // Mark invitation as accepted
                    await prisma.invitation.update({
                        where: { id: invitation.id },
                        data: { 
                            status: 'ACCEPTED',
                            acceptedAt: new Date(),
                        },
                    });

                    console.info(`[Inngest] Processed invitation: ${email} → ${invitation.project.name}`);
                } catch (error) {
                    console.error(`[Inngest] Failed to process invitation ${invitation.id}:`, error);
                }
            }

            if (pendingInvitations.length > 0) {
                console.info(`[Inngest] Processed ${pendingInvitations.length} invitations for ${email}`);
            }
        }
    }
)
//ingest function to delete user from database.
const syncUserDeletion = inngest.createFunction(
    {id: "sync-user-deletion-from-clerk"},
    { event: "clerk/user.deleted" },
    async ({ event}) => {
        const {data} = event;
        await prisma.user.delete({
            where: {
                id: data.id,
            }
        })
    }
)
//ingest funtion to save workspace data to the database when a workspace is created in Clerk

const syncWorkspaceCreation = inngest.createFunction(
    {id: "sync-workspace-from-clerk"},
    { event: "clerk/workspace.created" },
    async ({ event,}) => {
        const {data} = event;
        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            }
        })
        //Add creator as admin memeber of the workspace
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: "ADMIN",
            }
        })
    }
)
//inngest function to update workspace data in database.
const syncWorkspaceUpdation = inngest.createFunction(
    {id: "sync-workspace-update-from-clerk"},
    { event: "clerk/workspace.updated" },
    async ({ event}) => {
        const {data} = event;
        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

//inngest function to delete workspace from database.
const syncWorkspaceDeletion = inngest.createFunction(
    {id: "sync-workspace-deletion-from-clerk"},
    { event: "clerk/workspace.deleted" },
    async ({ event}) => {
        const {data} = event;
        await prisma.workspace.delete({
            where: {
                id: data.id,
            }
        })
    }
)

//inngest function to save workspace member data to database
const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: "sync-workspace-member-from-clerk"},
    { event: "clerk/organizationInvitation.accepted" },
    async ({ event,}) => {
        const {data} = event;
        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        })
    }
)

//ingest function to delete workspace member from database
const syncWorkspaceMemberDeletion = inngest.createFunction(
    {id: "sync-workspace-member-deletion-from-clerk"},
    { event: "clerk/workspace.member.deleted" },
    async ({ event}) => {
        const {data} = event;
        await prisma.workspaceMember.delete({
            where: {
                userId_workspaceId: {
                    userId: data.user_id,
                    workspaceId: data.workspace_id,
                }
            }
        })
    }
)

//ingest function to update user in database when user is updated in Clerk
const syncUserUpdation = inngest.createFunction(
    {id: "sync-user-update-from-clerk"},
    { event: "clerk/user.updated" },
    async ({ event}) => {
        const {data} = event;
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCHEDULED TASK REMINDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send reminder emails for tasks due tomorrow
 * Runs daily at 9:00 AM UTC
 */
const sendTaskDueReminders = inngest.createFunction(
    { id: "send-task-due-reminders" },
    { cron: "0 9 * * *" }, // Every day at 9 AM UTC
    async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        // Find tasks due tomorrow that are not completed
        const tasksDueTomorrow = await prisma.task.findMany({
            where: {
                dueDate: {
                    gte: tomorrow,
                    lt: dayAfterTomorrow,
                },
                status: {
                    not: 'COMPLETED',
                },
                assigneeId: {
                    not: null,
                },
            },
            include: {
                assignee: true,
                project: true,
            },
        });

        console.info(`[Inngest] Found ${tasksDueTomorrow.length} tasks due tomorrow`);

        const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        // Send reminder emails
        for (const task of tasksDueTomorrow) {
            if (task.assignee?.email) {
                try {
                    await emailService.sendTaskDueReminder({
                        to: task.assignee.email,
                        assigneeName: task.assignee.name || 'there',
                        taskTitle: task.title,
                        projectName: task.project.name,
                        dueDate: formatDate(task.dueDate),
                    });
                    console.info(`[Inngest] Sent due reminder for task "${task.title}" to ${task.assignee.email}`);
                } catch (error) {
                    console.error(`[Inngest] Failed to send reminder for task ${task.id}:`, error);
                }
            }
        }

        return { sent: tasksDueTomorrow.length };
    }
);

/**
 * Send overdue task notifications
 * Runs daily at 10:00 AM UTC
 */
const sendOverdueTaskNotifications = inngest.createFunction(
    { id: "send-overdue-task-notifications" },
    { cron: "0 10 * * *" }, // Every day at 10 AM UTC
    async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find overdue tasks (due date in the past, not completed)
        const overdueTasks = await prisma.task.findMany({
            where: {
                dueDate: {
                    lt: today,
                },
                status: {
                    not: 'COMPLETED',
                },
                assigneeId: {
                    not: null,
                },
            },
            include: {
                assignee: true,
                project: true,
            },
        });

        console.info(`[Inngest] Found ${overdueTasks.length} overdue tasks`);

        const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        // Send overdue notifications
        for (const task of overdueTasks) {
            if (task.assignee?.email) {
                const daysOverdue = Math.ceil((today - new Date(task.dueDate)) / (1000 * 60 * 60 * 24));
                
                // Only notify once per week for very old tasks
                if (daysOverdue > 7 && daysOverdue % 7 !== 0) {
                    continue;
                }

                try {
                    await emailService.sendTaskOverdue({
                        to: task.assignee.email,
                        assigneeName: task.assignee.name || 'there',
                        taskTitle: task.title,
                        projectName: task.project.name,
                        dueDate: formatDate(task.dueDate),
                        daysOverdue,
                    });
                    console.info(`[Inngest] Sent overdue notification for task "${task.title}" (${daysOverdue} days) to ${task.assignee.email}`);
                } catch (error) {
                    console.error(`[Inngest] Failed to send overdue notification for task ${task.id}:`, error);
                }
            }
        }

        return { sent: overdueTasks.length };
    }
);
// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,        
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
    syncWorkspaceMemberDeletion,
    // Scheduled reminders
    sendTaskDueReminders,
    sendOverdueTaskNotifications,
];
