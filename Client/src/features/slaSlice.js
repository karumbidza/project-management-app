// FOLLO SRP
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiCall, API_V1 } from "./apiHelper";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLA WORKFLOW THUNKS (FOLLO PERMISSIONS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const submitTaskAsync = createAsyncThunk(
    'sla/submitTask',
    async ({ taskId, completionNotes, completionPhotos, declaration, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/submit`, {
                method: 'POST',
                body: JSON.stringify({ completionNotes, completionPhotos, declaration }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const approveTaskAsync = createAsyncThunk(
    'sla/approveTask',
    async ({ taskId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/approve`, {
                method: 'POST',
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const rejectTaskAsync = createAsyncThunk(
    'sla/rejectTask',
    async ({ taskId, reason, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const raiseBlockerAsync = createAsyncThunk(
    'sla/raiseBlocker',
    async ({ taskId, description, mediaUrl, blockedByTaskId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/blocker`, {
                method: 'POST',
                body: JSON.stringify({ description, mediaUrl, blockedByTaskId }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const resolveBlockerAsync = createAsyncThunk(
    'sla/resolveBlocker',
    async ({ taskId, resolution, note, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/blocker/resolve`, {
                method: 'POST',
                body: JSON.stringify({ resolution, note }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const fetchTaskSlaAsync = createAsyncThunk(
    'sla/fetchTaskSla',
    async ({ taskId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/sla`, {}, getToken);
            return { taskId, sla: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// FOLLO WORKFLOW — request more info from assignee
export const requestMoreInfoAsync = createAsyncThunk(
    'sla/requestMoreInfo',
    async ({ taskId, question, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/request-info`, {
                method: 'POST',
                body: JSON.stringify({ question }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// FOLLO WORKFLOW — deadline extension thunks
export const requestExtensionAsync = createAsyncThunk(
    'sla/requestExtension',
    async ({ taskId, reason, proposedDate, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/extension/request`, {
                method: 'POST',
                body: JSON.stringify({ reason, proposedDate }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const approveExtensionAsync = createAsyncThunk(
    'sla/approveExtension',
    async ({ taskId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/extension/approve`, {
                method: 'POST',
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const denyExtensionAsync = createAsyncThunk(
    'sla/denyExtension',
    async ({ taskId, reason, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/extension/deny`, {
                method: 'POST',
                body: JSON.stringify({ reason }),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLICE (minimal — SLA state mutations live in workspace slice)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const slaSlice = createSlice({
    name: "sla",
    initialState: {},
    reducers: {},
});

export default slaSlice.reducer;
