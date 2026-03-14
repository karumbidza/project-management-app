// FOLLO NOTIFY
/**
 * Notification Service
 * Central function to persist an in-app notification AND fire a push notification.
 * All controller / Inngest call-sites use this single entry-point.
 */

import prisma from '../configs/prisma.js';
import { sendPushToUser } from '../lib/push.js';

/**
 * Create an in-app notification and send a Web Push notification.
 * Fire-and-forget safe — swallows errors so callers never break.
 *
 * @param {{
 *   userId:   string,
 *   type:     import('@prisma/client').NotificationType,
 *   title:    string,
 *   message:  string,
 *   metadata?: Record<string, unknown>,
 *   url?:     string,          // deep-link path for the push payload
 * }} opts
 * @returns {Promise<import('@prisma/client').Notification | null>}
 */
export async function createNotification({ userId, type, title, message, metadata = {}, url }) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, metadata },
    });

    // Fire push (non-blocking, never throws)
    sendPushToUser(userId, {
      title,
      body: message,
      url: url || metadata?.url || '/',
      tag: type,
    });

    return notification;
  } catch {
    // Best-effort — never break the caller
    return null;
  }
}

/**
 * Batch-create notifications for multiple users (same content).
 * Useful for project-wide announcements (milestones, blockers).
 *
 * @param {string[]} userIds
 * @param {Omit<Parameters<typeof createNotification>[0], 'userId'>} opts
 */
export async function createBulkNotifications(userIds, opts) {
  const unique = [...new Set(userIds)];
  await Promise.allSettled(
    unique.map((userId) => createNotification({ ...opts, userId })),
  );
}
