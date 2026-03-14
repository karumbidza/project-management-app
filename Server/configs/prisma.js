// FOLLO PERF
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Use global prisma instance in development to prevent multiple connections
const globalForPrisma = globalThis;

// FOLLO PERF: Connection pool settings via DATABASE_URL query params
// For Neon serverless, use ?pgbouncer=true&connection_limit=10
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Reduce query logging in development for better performance
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;