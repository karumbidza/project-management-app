// FOLLO PERF
// FOLLO NOTIFY
/**
 * Notification Routes
 * /api/v1/notifications
 */

import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  clearAll,
  pushSubscribe,
  pushUnsubscribe,
  getVapidKey,
} from '../controllers/notificationController.js';

const router = express.Router();

// Notification CRUD
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);   // FOLLO PERF — lightweight count
router.patch('/read-all', markAllRead);       // must come before /:id/read
router.patch('/:id/read', markRead);
router.delete('/', clearAll);

// Push subscription management
router.post('/push/subscribe', pushSubscribe);
router.delete('/push/subscribe', pushUnsubscribe);
router.get('/push/vapid-key', getVapidKey);

export default router;
