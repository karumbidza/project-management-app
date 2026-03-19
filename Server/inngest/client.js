// FOLLO SLA
// FOLLO PERF-2
/**
 * Shared Inngest client instance.
 * Extracted to avoid circular imports between index.js and slaJobs.js.
 */

import { Inngest } from 'inngest';
import { loggingMiddleware } from './middleware.js';

export const inngest = new Inngest({
  id: 'follo-app',
  middleware: [loggingMiddleware],
  logger: {
    info:  (...args) => console.info(JSON.stringify({ level: 'info',  source: 'inngest', args })),
    warn:  (...args) => console.warn(JSON.stringify({ level: 'warn',  source: 'inngest', args })),
    error: (...args) => console.error(JSON.stringify({ level: 'error', source: 'inngest', args })),
  },
});
