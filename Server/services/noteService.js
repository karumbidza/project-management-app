// FOLLO CALENDAR — Phase 3: project journal / notes
/**
 * Notes are dated, authored journal entries linked to a project (directly, or
 * via a task/event whose project is resolved). Access mirrors the rest of the
 * calendar: any project member can read + add notes; the author or a
 * manager/owner can edit/delete. "Convert to task" reuses taskService.createTask
 * so SLA/activity logic stays consistent.
 */

import prisma from '../configs/prisma.js';
import { requireProjectAccess } from '../utils/permissions.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors.js';
import { ERROR_CODES } from '../utils/constants.js';
import { userSelectMinimal } from '../lib/selectShapes.js';
import * as taskService from './taskService.js';

const noteSelect = {
  id: true, type: true, body: true, noteDate: true, authorId: true,
  projectId: true, taskId: true, eventId: true, createdAt: true, updatedAt: true,
  author: { select: userSelectMinimal },
  attachments: { select: { id: true, url: true, fileName: true, type: true, sizeBytes: true } },
};

async function resolveProjectId(body) {
  if (body.projectId) return body.projectId;
  if (body.taskId) {
    const t = await prisma.task.findUnique({ where: { id: body.taskId }, select: { projectId: true } });
    if (t) return t.projectId;
  }
  if (body.eventId) {
    const e = await prisma.calendarEvent.findUnique({ where: { id: body.eventId }, select: { projectId: true } });
    if (e) return e.projectId;
  }
  return null;
}

export async function createNote(userId, body) {
  const projectId = await resolveProjectId(body);
  if (!projectId) throw new ValidationError('A note must be linked to a project, task, or event', ERROR_CODES.VALIDATION_ERROR);
  await requireProjectAccess(userId, projectId);

  const { attachments = [], projectId: _p, ...rest } = body;
  return prisma.note.create({
    data: {
      ...rest,
      projectId,
      noteDate: body.noteDate ?? new Date(),
      authorId: userId,
      attachments: attachments.length
        ? { create: attachments.map((a) => ({ url: a.url, fileName: a.fileName ?? null, fileKey: a.fileKey ?? null, type: a.type ?? 'FILE', sizeBytes: a.sizeBytes ?? null, createdById: userId })) }
        : undefined,
    },
    select: noteSelect,
  });
}

export async function getProjectNotes(projectId, userId, opts = {}) {
  await requireProjectAccess(userId, projectId);
  const where = { projectId };
  if (opts.from || opts.to) {
    where.noteDate = {};
    if (opts.from) where.noteDate.gte = new Date(opts.from);
    if (opts.to) where.noteDate.lte = new Date(opts.to);
  }
  return prisma.note.findMany({ where, select: noteSelect, orderBy: { noteDate: 'desc' } });
}

async function loadEditable(noteId, userId) {
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { id: true, projectId: true, authorId: true, taskId: true, body: true } });
  if (!note) throw new NotFoundError('Note not found', ERROR_CODES.NOT_FOUND_ERROR);
  const { role } = await requireProjectAccess(userId, note.projectId);
  const canEdit = note.authorId === userId || role === 'OWNER' || role === 'MANAGER';
  if (!canEdit) throw new AuthorizationError('You cannot modify this note', ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  return note;
}

export async function updateNote(noteId, userId, body) {
  await loadEditable(noteId, userId);
  const { attachments: _a, projectId: _p, ...data } = body;
  return prisma.note.update({ where: { id: noteId }, data, select: noteSelect });
}

export async function deleteNote(noteId, userId) {
  const note = await loadEditable(noteId, userId);
  await prisma.note.delete({ where: { id: noteId } });
  return { id: noteId, projectId: note.projectId };
}

/** Turn a note into a real Task (reuses taskService so SLA/activity fire). */
export async function convertNoteToTask(noteId, userId, body = {}) {
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { id: true, projectId: true, body: true, taskId: true } });
  if (!note) throw new NotFoundError('Note not found', ERROR_CODES.NOT_FOUND_ERROR);
  const title = (body.title || note.body || 'Follow-up').split('\n')[0].slice(0, 200).trim() || 'Follow-up';
  const dueDefault = new Date(); dueDefault.setDate(dueDefault.getDate() + 7);
  const task = await taskService.createTask(note.projectId, userId, {
    title,
    description: note.body,
    due_date: body.due_date || dueDefault.toISOString(),
  });
  await prisma.note.update({ where: { id: noteId }, data: { taskId: task.id } }).catch(() => {});
  return task;
}
