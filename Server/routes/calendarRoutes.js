// FOLLO CALENDAR
/**
 * Calendar Routes
 * /api/v1/calendar
 */

import express from 'express';
import {
  getGlobalCalendar,
  getProjectCalendar,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/calendarController.js';
import { validate, createEventSchema, updateEventSchema } from '../utils/validators.js';
import { writeLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALENDAR FEED (normalised: tasks + milestones + deadlines + events)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/v1/calendar?from&to&views — global, all accessible projects
router.get('/', getGlobalCalendar);

// GET /api/v1/calendar/project/:projectId?from&to&views — one project
router.get('/project/:projectId', getProjectCalendar);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/v1/calendar/project/:projectId/events
router.post('/project/:projectId/events', writeLimiter, validate(createEventSchema), createEvent);

// GET /api/v1/calendar/events/:eventId
router.get('/events/:eventId', getEvent);

// PATCH /api/v1/calendar/events/:eventId
router.patch('/events/:eventId', writeLimiter, validate(updateEventSchema), updateEvent);

// DELETE /api/v1/calendar/events/:eventId
router.delete('/events/:eventId', writeLimiter, deleteEvent);

export default router;
