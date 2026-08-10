-- FOLLO CALENDAR — operational scheduling calendar (core slice)
-- New: CalendarEvent (+ participants, recurrence exceptions), Project site
-- location + timezone, and NotificationType additions. Tasks/milestones/
-- deadlines are consumed from existing rows, so nothing is duplicated here.

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE "CalendarEventType" AS ENUM ('PROJECT_MEETING', 'SITE_MEETING', 'CONTRACTOR_MEETING', 'CLIENT_MEETING', 'INSPECTION', 'SITE_VISIT', 'HANDOVER', 'PROGRESS_REVIEW', 'INTERNAL_MEETING', 'SITE_ACTIVITY', 'MAINTENANCE', 'APPOINTMENT', 'OTHER');
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ParticipantResponse" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- NotificationType additions
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'DEADLINE_APPROACHING';
ALTER TYPE "NotificationType" ADD VALUE 'MILESTONE_APPROACHING';
ALTER TYPE "NotificationType" ADD VALUE 'SCHEDULE_CONFLICT';
ALTER TYPE "NotificationType" ADD VALUE 'WEATHER_ALERT';

-- ── Project: site location + timezone ───────────────────────────────────────
ALTER TABLE "Project" ADD COLUMN "locationName" TEXT;
ALTER TABLE "Project" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Project" ADD COLUMN "timezone" TEXT DEFAULT 'Africa/Harare';

-- ── CalendarEvent ───────────────────────────────────────────────────────────
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "type" "CalendarEventType" NOT NULL DEFAULT 'PROJECT_MEETING',
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "isWeatherSensitive" BOOLEAN NOT NULL DEFAULT false,
    "rrule" TEXT,
    "recurrenceEndAt" TIMESTAMP(3),
    "responsibleId" TEXT,
    "outcome" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CalendarEvent_projectId_startAt_idx" ON "CalendarEvent"("projectId", "startAt");
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");
CREATE INDEX "CalendarEvent_relatedTaskId_idx" ON "CalendarEvent"("relatedTaskId");

-- ── EventParticipant ────────────────────────────────────────────────────────
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" "ParticipantResponse" NOT NULL DEFAULT 'INVITED',
    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");
CREATE INDEX "EventParticipant_userId_idx" ON "EventParticipant"("userId");

-- ── CalendarEventException ──────────────────────────────────────────────────
CREATE TABLE "CalendarEventException" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "originalDate" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "title" TEXT,
    CONSTRAINT "CalendarEventException_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CalendarEventException_eventId_originalDate_key" ON "CalendarEventException"("eventId", "originalDate");

-- ── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventException" ADD CONSTRAINT "CalendarEventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
