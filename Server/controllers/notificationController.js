// FOLLO AUDIT
// FOLLO PERF
// FOLLO NOTIFY
/**
 * Notification Controller
 * GET    /                 — list current user's notifications (paginated)
 * PATCH  /:id/read         — mark one notification as read
 * PATCH  /read-all         — mark ALL as read
 * DELETE /                 — clear all (delete) current user's notifications
 * POST   /push/subscribe   — save a push subscription
 * DELETE /push/subscribe   — remove a push subscription
 * GET    /push/vapid-key   — return the public VAPID key
 */

import prisma from '../configs/prisma.js';
import {
  asyncHandler,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from '../utils/response.js';
import { VAPID_PUBLIC_KEY } from '../lib/push.js';
import { notificationSelect } from '../lib/selectShapes.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET  /api/v1/notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getNotifications = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { cursor, limit = '30', unreadOnly } = req.query;

  const take = Math.min(parseInt(limit, 10) || 30, 100);

  const where = { userId };
  if (unreadOnly === 'true') where.isRead = false;

  const notifications = await prisma.notification.findMany({
    where,
    select: notificationSelect,
    orderBy: { createdAt: 'desc' },
    take: take + 1, // +1 to detect next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > take;
  if (hasMore) notifications.pop();

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  sendSuccess(res, {
    notifications,
    unreadCount,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET  /api/v1/notifications/unread-count
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getUnreadCount = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  sendSuccess(res, { unreadCount: count });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH  /api/v1/notifications/:id/read
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const markRead = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { id } = req.params;

  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!notification) throw new NotFoundError('Notification not found');

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });

  sendSuccess(res, updated);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH  /api/v1/notifications/read-all
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const markAllRead = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  sendSuccess(res, { message: 'All notifications marked as read' });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE  /api/v1/notifications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const clearAll = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();

  await prisma.notification.deleteMany({ where: { userId } });

  sendNoContent(res);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST  /api/v1/notifications/push/subscribe
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const pushSubscribe = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { endpoint, keys } = req.body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new ValidationError('endpoint, keys.p256dh, and keys.auth are required');
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: req.headers['user-agent'] || null,
    },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: req.headers['user-agent'] || null,
    },
  });

  sendCreated(res, subscription, 'Push subscription saved');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE  /api/v1/notifications/push/subscribe
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const pushUnsubscribe = asyncHandler(async (req, res) => {
  const { userId } = await req.auth();
  const { endpoint } = req.body;

  if (!endpoint) {
    throw new ValidationError('endpoint is required');
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });

  sendNoContent(res);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET  /api/v1/notifications/push/vapid-key
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getVapidKey = asyncHandler(async (_req, res) => {
  sendSuccess(res, { publicKey: VAPID_PUBLIC_KEY || null });
});
