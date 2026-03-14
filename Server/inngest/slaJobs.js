// FOLLO SLA
// FOLLO NOTIFY
// FOLLO WORKFLOW
/**
 * Inngest SLA Jobs
 * All background jobs for the SLA system: notifications, warnings, breaches,
 * dependency unlocking, and daily overdue tracking.
 */

import prisma from "../configs/prisma.js";
import emailService from "../utils/emailService.js";
import { inngest } from "./client.js";
import { createNotification, createBulkNotifications } from "../utils/notificationService.js";
import {
  SLA_STATUS,
  SLA_EVENT_TYPE,
  updateContractorScore,
  logSlaEvent,
  overdueDays,
} from "../lib/sla.js";
import { updateTaskPriority } from "../lib/priorityCalculator.js";
import {
  recalculateProjectCompletion,
  milestoneCrossed,
} from "../lib/projectCompletion.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Get workspace admins + project manager emails for a project */
async function getPMAndAdminEmails(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { email: true, name: true } },
      members: {
        where: { role: { in: ['OWNER', 'MANAGER'] }, isActive: true },
        include: { user: { select: { email: true, name: true, id: true } } },
      },
      workspace: {
        include: {
          members: {
            where: { role: 'ADMIN' },
            include: { user: { select: { email: true, name: true, id: true } } },
          },
        },
      },
    },
  });

  if (!project) return [];

  const emails = new Map();
  // Project owner
  if (project.owner?.email) {
    emails.set(project.owner.email, project.owner.name);
  }
  // Project managers
  for (const m of project.members) {
    if (m.user?.email) emails.set(m.user.email, m.user.name);
  }
  // Workspace admins
  for (const m of (project.workspace?.members || [])) {
    if (m.user?.email) emails.set(m.user.email, m.user.name);
  }

  return Array.from(emails.entries()).map(([email, name]) => ({ email, name }));
}

/** Get PM + admin user IDs for a project (for in-app notifications) */
async function getPMAndAdminUserIds(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true } },
      members: {
        where: { role: { in: ['OWNER', 'MANAGER'] }, isActive: true },
        select: { userId: true },
      },
      workspace: {
        include: {
          members: {
            where: { role: 'ADMIN' },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!project) return [];
  const ids = new Set();
  if (project.owner?.id) ids.add(project.owner.id);
  for (const m of project.members) ids.add(m.userId);
  for (const m of (project.workspace?.members || [])) ids.add(m.userId);
  return [...ids];
}

/** Post a system comment on a task (uses task creator as author) */
async function postSystemComment(taskId, content) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { createdById: true },
  });
  if (!task) return;
  return prisma.comment.create({
    data: { taskId, userId: task.createdById, content, type: 'TEXT' },
  });
}

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 1: task/submitted
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onTaskSubmitted = inngest.createFunction(
  { id: 'sla-task-submitted' },
  { event: 'task/submitted' },
  async ({ event }) => {
    const { taskId, taskTitle, projectName, assigneeName, isLate, projectId } = event.data;

    const recipients = await getPMAndAdminEmails(projectId);

    const lateFlag = isLate ? ' ⚠️ SUBMITTED LATE — task is past its due date.' : '';
    const subject = `Task pending your approval: ${taskTitle}`;

    for (const { email, name } of recipients) {
      await emailService.sendTaskDueReminder({
        to: email,
        assigneeName: name,
        taskTitle: `[Approval Needed] ${taskTitle}`,
        projectName,
        dueDate: `Submitted by ${assigneeName}.${lateFlag}`,
      }).catch((err) => console.error('[SLA] submit email failed:', err));
    }

    console.info(`[SLA] task/submitted: notified ${recipients.length} PMs for "${taskTitle}"`);
    return { notified: recipients.length };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 2: task/sla.warning.24hr
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onSlaWarning24hr = inngest.createFunction(
  { id: 'sla-warning-24hr' },
  { event: 'task/sla.warning.24hr' },
  async ({ event }) => {
    const { taskId } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { email: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!task) return { skipped: true, reason: 'task not found' };

    // Exit if task is already resolved, pending, or blocked
    if (['DONE', 'RESOLVED_ON_TIME', 'RESOLVED_LATE'].includes(task.status) ||
        [SLA_STATUS.PENDING_APPROVAL, SLA_STATUS.BLOCKED,
         SLA_STATUS.RESOLVED_ON_TIME, SLA_STATUS.RESOLVED_LATE].includes(task.slaStatus)) {
      return { skipped: true, reason: `status=${task.status}, sla=${task.slaStatus}` };
    }

    // Update SLA status to AT_RISK
    await prisma.task.update({
      where: { id: taskId },
      data: { slaStatus: SLA_STATUS.AT_RISK },
    });

    await logSlaEvent(prisma, {
      taskId,
      type: SLA_EVENT_TYPE.WARNING_24HR,
      triggeredBy: 'SYSTEM',
    });

    // Notify assignee
    if (task.assignee?.email) {
      await emailService.sendTaskDueReminder({
        to: task.assignee.email,
        assigneeName: task.assignee.name || 'there',
        taskTitle: `⚠️ SLA Warning: ${task.title}`,
        projectName: task.project.name,
        dueDate: `Due in 24 hours — ${formatDate(task.dueDate)}`,
      }).catch((err) => console.error('[SLA] 24hr warning email failed:', err));
    }

    // Notify PMs
    const pms = await getPMAndAdminEmails(task.project.id);
    for (const { email, name } of pms) {
      await emailService.sendTaskDueReminder({
        to: email,
        assigneeName: name,
        taskTitle: `⚠️ SLA Warning: ${task.title}`,
        projectName: task.project.name,
        dueDate: `Due in 24 hours — assigned to ${task.assignee?.name || 'unassigned'}`,
      }).catch((err) => console.error('[SLA] 24hr PM warning failed:', err));
    }

    console.info(`[SLA] 24hr warning sent for "${task.title}"`);

    // In-app notifications (FOLLO NOTIFY)
    const warnUserIds = [];
    if (task.assignee?.email) {
      const assigneeUser = await prisma.user.findFirst({ where: { email: task.assignee.email }, select: { id: true } });
      if (assigneeUser) warnUserIds.push(assigneeUser.id);
    }
    const pmIds24 = await getPMAndAdminUserIds(task.project.id);
    warnUserIds.push(...pmIds24);
    createBulkNotifications(warnUserIds, {
      type: 'SLA_WARNING',
      title: 'SLA Warning — 24h remaining',
      message: `"${task.title}" in ${task.project.name} is due in 24 hours`,
      metadata: { taskId, projectId: task.project.id },
      url: `/projects/${task.project.id}/tasks/${taskId}`,
    });

    return { warned: true };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 3: task/sla.warning.2hr
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onSlaWarning2hr = inngest.createFunction(
  { id: 'sla-warning-2hr' },
  { event: 'task/sla.warning.2hr' },
  async ({ event }) => {
    const { taskId } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { email: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!task) return { skipped: true, reason: 'task not found' };

    if (['DONE', 'RESOLVED_ON_TIME', 'RESOLVED_LATE'].includes(task.status) ||
        [SLA_STATUS.PENDING_APPROVAL, SLA_STATUS.BLOCKED,
         SLA_STATUS.RESOLVED_ON_TIME, SLA_STATUS.RESOLVED_LATE].includes(task.slaStatus)) {
      return { skipped: true, reason: `status=${task.status}, sla=${task.slaStatus}` };
    }

    await logSlaEvent(prisma, {
      taskId,
      type: SLA_EVENT_TYPE.WARNING_2HR,
      triggeredBy: 'SYSTEM',
    });

    // Notify assignee (urgent)
    if (task.assignee?.email) {
      await emailService.sendTaskOverdue({
        to: task.assignee.email,
        assigneeName: task.assignee.name || 'there',
        taskTitle: `🔴 URGENT: ${task.title}`,
        projectName: task.project.name,
        dueDate: formatDate(task.dueDate),
        daysOverdue: 0,
      }).catch((err) => console.error('[SLA] 2hr warning email failed:', err));
    }

    // Notify PMs (high urgency)
    const pms = await getPMAndAdminEmails(task.project.id);
    for (const { email, name } of pms) {
      await emailService.sendTaskOverdue({
        to: email,
        assigneeName: name,
        taskTitle: `🔴 URGENT: ${task.title} due in 2 hours`,
        projectName: task.project.name,
        dueDate: formatDate(task.dueDate),
        daysOverdue: 0,
      }).catch((err) => console.error('[SLA] 2hr PM warning failed:', err));
    }

    console.info(`[SLA] 2hr URGENT warning sent for "${task.title}"`);

    // In-app notifications (FOLLO NOTIFY)
    const urgentUserIds = [];
    if (task.assignee?.email) {
      const assigneeUser2 = await prisma.user.findFirst({ where: { email: task.assignee.email }, select: { id: true } });
      if (assigneeUser2) urgentUserIds.push(assigneeUser2.id);
    }
    const pmIds2 = await getPMAndAdminUserIds(task.project.id);
    urgentUserIds.push(...pmIds2);
    createBulkNotifications(urgentUserIds, {
      type: 'SLA_WARNING',
      title: '🚨 URGENT — 2h until SLA breach',
      message: `"${task.title}" in ${task.project.name} is due in 2 hours`,
      metadata: { taskId, projectId: task.project.id, urgent: true },
      url: `/projects/${task.project.id}/tasks/${taskId}`,
    });

    return { warned: true };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 4: task/sla.breach
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onSlaBreach = inngest.createFunction(
  { id: 'sla-breach' },
  { event: 'task/sla.breach' },
  async ({ event, step }) => {
    const { taskId } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!task) return { skipped: true, reason: 'task not found' };

    // If DONE → completed on time, no breach
    if (task.status === 'DONE') {
      return { skipped: true, reason: 'task already DONE' };
    }

    // If PENDING_APPROVAL → clock paused, do NOT breach
    if (task.slaStatus === SLA_STATUS.PENDING_APPROVAL) {
      return { skipped: true, reason: 'pending approval — clock paused' };
    }

    // If BLOCKED → clock paused, do NOT breach
    if (task.slaStatus === SLA_STATUS.BLOCKED) {
      return { skipped: true, reason: 'blocked — clock paused' };
    }

    // Terminal states
    if (task.slaStatus === SLA_STATUS.RESOLVED_ON_TIME ||
        task.slaStatus === SLA_STATUS.RESOLVED_LATE) {
      return { skipped: true, reason: 'already resolved' };
    }

    // BREACH
    await prisma.task.update({
      where: { id: taskId },
      data: {
        slaStatus: SLA_STATUS.BREACHED,
        isDelayed: true,
        slaBreachCount: { increment: 1 },
      },
    });

    // Score penalty
    if (task.assignee?.id) {
      await updateContractorScore(prisma, task.assignee.id, taskId, 'BREACH_PER_DAY', { days: 1 });
    }

    await logSlaEvent(prisma, {
      taskId,
      type: SLA_EVENT_TYPE.BREACHED,
      triggeredBy: 'SYSTEM',
    });

    await postSystemComment(taskId, '🔴 [System] SLA BREACHED — task is overdue');

    // Email: assignee + PM + workspace admin
    if (task.assignee?.email) {
      await emailService.sendTaskOverdue({
        to: task.assignee.email,
        assigneeName: task.assignee.name || 'there',
        taskTitle: `🔴 SLA BREACHED: ${task.title}`,
        projectName: task.project.name,
        dueDate: formatDate(task.dueDate),
        daysOverdue: 1,
      }).catch((err) => console.error('[SLA] breach assignee email failed:', err));
    }

    const pms = await getPMAndAdminEmails(task.project.id);
    for (const { email, name } of pms) {
      await emailService.sendTaskOverdue({
        to: email,
        assigneeName: name,
        taskTitle: `🔴 SLA BREACHED: ${task.title}`,
        projectName: task.project.name,
        dueDate: formatDate(task.dueDate),
        daysOverdue: 1,
      }).catch((err) => console.error('[SLA] breach PM email failed:', err));
    }

    // Schedule the daily overdue tracker starting tomorrow
    await inngest.send({
      name: 'task/sla.overdue.daily',
      data: { taskId },
      // Inngest will run this immediately; the job itself sleeps 24h between iterations
    });

    console.info(`[SLA] BREACH recorded for "${task.title}"`);
    return { breached: true };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 5: task/sla.overdue.daily
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onSlaOverdueDaily = inngest.createFunction(
  { id: 'sla-overdue-daily' },
  { event: 'task/sla.overdue.daily' },
  async ({ event, step }) => {
    const { taskId } = event.data;

    // Wait 24 hours before running (first iteration comes right after breach)
    await step.sleep('wait-24h', '24h');

    const task = await step.run('check-task', async () => {
      return prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignee: { select: { id: true, email: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });
    });

    if (!task) return { stopped: true, reason: 'task not found' };

    // Stop if task is now done or pending
    if (task.status === 'DONE' ||
        task.slaStatus === SLA_STATUS.PENDING_APPROVAL ||
        task.slaStatus === SLA_STATUS.RESOLVED_ON_TIME ||
        task.slaStatus === SLA_STATUS.RESOLVED_LATE) {
      return { stopped: true, reason: `status=${task.status}, sla=${task.slaStatus}` };
    }

    const days = overdueDays(task);

    // Increment delayDays
    await step.run('update-delay', async () => {
      await prisma.task.update({
        where: { id: taskId },
        data: { delayDays: days, isDelayed: true },
      });
    });

    // Score penalty per day
    if (task.assignee?.id) {
      await step.run('score-penalty', async () => {
        await updateContractorScore(prisma, task.assignee.id, taskId, 'BREACH_PER_DAY', { days: 1 });
      });
    }

    // Daily digest to PM + admin only (not assignee)
    await step.run('notify-pms', async () => {
      const pms = await getPMAndAdminEmails(task.project.id);
      for (const { email, name } of pms) {
        await emailService.sendTaskOverdue({
          to: email,
          assigneeName: name,
          taskTitle: `📋 ${task.title} — ${days} day${days !== 1 ? 's' : ''} overdue`,
          projectName: task.project.name,
          dueDate: formatDate(task.dueDate),
          daysOverdue: days,
        }).catch((err) => console.error('[SLA] daily overdue email failed:', err));
      }
    });

    // Re-schedule for tomorrow (chain)
    await inngest.send({
      name: 'task/sla.overdue.daily',
      data: { taskId },
    });

    console.info(`[SLA] daily overdue: "${task.title}" is ${days} days overdue`);
    return { days, continued: true };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 6: task/approved (unlock dependencies + completion %)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onTaskApproved = inngest.createFunction(
  { id: 'sla-task-approved' },
  { event: 'task/approved' },
  async ({ event, step }) => {
    const { taskId, taskTitle, projectId, projectName, assigneeName, onTime } = event.data;

    // 1. Find dependent tasks (successors where this task is predecessor)
    const dependents = await step.run('find-dependents', async () => {
      return prisma.taskDependency.findMany({
        where: { predecessorId: taskId },
        include: {
          successor: {
            include: {
              assignee: { select: { id: true, email: true, name: true } },
              predecessors: {
                include: {
                  predecessor: { select: { id: true, status: true } },
                },
              },
            },
          },
        },
      });
    });

    let unlocked = 0;

    // 2. Check each dependent — unlock if ALL predecessors are DONE
    for (const dep of dependents) {
      const successor = dep.successor;

      const allPredsDone = successor.predecessors.every(
        (p) => p.predecessor.status === 'DONE'
      );

      if (allPredsDone) {
        const now = new Date();

        await step.run(`unlock-${successor.id}`, async () => {
          await prisma.task.update({
            where: { id: successor.id },
            data: {
              status: 'TODO',
              slaClockStartedAt: now,
              slaStatus: SLA_STATUS.HEALTHY,
            },
          });

          await logSlaEvent(prisma, {
            taskId: successor.id,
            type: SLA_EVENT_TYPE.CLOCK_STARTED,
            triggeredBy: 'SYSTEM',
            metadata: { unlockedBy: taskId },
          });

          await postSystemComment(
            successor.id,
            `🔓 [System] Dependencies met — task is now unlocked`
          );

          // Notify assignee
          if (successor.assignee?.email) {
            await emailService.sendTaskAssigned({
              to: successor.assignee.email,
              assigneeName: successor.assignee.name || 'there',
              taskTitle: `✅ You're clear to start: ${successor.title}`,
              projectName,
              dueDate: formatDate(successor.dueDate),
              assignerName: 'System',
              priority: successor.priority,
            }).catch((err) => console.error('[SLA] unlock notify failed:', err));

            // In-app notification (FOLLO NOTIFY)
            createNotification({
              userId: successor.assignee.id,
              type: 'PREDECESSOR_COMPLETE',
              title: 'Dependencies met',
              message: `"${successor.title}" is now unlocked — all predecessors complete`,
              metadata: { taskId: successor.id, projectId, unlockedBy: taskId },
              url: `/projects/${projectId}/tasks/${successor.id}`,
            });
          }

          // Schedule SLA warnings for newly unlocked task
          if (successor.dueDate) {
            const due = new Date(successor.dueDate);
            const warn24 = new Date(due.getTime() - 24 * 60 * 60 * 1000);
            const warn2 = new Date(due.getTime() - 2 * 60 * 60 * 1000);

            if (warn24 > now) {
              await inngest.send({
                name: 'task/sla.warning.24hr',
                data: { taskId: successor.id },
                ts: warn24.getTime(),
              });
            }
            if (warn2 > now) {
              await inngest.send({
                name: 'task/sla.warning.2hr',
                data: { taskId: successor.id },
                ts: warn2.getTime(),
              });
            }
            // Schedule breach check at dueDate
            await inngest.send({
              name: 'task/sla.breach',
              data: { taskId: successor.id },
              ts: due.getTime(),
            });
          }
        });

        unlocked++;
      }
    }

    // 3. Recalculate project completion
    const result = await step.run('recalc-completion', async () => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { progress: true },
      });
      const oldPct = project?.progress || 0;
      const newPct = await recalculateProjectCompletion(projectId, prisma);
      return { oldPct, newPct };
    });

    // 4. Milestone announcement
    const milestone = milestoneCrossed(result.oldPct, result.newPct);
    if (milestone) {
      await step.run('milestone-comment', async () => {
        // Post to the first task in the project as a proxy for "project comment"
        // Since there's no project-level comment, post system comment on this task
        await postSystemComment(
          taskId,
          `📊 [System] Project is now ${milestone}% complete`
        );

        // In-app notification to all project members (FOLLO NOTIFY)
        const projMembers = await prisma.projectMember.findMany({
          where: { projectId, isActive: true },
          select: { userId: true },
        });
        const memberIds = projMembers.map(m => m.userId);
        createBulkNotifications(memberIds, {
          type: 'TASK_UPDATED',
          title: `Project ${milestone}% complete`,
          message: `"${projectName}" has reached ${milestone}% completion`,
          metadata: { projectId, milestone },
          url: `/projects/${projectId}`,
        });
      });
    }

    // 5. If 100%, notify everyone
    if (result.newPct === 100) {
      await step.run('project-complete', async () => {
        const pms = await getPMAndAdminEmails(projectId);
        for (const { email, name } of pms) {
          await emailService.sendTaskDueReminder({
            to: email,
            assigneeName: name,
            taskTitle: `🎉 Project Complete: ${projectName}`,
            projectName,
            dueDate: 'All tasks approved — 100% complete!',
          }).catch((err) => console.error('[SLA] project complete email failed:', err));
        }
      });
    }

    console.info(`[SLA] task/approved: "${taskTitle}" — unlocked ${unlocked} tasks, progress ${result.newPct}%`);
    return { unlocked, progress: result.newPct, milestone };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 7a: blocker/raised
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onBlockerRaised = inngest.createFunction(
  { id: 'sla-blocker-raised' },
  { event: 'blocker/raised' },
  async ({ event }) => {
    const {
      taskId, taskTitle, projectId, projectName,
      assigneeName, description, mediaUrl, blockedByTaskId,
    } = event.data;

    // Notify PM + workspace admin
    const pms = await getPMAndAdminEmails(projectId);
    for (const { email, name } of pms) {
      await emailService.sendTaskOverdue({
        to: email,
        assigneeName: name,
        taskTitle: `🚧 Quality Blocker: ${taskTitle}`,
        projectName,
        dueDate: `Raised by ${assigneeName}. SLA paused.`,
        daysOverdue: 0,
      }).catch((err) => console.error('[SLA] blocker notify PM failed:', err));
    }

    // If blockedByTaskId provided, notify that task's assignee
    if (blockedByTaskId) {
      const blockedTask = await prisma.task.findUnique({
        where: { id: blockedByTaskId },
        include: { assignee: { select: { email: true, name: true } } },
      });
      if (blockedTask?.assignee?.email) {
        await emailService.sendTaskOverdue({
          to: blockedTask.assignee.email,
          assigneeName: blockedTask.assignee.name || 'there',
          taskTitle: `⚠️ Your work on "${blockedTask.title}" is blocking "${taskTitle}"`,
          projectName,
          dueDate: `A quality issue has been raised by ${assigneeName}.`,
          daysOverdue: 0,
        }).catch((err) => console.error('[SLA] blocker cross-notify failed:', err));
      }
    }

    console.info(`[SLA] blocker/raised: "${taskTitle}" by ${assigneeName}`);
    return { notified: pms.length };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 7b: blocker/resolved
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onBlockerResolved = inngest.createFunction(
  { id: 'sla-blocker-resolved' },
  { event: 'blocker/resolved' },
  async ({ event }) => {
    const {
      taskId, taskTitle, projectName,
      assigneeEmail, assigneeName,
      resolution, note,
    } = event.data;

    if (assigneeEmail) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { dueDate: true },
      });

      await emailService.sendTaskAssigned({
        to: assigneeEmail,
        assigneeName: assigneeName || 'there',
        taskTitle: `✅ Blocker resolved: ${taskTitle}`,
        projectName,
        dueDate: `Resolution: ${resolution}. Your SLA clock has resumed. Due: ${formatDate(task?.dueDate)}`,
        assignerName: 'System',
        priority: 'HIGH',
      }).catch((err) => console.error('[SLA] blocker resolved notify failed:', err));
    }

    console.info(`[SLA] blocker/resolved: "${taskTitle}" — ${resolution}`);
    return { notified: assigneeEmail ? 1 : 0 };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 8: task/started (FOLLO WORKFLOW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onTaskStarted = inngest.createFunction(
  { id: 'sla-task-started' },
  { event: 'task/started' },
  async ({ event }) => {
    const { taskId, taskTitle, projectId, projectName, assigneeName, dueDate } = event.data;

    // 1. Notify all project members
    const pmIds = await getPMAndAdminUserIds(projectId);
    createBulkNotifications(pmIds, {
      type: 'TASK_UPDATED',
      title: 'Task started',
      message: `${assigneeName || 'Assignee'} started "${taskTitle}" in ${projectName}`,
      metadata: { taskId, projectId },
      url: `/projects/${projectId}/tasks/${taskId}`,
    });

    // 2. Schedule SLA warnings based on dueDate
    if (dueDate) {
      const due = new Date(dueDate);
      const now = new Date();
      const warn24 = new Date(due.getTime() - 24 * 60 * 60 * 1000);
      const warn2 = new Date(due.getTime() - 2 * 60 * 60 * 1000);

      if (warn24 > now) {
        await inngest.send({
          name: 'task/sla.warning.24hr',
          data: { taskId },
          ts: warn24.getTime(),
        });
      }
      if (warn2 > now) {
        await inngest.send({
          name: 'task/sla.warning.2hr',
          data: { taskId },
          ts: warn2.getTime(),
        });
      }
      // Schedule breach check at dueDate
      if (due > now) {
        await inngest.send({
          name: 'task/sla.breach',
          data: { taskId },
          ts: due.getTime(),
        });
      }
    }

    console.info(`[SLA] task/started: "${taskTitle}" by ${assigneeName}`);
    return { started: true };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 9: task/start-reminder (FOLLO REALTIME)
// Fires at plannedStartDate to remind assignee to begin work
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const onTaskStartReminder = inngest.createFunction(
  { id: 'sla-task-start-reminder' },
  { event: 'task/start-reminder' },
  async ({ event, step }) => {
    const {
      taskId, taskTitle, projectId, projectName,
      assigneeId, assigneeName, assigneeEmail, plannedStartDate,
    } = event.data;

    // Wait until the planned start date
    await step.sleepUntil('wait-for-start-date', new Date(plannedStartDate));

    // Re-fetch task to check it hasn't already been started
    const task = await step.run('check-task-status', async () => {
      return prisma.task.findUnique({
        where: { id: taskId },
        select: { status: true, actualStartDate: true },
      });
    });

    // If task was already started, cancelled, or done — skip
    if (!task || task.status !== 'TODO' || task.actualStartDate) {
      return { skipped: true, reason: `status=${task?.status}` };
    }

    // Send reminder notification
    await step.run('send-notification', async () => {
      createNotification({
        userId: assigneeId,
        type: 'TASK_UPDATED',
        title: 'Time to start your task',
        message: `"${taskTitle}" in ${projectName} is scheduled to begin today`,
        metadata: { taskId, projectId },
        url: `/projects/${projectId}/tasks/${taskId}`,
      });
    });

    // Send email reminder
    if (assigneeEmail) {
      await step.run('send-email', async () => {
        await emailService.sendTaskDueReminder({
          to: assigneeEmail,
          assigneeName: assigneeName || 'there',
          taskTitle: `📅 Time to start: ${taskTitle}`,
          projectName,
          dueDate: `Your planned start date is today. Please start this task.`,
        }).catch((err) => console.error('[SLA] start-reminder email failed:', err));
      });
    }

    console.info(`[SLA] task/start-reminder: reminded ${assigneeName} to start "${taskTitle}"`);
    return { reminded: true };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOB 11: DAILY PRIORITY RECALCULATION (FOLLO WORKFLOW)
// Recalculates auto-priority for all active tasks daily.
// Catches tasks that became overdue overnight.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const onDailyPriorityRecalc = inngest.createFunction(
  { id: 'daily-priority-recalc', name: 'Daily Priority Recalculation' },
  { cron: '0 2 * * *' }, // Run at 2 AM daily
  async ({ step }) => {
    const activeTasks = await step.run('fetch-active-tasks', async () => {
      return prisma.task.findMany({
        where: {
          status: { not: 'DONE' },
          priorityOverride: false,
        },
        select: { id: true },
      });
    });

    let updated = 0;
    // Process in batches of 50 to avoid overwhelming the DB
    const batchSize = 50;
    for (let i = 0; i < activeTasks.length; i += batchSize) {
      const batch = activeTasks.slice(i, i + batchSize);
      await step.run(`recalc-batch-${i}`, async () => {
        await Promise.all(batch.map(t => updateTaskPriority(t.id)));
        return batch.length;
      });
      updated += batch.length;
    }

    console.info(`[WORKFLOW] daily-priority-recalc: updated ${updated} tasks`);
    return { tasksProcessed: updated };
  }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT ALL SLA FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const slaFunctions = [
  onTaskSubmitted,
  onSlaWarning24hr,
  onSlaWarning2hr,
  onSlaBreach,
  onSlaOverdueDaily,
  onTaskApproved,
  onBlockerRaised,
  onBlockerResolved,
  onTaskStarted,
  onTaskStartReminder,
  onDailyPriorityRecalc,
];
