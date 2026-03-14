// FOLLO SLA
// FOLLO PERF
// FOLLO REALTIME
/**
 * Production-grade Express server
 * API v1 with proper security, error handling, and middleware
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

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
import { HTTP_STATUS, TIMING } from './utils/constants.js';
import { responseTimeLogger } from './middlewares/perfMiddleware.js';

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
// PERFORMANCE MONITORING (FOLLO PERF)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Log slow requests (over 500ms)
app.use(responseTimeLogger(500));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECURITY MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - general API
const apiLimiter = rateLimit({
  windowMs: TIMING.RATE_LIMIT_WINDOW_MS,
  max: TIMING.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: TIMING.RATE_LIMIT_WINDOW_MS,
  max: TIMING.AUTH_RATE_LIMIT_MAX,
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORS CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];
  
  // In development, allow localhost ports
  if (process.env.NODE_ENV !== 'production') {
    return [
      ...envOrigins,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ];
  }
  
  return envOrigins;
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = getAllowedOrigins();
    
    // Check exact match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow all localhost
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BODY PARSING & WEBHOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Webhook routes BEFORE json parser (needs raw body for signature verification)
app.use('/api/webhooks', webhookRouter);

// JSON body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTHENTICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.use(clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
}));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEALTH CHECK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'Project Management API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    error: null,
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'healthy' },
    error: null,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INNGEST (Background Jobs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.use("/api/inngest", serve({ client: inngest, functions }));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ROUTES (v1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Apply rate limiting to API routes
app.use('/api/v1', apiLimiter);

// Protected routes - require authentication
app.use('/api/v1/workspaces', protect, workspaceRouter);
app.use('/api/v1/projects', protect, projectRouter);
app.use('/api/v1/tasks', protect, taskRouter);
app.use('/api/v1/tasks', protect, taskSlaRouter); // FOLLO SLA routes
app.use('/api/v1/templates', protect, templateRouter); // FOLLO SLA Phase 7
app.use('/api/v1/notifications', protect, notificationRouter); // FOLLO NOTIFY
app.use('/api/v1/media', protect, mediaRouter);

// Legacy routes (for backward compatibility - will be deprecated)
app.use('/api/workspaces', protect, workspaceRouter);
app.use('/api/projects', protect, projectRouter);
app.use('/api/tasks', protect, taskRouter);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 404 handler for undefined routes
app.use(notFoundHandler);

// Centralized error handler - must be last
app.use(errorHandler);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVER STARTUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  httpServer.listen(PORT, () => {
    console.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Server running on port ${PORT}
📍 API: http://localhost:${PORT}/api/v1
🔌 Socket.IO ready
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

// Export for Vercel serverless
export default app;