// FOLLO NOTIFY
/**
 * Web Push helper — sends push notifications to user's subscribed devices.
 * Automatically cleans up expired/invalid subscriptions (410 Gone).
 */

import webpush from 'web-push';
import prisma from '../configs/prisma.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:noreply@tick-trackpro.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  console.info('[Push] VAPID keys configured');
} else {
  console.warn('[Push] WARNING: VAPID keys not set — push notifications disabled');
}

/**
 * Send a push notification to all devices registered by a user.
 * Fire-and-forget — never throws.
 *
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string, tag?: string }} payload
 */
export async function sendPushToUser(userId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    const staleIds = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          // 410 Gone or 404 = subscription expired, clean up
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleIds.push(sub.id);
          }
        }
      }),
    );

    // Bulk-remove stale subscriptions
    if (staleIds.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
    }
  } catch {
    // Swallow — push is best-effort
  }
}

export { VAPID_PUBLIC_KEY };
