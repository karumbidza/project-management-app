// FOLLO SRP
// FOLLO WORKFLOW
import { createAsyncThunk, createAction, createSlice } from "@reduxjs/toolkit";
import { apiCall, API_V1 } from "./apiHelper";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK CRUD THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchProjectTasksAsync = createAsyncThunk(
    'task/fetchProjectTasks',
    async ({ projectId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/project/${projectId}`, {}, getToken);
            return { projectId, tasks: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const createTaskAsync = createAsyncThunk(
    'task/createTask',
    async ({ projectId, taskData, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/project/${projectId}`, {
                method: 'POST',
                body: JSON.stringify(taskData),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateTaskAsync = createAsyncThunk(
    'task/updateTask',
    async ({ taskId, taskData, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}`, {
                method: 'PATCH',
                body: JSON.stringify(taskData),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteTaskAsync = createAsyncThunk(
    'task/deleteTask',
    async ({ taskId, projectId, getToken }, { rejectWithValue }) => {
        try {
            await apiCall(`${API_V1}/tasks/${taskId}`, {
                method: 'DELETE',
            }, getToken);
            return { taskId, projectId };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK DEPENDENCY THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchTaskDependenciesAsync = createAsyncThunk(
    'task/fetchTaskDependencies',
    async ({ taskId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/dependencies`, {}, getToken);
            return { taskId, dependencies: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const addTaskDependencyAsync = createAsyncThunk(
    'task/addTaskDependency',
    async ({ taskId, predecessorId, lagDays, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/dependencies`, {
                method: 'POST',
                body: JSON.stringify({ predecessorId, lagDays }),
            }, getToken);
            return { taskId, dependency: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const removeTaskDependencyAsync = createAsyncThunk(
    'task/removeTaskDependency',
    async ({ taskId, dependencyId, getToken }, { rejectWithValue }) => {
        try {
            await apiCall(`${API_V1}/tasks/${taskId}/dependencies/${dependencyId}`, {
                method: 'DELETE',
            }, getToken);
            return { taskId, dependencyId };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRIORITY RECALCULATION (FOLLO WORKFLOW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const recalculatePriorityAsync = createAsyncThunk(
    'task/recalculatePriority',
    async ({ taskId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/recalculate-priority`, {
                method: 'POST',
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REALTIME SYNC ACTIONS (state handled by workspaceSlice)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const addTaskToProject = createAction('task/addTaskToProject');
export const updateTaskInProject = createAction('task/updateTaskInProject');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLICE (minimal — task state lives in workspace slice)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const taskSlice = createSlice({
    name: "task",
    initialState: {},
    reducers: {},
});

export default taskSlice.reducer;
