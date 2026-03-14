// FOLLO PERF
// FOLLO NOTIFY
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_V1 = `${API_URL}/api/v1`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const apiCall = async (url, options, getToken) => {
  const token = await getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (response.status === 204) return { success: true, data: null };
  const result = await response.json();
  if (result.hasOwnProperty('success')) {
    if (!result.success) throw new Error(result.error?.message || 'Request failed');
    return result;
  }
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return { success: true, data: result };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async ({ getToken, cursor, unreadOnly }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (unreadOnly) params.set('unreadOnly', 'true');
      params.set('limit', '30');
      const result = await apiCall(
        `${API_V1}/notifications?${params}`,
        {},
        getToken,
      );
      return { ...result.data, append: !!cursor };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// FOLLO PERF — lightweight unread count (no notification bodies)
export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async ({ getToken }, { rejectWithValue }) => {
    try {
      const result = await apiCall(
        `${API_V1}/notifications/unread-count`,
        {},
        getToken,
      );
      return result.data.unreadCount;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async ({ getToken, id }, { rejectWithValue }) => {
    try {
      const result = await apiCall(
        `${API_V1}/notifications/${id}/read`,
        { method: 'PATCH' },
        getToken,
      );
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (getToken, { rejectWithValue }) => {
    try {
      await apiCall(
        `${API_V1}/notifications/read-all`,
        { method: 'PATCH' },
        getToken,
      );
      return true;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const clearAllNotifications = createAsyncThunk(
  'notifications/clearAll',
  async (getToken, { rejectWithValue }) => {
    try {
      await apiCall(
        `${API_V1}/notifications`,
        { method: 'DELETE' },
        getToken,
      );
      return true;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    nextCursor: null,
    loading: false,
    error: null,
  },
  reducers: {
    // Optimistic: push a real-time notification from push event
    addNotification(state, action) {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        const { notifications, unreadCount, nextCursor, append } = action.payload;
        state.items = append
          ? [...state.items, ...notifications]
          : notifications;
        state.unreadCount = unreadCount;
        state.nextCursor = nextCursor;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // mark one read
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const n = state.items.find((i) => i.id === action.payload?.id);
        if (n && !n.isRead) {
          n.isRead = true;
          n.readAt = action.payload.readAt;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      // mark all read
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        for (const n of state.items) {
          n.isRead = true;
          n.readAt = new Date().toISOString();
        }
        state.unreadCount = 0;
      })
      // clear all
      .addCase(clearAllNotifications.fulfilled, (state) => {
        state.items = [];
        state.unreadCount = 0;
        state.nextCursor = null;
      })
      // FOLLO PERF — lightweight unread count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      });
  },
});

export const { addNotification } = notificationSlice.actions;
export default notificationSlice.reducer;
