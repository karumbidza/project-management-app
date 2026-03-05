import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Async thunk to fetch workspaces from API
export const fetchWorkspaces = createAsyncThunk(
    'workspace/fetchWorkspaces',
    async (getToken, { rejectWithValue }) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/workspaces`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch workspaces');
            }
            return await response.json();
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Async thunk to create a project
export const createProjectAsync = createAsyncThunk(
    'workspace/createProject',
    async ({ workspaceId, projectData, getToken }, { rejectWithValue }) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/projects/workspace/${workspaceId}/projects`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(projectData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create project');
            }
            return await response.json();
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Async thunk to create a task
export const createTaskAsync = createAsyncThunk(
    'workspace/createTask',
    async ({ projectId, taskData, getToken }, { rejectWithValue }) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/api/tasks/project/${projectId}/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create task');
            }
            return await response.json();
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

const initialState = {
    workspaces: [],
    currentWorkspace: null,
    loading: false,
    error: null,
};

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        setWorkspaces: (state, action) => {
            state.workspaces = action.payload;
        },
        setCurrentWorkspace: (state, action) => {
            localStorage.setItem("currentWorkspaceId", action.payload);
            state.currentWorkspace = state.workspaces.find((w) => w.id === action.payload);
        },
        addWorkspace: (state, action) => {
            state.workspaces.push(action.payload);

            // set current workspace to the new workspace
            if (state.currentWorkspace?.id !== action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        updateWorkspace: (state, action) => {
            state.workspaces = state.workspaces.map((w) =>
                w.id === action.payload.id ? action.payload : w
            );

            // if current workspace is updated, set it to the updated workspace
            if (state.currentWorkspace?.id === action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        deleteWorkspace: (state, action) => {
            state.workspaces = state.workspaces.filter((w) => w._id !== action.payload);
        },
        addProject: (state, action) => {
            state.currentWorkspace.projects.push(action.payload);
            // find workspace by id and add project to it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? { ...w, projects: w.projects.concat(action.payload) } : w
            );
        },
        addTask: (state, action) => {

            state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                console.log(p.id, action.payload.projectId, p.id === action.payload.projectId);
                if (p.id === action.payload.projectId) {
                    p.tasks.push(action.payload);
                }
                return p;
            });

            // find workspace and project by id and add task to it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? { ...p, tasks: p.tasks.concat(action.payload) } : p
                    )
                } : w
            );
        },
        updateTask: (state, action) => {
            state.currentWorkspace.projects.map((p) => {
                if (p.id === action.payload.projectId) {
                    p.tasks = p.tasks.map((t) =>
                        t.id === action.payload.id ? action.payload : t
                    );
                }
            });
            // find workspace and project by id and update task in it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? {
                            ...p, tasks: p.tasks.map((t) =>
                                t.id === action.payload.id ? action.payload : t
                            )
                        } : p
                    )
                } : w
            );
        },
        deleteTask: (state, action) => {
            state.currentWorkspace.projects.map((p) => {
                p.tasks = p.tasks.filter((t) => !action.payload.includes(t.id));
                return p;
            });
            // find workspace and project by id and delete task from it
            state.workspaces = state.workspaces.map((w) =>
                w.id === state.currentWorkspace.id ? {
                    ...w, projects: w.projects.map((p) =>
                        p.id === action.payload.projectId ? {
                            ...p, tasks: p.tasks.filter((t) => !action.payload.includes(t.id))
                        } : p
                    )
                } : w
            );
        }

    },
    extraReducers: (builder) => {
        builder
            // Fetch workspaces
            .addCase(fetchWorkspaces.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchWorkspaces.fulfilled, (state, action) => {
                state.loading = false;
                state.workspaces = action.payload;
                // Restore current workspace from localStorage or set first one
                const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
                if (savedWorkspaceId && action.payload.find(w => w.id === savedWorkspaceId)) {
                    state.currentWorkspace = action.payload.find(w => w.id === savedWorkspaceId);
                } else if (action.payload.length > 0) {
                    state.currentWorkspace = action.payload[0];
                    localStorage.setItem("currentWorkspaceId", action.payload[0].id);
                }
            })
            .addCase(fetchWorkspaces.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create project
            .addCase(createProjectAsync.pending, (state) => {
                state.loading = true;
            })
            .addCase(createProjectAsync.fulfilled, (state, action) => {
                state.loading = false;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = [...(state.currentWorkspace.projects || []), action.payload];
                }
            })
            .addCase(createProjectAsync.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create task
            .addCase(createTaskAsync.pending, (state) => {
                state.loading = true;
            })
            .addCase(createTaskAsync.fulfilled, (state, action) => {
                state.loading = false;
                const task = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => 
                        p.id === task.projectId 
                            ? { ...p, tasks: [...(p.tasks || []), task] } 
                            : p
                    );
                }
            })
            .addCase(createTaskAsync.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { setWorkspaces, setCurrentWorkspace, addWorkspace, updateWorkspace, deleteWorkspace, addProject, addTask, updateTask, deleteTask } = workspaceSlice.actions;
export default workspaceSlice.reducer;