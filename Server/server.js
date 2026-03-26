// FOLLO AUDIT
// FOLLO SLA
// FOLLO PERF
// FOLLO PERF-2
// FOLLO REALTIME
// FOLLO SECURITY
/**
 * Production-grade Express server
 * API v1 with proper security, error handling, and middleware
 */

// FOLLO PERF-2: instrument.js must be the very first import — Sentry needs to
// instrument the runtime before any other modules load.
import './instrument.js';
import * as Sentry from '@sentry/node';

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import { v4 as uuidv4 } from 'uuid';

// Routes
import workspaceRouter from './routes/workspaceRoutes.js';
import projectRouter from './routes/projectRoutes.js';
import taskRouter from './routes/taskRoutes.js';
import webhookRouter from './routes/webhookRoutes.js';
import mediaRouter from './routes/mediaRoutes.js';
import taskSlaRouter from './routes/taskSlaRoutes.js';
import templateRouter from './routes/templateRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';

// Middleware & Utils
import { protect } from './middlewares/authMiddleware.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';
import { responseTimeLogger } from './middlewares/perfMiddleware.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { sanitiseBody } from './middlewares/sanitise.js';
import prisma from './configs/prisma.js';

const app = express();
const httpServer = createServer(app);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCKET.IO (FOLLO REALTIME)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];
      if (allowed.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});

app.set('io', io); // FOLLO PROJECT-OVERVIEW — make io available to controllers

io.on('connection', (socket) => {
  // Project-level rooms — join when user opens a project
  socket.on('join_project', (projectId) => {
    if (typeof projectId === 'string' && projectId.length > 0) {
      socket.join(`project:${projectId}`);
    }
  });

  socket.on('leave_project', (projectId) => {
    if (typeof projectId === 'string' && projectId.length > 0) {
      socket.leave(`project:${projectId}`);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECURITY MIDDLEWARE — FOLLO SECURITY
// Must be registered before all other middleware
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// FOLLO SECURITY — helmet must be FIRST
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:              ["'self'"],
      scriptSrc:               ["'self'", "'unsafe-inline'"],
      styleSrc:                ["'self'", "'unsafe-inline'"],
      imgSrc:                  ["'self'", "data:", "https://cdn.follo.app", "https://img.clerk.com"],
      connectSrc:              ["'self'", "https://api.clerk.com", "https://follo.app"],
      fontSrc:                 ["'self'"],
      objectSrc:               ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard:    { action: 'deny' },
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },
  hidePoweredBy:  true,
  noSniff:        true,
  xssFilter:      true,
  ieNoOpen:       true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// FOLLO SECURITY — assign unique ID to every request for tracing
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] ?? uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PERFORMANCE MONITORING (FOLLO PERF)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Log slow requests (over 500ms)
app.use(responseTimeLogger(500));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORS CONFIGURATION — FOLLO SECURITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [
      'https://follo.app',
      'https://www.follo.app',
    ])
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (monitoring tools, Railway healthchecks, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge:         86400,
}));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BODY PARSING & WEBHOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Webhook routes BEFORE json parser (needs raw body for signature verification)
app.use('/api/webhooks', webhookRouter);

// JSON body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// FOLLO SECURITY — sanitise ALL request bodies after parsing, before routes
app.use(sanitiseBody);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.use(clerkMiddleware({
  secretKey:      process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
}));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEALTH CHECK — no auth required (monitoring tools)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status:    'healthy',
      service:   'Project Management API',
      version:   '1.0.0',
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

app.get('/api/v1/health', async (req, res) => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    res.status(200).json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
      version:   process.env.npm_package_version ?? '1.0.0',
      services: {
        database: {
          status:  'connected',
          latency: `${dbLatency}ms`,
        },
      },
      environment: process.env.NODE_ENV,
    });
  } catch (err) {
    console.error(JSON.stringify({
      level:   'error',
      event:   'health.check.failed',
      message: err.message,
    }));
    res.status(503).json({
      status:    'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'error' },
      },
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INNGEST (Background Jobs) — skips rate limiting
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.use("/api/inngest", serve({ client: inngest, functions }));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ROUTES (v1) — FOLLO SECURITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Apply rate limiting to all API routes (userId when authed, IP as fallback)
app.use('/api/v1', apiLimiter);

// Protected routes - require authentication
app.use('/api/v1/workspaces',    protect, workspaceRouter);
app.use('/api/v1/projects',      protect, projectRouter);
app.use('/api/v1/tasks',         protect, taskRouter);
app.use('/api/v1/tasks',         protect, taskSlaRouter);  // FOLLO SLA routes
app.use('/api/v1/templates',     protect, templateRouter); // FOLLO SLA Phase 7
app.use('/api/v1/notifications', protect, notificationRouter); // FOLLO NOTIFY
app.use('/api/v1/media',         protect, mediaRouter);

// FOLLO AUDIT — Legacy unversioned routes kept for backwards compat; prefer /api/v1/
// Legacy routes (for backward compatibility - will be deprecated)
app.use('/api/workspaces', protect, workspaceRouter);
app.use('/api/projects',   protect, projectRouter);
app.use('/api/tasks',      protect, taskRouter);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLING — FOLLO SECURITY + FOLLO PERF-2
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 404 handler for undefined routes
app.use(notFoundHandler);

// FOLLO SECURITY — CORS errors return 403
app.use((err, req, res, next) => {
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({
      error:     'Forbidden',
      requestId: req.requestId,
    });
  }
  next(err);
});

// FOLLO PERF-2: Sentry error handler — MUST come before custom error handler
Sentry.setupExpressErrorHandler(app);

// Centralized error handler - must be last
app.use(errorHandler);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GRACEFUL SHUTDOWN — FOLLO PERF-2
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const gracefulShutdown = async (signal) => {
  console.info(JSON.stringify({
    level:  'info',
    event:  'server.shutdown',
    signal,
    timestamp: new Date().toISOString(),
  }));

  // Stop accepting new connections
  httpServer.close(async () => {
    try {
      await prisma.$disconnect();
      console.info(JSON.stringify({
        level:     'info',
        event:     'server.shutdown.complete',
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.error(JSON.stringify({
        level:   'error',
        event:   'server.shutdown.error',
        message: err.message,
      }));
    }
    process.exit(0);
  });

  // Force shutdown after 10 seconds if graceful close stalls
  setTimeout(() => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'server.shutdown.forced',
    }));
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVER STARTUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// FOLLO TESTS — do not bind a port in test mode (supertest uses the app directly)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5001;
  httpServer.listen(PORT, () => {
    console.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on port ${PORT}
API: http://localhost:${PORT}/api/v1
Socket.IO ready
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

export default app;
