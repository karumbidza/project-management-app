// FOLLO READINESS — fail-fast environment validation.
// Asserts the required environment variables are present at boot. On a deployed
// server a missing secret should crash loudly at startup, not surface later as a
// confusing 500 mid-request. Optional feature integrations only warn.
import { z } from 'zod';

// Required in EVERY environment — the server cannot function without these.
const baseShape = {
  DATABASE_URL:          z.string().min(1, 'pooled Postgres connection string'),
  DIRECT_URL:            z.string().min(1, 'unpooled Postgres connection (used by prisma migrate)'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY:      z.string().min(1),
};

// Additionally required in production.
const productionShape = {
  ...baseShape,
  CLERK_WEBHOOK_SECRET: z.string().min(1, 'needed to verify Clerk webhooks'),
  INNGEST_EVENT_KEY:    z.string().min(1),
  INNGEST_SIGNING_KEY:  z.string().min(1, 'needed to verify background-job (Inngest) requests'),
  RESEND_API_KEY:       z.string().min(1),
  RESEND_FROM_EMAIL:    z.string().regex(/.+@.+\..+/, 'must be a valid email address'),
  ALLOWED_ORIGINS:      z.string().min(1, 'comma-separated list of allowed CORS origins'),
};

// Optional feature integrations — the code degrades gracefully when absent, but a
// PARTIAL group is almost always a misconfiguration, so we warn loudly.
const OPTIONAL_FEATURE_GROUPS = {
  'R2 file storage':      ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'CDN_URL'],
  'Mux video':            ['MUX_TOKEN_ID', 'MUX_TOKEN_SECRET'],
  'Mux signed playback':  ['MUX_SIGNING_KEY_ID', 'MUX_SIGNING_KEY_PRIVATE'],
  'Web push (VAPID)':     ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'],
  'Upstash Redis cache':  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  'PgBouncer pooler':     ['DATABASE_POOLER_URL'],
  'Sentry (server)':      ['SENTRY_DSN'],
};

export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const schema = z.object(isProd ? productionShape : baseShape);
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(
      `[env] FATAL — missing/invalid required environment variables ` +
      `(${isProd ? 'production' : process.env.NODE_ENV || 'development'}):\n${issues}`
    );
    process.exit(1);
  }

  for (const [feature, vars] of Object.entries(OPTIONAL_FEATURE_GROUPS)) {
    const present = vars.filter((v) => process.env[v]);
    if (present.length > 0 && present.length < vars.length) {
      const missing = vars.filter((v) => !process.env[v]);
      console.warn(`[env] ${feature} is PARTIALLY configured — missing: ${missing.join(', ')}`);
    } else if (present.length === 0 && isProd) {
      console.warn(`[env] ${feature} is not configured — that feature is disabled.`);
    }
  }

  console.info(`[env] Validated (${isProd ? 'production' : process.env.NODE_ENV || 'development'}).`);
}
