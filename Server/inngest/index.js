// FOLLO FIX
// FOLLO SLA
// FOLLO PERF-2
// FOLLO ACCESS-SEC
import prisma from "../configs/prisma.js";
import emailService from "../utils/emailService.js";
import { createBulkNotifications } from "../utils/notificationService.js"; // FOLLO CALENDAR
import { listDistinctLocations, fetchAndCache, getSnapshot, computeRisk } from "../services/weatherService.js"; // FOLLO CALENDAR
import { inngest } from "./client.js";
import { slaFunctions } from "./slaJobs.js";
import { io } from "../server.js";

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

    // FOLLO ACCESS-SEC — cascade: remove project memberships + unassign open tasks
    const projects = await prisma.project.findMany({
      where:  { workspaceId: data.workspace_id },
      select: { id: true },
    });
    const projectIds = projects.map(p => p.id);

    if (projectIds.length > 0) {
      // Remove all project memberships in this workspace
      await prisma.projectMember.deleteMany({
        where: { userId: data.user_id, projectId: { in: projectIds } },
      });

      // Null-out open task assignments so tasks aren't stuck on a non-member
      await prisma.task.updateMany({
        where: {
          projectId:  { in: projectIds },
          assigneeId: data.user_id,
          status:     { notIn: ['DONE', 'BLOCKED'] },
        },
        data: { assigneeId: null },
      });
    }

    // Notify the client so the removed member is redirected immediately
    io.emit('permission:revoked', {
      userId:      data.user_id,
      workspaceId: data.workspace_id,
    });

    console.info(JSON.stringify({
      level:            'info',
      event:            'inngest.workspace.member.deletion.cascade',
      userId:           data.user_id,
      workspaceId:      data.workspace_id,
      projectsAffected: projectIds.length,
    }));
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cleanup expired invitations daily at 2:00 AM UTC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const cleanupExpiredInvitations = inngest.createFunction(
  {
    id:        'follo/cleanup-expired-invitations',
    name:      'Cleanup Expired Invitations',
    retries:   2,
    timeouts:  { start: '30s', finish: '5m' },
    onFailure: makeFailureHandler('follo/cleanup-expired-invitations'),
  },
  { cron: '0 2 * * *' },
  async () => {
    const { count } = await prisma.invitation.deleteMany({
      where: { expiresAt: { lt: new Date() }, status: 'PENDING' },
    });
    console.info(JSON.stringify({
      level: 'info',
      event: 'inngest.invitations.expired.cleaned',
      count,
    }));
    return { deleted: count };
  }
);

// FOLLO CALENDAR — Phase 4: refresh the weather cache for every site location
// once a day. The request path serves only from this cache.
const refreshWeatherCache = inngest.createFunction(
  {
    id:        'follo/refresh-weather-cache',
    name:      'Refresh Weather Cache',
    retries:   2,
    timeouts:  { start: '30s', finish: '10m' },
    onFailure: makeFailureHandler('follo/refresh-weather-cache'),
  },
  { cron: '0 5 * * *' },
  async ({ step }) => {
    const locations = await step.run('list-locations', () => listDistinctLocations());
    let refreshed = 0;
    for (const loc of locations) {
      try {
        await fetchAndCache(loc.lat, loc.lng, loc.timezone);
        refreshed++;
      } catch (err) {
        console.error('[weather] refresh failed for', loc, err.message);
      }
    }
    return { locations: locations.length, refreshed };
  }
);

// FOLLO CALENDAR — Phase 5: fire a one-shot reminder for an upcoming event.
// Scheduled at create/update time via inngest.send({ ts }); this handler
// re-checks state so stale (rescheduled/cancelled) reminders no-op.
const onCalendarEventReminder = inngest.createFunction(
  {
    id:        'follo/calendar-event-reminder',
    name:      'Calendar Event Reminder',
    retries:   2,
    timeouts:  { start: '30s', finish: '2m' },
    onFailure: makeFailureHandler('follo/calendar-event-reminder'),
  },
  { event: 'follo/calendar.event.reminder' },
  async ({ event: ingEvent }) => {
    const { eventId, scheduledStart } = ingEvent.data || {};
    const ev = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true, projectId: true, title: true, startAt: true, status: true,
        createdById: true, responsibleId: true, participants: { select: { userId: true } },
      },
    });
    if (!ev || ev.status === 'CANCELLED') return { skipped: 'gone-or-cancelled' };
    if (new Date(ev.startAt).toISOString() !== scheduledStart) return { skipped: 'rescheduled' };

    const recipients = [...new Set([ev.createdById, ev.responsibleId, ...ev.participants.map((p) => p.userId)].filter(Boolean))];
    await createBulkNotifications(recipients, {
      type:     'EVENT_REMINDER',
      title:    `Upcoming: ${ev.title}`,
      message:  `Starts ${new Date(ev.startAt).toUTCString()}`,
      metadata: { eventId: ev.id, projectId: ev.projectId },
      url:      `/projectsDetail?id=${ev.projectId}&tab=calendar`,
    });
    return { notified: recipients.length };
  }
);

// FOLLO CALENDAR — Phase 5: daily sweep for approaching milestones and
// weather-sensitive activities. Scoped to the "tomorrow" window so each item is
// surfaced roughly once (mirrors sendTaskDueReminders' bounded window).
const computeCalendarInsights = inngest.createFunction(
  {
    id:        'follo/calendar-insights',
    name:      'Calendar Insights Sweep',
    retries:   2,
    timeouts:  { start: '30s', finish: '10m' },
    onFailure: makeFailureHandler('follo/calendar-insights'),
  },
  { cron: '0 6 * * *' },
  async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);

    // Milestones due tomorrow → notify assignee + project managers/owner.
    const milestones = await prisma.task.findMany({
      where: { type: 'MILESTONE', status: { not: 'DONE' }, dueDate: { gte: tomorrow, lt: dayAfter } },
      select: {
        id: true, title: true, projectId: true, assigneeId: true,
        project: { select: { ownerId: true, members: { where: { role: { in: ['OWNER', 'MANAGER'] }, isActive: true }, select: { userId: true } } } },
      },
    });
    let milestoneAlerts = 0;
    for (const m of milestones) {
      const recipients = [...new Set([m.assigneeId, m.project.ownerId, ...m.project.members.map((x) => x.userId)].filter(Boolean))];
      if (!recipients.length) continue;
      await createBulkNotifications(recipients, {
        type: 'MILESTONE_APPROACHING', title: `Milestone tomorrow: ${m.title}`, message: 'Due tomorrow.',
        metadata: { taskId: m.id, projectId: m.projectId }, url: `/task?id=${m.id}`,
      });
      milestoneAlerts++;
    }

    // Weather-sensitive events tomorrow on a forecast-risk day → advisory alert.
    const events = await prisma.calendarEvent.findMany({
      where: { isWeatherSensitive: true, status: { not: 'CANCELLED' }, startAt: { gte: tomorrow, lt: dayAfter } },
      select: {
        id: true, title: true, projectId: true, startAt: true, createdById: true, responsibleId: true,
        participants: { select: { userId: true } }, project: { select: { latitude: true, longitude: true } },
      },
    });
    let weatherAlerts = 0;
    for (const ev of events) {
      const snap = await getSnapshot(ev.project.latitude, ev.project.longitude, new Date(ev.startAt).toISOString().slice(0, 10));
      if (!snap || !computeRisk(snap)) continue;
      const recipients = [...new Set([ev.createdById, ev.responsibleId, ...ev.participants.map((p) => p.userId)].filter(Boolean))];
      if (!recipients.length) continue;
      await createBulkNotifications(recipients, {
        type: 'WEATHER_ALERT',
        title: `Weather risk: ${ev.title}`,
        message: `Forecast for tomorrow shows ${snap.precipProb ?? 0}% rain, ${snap.precipMm ?? 0}mm. Consider reviewing this activity (advisory).`,
        metadata: { eventId: ev.id, projectId: ev.projectId },
        url: `/projectsDetail?id=${ev.projectId}&tab=calendar`,
      });
      weatherAlerts++;
    }

    return { milestoneAlerts, weatherAlerts };
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
  // Weather (FOLLO CALENDAR)
  refreshWeatherCache,
  // Calendar reminders & intelligence (FOLLO CALENDAR — Phase 5)
  onCalendarEventReminder,
  computeCalendarInsights,
  // Maintenance
  cleanupExpiredInvitations,
  // SLA jobs (FOLLO SLA)
  ...slaFunctions,
];
