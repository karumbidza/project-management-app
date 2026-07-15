# Production Readiness Review — Follo Project Management App

_Senior software & architecture review. Date: 2026-06-29. Branch: `claude/app-readiness-review-ew5luh`._

Scope: full-stack audit across **security/vulnerabilities, cost, speed (esp. chat/real-time), bugs, and optimisation**. Backend `Server/` (Express 5, Prisma/Neon, Clerk, Socket.IO, Inngest, R2, Mux). Frontend `Client/` (React 19, Redux, Vite). ~30k LOC.

---

## Verdict

**Not yet production-ready.** The architecture is mature and many things are done well (Helmet/CSP, Zod validation + global HTML sanitisation, Clerk webhook signature verification, R2 presigned direct uploads, graceful shutdown, Sentry at sane 0.1 sampling, good DB index coverage, no committed secrets, no SQL injection, no real XSS sink). But there is a **cluster of launch-blocking issues**: an unauthenticated real-time channel leaking cross-tenant data, critical CVEs in the exact auth library guarding every route, a rate limiter that silently doesn't work, several IDOR/authz gaps, and a handful of guaranteed-crash / wrong-result correctness bugs (extension flow, completed-task delay calc, broken MyTasks quick-actions).

Estimated effort to "launch-safe": **the P0 set below is ~2–3 focused days.**

---

## P0 — Launch blockers (fix before any production traffic)

| # | Area | Issue | Location | Impact |
|---|------|-------|----------|--------|
| P0-1 | Security | **Unauthenticated Socket.IO.** `join_project` takes any `projectId` with no JWT / membership check. All task + private-chat events are broadcast to `project:<id>` rooms. | `Server/server.js:70-83` | Cross-tenant real-time data breach. Guess/enumerate a project ID → live feed of another tenant's tasks, assignees, SLA/blocker text, and PM-only chat. |
| P0-2 | Security | **Critical CVEs in Clerk auth libs.** `@clerk/shared` <3.47.4 has a CRITICAL (9.1) middleware route-protection-bypass advisory; `@clerk/express` <=1.7.78 a HIGH (8.1) authz-bypass. `npm audit`: 2 critical / 26 high server-side. | `Server/package.json` | The library authenticating 100% of routes has a known auth-bypass. |
| P0-3 | Security | **Rate limiter keys on `req.auth.userId`, which is always `undefined`** (Clerk `req.auth` is a function). Silently degrades to per-IP, and runs *before* `protect` so `req.userId` isn't set either. | `Server/middlewares/rateLimiter.js:10,26,41`; `server.js:250` | No per-user abuse protection; one NAT shares a bucket (DoS of real users); IP-rotating attacker bypasses entirely. |
| P0-4 | Security | **Media `DELETE /:fileKey` has no ownership check** (the route comment even says the caller "should verify ownership" — no caller does). | `Server/routes/mediaRoutes.js:99-127` | Any authed user deletes any R2 object / any Mux asset by key → cross-tenant data loss. |
| P0-5 | Security | **`addPinnedLink` has no authz** (its sibling get/delete handlers do). `url` not validated as http(s). | `Server/controllers/projectController.js:937-946` | Cross-tenant write IDOR: pin phishing/`javascript:` links into any project. |
| P0-6 | Security | **`getProjectById` grants full project read to any parent-workspace member** regardless of project membership, returning every task + all comments + member emails. Inconsistent with `getProjectTasks` (which filters non-managers). | `Server/controllers/projectController.js:229-239` | Low-priv workspace MEMBER reads all projects' contents + PII. |
| P0-7 | Bug (Critical) | **Extension SLA flows crash + half-commit.** `logSlaEvent(taskId, type, userId, {...})` called positionally, but signature is `logSlaEvent(prisma, {taskId,type,triggeredBy,metadata})`. `prisma.slaEvent` is undefined → throws *after* the task row (incl. changed `dueDate`) is already committed. `SLA_EVENT_TYPE.EXTENSION_*` are also undefined. | `Server/services/slaService.js:575,633,688` | Every extension request/approve/deny returns 500; deadline silently changes with no notification/comment/socket emit. **Confirmed.** |
| P0-8 | Bug (High) | **`TASK_STATUS.COMPLETED` is undefined** (`COMPLETED` lives on `PROJECT_STATUS`; tasks use `DONE`). Delay calc compares to `undefined`. | `Server/services/taskService.js:113,118,508` | Every finished task is reported `isDelayed: true` forever, delay days growing daily, across all task lists. **Confirmed.** |
| P0-9 | Bug (High) | **MyTasks "Start"/"Submit" send `{updates:...}` but the thunk destructures `taskData`** → PATCH body `undefined`. Toast still says success. | `Client/src/pages/MyTasks.jsx:185-189,210-214` | Core quick-actions silently no-op server-side. |

---

## P1 — High priority (fix before GA / first real users)

### Security
- **Media presign/Mux endpoints lack object-level authz + (broken) rate limiting** — any authed user mints unlimited R2 presigned PUTs and Mux uploads (cost amplification; `file` allows any MIME → stored HTML/SVG under CDN). `Server/routes/mediaRoutes.js:20-71`.
- **Private project chat broadcast to the whole project room** (REST is PM/Admin-only, but socket emit isn't) — `projectCommentController.js:68,97`. Depends on P0-1 fix; emit to a managers-only room.
- **Mux assets are `public` + MP4 download** — anyone with a playback ID can stream/download. Use `signed` policy + short-lived tokens for confidential media. `Server/lib/mux.js:39-41`.
- **Frontend CVEs** — `npm audit` Client: 2 critical / 12 high (`jspdf` critical, `vite`/`react-router-dom`/`ws` high). `npm audit fix` + bump.
- **Remove legacy unversioned route mounts** (`/api/workspaces|projects|tasks`) — parallel, less-tested attack surface. `server.js:262-265`.

### Correctness bugs
- **SLA "pause" never credits paused time to the deadline** and a breach event firing while BLOCKED is skipped and never re-scheduled on resume → a task blocked across its due date may *never* breach. `Server/lib/sla.js:82`, `inngest/slaJobs.js:372-479`.
- **Dependency cycle check + insert is non-atomic** → two reciprocal concurrent adds both pass the acyclic check and persist a 2-cycle (can deadlock the unlock-on-approve logic). Wrap in a `$transaction`. `services/taskService.js:691-702`.
- **`lagDays` is stored/validated/displayed but never applied** to any date math — documented feature is a no-op. `slaJobs.js:614-690`.
- **ProjectGantt "View Details" navigates `/task?id=` but TaskDetails reads `projectId`+`taskId`** → "Task not found". `Client/src/components/ProjectGantt.jsx:1057`.
- **Focus-refetch can clobber a just-created project/task** — the workspace merge replaces a workspace wholesale with the stale (≤120s cached) server copy, and the guard only preserves *entirely* missing workspaces, not new nested projects. `Client/src/features/workspaceSlice.js:439-472`, `pages/Layout.jsx:113-123`.
- **Non-transactional multi-write flows** (createTask → activity → member; approveTask → event → score → comment) leave partial state + 500 on any mid-step failure. Wrap core writes in `$transaction`. `taskService.js:301-332`, `slaService.js:137-219`.
- **Contractor `score` is last-writer-wins** (absolute write, not `{increment}`) → lost updates under concurrent scoring. `Server/lib/sla.js:188-224`.

---

## Speed — Chat boxes (your specific concern)

There are **two chat systems**: task discussion (the heavy one) and project chat (lighter). Server serialisation is actually good — comments come back in **one Prisma query with a nested `user` select, no N+1** (`selectShapes.js:139-156`). The pain is the client fetch strategy and re-render cost.

**Highest-impact:**
1. **Task chat polls the *entire task* every 10s** (`TaskDetails.jsx:654-661`) — re-downloads description, deps, activities, and **all comments (no `take`)**, replacing state and re-rendering a 920-line component. Periodic jank + mobile-data burn. → Delete the poll; rely on the socket.
2. **Task comments have NO socket broadcast** (`taskService.js:798`, unlike project chat at `projectCommentController.js:68`) — the other participant only sees your message on their next 10s poll. → Emit `task_comment_added` to the project room and append client-side.
3. **Every keystroke re-renders the whole TaskDetails page** — `newComment` is page-level state, `comments` filter isn't `useMemo`'d, `TaskCommentPanel` isn't `memo`'d, handlers aren't `useCallback`'d. → Isolate the composer into a child, memoise the list/rows.
4. **Socket never re-joins the room on reconnect** (`ProjectChatPanel.jsx:63-87`, `TaskDetails.jsx:664-698`) — after a transient drop, messages are silently missed until remount. → `socket.on('connect', () => socket.emit('join_project', projectId))`.
5. **Project chat send waits for full HTTP round-trip; no optimistic UI** (`ProjectChatPanel.jsx:89-103`) — dedup-by-id is already there, just add the optimistic insert.
6. **Video/audio comments mount real `<video/audio preload="metadata">` eagerly** for every media comment (`MediaRenderer.jsx:120,211`) — metadata-fetch storm on open. → `preload="none"` + click-to-load poster; virtualise long lists.

---

## Cost & performance (DB / jobs / bundle)

**Top ROI:**
1. **`getUserWorkspaces` mega over-fetch** — the dashboard's hottest endpoint loads every workspace → every project → every task (~25 cols) with no task pagination, cached only 120s. `workspaceController.js:196-242`. → Return workspaces+projects+`_count.tasks`; lazy-load tasks per project. _Single biggest latency + Neon-compute driver._
2. **`getProjectById` unbounded nested fetch** (tasks → comments → user, + full members), no pagination/cache. `projectController.js:206-223`.
3. **Auth middleware runs `prisma.user.findUnique` on EVERY request** (`authMiddleware.js:8-9`) — +1 DB round-trip on 100% of API calls. → Cache "user synced" flag (~5 min).
4. **`getMyProjects` runs the heavy project select 3×** then merges in JS (`projectController.js:124-178`) — collect IDs first, then one query.
5. **Inngest SLA jobs email recipients sequentially in `for` loops** (`slaJobs.js:149,230,…`) and **`onSlaOverdueDaily` self-chains forever, one email per overdue task per day** (`slaJobs.js:485-568`) → step-count + Resend cost grows with backlog. → `Promise.allSettled` + one batched daily digest.
6. **`getProjectTasks` issues writes during a GET** (auto-start/auto-block loop) (`taskService.js:194-234`) → move to the daily cron.
7. **`invalidateCachePattern` silently no-ops on Redis** ("wildcard not implemented") while being used for `workspaces:`/`dashboard:*` invalidation → cross-instance staleness when Upstash is on. `lib/cache.js:118-124`.
8. **Bundle:** `html2canvas`+`jspdf` (~1MB) are **static** imports in `GanttWidget.jsx:14-15` and `ProjectGantt.jsx:21-22`; `recharts` sits in the always-loaded `vendor-ui` chunk. → dynamic `import()` on the export handlers; lazy-load charts. (`exportReport.js` already does this correctly — copy that pattern.)

**Deployment note:** `Server/vercel.json` → `Server/api/index.js` is a **stub** that doesn't mount the real routers; the real app is `server.js` (Socket.IO + `listen`). Production is therefore a long-lived host, not Vercel serverless — good, because `node-cache` and Socket.IO would both break on serverless. Remove the dead `vercel.json`/`api/index.js` to avoid someone wiring it up by mistake.

---

## Readiness gaps (process)

- **No CI** (`.github/workflows` absent) despite a real test suite (6 server suites + 1 client). Tests aren't run automatically. → Add a CI workflow running `npm test` + `npm audit` on both packages.
- **`Server/middlewares/rateLimiter.js:12`** computes `Retry-After` from a `Date` object (`resetTime/1000`) → meaningless value. Minor.
- **Stray `gantt_full_audit_and_upgrade.html`** prototype at repo root — shouldn't ship.
- **Test auth bypass** (`x-test-user-id` header when `NODE_ENV==='test'`) is a full auth bypass if `NODE_ENV` is ever `test` in a deployed env — ensure it never is. `authMiddleware.js:85-90`.

---

## Suggested sequence

1. **P0 security** (Socket.IO auth, Clerk upgrade, rate-limiter key, media-delete + addPinnedLink authz, getProjectById model) — ~1–1.5 days.
2. **P0 bugs** (extension crash, COMPLETED typo, MyTasks payload, Gantt nav) — small, isolated, ~half day.
3. **Chat speed** (drop the 10s poll + add task-comment socket emit + reconnect re-join + memoise composer) — ~1 day, big perceived-speed win.
4. **P1 + cost levers** (over-fetch trims, auth-middleware cache, Inngest batching, dynamic imports, CI) — ongoing.

_All findings verified against source; no application files were modified during this review._
