// FOLLO PERF
// FOLLO NOTIFY
/**
 * NotificationPanel — dropdown panel triggered by the bell icon in Navbar.
 * Shows unread badge, paginated notification list, mark-read, clear-all.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Loader2,
  MessageSquare,
  ClipboardCheck,
  AlertTriangle,
  Shield,
  GitBranch,
  UserPlus,
  Clock,
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from '../features/notificationSlice';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

/** Map notification type to icon + colour */
const typeConfig = {
  TASK_ASSIGNED:      { icon: ClipboardCheck, color: 'text-blue-500' },
  TASK_UPDATED:       { icon: ClipboardCheck, color: 'text-amber-500' },
  TASK_APPROVED:      { icon: Check,          color: 'text-green-500' },
  TASK_STARTING_SOON: { icon: Clock,          color: 'text-amber-400' },
  TASK_OVERDUE:       { icon: AlertTriangle,  color: 'text-red-500' },
  PREDECESSOR_COMPLETE:{ icon: GitBranch,     color: 'text-emerald-500' },
  COMMENT_ADDED:      { icon: MessageSquare,  color: 'text-indigo-500' },
  PROJECT_INVITE:     { icon: UserPlus,       color: 'text-purple-500' },
  DELAY_ALERT:        { icon: AlertTriangle,  color: 'text-orange-500' },
  SLA_WARNING:        { icon: Shield,         color: 'text-red-500' },
  BLOCKER_RAISED:     { icon: AlertTriangle,  color: 'text-red-600' },
};

const NotificationPanel = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { items, unreadCount, nextCursor, loading } = useSelector((s) => s.notifications);
  const { permission, isSupported, requestPermission, subscribeToPush } = useNotifications();

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const hasFetched = useRef(false);

  // FOLLO PERF — lightweight unread count on mount
  useEffect(() => {
    dispatch(fetchUnreadCount({ getToken }));
  }, [dispatch, getToken]);

  // Fetch full list on first open
  useEffect(() => {
    if (open && !hasFetched.current) {
      hasFetched.current = true;
      dispatch(fetchNotifications({ getToken }));
    }
  }, [open, dispatch, getToken]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // FOLLO PERF — poll lightweight count every 60s (full fetch only when panel is open)
  useEffect(() => {
    const id = setInterval(() => {
      if (open) {
        dispatch(fetchNotifications({ getToken }));
      } else {
        dispatch(fetchUnreadCount({ getToken }));
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [open, dispatch, getToken]);

  const handleBellClick = async () => {
    // If notifications not granted, ask first
    if (isSupported && permission !== 'granted' && permission !== 'denied') {
      const result = await requestPermission();
      if (result === 'granted') {
        toast.success('Notifications enabled!');
        subscribeToPush(getToken);
      }
    }
    setOpen((prev) => !prev);
    // Refresh list when opening
    if (!open) {
      dispatch(fetchNotifications({ getToken }));
    }
  };

  const handleItemClick = (n) => {
    if (!n.isRead) {
      dispatch(markNotificationRead({ getToken, id: n.id }));
    }
    const url = n.metadata?.url || `/projects/${n.metadata?.projectId || ''}`;
    setOpen(false);
    navigate(url);
  };

  const handleMarkAllRead = () => {
    dispatch(markAllNotificationsRead(getToken));
  };

  const handleClearAll = () => {
    dispatch(clearAllNotifications(getToken));
  };

  const loadMore = () => {
    if (nextCursor) {
      dispatch(fetchNotifications({ getToken, cursor: nextCursor }));
    }
  };

  const renderIcon = (type) => {
    const cfg = typeConfig[type] || typeConfig.TASK_UPDATED;
    const Icon = cfg.icon;
    return <Icon className={`size-4 ${cfg.color} flex-shrink-0`} />;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className="size-8 flex items-center justify-center bg-white dark:bg-zinc-800 shadow rounded-lg transition hover:scale-105 active:scale-95 relative"
        title={permission === 'granted' ? 'Notifications' : 'Enable notifications'}
      >
        {permission === 'granted' ? (
          <Bell className="size-4 text-blue-500" />
        ) : (
          <BellOff className="size-4 text-gray-400 dark:text-zinc-500" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 sm:w-96 max-h-[70vh] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden flex flex-col z-[100]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications {unreadCount > 0 && <span className="text-xs text-gray-500 dark:text-zinc-400">({unreadCount} unread)</span>}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 rounded-md text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3.5" />
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 rounded-md text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                  title="Clear all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 text-gray-400 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-zinc-500">
                <Bell className="size-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <>
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-50 dark:border-zinc-800/50 ${
                      !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="mt-0.5">{renderIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${!n.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="mt-2 size-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                ))}

                {/* Load more */}
                {nextCursor && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-3 text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="size-4 mx-auto animate-spin" /> : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
