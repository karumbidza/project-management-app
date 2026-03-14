// FOLLO FIX
// FOLLO NOTIFY
/**
 * Push Notification Hook
 * Handles browser push notifications + Web Push subscription
 */

import { useCallback, useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_V1 = `${API_URL}/api/v1`;

/** Convert a URL-safe base64 VAPID key to a Uint8Array for PushManager */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const useNotifications = () => {
    const [permission, setPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );

    // Request notification permission
    const requestPermission = useCallback(async () => {
        if (typeof Notification === 'undefined') {
            return 'denied';
        }

        if (Notification.permission === 'granted') {
            setPermission('granted');
            return 'granted';
        }

        if (Notification.permission !== 'denied') {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result;
        }

        return Notification.permission;
    }, []);

    // Show a notification
    const showNotification = useCallback((title, options = {}) => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return null;
        }

        const notification = new Notification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
    }, []);

    // Show comment notification
    const notifyNewComment = useCallback(({ commenterName, taskTitle, preview }) => {
        return showNotification(`💬 ${commenterName} commented`, {
            body: `On "${taskTitle}": ${preview?.substring(0, 100) || 'New message'}`,
            tag: 'new-comment',
            renotify: true,
        });
    }, [showNotification]);

    // Show task assigned notification
    const notifyTaskAssigned = useCallback(({ taskTitle, projectName }) => {
        return showNotification(`✅ New Task Assigned`, {
            body: `"${taskTitle}" in ${projectName}`,
            tag: 'task-assigned',
            renotify: true,
        });
    }, [showNotification]);

    /**
     * Subscribe the current browser to Web Push via service worker.
     * Sends the subscription to the server.
     * @param {() => Promise<string>} getToken — Clerk getToken function
     */
    const subscribeToPush = useCallback(async (getToken) => {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

            const registration = await navigator.serviceWorker.ready;

            // Fetch VAPID public key from server
            const token = await getToken();
            const res = await fetch(`${API_V1}/notifications/push/vapid-key`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const { data } = await res.json();
            if (!data?.publicKey) return;

            // Check existing subscription
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
                });
            }

            // Send subscription to server
            const subJSON = subscription.toJSON();
            await fetch(`${API_V1}/notifications/push/subscribe`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${await getToken()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    endpoint: subJSON.endpoint,
                    keys: subJSON.keys,
                }),
            });

            console.info('[Push] Subscribed successfully');
        } catch (err) {
            console.error('[Push] Subscription failed:', err);
        }
    }, []);

    // Check if notifications are supported
    const isSupported = typeof Notification !== 'undefined';

    return {
        permission,
        isSupported,
        requestPermission,
        showNotification,
        notifyNewComment,
        notifyTaskAssigned,
        subscribeToPush,
    };
};

/**
 * Initialize notifications on app load
 * Call this once in your App or Layout component
 */
export const initNotifications = async () => {
    if (typeof Notification === 'undefined') {
        return 'not-supported';
    }

    if (Notification.permission === 'default') {
        // Don't auto-request, let user trigger it
        return 'prompt';
    }

    return Notification.permission;
};

export default useNotifications;
