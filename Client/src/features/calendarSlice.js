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

// FOLLO CALENDAR — Phase 4 weather
export const fetchProjectWeatherAsync = createAsyncThunk(
  "calendar/fetchWeather",
  async ({ getToken, projectId, from, to }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiCall(`${API_V1}/calendar/project/${projectId}/weather?${params.toString()}`, {}, getToken);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const setProjectLocationAsync = createAsyncThunk(
  "calendar/setLocation",
  async ({ getToken, projectId, location }, { rejectWithValue }) => {
    try {
      const result = await apiCall(
        `${API_V1}/calendar/project/${projectId}/location`,
        { method: "PATCH", body: JSON.stringify(location) },
        getToken,
      );
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// FOLLO CALENDAR — Phase 3 notes
export const fetchProjectNotesAsync = createAsyncThunk(
  "calendar/fetchNotes",
  async ({ getToken, projectId, from, to }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiCall(`${API_V1}/calendar/project/${projectId}/notes?${params.toString()}`, {}, getToken);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const createNoteAsync = createAsyncThunk(
  "calendar/createNote",
  async ({ getToken, note }, { rejectWithValue }) => {
    try {
      const result = await apiCall(`${API_V1}/calendar/notes`, { method: "POST", body: JSON.stringify(note) }, getToken);
      return result.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const deleteNoteAsync = createAsyncThunk(
  "calendar/deleteNote",
  async ({ getToken, noteId }, { rejectWithValue }) => {
    try {
      await apiCall(`${API_V1}/calendar/notes/${noteId}`, { method: "DELETE" }, getToken);
      return { noteId };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const convertNoteToTaskAsync = createAsyncThunk(
  "calendar/convertNote",
  async ({ getToken, noteId, body }, { rejectWithValue }) => {
    try {
      const result = await apiCall(`${API_V1}/calendar/notes/${noteId}/convert-to-task`, { method: "POST", body: JSON.stringify(body || {}) }, getToken);
      return result.data;
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
  initialState: { items: [], range: null, loading: false, error: null, weather: { location: null, byDate: {} }, notes: [] },
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
      })
      .addCase(fetchProjectWeatherAsync.fulfilled, (state, action) => {
        const days = action.payload?.days || [];
        state.weather = {
          location: action.payload?.location || null,
          byDate: Object.fromEntries(days.map((d) => [d.date, d])),
        };
      })
      .addCase(setProjectLocationAsync.fulfilled, (state, action) => {
        state.weather.location = action.payload || state.weather.location;
      })
      .addCase(fetchProjectNotesAsync.fulfilled, (state, action) => {
        state.notes = action.payload || [];
      });
  },
});

export default calendarSlice.reducer;
