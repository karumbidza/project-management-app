// FOLLO CALENDAR
/**
 * Pure calendar helpers — recurrence expansion + feed-item normalisation.
 * No database or side effects, so these are unit-testable in isolation.
 * Kept separate from calendarService (which imports Prisma) for that reason.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_OCCURRENCES = 366; // safety cap per recurring series

export const iso = (d) => (d ? new Date(d).toISOString() : null);
export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// ── Recurrence (minimal RFC 5545 subset: FREQ, INTERVAL, COUNT, UNTIL, BYDAY) ─
const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function parseUntil(v) {
  // Accept 20260901 or 20260901T000000Z or an ISO string.
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(v);
  if (!m) { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
}

export function parseRRule(rrule) {
  if (!rrule) return null;
  const parts = {};
  for (const seg of rrule.replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) parts[k.trim().toUpperCase()] = v.trim();
  }
  if (!parts.FREQ) return null;
  return {
    freq: parts.FREQ.toUpperCase(),
    interval: Math.max(1, parseInt(parts.INTERVAL, 10) || 1),
    count: parts.COUNT ? parseInt(parts.COUNT, 10) : null,
    until: parts.UNTIL ? parseUntil(parts.UNTIL) : null,
    byday: parts.BYDAY ? parts.BYDAY.split(',').map((d) => BYDAY[d.toUpperCase()]).filter((n) => n != null) : null,
  };
}

/**
 * Expand a (possibly recurring) event into concrete occurrences that overlap
 * [fromMs, toMs]. Applies exceptions (cancelled = EXDATE, or per-occurrence
 * override). Returns [{ startAt: Date, endAt: Date|null, title, occKey }].
 */
export function expandRecurrence(event, fromMs, toMs) {
  const start = new Date(event.startAt);
  const durationMs = event.endAt ? new Date(event.endAt).getTime() - start.getTime() : 0;
  const exceptions = new Map((event.exceptions || []).map((e) => [dayKey(e.originalDate), e]));

  const rule = parseRRule(event.rrule);
  const out = [];
  const push = (occStart) => {
    const key = dayKey(occStart);
    const exc = exceptions.get(key);
    if (exc && exc.cancelled) return; // EXDATE
    const s = exc && exc.startAt ? new Date(exc.startAt) : occStart;
    const e = exc && exc.endAt ? new Date(exc.endAt) : durationMs ? new Date(occStart.getTime() + durationMs) : null;
    const endMs = e ? e.getTime() : s.getTime();
    if (endMs >= fromMs && s.getTime() <= toMs) {
      out.push({ startAt: s, endAt: e, title: (exc && exc.title) || event.title, occKey: key });
    }
  };

  if (!rule) { push(start); return out; }

  const hardEnd = Math.min(
    toMs,
    rule.until ? rule.until.getTime() : Infinity,
    event.recurrenceEndAt ? new Date(event.recurrenceEndAt).getTime() : Infinity,
  );

  let emitted = 0;
  const cursor = new Date(start);
  for (let guard = 0; guard < 4000 && emitted < MAX_OCCURRENCES; guard++) {
    if (cursor.getTime() > hardEnd) break;
    if (rule.freq === 'WEEKLY' && rule.byday && rule.byday.length) {
      const weekStart = new Date(cursor);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      for (const wd of [...rule.byday].sort((a, b) => a - b)) {
        const occ = new Date(weekStart);
        occ.setUTCDate(weekStart.getUTCDate() + wd);
        occ.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0);
        if (occ < start || occ.getTime() > hardEnd) continue;
        if (rule.count && emitted >= rule.count) break;
        push(occ); emitted++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7 * rule.interval);
    } else {
      if (rule.count && emitted >= rule.count) break;
      push(cursor); emitted++;
      if (rule.freq === 'DAILY') cursor.setUTCDate(cursor.getUTCDate() + rule.interval);
      else if (rule.freq === 'WEEKLY') cursor.setUTCDate(cursor.getUTCDate() + 7 * rule.interval);
      else if (rule.freq === 'MONTHLY') cursor.setUTCMonth(cursor.getUTCMonth() + rule.interval);
      else if (rule.freq === 'YEARLY') cursor.setUTCFullYear(cursor.getUTCFullYear() + rule.interval);
      else break;
    }
  }
  return out.sort((a, b) => a.startAt - b.startAt);
}

// ── Normalisation → one flat item shape the client renders uniformly ─────────
export function normalizeTask(task, projectName) {
  const isMilestone = task.type === 'MILESTONE';
  const start = task.plannedStartDate || task.dueDate;
  const end = isMilestone ? task.dueDate : task.plannedEndDate || task.dueDate;
  return {
    id: task.id,
    kind: isMilestone ? 'milestone' : 'task',
    projectId: task.projectId,
    projectName,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: iso(task.dueDate),
    start: iso(start),
    end: iso(end),
    allDay: true,
    url: `/task?id=${task.id}`,
  };
}

export function normalizeEventOccurrence(event, occ, projectName) {
  const recurring = !!event.rrule;
  return {
    id: recurring ? `${event.id}@${occ.occKey}` : event.id,
    eventId: event.id,
    kind: 'event',
    eventType: event.type,
    projectId: event.projectId,
    projectName,
    title: occ.title,
    status: event.status,
    location: event.location,
    isWeatherSensitive: event.isWeatherSensitive,
    relatedTaskId: event.relatedTaskId,
    responsibleId: event.responsibleId,
    allDay: event.allDay,
    start: iso(occ.startAt),
    end: iso(occ.endAt),
    recurring,
    participants: (event.participants || []).map((p) => ({
      userId: p.userId,
      response: p.response,
      name: p.user?.name || null,
      image: p.user?.image || null,
    })),
    url: `/projectsDetail?id=${event.projectId}&tab=calendar`,
  };
}

export function projectMarkers(project, views, fromMs, toMs) {
  const items = [];
  const within = (d) => d && new Date(d).getTime() >= fromMs && new Date(d).getTime() <= toMs;
  if (views.has('projects') && within(project.startDate)) {
    items.push({ id: `pstart-${project.id}`, kind: 'project', projectId: project.id, projectName: project.name,
      title: `${project.name} — start`, start: iso(project.startDate), end: iso(project.startDate), allDay: true,
      url: `/projectsDetail?id=${project.id}` });
  }
  if (views.has('deadlines') && within(project.endDate)) {
    items.push({ id: `pend-${project.id}`, kind: 'deadline', projectId: project.id, projectName: project.name,
      title: `${project.name} — target completion`, start: iso(project.endDate), end: iso(project.endDate), allDay: true,
      url: `/projectsDetail?id=${project.id}` });
  }
  return items;
}
