// FOLLO CALENDAR
/**
 * Calendar Controller
 * Thin HTTP wrapper — delegates to calendarService, mirrors taskController.
 */

import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import * as calendarService from '../services/calendarService.js';
import * as weatherService from '../services/weatherService.js'; // FOLLO CALENDAR — Phase 4
import * as noteService from '../services/noteService.js'; // FOLLO CALENDAR — Phase 3

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

// ── Notes / journal (Phase 3) ────────────────────────────────────────────────

// POST /api/v1/calendar/notes
export const createNote = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const note = await noteService.createNote(userId, req.body);
  sendCreated(res, note, 'Note added');
});

// GET /api/v1/calendar/project/:projectId/notes?from&to
export const getProjectNotes = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId } = await req.auth();
  const notes = await noteService.getProjectNotes(projectId, userId, req.query);
  sendSuccess(res, notes);
});

// PATCH /api/v1/calendar/notes/:noteId
export const updateNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const { userId } = await req.auth();
  const note = await noteService.updateNote(noteId, userId, req.body);
  sendSuccess(res, note);
});

// DELETE /api/v1/calendar/notes/:noteId
export const deleteNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const { userId } = await req.auth();
  const result = await noteService.deleteNote(noteId, userId);
  sendSuccess(res, result);
});

// POST /api/v1/calendar/notes/:noteId/convert-to-task
export const convertNoteToTask = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const { userId } = await req.auth();
  const task = await noteService.convertNoteToTask(noteId, userId, req.body);
  sendCreated(res, task, 'Task created from note');
});
