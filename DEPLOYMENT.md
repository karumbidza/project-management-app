# Deployment Guide

**Stack:** Vercel (Frontend) + Railway (Backend)
**Repo:** Monorepo — `Client/` and `Server/` in the same GitHub repo
**Auto-deploy:** Both platforms watch `main` — every `git push` deploys automatically.

## Live URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | https://project-management-app-kohl-one.vercel.app |
| Backend (Railway) | https://project-management-app-production-d002.up.railway.app |
| Health check | https://project-management-app-production-d002.up.railway.app/api/v1/health |

---

## Architecture

```
Browser
  └── Vercel  (Client/ — React/Vite)
        └── VITE_API_URL ──► Railway  (Server/ — Express/Socket.IO)
                                  └── Neon PostgreSQL
                                  └── Cloudflare R2
                                  └── Inngest
                                  └── Clerk Webhooks
```

---

## One-Time Setup

### 1. Railway — Backend

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select this repo → **Add Service**
3. In service **Settings**:

   | Setting | Value |
   |---|---|
   | Root Directory | `Server` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

4. **Variables** tab — add every var from `Server/.env.example`:

   ```
   NODE_ENV=production
   PORT=5001
   DATABASE_URL=<neon pooled URL>
   DIRECT_URL=<neon direct URL>
   CLERK_SECRET_KEY=sk_live_xxx
   CLERK_PUBLISHABLE_KEY=pk_live_xxx
   CLERK_WEBHOOK_SECRET=whsec_xxx
   ALLOWED_ORIGINS=https://PLACEHOLDER.vercel.app   ← update after Vercel deploy
   RESEND_API_KEY=re_xxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   R2_ACCOUNT_ID=xxx
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
   R2_BUCKET_NAME=xxx
   CDN_URL=https://cdn.yourdomain.com
   MUX_TOKEN_ID=xxx
   MUX_TOKEN_SECRET=xxx
   INNGEST_EVENT_KEY=xxx
   INNGEST_SIGNING_KEY=xxx
   VAPID_PUBLIC_KEY=xxx
   VAPID_PRIVATE_KEY=xxx
   VAPID_SUBJECT=mailto:you@yourdomain.com
   SENTRY_DSN=xxx
   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxx
   ```

5. **Settings → Networking → Generate Domain**
   Copy URL: `https://YOUR-APP.up.railway.app`

6. Click **Deploy** — logs should show `Server running on port 5001`

---

### 2. Vercel — Frontend

1. [vercel.com](https://vercel.com) → **New Project** → import this repo
2. Build settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `Client` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. **Environment Variables**:

   ```
   VITE_API_URL=https://YOUR-APP.up.railway.app
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
   ```

   Optional (Sentry source maps):
   ```
   SENTRY_AUTH_TOKEN=xxx
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   ```

4. Click **Deploy** — copy your Vercel URL: `https://YOUR-APP.vercel.app`

---

### 3. Wire Everything Together

After both are live, go back and connect them:

#### Railway — update ALLOWED_ORIGINS
```
ALLOWED_ORIGINS=https://YOUR-APP.vercel.app
```
Railway auto-redeploys on env var save.

#### Clerk Dashboard → Domains
Add `https://YOUR-APP.vercel.app` as an allowed origin.

#### Clerk Dashboard → Webhooks
Update endpoint URL to:
```
https://YOUR-APP.up.railway.app/api/v1/webhooks/clerk
```

#### Inngest Dashboard → Apps
Set Serve URL to:
```
https://YOUR-APP.up.railway.app/api/inngest
```

---

### 4. Custom Domain (Optional)

- **Vercel:** Project → Settings → Domains → add domain
- **Railway:** Service → Settings → Networking → Custom Domain
- Update `ALLOWED_ORIGINS` in Railway to match the custom domain
- Update Clerk allowed origins to match the custom domain

---

## Daily Development Workflow

```bash
# Work locally
cd Server && npm run dev     # http://localhost:5001
cd Client && npm run dev     # http://localhost:5173

# Deploy
git add -A
git commit -m "feat: ..."
git push                     # Vercel + Railway auto-deploy
```

Local frontend points to `http://localhost:5001` via `VITE_API_URL` in `Client/.env`.
Production frontend points to Railway via `VITE_API_URL` in Vercel env vars.

---

## Environment Files

| File | Purpose |
|---|---|
| `Server/.env` | Local dev — never commit |
| `Server/.env.example` | Template — committed, no secrets |
| `Client/.env` | Local dev — never commit |
| `Client/.env.example` | Template — committed, no secrets |

Production secrets live exclusively in Railway and Vercel dashboards.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| API calls failing (CORS) | `ALLOWED_ORIGINS` in Railway matches Vercel URL exactly |
| Auth broken | Clerk domain list includes Vercel URL |
| Socket.IO not connecting | `ALLOWED_ORIGINS` includes Vercel URL |
| Inngest jobs not running | Inngest dashboard Serve URL points to Railway |
| Prisma errors on boot | `DATABASE_URL` + `DIRECT_URL` set correctly in Railway |
| Build fails on Railway | Check Railway build logs; `npm install` runs `prisma generate` via postinstall |

---

## Re-deploy Manually

- **Railway:** Dashboard → Service → **Redeploy**
- **Vercel:** Dashboard → Project → **Redeploy**
