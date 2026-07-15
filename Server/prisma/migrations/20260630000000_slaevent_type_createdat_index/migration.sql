-- Replace the standalone (type) index with a composite (type, createdAt) so
-- event-type-by-time queries (daily overdue tracking, audit scans) are covered.
DROP INDEX IF EXISTS "SlaEvent_type_idx";
CREATE INDEX IF NOT EXISTS "SlaEvent_type_createdAt_idx" ON "SlaEvent"("type", "createdAt");
