import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Lazy load to catch import errors
let clerkMiddleware, serve, inngest, functions, prisma;

try {
  const clerkModule = await import('@clerk/express');
  clerkMiddleware = clerkModule.clerkMiddleware;
} catch (e) {
  console.error('Failed to load Clerk:', e.message);
}

try {
  const inngestExpress = await import('inngest/express');
  serve = inngestExpress.serve;
  const inngestModule = await import('../inngest/index.js');
  inngest = inngestModule.inngest;
  functions = inngestModule.functions;
} catch (e) {
  console.error('Failed to load Inngest:', e.message);
}

try {
  const prismaModule = await import('../configs/prisma.js');
  prisma = prismaModule.default;
} catch (e) {
  console.error('Failed to load Prisma:', e.message);
}

const app = express();

// Security: Configure CORS for production
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://your-frontend-domain.vercel.app' // Update this with your actual frontend URL
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all origins for now during development
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Clerk authentication middleware (if loaded)
if (clerkMiddleware) {
  app.use(clerkMiddleware({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  }));
}

// Health check endpoint
app.get('/', (req, res) => res.json({ 
  status: 'ok', 
  message: 'Project Management API',
  timestamp: new Date().toISOString()
}));

// API health check
app.get('/api', (req, res) => res.json({ 
  status: 'ok', 
  message: 'API endpoint working!'
}));

// Inngest webhook endpoint (if loaded)
if (serve && inngest && functions) {
  app.use("/api/inngest", serve({ client: inngest, functions }));
}

// Example: Get all workspaces for current user
app.get('/api/workspaces', async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  try {
    const workspaces = await prisma.workspace.findMany();
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces', details: error.message });
  }
});

// Example: Get all projects
app.get('/api/projects', async (req, res) => {
  if (!prisma) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  try {
    const projects = await prisma.project.findMany();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
  }
});

// Export for Vercel serverless
export default app;
