# Calendar & Operational Scheduling — Research & Architecture Brief

**Status:** Design proposal (pre-implementation) · **Date:** 2026-08-10 · **Owner:** Product
**Scope:** Evolve the project calendar into an *operational scheduling layer* — tasks, meetings, milestones, deadlines, notes, and weather — that consumes existing project data rather than duplicating it.

> This document is the deliverable of the "research before implementation" rule. No calendar UI is to be built until the data model and integration points below are agreed. Every recommendation is grounded in the **actual** codebase (Prisma schema, notification service, Inngest jobs, permissions, existing `ProjectCalendar`/`ProjectGantt`), cited inline.

---

## 0. Executive summary — the decisions that matter

1. **We are not starting from zero.** A month-grid calendar (`Client/src/components/ProjectCalendar.jsx`, 273 lines) and a full custom Gantt (`Client/src/components/ProjectGantt.jsx`, 1068 lines, drag/resize + PNG/PDF export) already exist, project-scoped, surfaced as `?tab=calendar` / `?tab=gantt` in `ProjectDetails`. Both are hand-built on `date-fns` — **no calendar/Gantt library is installed.** The plan is to *extend* these, not replace them.
2. **Consume, don't duplicate.** Tasks already carry `dueDate` (required), `plannedStartDate/plannedEndDate`, `actualStartDate/actualEndDate`, and baseline dates. Projects carry `startDate/endDate`. Milestones already exist as `Task.type = MILESTONE`. The calendar **reads** these; it never creates a second deadline/milestone record.
3. **Only four genuinely-new entities.** `CalendarEvent` (+ participants, reminders, recurrence exceptions), `Note` (project journal), a unified `Reminder` mechanism, and a `WeatherSnapshot` cache. Plus location/timezone columns that don't exist today.
4. **Weather API → Open-Meteo** (primary), with a one-call-per-site-per-day cache. Best forecast quality + Zimbabwe/Africa coverage + trivial integration. Commercial licensing handled via their low-cost plan or self-hosting (details in §7).
5. **Reminders/alerts ride the existing stack.** `createNotification`/`createBulkNotifications` (in-app + web push) + `emailService` templates, scheduled with the **existing Inngest patterns** (`inngest.send({ ts })` delayed events, `step.sleepUntil`, cron sweeps, self-chaining daily loops).
6. **Intelligence is derived, not a new subsystem.** Conflict/overload/weather-risk detection is computed from existing data on read and by a daily Inngest sweep — clearly labelled as *advisory*, never as prediction.
7. **Two open product decisions** need a call before Phase 2: (a) introduce a lightweight **Phase** entity or keep the hierarchy flat; (b) **global cross-project calendar** vs project-scoped only. Recommendations in §13.

---

## 1. What already exists (the grounding facts)

Everything below is verified against the repo. This section exists so we never re-implement something we already have.

### 1.1 Data we can consume today (`Server/prisma/schema.prisma`)

| Entity | Date/scheduling fields already present | Calendar use |
|---|---|---|
| **Project** (`:186`) | `startDate?`, `endDate?`, `status`, `priority`, `progress` | Project start/end bars, "project completion date" |
| **Task** (`:239`) | `dueDate` (**required**, indexed `:343`), `plannedStartDate?`, `plannedEndDate?`, `actualStartDate?`, `actualEndDate?`, `baselineDueDate?`, baseline planned start/end, `sortOrder` | Task calendar items, deadlines, overdue detection, drag-reschedule |
| **Task (milestone)** | `type = MILESTONE` (enum `TaskType`, `:44`) | Milestones — **no new table** |
| **Task (approval/extension)** | `submittedAt/approvedAt/rejectedAt`, `extensionProposedDate`, `extensionOriginalDueDate` | "Key approval dates" |
| **TaskDependency** (`:353`) | `predecessorId`, `successorId`, `lagDays` (no FS/SS type) | Dependency-aware conflict hints |
| **SLA** | `slaStatus` (string state machine), `SlaEvent` stream | Colour/urgency treatment, "at-risk" flags |

**Enums:** `TaskStatus` = TODO, IN_PROGRESS, BLOCKED, PENDING_APPROVAL, DONE (note: no `IN_REVIEW` despite CLAUDE.md). `Priority` = LOW/MEDIUM/HIGH/CRITICAL. `ProjectStatus` = ACTIVE/PLANNING/COMPLETED/ON_HOLD/CANCELLED.

### 1.2 What does **not** exist (the real gaps)

- **No `Phase` entity** anywhere. The brief's "Project → Phase → Milestone → Task" hierarchy is aspirational — Phase would be net-new.
- **No `Milestone` table** — only the `TaskType.MILESTONE` enum value.
- **No `Event`, `Calendar`, `Meeting`, `Reminder`, `Note`, or `Weather` models.** Meetings/site-visits/inspections have no home today.
- **No `location`/geo columns** (lat/lng/address) on Project, Workspace, or anywhere — required for weather-by-site.
- **No timezone / locale columns** on User, Workspace, or Project. All dates are Prisma `DateTime` (UTC `timestamp(3)`); TZ handling is entirely client-side today.

### 1.3 Existing UI to extend, not rebuild

- `ProjectCalendar.jsx` — month grid via `date-fns` (`startOfMonth`/`eachDayOfInterval`/`addMonths`), 7-col grid, prev/next nav, per-day task counts, selected-day list, **Upcoming + Overdue sidebars already implemented**. Places tasks by `plannedStartDate→plannedEndDate` range, falling back to `dueDate` (`getTasksForDate`, `:34`). "View in Gantt" hands off via `?tab=gantt`.
- `ProjectGantt.jsx` — drag-to-move & resize (mouse + touch) persist via `dispatch(updateTaskAsync({ plannedStartDate, plannedEndDate }))` (`:428`). This is the **exact reschedule mechanism** the calendar's drag-and-drop should reuse.
- Design tokens (observed, consistent): surfaces `bg-white dark:bg-zinc-900`, borders `border-zinc-200 dark:border-zinc-800`, primary `bg-blue-600`, priority colours CRITICAL=red / HIGH=orange / MEDIUM=amber / LOW=zinc, status colours TODO=zinc / IN_PROGRESS=blue / PENDING_APPROVAL=purple / BLOCKED=red-amber / DONE=emerald, SLA HEALTHY=emerald / AT_RISK=amber / BREACHED=red-600. Dark mode = Tailwind `class` strategy (`themeSlice.js`). `react-hot-toast` for toasts. `date-fns` for **all** date math.

### 1.4 Notification & scheduling stack (what reminders plug into)

- **One entry point:** `createNotification({ userId, type, title, message, metadata, url })` (`Server/utils/notificationService.js:25`) — persists a `Notification` row **and** fires web push (VAPID) non-blocking. `createBulkNotifications(userIds, opts)` (`:53`) for fan-out. `NotificationType` enum (`schema.prisma:63`) — we add new values.
- **Channels that actually exist:** in-app (HTTP-polled Redux slice + bell in `NotificationPanel.jsx`), **web push** (`Server/lib/push.js`, service worker `Client/public/sw.js`), **email** (Resend, `Server/utils/emailService.js` — add a template + `sendXxx`). **No SMS/WhatsApp** (confirmed absent). Socket.IO exists but only emits task/project mutations to `project:${id}` rooms — **notifications are not socketed today** (the `addNotification` reducer exists but is unwired → a live-badge opportunity).
- **Inngest** (`Server/inngest/`) is the home for scheduled work. Existing patterns to copy verbatim:
  - **Cron sweep** — `sendTaskDueReminders` (`inngest/index.js:381`, `cron '0 9 * * *'`) queries tomorrow's due tasks. Register new functions in the `functions` array (`index.js:554`).
  - **Delayed event at an exact time** — `inngest.send({ name, data, ts: futureEpochMs })` (`slaJobs.js:903`) — SLA warnings are self-scheduled at task-start, not polled.
  - **Sleep-until-a-date** — `step.sleepUntil('...', new Date(startDate))` (`slaJobs.js:965`) — the cleanest analog for a single event reminder.
  - **Self-chaining daily loop** — `onSlaOverdueDaily` (`slaJobs.js:485`) `step.sleep('24h')` + re-send — "keep alerting until resolved."
  - **Idempotency guard** — every fired job re-fetches and checks state before acting (`slaJobs.js:196`), because delayed events fire regardless of later changes. Calendar reminders must do the same.

### 1.5 Permission & access pattern (to mirror exactly)

- Auth middleware `protect` (`authMiddleware.js:83`) only attaches `req.userId`; **authorization happens in the service layer**, not routes.
- Canonical helpers in `Server/utils/permissions.js`: `requireProjectAccess(userId, projectId)` → `{ project, membership, role }` (`:86`; owner→OWNER, active member→their role, workspace ADMIN→synthesized MANAGER); `requireProjectManager` (`:146`), `requireTaskEditor` (`:233`, assignee OR OWNER/MANAGER).
- **Row-level filtering by role** — `taskService.getProjectTasks` (`:171`) returns all tasks to managers/owners/admins but **only `assigneeId === userId` tasks to plain members** (`:183`). Calendar queries must apply the same visibility rule.
- Client gate: `useUserRole()` exposes `canCreateTasks` (`:86`) etc.; the Gantt hides drag/resize handles behind it (`ProjectGantt.jsx:833`, early-return + toast at `:305`). The calendar's edit/drag must copy this.
- Client data flow: `createAsyncThunk` + `apiCall(url, opts, getToken)` (`apiHelper.js:9`, **fetch not axios**) against `API_V1`; task data lives in the **`workspace` slice**, not `task` (`store.js`; `taskSlice.js` is thunks-only). Routing is flat + query-param (`?tab=...`), not nested REST.

---

## 2. Research findings — patterns from established tools

Grounded scan of Microsoft Project, Primavera P6, Monday.com, Asana, ClickUp, Google/Outlook calendar internals, plus the standards.

### 2.1 How leading PM platforms model the calendar
- **Asana / ClickUp / Monday**: the calendar is a *view over tasks*, not a separate object store. A task with a date appears on the calendar; dragging it edits the task's date. Events/meetings that aren't tasks are a thin secondary object. **→ Adopt.** This is exactly our situation — tasks are the spine; events are additive.
- **MS Project / Primavera P6**: schedule engines with dependencies, critical path, resource levelling, and **baselines**. We already store `baselineDueDate`/`baselinePlannedStart/End` and `TaskDependency.lagDays` — we have the raw material for baseline-vs-actual and lightweight critical-path hints, but full CPM/levelling is out of scope for this feature. **→ Improve later, don't block on it.**
- **Calendars everywhere** distinguish *timed* vs *all-day* items and treat deadlines/milestones as zero-duration markers. **→ Adopt** (all-day flag + milestone marker styling).

### 2.2 Common calendar data model
Two schools: (a) **task-as-event** (calendar view derives items from domain rows) and (b) **first-class event store** (every calendar item is an `Event` row). Best practice for an *operational* PM calendar is **hybrid**: derive task/milestone/deadline items from existing rows; store only genuinely-new items (meetings, site visits, inspections, notes) as `CalendarEvent`. This avoids the classic dual-write bug where a task's date and its "calendar copy" drift apart. **→ Adopt hybrid.**

### 2.3 Recurring events — RRULE (RFC 5545)
Store the **series rule once** (`RRULE`, e.g. `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12`) on the master row and **expand instances on demand** within the queried window; never materialise hundreds of rows. Model a moved/edited single occurrence as an **exception row** keyed by its original date (Google's `originalStartTime`, Graph's exception-occurrence, iCalendar's `RECURRENCE-ID`), and deletions as `EXDATE`. **→ Adopt:** `CalendarEvent.rrule` + `CalendarEventException` table; expand with `rrule` (npm) inside the API's date-window query. ([Nylas RRULE guide](https://www.nylas.com/blog/calendar-events-rrules/), [RFC 5545 EXDATE](https://icalendar.org/iCalendar-RFC-5545/3-8-5-1-exception-date-times.html))

### 2.4 Time zones & date handling
Store everything **UTC** (we already do). For correct recurrence and all-day semantics, an event needs the **IANA timezone** it was authored in (a 09:00 daily standup must stay 09:00 local across DST). All-day items are date-only semantics, not a UTC instant. **→ Adopt:** add `timezone` (IANA, e.g. `Africa/Harare`) to `Project` (default) and to `CalendarEvent`; store `allDay` boolean; convert for display with `date-fns-tz`. This is a real gap — **no TZ column exists today.**

### 2.5 Conflict & overload detection
Standard approach is **interval-overlap** detection (same participant, overlapping `[start,end)`), plus **per-user daily load** (count/sum of assigned task-hours per day) and **dependency violations** (successor scheduled before predecessor end + lag). All computable from data we hold — no ML needed. **→ Adopt** as derived intelligence (§9).

### 2.6 Reminder systems
Two models: **relative offsets** (e.g. "15 min before", "1 day before") resolved against the item's start; and **absolute** one-off reminders. Delivery should be **idempotent and de-duplicated** (never double-send if a job retries). Our Inngest `slaJobs` already demonstrate the exact delayed-event + state-guard pattern. **→ Adopt** offset-based reminders scheduled as delayed Inngest events.

### 2.7 Calendar-to-Gantt relationship
Both are views of the same task rows on different axes (grid of days vs horizontal timeline). Keeping them backed by the *same* task fields (as `ProjectCalendar`/`ProjectGantt` already do) means a drag in one is instantly correct in the other. **→ Preserve;** do not fork the data.

### 2.8 Permission models for shared calendars
Calendar visibility should inherit **project membership** (don't invent a parallel ACL). Event edit rights → organizer + project managers. Optional "private" events later. **→ Adopt:** reuse `requireProjectAccess`/`requireProjectManager` and the row-level member filter.

### 2.9 Weather-aware construction scheduling
Domain literature confirms: rain in the first ~8–12 h compromises fresh concrete; PMs bake in weather "float" days; site-specific forecasting improves planning. The right product behaviour is to **surface risk as advisory** against weather-sensitive activities, never to auto-reschedule or "predict." ([weather-driven scheduling](https://www.visualcrossing.com/resources/blog/weather-driven-construction-project-scheduling-for-safer-smarter-job-sites/)) **→ Adopt** the advisory framing (§7.4).

### 2.10 What to deliberately avoid
- ❌ A second deadline/date store parallel to tasks (drift, dual-write bugs).
- ❌ Materialising recurring instances as rows.
- ❌ A separate calendar ACL.
- ❌ Presenting weather as a guarantee, or auto-moving activities.
- ❌ Full CPM/resource-levelling in v1 (scope creep).
- ❌ Adding a heavyweight calendar library — the app is deliberately `date-fns` + custom; match it.

---

## 3. Recommended functionality

### 3.1 Views (extend `ProjectCalendar`)
Month · Week · Day/Agenda · "Upcoming" (deadlines/meetings) · "Overdue" — Month/Upcoming/Overdue already exist; add Week and Day/Agenda. A view toggle that **preserves the focused date and filters** when switching (context is not lost). Gantt stays the timeline view and cross-links both ways.

### 3.2 Events & meetings (new `CalendarEvent`)
Types: project/site/contractor/client meeting, inspection, site visit, handover, progress review, internal, general. Fields: title, description, start/end, all-day, location, `projectId`, optional `phaseId`, optional `relatedTaskId`, participants, responsible person, notes, attachments, recurrence, reminders, status, **outcome/action items**. A meeting can **spawn follow-up tasks** (creates real `Task` rows linked back via `metadata.sourceEventId`).

### 3.3 Tasks & to-dos (consume existing tasks)
Schedule onto dates (edit `plannedStart/End` or `dueDate`), assign, set deadlines/reminders, view alongside events, **create a task from the calendar**, **drag to reschedule** (reuse `updateTaskAsync`), see overdue prominently, **complete from the calendar** (status→DONE via existing task action). Tasks stay linked to project/assignee (and phase/milestone once those exist).

### 3.4 Deadlines & milestones
Deadlines are derived from `Task.dueDate` + `Project.endDate` — no new records. Strong visual states: **Upcoming → Due Today → Due Soon → Overdue → Completed** (derived from `dueDate` vs now and `status`/`actualEndDate`). Milestones (`Task.type = MILESTONE`) render as **diamond markers**, visually distinct from tasks/events.

### 3.5 Notes & project journal (new `Note`)
Lightweight, date-stamped, authored, attachable to a date / project / task / event / milestone / site visit. v1: plain text (+ markdown) + attachments (reuse the R2/Mux comment pipeline) and a `date`. Defer @mentions/rich-text to a later pass. Follow-up actions = "convert note to task."

### 3.6 Weather intelligence
Per project **site location** → daily forecast shown against relevant days; weather-sensitive activities flagged with advisory risk. Full design in §7.

### 3.7 Project intelligence
Approaching deadlines, overdue detection, schedule conflicts, overloaded users, critical milestones, dependency risks, meeting-vs-activity clashes, weather-sensitive activities, "review this" surfacing. Derived (§9), delivered as calendar badges + a "Needs review" panel + notifications.

### 3.8 Relationships & navigation
Every calendar item links into `Project → (Phase) → (Milestone) → Task → Event` and back. Deep-link via the existing query-param routing (`/task?id=…`, `/projectsDetail?id=…&tab=calendar`).

---

## 4. UX recommendations

- **Two audiences, one calendar.** PM sees the whole project schedule at a glance (all tasks/events/milestones, risk badges, "Needs review"). A team member's default is filtered to **"What do I need to do today?"** — mirror the existing row-level rule (members see their assigned items) and open on Day/Agenda.
- **Match the design language** (§1.3): `bg-white dark:bg-zinc-900` surfaces, zinc borders, blue-600 primary, the established priority/status/SLA colour tokens, `date-fns`, `react-hot-toast`, full light/dark. No new component library.
- **Clear type distinction** without colour overload: **task** = filled chip (priority-tinted left edge), **meeting/event** = outlined chip with a time, **milestone** = diamond marker, **deadline** = small flag/underline on the day, **weather** = a single glyph + %/mm in the day header, **risk** = one amber ⚠. Reserve red strictly for overdue/breach.
- **Fast navigation:** keyboard (`T` today, `←/→` period, `M/W/D` views), sticky period header, "jump to date." Switching views keeps the focused date + active filters.
- **Minimal clutter:** collapse dense days to "+N more"; density toggle (comfortable/compact); weekends de-emphasised; today's column highlighted.
- **Responsive:** month grid → agenda list on mobile (the PM's phone is a common site device).
- **Drag-to-reschedule** shows a ghost + snaps to day; on drop, optimistic update + `updateTaskAsync`; permission-gated exactly like the Gantt (`canCreateTasks`), with a toast when denied.
- **Advisory, never authoritative:** weather and intelligence render in a visibly distinct "advisory" style (muted panel, "Forecast" / "Suggestion" labels) so API data and our recommendations are never confused (§7.4).

---

## 5. Data model (new tables — Prisma)

Design rules: **consume** task/project dates; **add** only what has no home; make every new item **relatable** to existing entities via nullable FKs; keep everything UTC + an IANA `timezone` for correctness.

### 5.1 Location & timezone (add to existing models)
```prisma
model Project {
  // … existing fields …
  // Site location (for weather + agenda TZ). All nullable — backfilled per project.
  locationName String?
  latitude     Float?
  longitude    Float?
  timezone     String?  @default("Africa/Harare")   // IANA; display + recurrence anchor
}
// Optional (later): User.timezone for per-user agenda display.
```

### 5.2 CalendarEvent (+ participants, reminders, exceptions)
```prisma
enum CalendarEventType {
  PROJECT_MEETING SITE_MEETING CONTRACTOR_MEETING CLIENT_MEETING
  INSPECTION SITE_VISIT HANDOVER PROGRESS_REVIEW INTERNAL_MEETING
  SITE_ACTIVITY MAINTENANCE APPOINTMENT OTHER
}
enum EventStatus       { SCHEDULED CONFIRMED IN_PROGRESS COMPLETED CANCELLED }
enum ParticipantResp   { INVITED ACCEPTED DECLINED TENTATIVE }

model CalendarEvent {
  id            String   @id @default(uuid())
  projectId     String
  phaseId       String?                       // forward-compat (see §13)
  relatedTaskId String?                       // link to a Task/milestone
  type          CalendarEventType @default(PROJECT_MEETING)
  status        EventStatus       @default(SCHEDULED)
  title         String
  description   String?
  location      String?                       // free text, distinct from Project geo
  startAt       DateTime                       // UTC instant
  endAt         DateTime?
  allDay        Boolean  @default(false)
  timezone      String?                        // IANA; defaults from Project
  isWeatherSensitive Boolean @default(false)   // drives weather-risk flags (§7)
  rrule         String?                        // RFC 5545; null = single occurrence
  recurrenceEndAt DateTime?
  responsibleId String?                        // the accountable user
  outcome       String?                        // meeting outcome / minutes
  createdById   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  relatedTask Task?   @relation(fields: [relatedTaskId], references: [id], onDelete: SetNull)
  participants EventParticipant[]
  reminders    Reminder[]
  exceptions   CalendarEventException[]
  attachments  Attachment[]                    // see §5.5
  notes        Note[]

  @@index([projectId, startAt])
  @@index([startAt])
}

model EventParticipant {
  id       String @id @default(uuid())
  eventId  String
  userId   String
  response ParticipantResp @default(INVITED)
  event    CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([eventId, userId])
}

// A single occurrence moved/edited/cancelled out of a recurring series.
model CalendarEventException {
  id           String   @id @default(uuid())
  eventId      String
  originalDate DateTime            // the occurrence this overrides (RECURRENCE-ID)
  cancelled    Boolean  @default(false)   // true = EXDATE
  startAt      DateTime?           // overrides for this occurrence only
  endAt        DateTime?
  title        String?
  event        CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  @@unique([eventId, originalDate])
}
```

### 5.3 Reminder (unified — events now, extensible to tasks)
```prisma
enum ReminderChannel { IN_APP PUSH EMAIL }        // SMS/WHATSAPP reserved, not yet wired
model Reminder {
  id           String @id @default(uuid())
  eventId      String?                            // XOR target …
  taskId       String?                            // … reuse for task reminders later
  userId       String                             // who to remind
  offsetMinutes Int                               // minutes before start/due (e.g. 1440 = 1 day)
  channels     ReminderChannel[] @default([IN_APP, PUSH])
  scheduledFor DateTime                           // resolved absolute time (for the Inngest job)
  sentAt       DateTime?                          // idempotency
  event        CalendarEvent? @relation(fields: [eventId], references: [id], onDelete: Cascade)
  @@index([scheduledFor, sentAt])
}
```
> Task "due tomorrow" reminders already work via `sendTaskDueReminders` (cron). This table is primarily for **event** reminders and any custom per-user offsets; it does not replace the existing task-due job.

### 5.4 Note (project journal)
```prisma
enum NoteType { GENERAL SITE_VISIT PROGRESS ISSUE DECISION }
model Note {
  id         String   @id @default(uuid())
  type       NoteType @default(GENERAL)
  body       String                              // markdown text
  noteDate   DateTime                            // the date the note is *about*
  authorId   String
  projectId  String?                             // at least one link is set …
  taskId     String?
  eventId    String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  author     User @relation(fields: [authorId], references: [id])
  project    Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  attachments Attachment[]
  @@index([projectId, noteDate])
}
```

### 5.5 Attachment (shared, reuses the existing R2/Mux pipeline)
```prisma
model Attachment {
  id          String @id @default(uuid())
  eventId     String?
  noteId      String?
  url         String            // R2/CDN url (same pipeline as Comment media)
  fileKey     String?
  fileName    String?
  type        CommentType       // reuse TEXT/IMAGE/VIDEO/AUDIO/FILE
  sizeBytes   Int?
  createdById String
  createdAt   DateTime @default(now())
}
```
> Reuses the media conventions already on `Comment` (`schema.prisma:402`) — same R2 keys, Mux fields if we later allow video minutes.

### 5.6 WeatherSnapshot (cache) — §7
```prisma
model WeatherSnapshot {
  id          String   @id @default(uuid())
  latBucket   Decimal  @db.Decimal(6,2)     // rounded lat (≈1km) — cache key
  lngBucket   Decimal  @db.Decimal(6,2)
  forecastDate DateTime @db.Date            // the day this forecast is for
  fetchedAt   DateTime @default(now())
  source      String   @default("open-meteo")
  tempMinC    Float?
  tempMaxC    Float?
  precipMm    Float?                        // precipitation_sum
  precipProb  Int?                          // precipitation_probability_max (%)
  windKph     Float?                        // wind_speed_10m_max
  humidity    Int?                          // relative_humidity_2m (mean)
  weatherCode Int?                          // WMO code
  raw         Json?                         // full API payload for audit
  @@unique([latBucket, lngBucket, forecastDate])
  @@index([forecastDate])
}
```
> Keyed by **rounded** lat/lng + date so all projects near a site share one cached forecast → tiny API volume. TTL: refresh a day's forecast at most a few times/day (a daily sweep is enough; §7.3).

### 5.7 NotificationType additions (migration on the existing enum)
```
EVENT_REMINDER  MEETING_REMINDER  DEADLINE_APPROACHING
MILESTONE_APPROACHING  SCHEDULE_CONFLICT  WEATHER_ALERT
```

---

## 6. API architecture

Follows the existing shape: routes under `/api/v1/…`, thin controllers doing `const { userId } = await req.auth()`, **authorization in the service layer** via `requireProjectAccess`/`requireProjectManager`, responses in the `{ success, data, error }` envelope, Zod validation per route.

### 6.1 Calendar feed (the aggregator — the heart of it)
```
GET /api/v1/projects/:projectId/calendar?from=ISO&to=ISO&views=tasks,events,milestones,deadlines,weather
```
Returns a **merged, normalised** item list for the window:
- tasks (from existing task rows, filtered by role like `getProjectTasks`),
- milestones (tasks with `type=MILESTONE`),
- deadlines (derived markers from `dueDate`/`Project.endDate`),
- events (with **recurrence expanded** across `[from,to)` using `rrule`, exceptions applied),
- weather (cached snapshots for the project's location across the window),
- derived intelligence flags (§9) attached to the relevant items.

Each item is normalised to `{ id, kind, title, start, end, allDay, status, priority?, url, badges[] }` so the client renders one list. Recurrence expansion happens **server-side** in this endpoint only.

### 6.2 Events
```
POST   /api/v1/projects/:projectId/events            (manager/organizer)
GET    /api/v1/projects/:projectId/events?from&to
PATCH  /api/v1/events/:id                             (organizer|manager)
DELETE /api/v1/events/:id                             (organizer|manager)
POST   /api/v1/events/:id/participants                add/update RSVP
PATCH  /api/v1/events/:id/occurrences/:date          edit ONE occurrence → CalendarEventException
DELETE /api/v1/events/:id/occurrences/:date          cancel ONE occurrence (EXDATE)
POST   /api/v1/events/:id/follow-up-tasks            create Task(s) from a meeting outcome
POST   /api/v1/events/:id/reminders                  set per-user reminder offsets
```

### 6.3 Task scheduling (reuse existing task endpoints)
Drag-reschedule and complete-from-calendar reuse the existing task update path (`PATCH` task → `plannedStartDate/plannedEndDate` or `status`) via `updateTaskAsync`. **No new deadline endpoints.** "Create task from calendar" hits the existing create-task route with the clicked date prefilled.

### 6.4 Notes
```
POST /api/v1/notes            GET /api/v1/projects/:projectId/notes?from&to
PATCH /api/v1/notes/:id       DELETE /api/v1/notes/:id
POST /api/v1/notes/:id/convert-to-task
```

### 6.5 Weather
```
GET /api/v1/projects/:projectId/weather?from&to     (served from cache; never hits Open-Meteo inline)
PATCH /api/v1/projects/:projectId/location          set locationName/lat/lng/timezone (manager)
```

### 6.6 Intelligence
```
GET /api/v1/projects/:projectId/insights            derived alerts for the "Needs review" panel
```

---

## 7. Weather API — recommendation

### 7.1 Recommendation: **Open-Meteo** (primary)
Best fit on every axis that matters here:

| Criterion | Open-Meteo | OpenWeather (One Call 3.0) | Tomorrow.io |
|---|---|---|---|
| Forecast quality | High — blends ECMWF/GFS/national models | Good | High (probabilistic 1F model) |
| Zimbabwe/Africa coverage | Excellent (global, model-blended) | Good | Good |
| Fields we need (temp, rain %, rainfall mm, wind, humidity, WMO code, multi-day) | ✅ all | ✅ | ✅ |
| Free/dev | **No key**, 10k calls/day | 1k/day free then pay-as-you-go | Limited free |
| Commercial | ~$29/mo plan **or self-host (open-source)** | Pay-as-you-go (~$0.0015/call) | Enterprise-leaning |
| Ease of integration | **Trivial** (`lat`,`lng`,`timezone` query) | Easy (key) | Moderate |

**Why:** with a **one-call-per-site-per-day cache** (§5.6) our real call volume is a handful per day regardless of tier, so cost is negligible — and Open-Meteo's simplicity (no key in dev, `timezone=Africa/Harare`, clean hourly+daily JSON) plus strong African coverage make it the clear primary. **Fallback:** OpenWeather One Call 3.0 (pay-as-you-go) behind the same cache interface if we ever need a second source. **Future:** Tomorrow.io if native weather-*event* alerting becomes central. ([Open-Meteo pricing](https://open-meteo.com/en/pricing) · [comparison](https://www.meteomatics.com/en/weather-api/best-weather-apis/))

> **Licensing note:** Open-Meteo's free tier is **non-commercial**. For production we take their low-cost commercial plan or self-host the open-source server. Because of the daily cache, either path is cheap. This must be a conscious pre-launch decision.

### 7.2 Request shape
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lng}&timezone={ianaTz}&forecast_days=14
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,
         precipitation_probability_max,wind_speed_10m_max,weather_code
  &hourly=precipitation,precipitation_probability,temperature_2m,
          relative_humidity_2m,wind_speed_10m,weather_code
  &current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m
```
Map `weather_code` (WMO) → an icon/label table in shared constants.

### 7.3 Cache strategy
- One Inngest **daily cron** (mirror `sendTaskDueReminders`) iterates **distinct project locations** (rounded lat/lng), fetches once each, upserts `WeatherSnapshot` rows for the forecast horizon.
- The `GET …/weather` endpoint and the calendar feed read **only** from `WeatherSnapshot` — the browser and request path never call Open-Meteo directly (keeps keys server-side, bounds volume, survives API downtime).
- Rounding lat/lng to ~2 dp (≈1 km) means nearby projects share a snapshot.

### 7.4 Advisory framing (non-negotiable)
Two clearly separated layers, visibly distinct in the UI:
1. **Forecast (data from Open-Meteo)** — shown as-is with the source and fetch time. "Rain probability 80% · 18 mm · source: Open-Meteo, fetched 06:00."
2. **Suggestion (generated by us)** — a rule-based advisory, labelled as such: *"Concrete pouring is scheduled Wed; forecast shows high rainfall probability. Consider reviewing this activity."* Never "it will rain," never auto-reschedule.

Rule example (server-side, in the insights service):
```
if (event.isWeatherSensitive && snapshot.precipProb >= 70 || snapshot.precipMm >= 10)
  → advisory WEATHER_ALERT on that day, severity by threshold.
```
Thresholds live in shared constants so they're tunable per activity type later.

---

## 8. Integration points with existing modules

| Concern | Reuse (don't rebuild) | New glue |
|---|---|---|
| **Task dates** | `Task.dueDate/plannedStart/End/actual*`, `updateTaskAsync` | calendar feed reads them; drag calls the same thunk |
| **Milestones** | `Task.type = MILESTONE` | diamond rendering only |
| **Permissions** | `requireProjectAccess`/`requireProjectManager`, row-level member filter | applied in calendar/event/note services |
| **Client role gate** | `useUserRole().canCreateTasks` | gates event create + drag |
| **Notifications** | `createNotification`/`createBulkNotifications` (+ push) | new `NotificationType` values |
| **Email** | `emailService.sendEmail` + template pattern | `sendEventReminder`, `sendWeatherAlert` templates |
| **Scheduling** | Inngest cron / `inngest.send({ts})` / `step.sleepUntil` / self-chaining loop | `sendEventReminders`, `fetchDailyWeather`, `computeDailyInsights` functions registered in `index.js:554` |
| **Real-time** | Socket.IO `project:${id}` rooms | emit `event_created/updated`; optionally wire the unused `addNotification` reducer for a live bell |
| **Media/attachments** | R2/Mux pipeline used by `Comment` | `Attachment` reuses the same keys/`CommentType` |
| **Client data** | `createAsyncThunk` + `apiCall(url,opts,getToken)`, `workspace` slice | a `calendar` slice (or extend `workspace`) |
| **UI** | `ProjectCalendar` date logic + tokens, `ProjectGantt` drag mechanics, `date-fns`, toasts | Week/Day/Agenda views, event chips, weather glyphs |
| **Routing** | `?tab=calendar` sub-view (exists) + optional global `/calendar` lazy route + `Sidebar.jsx` entry | — |

---

## 9. Intelligence layer (derived, advisory)

Computed — never a separate stored source of truth. Two delivery paths: **on-read** (attached to calendar-feed items as `badges[]`) and a **daily Inngest sweep** (`computeDailyInsights`) that writes surfaced alerts to notifications + a "Needs review" panel.

| Insight | Derivation (all from existing data) |
|---|---|
| Approaching deadline | `dueDate` within N days & not DONE |
| Overdue | `dueDate < now` & status ≠ DONE (already flagged by SLA) |
| Schedule conflict | participant/assignee has overlapping `[start,end)` items |
| Overloaded user | count/planned-hours of a user's items on a day > threshold |
| Critical milestone approaching | `type=MILESTONE` within N days |
| Dependency risk | successor planned before predecessor `plannedEndDate + lagDays` |
| Meeting vs activity clash | event overlaps a weather-sensitive or milestone day |
| Weather-sensitive at risk | `isWeatherSensitive` day meets weather thresholds (§7.4) |
| High-activity period | day/week item count in top percentile for the project |
| "Review this" | any of the above above severity threshold → surfaced to PM |

Example surfaced alert (matches the brief):
> **Project alert** — Concrete pour scheduled in 2 days. Forecast: 75% chance of rain. Contractor readiness not confirmed. *Consider reviewing this activity.* (advisory)

Severity thresholds in shared constants; each insight carries `{ kind, severity, itemId, message, isAdvisory:true }`.

---

## 10. Notifications & reminders

- **Event reminders:** on event create/update, upsert `Reminder` rows and schedule delayed Inngest events (`inngest.send({ name:'calendar/event.reminder', ts: scheduledFor })`, or `step.sleepUntil`). The job re-fetches, checks the event isn't cancelled/moved (idempotency guard, per `slaJobs.js:196`), then `createNotification` (in-app + push) and/or email.
- **Deadline/milestone approaching:** a daily cron (like `sendTaskDueReminders`) — but emitting `createNotification` (the existing job only emails; we add in-app/push).
- **Weather alert / schedule conflict:** produced by `computeDailyInsights`, delivered via `createBulkNotifications` to the responsible user + PM.
- **Channels:** in-app + web push now; email via a new template; **SMS/WhatsApp are designed-for but not wired** (reserved enum values, no Twilio dependency added) — exactly the "don't build unready channels" instruction.
- **Live bell (optional):** emit a Socket.IO `notification` event and wire the currently-unused `addNotification` reducer so the badge updates without an HTTP refetch.

---

## 11. Implementation phases (mapped to the codebase)

**Phase 1 — Research & architecture** *(this document)*
Deliver findings, data model, UX, weather-API choice, integration map, risks. Decide the two open questions (§13). **Exit:** schema + endpoints signed off.

**Phase 2 — Core calendar**
- Migration: location/timezone on `Project`; `CalendarEvent`, `EventParticipant`, `CalendarEventException`; `NotificationType` additions.
- `GET …/calendar` aggregator (tasks + milestones + deadlines + events, recurrence expansion, role filter).
- Client: `calendar` slice + thunks (`apiCall`); extend `ProjectCalendar` with **Week + Day/Agenda**; view toggle preserving date/filters; event chips vs task chips vs milestone diamonds; **drag-to-reschedule** reusing `updateTaskAsync` + `canCreateTasks` gate; create-task-from-calendar; complete-from-calendar; deadline states (Upcoming→Due Today→Due Soon→Overdue→Completed).

**Phase 3 — Meetings & notes**
- Event CRUD + participants/RSVP + recurrence exceptions + reminders; **follow-up tasks from a meeting**; meeting outcome/minutes.
- `Note` + `Attachment` (reuse R2/Mux); attach notes to date/task/event/project; convert-note-to-task.

**Phase 4 — Weather intelligence**
- `WeatherSnapshot` + project location editor; `fetchDailyWeather` Inngest cron (Open-Meteo, cached); `GET …/weather`; weather glyphs in day headers; `isWeatherSensitive` flag on events; advisory risk rules (clearly labelled).

**Phase 5 — Notifications & intelligence**
- `Reminder` scheduling via delayed Inngest events; `computeDailyInsights` sweep; deadline/milestone/conflict/weather notifications through `createNotification`/email; "Needs review" panel; optional live-bell socket wiring.

Each phase ships behind the existing `?tab=calendar` sub-view first; the optional global `/calendar` route is additive.

---

## 12. Risks & edge cases

- **Data drift (the #1 risk):** never copy a task's date into a calendar row. The feed derives task items live. *Mitigation:* no task-date duplication anywhere; one source of truth.
- **Recurrence correctness:** DST, moved/cancelled single occurrences, infinite series. *Mitigation:* store `rrule` + `timezone`; bound expansion to the queried window + a hard `recurrenceEndAt`/max horizon; exceptions table for overrides; unit-test around DST transitions (`Africa/Harare` has no DST, but participants may be elsewhere).
- **Timezones:** no TZ columns exist today; mixed-TZ participants; all-day vs instant. *Mitigation:* add `timezone`, store UTC, convert with `date-fns-tz`, treat all-day as date-only.
- **Idempotent reminders:** Inngest retries and delayed events fire regardless of later edits. *Mitigation:* `Reminder.sentAt` guard + re-fetch/state-check pattern from `slaJobs`.
- **Permission leakage:** a naive calendar feed could expose tasks a member shouldn't see. *Mitigation:* apply the exact `getProjectTasks` row-level filter; events scoped to project membership.
- **Weather reliability & framing:** API downtime; over-trusting the forecast. *Mitigation:* serve only from cache (survives outages); advisory-only labelling; never auto-reschedule.
- **Missing location:** weather features must degrade gracefully when a project has no lat/lng. *Mitigation:* feature-detect; prompt PM to set location; hide weather cleanly otherwise.
- **Performance:** aggregating tasks+events+recurrence+weather over a wide window. *Mitigation:* window-bounded queries, the `startAt`/`dueDate` indexes, cap the max range per request, cache weather.
- **Notification fatigue:** conflict/weather/deadline alerts could spam. *Mitigation:* severity thresholds, per-project daily digest option, dedupe by `metadata`.
- **Phase gap:** the brief assumes Phases exist; they don't. *Mitigation:* `phaseId` nullable everywhere now; decide §13 before wiring phase filters.
- **Scope creep toward CPM/resource-levelling:** tempting but large. *Mitigation:* explicitly deferred; keep dependency use to advisory hints in v1.

---

## 13. Open product decisions (needed before Phase 2)

1. **Phase entity — introduce or defer?**
   *Recommendation:* introduce a **lightweight `Phase`** (`id, projectId, name, startDate?, endDate?, order`) in Phase 2. It's small, unlocks the "Project → Phase → Milestone → Task" grouping the brief asks for, and `phaseId` is already nullable across the new tables. Tasks would gain an optional `phaseId`. If we defer, everything still works — phase filters just stay hidden.
2. **Global cross-project calendar vs project-scoped only?**
   *Recommendation:* ship **project-scoped first** (reuses the existing `?tab=calendar` and permission model with zero new access logic), then add a **global `/calendar`** that unions the feed across the user's projects (respecting per-project role filters) as a fast follow. The Sidebar entry + lazy route are ready-made slots.
3. **Weather commercial tier — Open-Meteo paid plan vs self-host?** Cheap either way behind the cache; needs a pre-launch call.
4. **User-level timezone** now or later? *Recommendation:* project-level TZ in Phase 2; per-user TZ only if multi-region participants become common.

---

### Appendix — source map (for implementers)
- Data model: `Server/prisma/schema.prisma` (Project `:186`, Task `:239`, TaskDependency `:353`, Notification `:427`, enums `:19-105`).
- Notifications: `Server/utils/notificationService.js`, `Server/lib/push.js`, `Server/utils/emailService.js`, `Client/src/features/notificationSlice.js`, `Client/src/components/NotificationPanel.jsx`.
- Jobs: `Server/inngest/index.js` (`:381`, `:554`), `Server/inngest/slaJobs.js` (`:903`, `:965`, `:485`).
- Permissions: `Server/utils/permissions.js` (`:86`, `:146`, `:233`), `Server/services/taskService.js:171`, `Client/src/hooks/useUserRole.js`.
- UI to extend: `Client/src/components/ProjectCalendar.jsx`, `Client/src/components/ProjectGantt.jsx`, `Client/src/features/apiHelper.js`, `Client/src/features/themeSlice.js`.
