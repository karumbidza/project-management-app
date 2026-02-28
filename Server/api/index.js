import express from 'express';
import cors from 'cors';

const app = express();

// Simple CORS - allow all for now
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Project Management API is live!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'API endpoint working!'
  });
});

// Export for Vercel serverless
export default app;
