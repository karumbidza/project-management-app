import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "../inngest/index.js";

const app = express();

// Security: Configure CORS for production
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
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
  message: 'Project Management API is live!',
  timestamp: new Date().toISOString()
}));

app.get('/api', (req, res) => res.json({ 
  status: 'ok', 
  message: 'Project Management API is live!',
  timestamp: new Date().toISOString()
}));

// Inngest webhook endpoint
app.use("/api/inngest", serve({ client: inngest, functions }));

// Export for Vercel serverless
export default app;
