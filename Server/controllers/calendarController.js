// FOLLO CALENDAR
/**
 * Calendar Controller
 * Thin HTTP wrapper — delegates to calendarService, mirrors taskController.
 */

import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as calendarService from '../services/calendarService.js';
import * as weatherService from '../services/weatherService.js'; // FOLLO CALENDAR — Phase 4

// ── Feed ─────────────────────────────────────────────────────────────────────

// GET /api/v1/calendar — global (all accessible projects)
export const getGlobalCalendar = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const data = await calendarService.getGlobalCalendar(userId, req.query);
  sendSuccess(res, data);
});

// GET /api/v1/calendar/project/:projectId
export const getProjectCalendar = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const data = await calendarService.getProjectCalendar(projectId, userId, req.query);
  sendSuccess(res, data);
});

// ── Events ───────────────────────────────────────────────────────────────────

// POST /api/v1/calendar/project/:projectId/events
export const createEvent = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const event = await calendarService.createEvent(projectId, userId, req.body);
  const io = req.app.get('io');
  if (io) io.to(`project:${projectId}`).emit('event_created', { event });
  sendCreated(res, event, 'Event created');
});

// GET /api/v1/calendar/events/:eventId
export const getEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { userId } = await req.auth();
  const event = await calendarService.getEvent(eventId, userId);
  sendSuccess(res, event);
});

// PATCH /api/v1/calendar/events/:eventId
export const updateEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { userId } = await req.auth();
  const event = await calendarService.updateEvent(eventId, userId, req.body);
  const io = req.app.get('io');
  if (io) io.to(`project:${event.projectId}`).emit('event_updated', { event });
  sendSuccess(res, event);
});

// DELETE /api/v1/calendar/events/:eventId
export const deleteEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { userId } = await req.auth();
  const result = await calendarService.deleteEvent(eventId, userId);
  const io = req.app.get('io');
  if (io) io.to(`project:${result.projectId}`).emit('event_deleted', { eventId, projectId: result.projectId });
  sendSuccess(res, result);
});

// ── Weather (Phase 4) ──────────────────────────────────────────────────────────

// GET /api/v1/calendar/project/:projectId/weather?from&to
export const getProjectWeather = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const data = await weatherService.getProjectWeather(projectId, userId, req.query);
  sendSuccess(res, data);
});

// PATCH /api/v1/calendar/project/:projectId/location
export const setProjectLocation = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const data = await weatherService.setProjectLocation(projectId, userId, req.body);
  sendSuccess(res, data, 'Location updated');
});
