// FOLLO FIX
// FOLLO SLA
// FOLLO PERF-2
import prisma from "../configs/prisma.js";
import emailService from "../utils/emailService.js";
import { inngest } from "./client.js";
import { slaFunctions } from "./slaJobs.js";

// Re-export the shared client so existing imports (`from './inngest/index.js'`) keep working
export { inngest };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED onFailure LOGGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const makeFailureHandler = (functionId) => async ({ error, event }) => {
  console.error(JSON.stringify({
    level:    'error',
    event:    'inngest.job.failed',
    function: functionId,
    error:    error.message,
    eventId:  event?.id,
    timestamp: new Date().toISOString(),
  }));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to save user to DB when created in Clerk
// Also processes any pending invitations for this user's email
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncUserCreation = inngest.createFunction(
  {
    id:        'follo/sync-user-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-user-from-clerk'),
  },
  { event: 'clerk/user.created' },
  async ({ event }) => {
    const { data } = event;
    const email = data?.email_addresses[0]?.email_address?.toLowerCase();

    // IDEMPOTENCY CHECK: skip if user already exists
    const existing = await prisma.user.findUnique({ where: { id: data.id } });
    if (existing) {
      return { skipped: true, reason: 'user already exists' };
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        id:    data.id,
        email: email,
        name:  data?.first_name + ' ' + data?.last_name,
        image: data?.image_url,
      },
    });

    // Check for pending invitations for this email
    if (email) {
      const pendingInvitations = await prisma.invitation.findMany({
        where: {
          email:     email,
          status:    'PENDING',
          expiresAt: { gte: new Date() },
        },
        include: {
          project: { include: { workspace: true } },
        },
      });

      // Process each invitation
      for (const invitation of pendingInvitations) {
        try {
          // IDEMPOTENCY CHECK: skip if already a member
          const alreadyMember = await prisma.projectMember.findFirst({
            where: { userId: user.id, projectId: invitation.projectId },
          });
          if (!alreadyMember) {
            await prisma.projectMember.create({
              data: {
                userId:    user.id,
                projectId: invitation.projectId,
                role:      invitation.role,
              },
            });
          }

          await prisma.invitation.update({
            where: { id: invitation.id },
            data:  { status: 'ACCEPTED', acceptedAt: new Date() },
          });

          console.info(JSON.stringify({
            level:   'info',
            event:   'inngest.invitation.processed',
            userId:  user.id,
            project: invitation.project.name,
          }));
        } catch (error) {
          console.error(JSON.stringify({
            level:        'error',
            event:        'inngest.invitation.failed',
            invitationId: invitation.id,
            error:        error.message,
          }));
        }
      }

      if (pendingInvitations.length > 0) {
        console.info(JSON.stringify({
          level:  'info',
          event:  'inngest.invitations.processed',
          userId: user.id,
          count:  pendingInvitations.length,
        }));
      }
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to delete user from database
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncUserDeletion = inngest.createFunction(
  {
    id:        'follo/sync-user-deletion-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-user-deletion-from-clerk'),
  },
  { event: 'clerk/user.deleted' },
  async ({ event }) => {
    const { data } = event;

    // IDEMPOTENCY CHECK: skip if user doesn't exist
    const existing = await prisma.user.findUnique({ where: { id: data.id } });
    if (!existing) {
      return { skipped: true, reason: 'user not found' };
    }

    await prisma.user.delete({ where: { id: data.id } });
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to save workspace when created in Clerk
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncWorkspaceCreation = inngest.createFunction(
  {
    id:        'follo/sync-workspace-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-workspace-from-clerk'),
  },
  { event: 'clerk/workspace.created' },
  async ({ event }) => {
    const { data } = event;

    // IDEMPOTENCY CHECK: skip if workspace already exists
    const existing = await prisma.workspace.findUnique({ where: { id: data.id } });
    if (existing) {
      return { skipped: true, reason: 'workspace already exists' };
    }

    await prisma.workspace.create({
      data: {
        id:        data.id,
        name:      data.name,
        slug:      data.slug,
        ownerId:   data.created_by,
        image_url: data.image_url,
      },
    });

    // Add creator as admin member of the workspace
    const alreadyMember = await prisma.workspaceMember.findFirst({
      where: { userId: data.created_by, workspaceId: data.id },
    });
    if (!alreadyMember) {
      await prisma.workspaceMember.create({
        data: {
          userId:      data.created_by,
          workspaceId: data.id,
          role:        'ADMIN',
        },
      });
    }
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to update workspace in database
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncWorkspaceUpdation = inngest.createFunction(
  {
    id:        'follo/sync-workspace-update-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-workspace-update-from-clerk'),
  },
  { event: 'clerk/workspace.updated' },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.update({
      where: { id: data.id },
      data:  { name: data.name, slug: data.slug, image_url: data.image_url },
    });
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to delete workspace from database
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncWorkspaceDeletion = inngest.createFunction(
  {
    id:        'follo/sync-workspace-deletion-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-workspace-deletion-from-clerk'),
  },
  { event: 'clerk/workspace.deleted' },
  async ({ event }) => {
    const { data } = event;

    // IDEMPOTENCY CHECK
    const existing = await prisma.workspace.findUnique({ where: { id: data.id } });
    if (!existing) {
      return { skipped: true, reason: 'workspace not found' };
    }

    await prisma.workspace.delete({ where: { id: data.id } });
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to save workspace member when invitation accepted
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id:        'follo/sync-workspace-member-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-workspace-member-from-clerk'),
  },
  { event: 'clerk/organizationInvitation.accepted' },
  async ({ event }) => {
    const { data } = event;

    // IDEMPOTENCY CHECK: skip if already a member
    const existing = await prisma.workspaceMember.findFirst({
      where: { userId: data.user_id, workspaceId: data.organization_id },
    });
    if (existing) {
      return { skipped: true, reason: 'already a member' };
    }

    await prisma.workspaceMember.create({
      data: {
        userId:      data.user_id,
        workspaceId: data.organization_id,
        role:        String(data.role_name).toUpperCase(),
      },
    });
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to delete workspace member from database
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncWorkspaceMemberDeletion = inngest.createFunction(
  {
    id:        'follo/sync-workspace-member-deletion-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-workspace-member-deletion-from-clerk'),
  },
  { event: 'clerk/workspace.member.deleted' },
  async ({ event }) => {
    const { data } = event;

    // IDEMPOTENCY CHECK
    const existing = await prisma.workspaceMember.findFirst({
      where: { userId: data.user_id, workspaceId: data.workspace_id },
    });
    if (!existing) {
      return { skipped: true, reason: 'member not found' };
    }

    await prisma.workspaceMember.delete({
      where: {
        userId_workspaceId: {
          userId:      data.user_id,
          workspaceId: data.workspace_id,
        },
      },
    });
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inngest function to update user in database when updated in Clerk
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const syncUserUpdation = inngest.createFunction(
  {
    id:        'follo/sync-user-update-from-clerk',
    retries:   3,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/sync-user-update-from-clerk'),
  },
  { event: 'clerk/user.updated' },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.update({
      where: { id: data.id },
      data:  {
        email: data?.email_addresses[0]?.email_address,
        name:  data?.first_name + ' ' + data?.last_name,
        image: data?.image_url,
      },
    });
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCHEDULED TASK REMINDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send reminder emails for tasks due tomorrow.
 * Runs daily at 9:00 AM UTC.
 */
const sendTaskDueReminders = inngest.createFunction(
  {
    id:        'follo/send-task-due-reminders',
    name:      'Send Task Due Reminders',
    retries:   3,
    timeouts:  { start: '30s', finish: '10m' },
    onFailure: makeFailureHandler('follo/send-task-due-reminders'),
  },
  { cron: '0 9 * * *' },
  async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const tasksDueTomorrow = await prisma.task.findMany({
      where: {
        dueDate:    { gte: tomorrow, lt: dayAfterTomorrow },
        status:     { not: 'COMPLETED' },
        assigneeId: { not: null },
      },
      include: {
        assignee: true,
        project:  true,
      },
    });

    console.info(JSON.stringify({
      level: 'info',
      event: 'inngest.reminders.found',
      count: tasksDueTomorrow.length,
    }));

    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    });

    for (const task of tasksDueTomorrow) {
      if (task.assignee?.email) {
        try {
          await emailService.sendTaskDueReminder({
            to:           task.assignee.email,
            assigneeName: task.assignee.name || 'there',
            taskTitle:    task.title,
            projectName:  task.project.name,
            dueDate:      formatDate(task.dueDate),
          });
          console.info(JSON.stringify({
            level:  'info',
            event:  'inngest.reminder.sent',
            taskId: task.id,
          }));
        } catch (error) {
          console.error(JSON.stringify({
            level:  'error',
            event:  'inngest.reminder.failed',
            taskId: task.id,
            error:  error.message,
          }));
        }
      }
    }

    return { sent: tasksDueTomorrow.length };
  }
);

/**
 * Send overdue task notifications.
 * Runs daily at 10:00 AM UTC.
 */
const sendOverdueTaskNotifications = inngest.createFunction(
  {
    id:        'follo/send-overdue-task-notifications',
    name:      'Send Overdue Task Notifications',
    retries:   3,
    timeouts:  { start: '30s', finish: '10m' },
    onFailure: makeFailureHandler('follo/send-overdue-task-notifications'),
  },
  { cron: '0 10 * * *' },
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate:    { lt: today },
        status:     { not: 'COMPLETED' },
        assigneeId: { not: null },
      },
      include: {
        assignee: true,
        project:  true,
      },
    });

    console.info(JSON.stringify({
      level: 'info',
      event: 'inngest.overdue.found',
      count: overdueTasks.length,
    }));

    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    for (const task of overdueTasks) {
      if (task.assignee?.email) {
        const daysOverdue = Math.ceil((today - new Date(task.dueDate)) / (1000 * 60 * 60 * 24));

        // Only notify once per week for very old tasks
        if (daysOverdue > 7 && daysOverdue % 7 !== 0) {
          continue;
        }

        try {
          await emailService.sendTaskOverdue({
            to:           task.assignee.email,
            assigneeName: task.assignee.name || 'there',
            taskTitle:    task.title,
            projectName:  task.project.name,
            dueDate:      formatDate(task.dueDate),
            daysOverdue,
          });
          console.info(JSON.stringify({
            level:  'info',
            event:  'inngest.overdue.sent',
            taskId: task.id,
            daysOverdue,
          }));
        } catch (error) {
          console.error(JSON.stringify({
            level:  'error',
            event:  'inngest.overdue.failed',
            taskId: task.id,
            error:  error.message,
          }));
        }
      }
    }

    return { sent: overdueTasks.length };
  }
);

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
  // SLA jobs (FOLLO SLA)
  ...slaFunctions,
];
