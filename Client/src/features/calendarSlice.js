// FOLLO CALENDAR
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiCall, API_V1 } from "./apiHelper";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Global feed = /calendar ; project feed = /calendar/project/:id
export const fetchCalendarFeed = createAsyncThunk(
  "calendar/fetchFeed",
  async ({ getToken, scope, projectId, from, to, views }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (views) params.set("views", views);
      const base =
        scope === "project" && projectId
          ? `${API_V1}/calendar/project/${projectId}`
          : `${API_V1}/calendar`;
      const result = await apiCall(`${base}?${params.toString()}`, {}, getToken);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const createEventAsync = createAsyncThunk(
  "calendar/createEvent",
  async ({ getToken, projectId, event }, { rejectWithValue }) => {
    try {
      const result = await apiCall(
        `${API_V1}/calendar/project/${projectId}/events`,
        { method: "POST", body: JSON.stringify(event) },
        getToken,
      );
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const updateEventAsync = createAsyncThunk(
  "calendar/updateEvent",
  async ({ getToken, eventId, updates }, { rejectWithValue }) => {
    try {
      const result = await apiCall(
        `${API_V1}/calendar/events/${eventId}`,
        { method: "PATCH", body: JSON.stringify(updates) },
        getToken,
      );
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const deleteEventAsync = createAsyncThunk(
  "calendar/deleteEvent",
  async ({ getToken, eventId }, { rejectWithValue }) => {
    try {
      await apiCall(`${API_V1}/calendar/events/${eventId}`, { method: "DELETE" }, getToken);
      return { eventId };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const calendarSlice = createSlice({
  name: "calendar",
  initialState: { items: [], range: null, loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCalendarFeed.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCalendarFeed.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload?.items || [];
        state.range = { from: action.payload?.from, to: action.payload?.to };
      })
      .addCase(fetchCalendarFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load calendar";
      });
  },
});

export default calendarSlice.reducer;
