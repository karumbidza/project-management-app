# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack project management application with workspaces, projects, tasks, SLA tracking, real-time updates, and media comments. Monorepo with separate `Client/` (React) and `Server/` (Express) directories.

## Development Commands

### Client (React + Vite)
```bash
cd Client
npm install
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Server (Node.js + Express)
```bash
cd Server
npm install        # Also runs prisma generate via postinstall
npm run dev        # Nodemon watch mode
npm start          # Production
npm run build      # prisma generate only
```

### Database
```bash
cd Server
npx prisma migrate dev    # Run migrations
npx prisma studio         # GUI database browser
npx prisma generate       # Regenerate client after schema changes
```

## Architecture

### Backend (`Server/`)

- **Entry point:** `server.js` — Express + Socket.IO, Helmet, CORS, rate limiting, Clerk middleware, Inngest
- **API prefix:** `/api/v1/`
- **Routes → Controllers pattern:**
  - `routes/` maps endpoints; `controllers/` contains business logic
  - Key controllers: `workspaceController`, `projectController`, `taskController`, `slaController`, `notificationController`, `templateController`
- **Auth:** All `/api/v1/*` routes protected via `middlewares/authMiddleware.js`, which validates Clerk JWT and auto-syncs users to Prisma DB on first request
- **Validation:** Zod schemas in `utils/validators.js`, applied per-route
- **Background jobs:** Inngest (`inngest/`) for async workflows (workspace sync, SLA jobs)
- **Real-time:** Socket.IO with project-level rooms (`project:${projectId}`)
- **Storage:** Cloudflare R2 for files, Mux for video streaming
- **Email:** Resend via `utils/emailService.js`
- **DB:** PostgreSQL on Neon; Prisma with pooled (`DATABASE_URL`) + unpooled (`DIRECT_URL`) connections

### Frontend (`Client/`)

- **Entry:** `src/main.jsx` — Clerk provider wraps app, Redux store, React Router
- **Routing:** `src/App.jsx` — React Router 7, lazy-loaded pages
- **State:** Redux Toolkit store at `src/app/store.js`:
  - `workspace` — active workspace, members
  - `task` — task state
  - `comment` — task comments
  - `sla` — SLA tracking
  - `theme` — UI theme
  - `notifications` — real-time notifications
- **API calls:** Axios via `src/features/apiHelper.js` (attaches Clerk JWT automatically)
- **UI:** TailwindCSS 4, Lucide React icons, Recharts for analytics
- **Vite config:** Manual chunks for vendor splitting (react, redux, clerk, ui libs)

### Data Model (Prisma)

Key relationships:
- `User` → `WorkspaceMember` → `Workspace` (multi-tenant)
- `Workspace` → `Project` → `ProjectMember`
- `Project` → `Task` → `TaskDependency` (self-referential with lag days)
- `Task` has SLA state machine: `HEALTHY → AT_RISK → PENDING_APPROVAL → BLOCKED → BREACHED → RESOLVED_*`
- `Task` supports approval workflows, blocker tracking, extension requests
- `Comment` supports media types: TEXT, IMAGE, VIDEO (Mux), AUDIO, FILE (R2)
- `TaskActivity` is the audit trail for all task changes
- `TaskTemplate` / `ProjectTemplate` for reusable templates

### Environment Variables

**Server `.env`:**
```
NODE_ENV
CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET
DATABASE_URL, DIRECT_URL
INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
RESEND_API_KEY, RESEND_FROM_EMAIL
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, CDN_URL
MUX_TOKEN_ID, MUX_TOKEN_SECRET
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
ALLOWED_ORIGINS
```

**Client `.env`:**
```
VITE_CLERK_PUBLISHABLE_KEY
```

## Key Patterns

- **Role system:** Workspace roles (ADMIN, MEMBER); Project roles (OWNER, MANAGER, CONTRIBUTOR, VIEWER) — see `utils/permissions.js` and `hooks/useUserRole.js`
- **Task statuses:** TODO → IN_PROGRESS → IN_REVIEW → DONE (also BLOCKED)
- **Error handling:** Centralized via `utils/errors.js` and `utils/response.js`
- **Auth middleware** handles Clerk user migration (email conflict resolution + relation re-linking) transparently
