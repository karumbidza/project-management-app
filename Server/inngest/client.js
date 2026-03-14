// FOLLO SLA
/**
 * Shared Inngest client instance.
 * Extracted to avoid circular imports between index.js and slaJobs.js.
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "project-management" });
