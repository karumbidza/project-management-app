// FOLLO PERF
// FOLLO PERF-2
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// FOLLO PERF-2: Use pooler URL in production for connection reuse.
// Neon/Supabase provide a PgBouncer URL on port 6543.
// Set DATABASE_POOLER_URL in production .env to activate.
const databaseUrl = process.env.NODE_ENV === 'production'
  ? (process.env.DATABASE_POOLER_URL ?? process.env.DATABASE_URL)
  : process.env.DATABASE_URL;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
  log: process.env.NODE_ENV === 'development'
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn'  },
      ]
    : [
        { emit: 'event', level: 'error' },
      ],
});

// FOLLO PERF-2: Log slow queries in development (threshold: 100ms)
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 100) {
      console.warn(JSON.stringify({
        level:    'warn',
        event:    'slow.query',
        duration: `${e.duration}ms`,
        query:    e.query.substring(0, 200),
      }));
    }
  });
}

// FOLLO PERF-2: Structured error logging for all Prisma errors
prisma.$on('error', (e) => {
  console.error(JSON.stringify({
    level:   'error',
    event:   'prisma.error',
    message: e.message,
    target:  e.target,
  }));
});

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
