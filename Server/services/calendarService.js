// FOLLO CALENDAR
/**
 * Calendar service — the operational scheduling layer.
 *
 * The feed is HYBRID: tasks, milestones, deadlines and project markers are
 * DERIVED from existing rows (never duplicated), and only CalendarEvent rows
 * (meetings, site visits, inspections…) are stored. Recurring events are
 * stored once (RRULE) and expanded on read inside the queried window.
 *
 * Access mirrors taskService.getProjectTasks: managers/owners/workspace-admins
 * see everything in a project; plain members see only their own tasks and the
 * events they're part of. Milestones / deadlines / project markers are shared
 * context and shown to every project member.
 */

import prisma from '../configs/prisma.js';
import { requireProjectAccess } from '../utils/permissions.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors.js';
import { ERROR_CODES } from '../utils/constants.js';
import { calendarEventSelect } from '../lib/selectShapes.js';
import { inngest } from '../inngest/client.js'; // FOLLO CALENDAR — Phase 5 reminders
import {
  DAY_MS,
  expandRecurrence,
  normalizeTask,
  normalizeEventOccurrence,
  projectMarkers,
} from '../lib/calendarRecurrence.js';

const MAX_WINDOW_DAYS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers
// ─────────────────────────────────────────────────────────────────────────────
function isManager(project, userId) {
  if (project.ownerId === userId) return true;
  if (project.workspace?.ownerId === userId) return true;
  if (project.workspace?.members?.some((m) => m.userId === userId && m.role === 'ADMIN')) return true;
  return (project.members || []).some(
    (m) => m.userId === userId && m.isActive !== false && (m.role === 'OWNER' || m.role === 'MANAGER'),
  );
}

const accessSelect = {
  id: true, name: true, startDate: true, endDate: true, timezone: true, ownerId: true,
  members: { select: { userId: true, role: true, isActive: true } },
  workspace: { select: { ownerId: true, members: { select: { userId: true, role: true } } } },
};

/** Every project the user can see (owner, active member, or workspace admin). */
export async function listAccessibleProjects(userId) {
  return prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, isActive: true } } },
        { workspace: { OR: [{ ownerId: userId }, { members: { some: { userId, role: 'ADMIN' } } }] } },
      ],
    },
    select: accessSelect,
  });
}

function resolveWindow(opts) {
  const now = new Date();
  const parseD = (v, fb) => {
    if (!v) return fb;
    const d = new Date(v);
    return isNaN(d.getTime()) ? fb : d;
  };
  const from = parseD(opts.from, new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const to = parseD(opts.to, new Date(now.getFullYear(), now.getMonth() + 2, 0));
  if (to < from) throw new ValidationError('`to` must be after `from`', ERROR_CODES.VALIDATION_ERROR);
  if (to - from > MAX_WINDOW_DAYS * DAY_MS) {
    throw new ValidationError(`Date range too large (max ${MAX_WINDOW_DAYS} days)`, ERROR_CODES.VALIDATION_ERROR);
  }
  return { from, to, fromMs: from.getTime(), toMs: to.getTime() };
}

function parseViews(views) {
  const set = new Set((views || 'tasks,events,milestones,deadlines,projects').split(',').map((s) => s.trim()).filter(Boolean));
  return set;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed builders
// ─────────────────────────────────────────────────────────────────────────────
async function buildFeed(projects, userId, opts) {
  const { from, to, fromMs, toMs } = resolveWindow(opts);
  const views = parseViews(opts.views);
  const ids = projects.map((p) => p.id);
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const mgrById = new Map(projects.map((p) => [p.id, isManager(p, userId)]));
  const items = [];

  // Project start/end markers
  for (const p of projects) items.push(...projectMarkers(p, views, fromMs, toMs));

  const wantTasks = views.has('tasks') || views.has('milestones');
  if (wantTasks && ids.length) {
    const tasks = await prisma.task.findMany({
      where: {
        projectId: { in: ids },
        OR: [
          { dueDate: { gte: from, lte: to } },
          { AND: [{ plannedStartDate: { lte: to } }, { plannedEndDate: { gte: from } } ] },
        ],
      },
      select: {
        id: true, projectId: true, title: true, status: true, priority: true, type: true,
        assigneeId: true, dueDate: true, plannedStartDate: true, plannedEndDate: true,
      },
    });
    for (const t of tasks) {
      const isMilestone = t.type === 'MILESTONE';
      if (isMilestone && !views.has('milestones')) continue;
      if (!isMilestone && !views.has('tasks')) continue;
      // Row-level visibility: milestones are shared context; regular tasks are
      // filtered to the member's own unless they manage the project.
      if (!isMilestone && !mgrById.get(t.projectId) && t.assigneeId !== userId) continue;
      items.push(normalizeTask(t, nameById.get(t.projectId)));
    }
  }

  if (views.has('events') && ids.length) {
    const events = await prisma.calendarEvent.findMany({
      where: {
        projectId: { in: ids },
        OR: [
          { startAt: { gte: from, lte: to } },
          { AND: [{ startAt: { lte: to } }, { endAt: { gte: from } }] },
          { AND: [{ rrule: { not: null } }, { startAt: { lte: to } }, { OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: from } }] }] },
        ],
      },
      select: calendarEventSelect,
    });
    for (const ev of events) {
      const mgr = mgrById.get(ev.projectId);
      const involved = mgr || ev.createdById === userId || ev.responsibleId === userId ||
        (ev.participants || []).some((p) => p.userId === userId);
      if (!involved) continue;
      for (const occ of expandRecurrence(ev, fromMs, toMs)) {
        items.push(normalizeEventOccurrence(ev, occ, nameById.get(ev.projectId)));
      }
    }
  }

  items.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return { from: from.toISOString(), to: to.toISOString(), views: [...views], count: items.length, items };
}

export async function getGlobalCalendar(userId, opts) {
  const projects = await listAccessibleProjects(userId);
  return buildFeed(projects, userId, opts);
}

export async function getProjectCalendar(projectId, userId, opts) {
  await requireProjectAccess(userId, projectId); // throws if no access
  const projects = await prisma.project.findMany({ where: { id: projectId }, select: accessSelect });
  return buildFeed(projects, userId, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event CRUD
// ─────────────────────────────────────────────────────────────────────────────
function canEditEvent(event, userId, role) {
  return role === 'OWNER' || role === 'MANAGER' || event.createdById === userId || event.responsibleId === userId;
}

/**
 * Schedule a one-shot reminder via a delayed Inngest event (mirrors the SLA
 * pattern). Default is 24h before; if the event is <24h out, remind 1h before;
 * if <1h out (or in the past, or cancelled, or recurring), skip. The handler
 * re-checks state, so re-scheduling on update is naturally idempotent: the stale
 * delayed event fires later, sees startAt no longer matches, and no-ops.
 * Recurring events (rrule) are skipped in v1. Best-effort — never blocks writes.
 */
async function scheduleEventReminder(event) {
  try {
    if (!event || event.rrule || event.status === 'CANCELLED') return;
    const startMs = new Date(event.startAt).getTime();
    const now = Date.now();
    if (!(startMs > now)) return;
    let ts = startMs - 24 * 60 * 60 * 1000;
    if (ts <= now) ts = startMs - 60 * 60 * 1000;
    if (ts <= now) return;
    await inngest.send({
      name: 'follo/calendar.event.reminder',
      data: { eventId: event.id, scheduledStart: new Date(event.startAt).toISOString() },
      ts,
    });
  } catch (err) {
    console.error('[calendar] schedule reminder failed:', err.message);
  }
}

export async function createEvent(projectId, userId, body) {
  const { role } = await requireProjectAccess(userId, projectId);
  if (role === 'VIEWER') {
    throw new AuthorizationError('Viewers cannot create events', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }
  const { participantIds = [], ...data } = body;
  const uniqueParticipants = [...new Set(participantIds)];
  const event = await prisma.calendarEvent.create({
    data: {
      ...data,
      projectId,
      createdById: userId,
      participants: uniqueParticipants.length
        ? { create: uniqueParticipants.map((uid) => ({ userId: uid })) }
        : undefined,
    },
    select: calendarEventSelect,
  });
  await scheduleEventReminder(event);
  return event;
}

export async function getEvent(eventId, userId) {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId }, select: calendarEventSelect });
  if (!event) throw new NotFoundError('Event not found', ERROR_CODES.NOT_FOUND_ERROR);
  await requireProjectAccess(userId, event.projectId);
  return event;
}

export async function updateEvent(eventId, userId, body) {
  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, projectId: true, createdById: true, responsibleId: true },
  });
  if (!existing) throw new NotFoundError('Event not found', ERROR_CODES.NOT_FOUND_ERROR);
  const { role } = await requireProjectAccess(userId, existing.projectId);
  if (!canEditEvent(existing, userId, role)) {
    throw new AuthorizationError('You cannot edit this event', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }
  const { participantIds, ...data } = body;
  const updated = await prisma.$transaction(async (tx) => {
    if (participantIds) {
      const unique = [...new Set(participantIds)];
      await tx.eventParticipant.deleteMany({ where: { eventId } });
      if (unique.length) {
        await tx.eventParticipant.createMany({ data: unique.map((uid) => ({ eventId, userId: uid })) });
      }
    }
    return tx.calendarEvent.update({ where: { id: eventId }, data, select: calendarEventSelect });
  });
  if ('startAt' in data) await scheduleEventReminder(updated);
  return updated;
}

export async function deleteEvent(eventId, userId) {
  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, projectId: true, createdById: true, responsibleId: true },
  });
  if (!existing) throw new NotFoundError('Event not found', ERROR_CODES.NOT_FOUND_ERROR);
  const { role } = await requireProjectAccess(userId, existing.projectId);
  if (!canEditEvent(existing, userId, role)) {
    throw new AuthorizationError('You cannot delete this event', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  return { id: eventId, projectId: existing.projectId };
}
