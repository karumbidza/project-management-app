// FOLLO PERF-2
// IMPORTANT: This file must be imported before all other imports in server.js
// Sentry must instrument the runtime before any other modules load.
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production',

  environment: process.env.NODE_ENV ?? 'development',

  // Send default PII data (e.g. IP address collection on events)
  sendDefaultPii: true,

  // Sample 10% of requests for performance tracing
  tracesSampleRate:   0.1,
  profilesSampleRate: 0.1,

  // Strip sensitive fields before sending to Sentry
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    if (event.request) {
      delete event.request.data; // req.body may contain passwords/tokens
    }
    return event;
  },
});
