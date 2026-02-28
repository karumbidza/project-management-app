import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "../inngest/index.js";
import prisma from "../configs/prisma.js";

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

// Clerk authentication middleware
app.use(clerkMiddleware({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
}));

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

// Inngest webhook endpoint
app.use("/api/inngest", serve({ client: inngest, functions }));

// Example: Get all workspaces for current user
app.get('/api/workspaces', async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany();
    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Example: Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await prisma.project.findMany();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Export for Vercel serverless
export default app;
