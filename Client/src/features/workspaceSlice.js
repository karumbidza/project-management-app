import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_V1 = `${API_URL}/api/v1`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Helper to make API calls with envelope handling
 */
const apiCall = async (url, options, getToken) => {
    const token = await getToken();
    console.log('[apiCall] Fetching:', url);
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });
    
    console.log('[apiCall] Response status:', response.status);
    
    // Handle 204 No Content
    if (response.status === 204) {
        return { success: true, data: null };
    }
    
    const result = await response.json();
    console.log('[apiCall] Result:', result);
    
    // Handle new envelope format
    if (result.hasOwnProperty('success')) {
        if (!result.success) {
            throw new Error(result.error?.message || 'Request failed');
        }
        return result;
    }
    
    // Handle legacy format (backward compatibility)
    if (!response.ok) {
        throw new Error(result.error || 'Request failed');
    }
    
    return { success: true, data: result };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchWorkspaces = createAsyncThunk(
    'workspace/fetchWorkspaces',
    async (getToken, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/workspaces`, {}, getToken);
            console.log('[fetchWorkspaces] API result:', result);
            console.log('[fetchWorkspaces] result.data:', result.data);
            return result.data;
        } catch (error) {
            console.error('[fetchWorkspaces] Error:', error);
            return rejectWithValue(error.message);
        }
    }
);

export const createWorkspaceAsync = createAsyncThunk(
    'workspace/createWorkspace',
    async ({ workspaceData, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/workspaces`, {
                method: 'POST',
                body: JSON.stringify(workspaceData),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteWorkspaceAsync = createAsyncThunk(
    'workspace/deleteWorkspace',
    async ({ workspaceId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/workspaces/${workspaceId}`, {
                method: 'DELETE',
            }, getToken);
            return { workspaceId };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const addWorkspaceMemberAsync = createAsyncThunk(
    'workspace/addWorkspaceMember',
    async ({ workspaceId, email, role, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/workspaces/add-member`, {
                method: 'POST',
                body: JSON.stringify({ workspaceId, email, role }),
            }, getToken);
            return { workspaceId, member: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch projects the user is directly a member of (for non-workspace users)
 */
export const fetchMyProjects = createAsyncThunk(
    'workspace/fetchMyProjects',
    async (getToken, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/my-projects`, {}, getToken);
            console.log('[fetchMyProjects] API result:', result);
            return result.data;
        } catch (error) {
            console.error('[fetchMyProjects] Error:', error);
            return rejectWithValue(error.message);
        }
    }
);

export const createProjectAsync = createAsyncThunk(
    'workspace/createProject',
    async ({ workspaceId, projectData, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/workspace/${workspaceId}`, {
                method: 'POST',
                body: JSON.stringify(projectData),
            }, getToken);
            return { ...result.data, workspaceId };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateProjectAsync = createAsyncThunk(
    'workspace/updateProject',
    async ({ projectId, projectData, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/${projectId}`, {
                method: 'PATCH',
                body: JSON.stringify(projectData),
            }, getToken);
            return result.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteProjectAsync = createAsyncThunk(
    'workspace/deleteProject',
    async ({ projectId, workspaceId, getToken }, { rejectWithValue }) => {
        try {
            await apiCall(`${API_V1}/projects/${projectId}`, {
                method: 'DELETE',
            }, getToken);
            return { projectId, workspaceId };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT MEMBER THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchProjectMembersAsync = createAsyncThunk(
    'workspace/fetchProjectMembers',
    async ({ projectId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/${projectId}/members`, {}, getToken);
            return { projectId, members: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const addProjectMemberAsync = createAsyncThunk(
    'workspace/addProjectMember',
    async ({ projectId, email, role, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/${projectId}/members`, {
                method: 'POST',
                body: JSON.stringify({ email, role }),
            }, getToken);
            // Backend returns { type: 'member', member } or { type: 'invitation', invitation }
            return { projectId, ...result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateProjectMemberRoleAsync = createAsyncThunk(
    'workspace/updateProjectMemberRole',
    async ({ projectId, memberId, role, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/${projectId}/members/${memberId}`, {
                method: 'PATCH',
                body: JSON.stringify({ role }),
            }, getToken);
            return { projectId, member: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

export const removeProjectMemberAsync = createAsyncThunk(
    'workspace/removeProjectMember',
    async ({ projectId, memberId, getToken }, { rejectWithValue }) => {
        try {
            await apiCall(`${API_V1}/projects/${projectId}/members/${memberId}`, {
                method: 'DELETE',
            }, getToken);
            return { projectId, memberId };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchProjectTasksAsync = createAsyncThunk(
    'workspace/fetchProjectTasks',
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
    'workspace/createTask',
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
    'workspace/updateTask',
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
    'workspace/deleteTask',
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
    'workspace/fetchTaskDependencies',
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
    'workspace/addTaskDependency',
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
    'workspace/removeTaskDependency',
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
// TASK COMMENT THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const addCommentAsync = createAsyncThunk(
    'workspace/addComment',
    async ({ taskId, commentData, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/tasks/${taskId}/comments`, {
                method: 'POST',
                body: JSON.stringify(commentData),
            }, getToken);
            return { taskId, comment: result.data };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIAL STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const initialState = {
    workspaces: [],
    currentWorkspace: null,
    // For members who access projects directly (not through workspaces)
    myProjects: [],
    currentProject: null,
    isMemberView: false, // true when user has projects but no workspaces (member-only)
    loading: false,
    error: null,
    // Granular loading states for better UX
    loadingStates: {
        workspaces: false,
        projects: false,
        myProjects: false,
        tasks: false,
        members: false,
        dependencies: false,
    },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
        setMyProjects: (state, action) => {
            state.myProjects = action.payload;
        },
        setCurrentProject: (state, action) => {
            localStorage.setItem("currentProjectId", action.payload);
            state.currentProject = state.myProjects.find((p) => p.id === action.payload);
        },
        setMemberView: (state, action) => {
            state.isMemberView = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
        addWorkspace: (state, action) => {
            state.workspaces.push(action.payload);
            if (state.currentWorkspace?.id !== action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        updateWorkspace: (state, action) => {
            state.workspaces = state.workspaces.map((w) =>
                w.id === action.payload.id ? action.payload : w
            );
            if (state.currentWorkspace?.id === action.payload.id) {
                state.currentWorkspace = action.payload;
            }
        },
        deleteWorkspace: (state, action) => {
            state.workspaces = state.workspaces.filter((w) => w.id !== action.payload);
        },
        addProject: (state, action) => {
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = [...(state.currentWorkspace.projects || []), action.payload];
                state.workspaces = state.workspaces.map((w) =>
                    w.id === state.currentWorkspace.id 
                        ? { ...w, projects: [...(w.projects || []), action.payload] } 
                        : w
                );
            }
        },
        addTask: (state, action) => {
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                    if (p.id === action.payload.projectId) {
                        return { ...p, tasks: [...(p.tasks || []), action.payload] };
                    }
                    return p;
                });
            }
        },
        updateTask: (state, action) => {
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => {
                    if (p.id === action.payload.projectId) {
                        return {
                            ...p,
                            tasks: p.tasks.map((t) =>
                                t.id === action.payload.id ? action.payload : t
                            ),
                        };
                    }
                    return p;
                });
            }
        },
        deleteTask: (state, action) => {
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => ({
                    ...p,
                    tasks: (p.tasks || []).filter((t) => t.id !== action.payload),
                }));
            }
        },
    },
    extraReducers: (builder) => {
        builder
            // ━━━ Fetch Workspaces ━━━
            .addCase(fetchWorkspaces.pending, (state) => {
                state.loadingStates.workspaces = true;
                state.error = null;
            })
            .addCase(fetchWorkspaces.fulfilled, (state, action) => {
                state.loadingStates.workspaces = false;
                state.workspaces = action.payload || [];
                
                // If user has workspaces, they are NOT in member-only view
                if (action.payload?.length > 0) {
                    state.isMemberView = false;
                }
                
                const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
                if (savedWorkspaceId && action.payload?.find(w => w.id === savedWorkspaceId)) {
                    state.currentWorkspace = action.payload.find(w => w.id === savedWorkspaceId);
                } else if (action.payload?.length > 0) {
                    state.currentWorkspace = action.payload[0];
                    localStorage.setItem("currentWorkspaceId", action.payload[0].id);
                }
            })
            .addCase(fetchWorkspaces.rejected, (state, action) => {
                state.loadingStates.workspaces = false;
                state.error = action.payload;
            })
            
            // ━━━ Fetch My Projects (for members without workspace access) ━━━
            .addCase(fetchMyProjects.pending, (state) => {
                state.loadingStates.myProjects = true;
                state.error = null;
            })
            .addCase(fetchMyProjects.fulfilled, (state, action) => {
                state.loadingStates.myProjects = false;
                state.myProjects = action.payload || [];
                
                // Only enable member view if:
                // 1. User has projects 
                // 2. User has NO workspaces
                // 3. Workspaces have finished loading (not pending)
                const hasNoWorkspaces = state.workspaces.length === 0 && !state.loadingStates.workspaces;
                const hasProjects = action.payload?.length > 0;
                
                if (hasProjects && hasNoWorkspaces) {
                    state.isMemberView = true;
                    
                    // Set current project for member view
                    const savedProjectId = localStorage.getItem("currentProjectId");
                    if (savedProjectId && action.payload?.find(p => p.id === savedProjectId)) {
                        state.currentProject = action.payload.find(p => p.id === savedProjectId);
                    } else if (action.payload?.length > 0) {
                        state.currentProject = action.payload[0];
                        localStorage.setItem("currentProjectId", action.payload[0].id);
                    }
                }
            })
            .addCase(fetchMyProjects.rejected, (state, action) => {
                state.loadingStates.myProjects = false;
                state.error = action.payload;
            })
            
            // ━━━ Create Workspace ━━━
            .addCase(createWorkspaceAsync.pending, (state) => {
                state.loadingStates.workspaces = true;
            })
            .addCase(createWorkspaceAsync.fulfilled, (state, action) => {
                state.loadingStates.workspaces = false;
                state.workspaces.push(action.payload);
                state.currentWorkspace = action.payload;
                localStorage.setItem("currentWorkspaceId", action.payload.id);
            })
            .addCase(createWorkspaceAsync.rejected, (state, action) => {
                state.loadingStates.workspaces = false;
                state.error = action.payload;
            })
            
            // ━━━ Delete Workspace ━━━
            .addCase(deleteWorkspaceAsync.pending, (state) => {
                state.loadingStates.workspaces = true;
            })
            .addCase(deleteWorkspaceAsync.fulfilled, (state, action) => {
                state.loadingStates.workspaces = false;
                const { workspaceId } = action.payload;
                state.workspaces = state.workspaces.filter((w) => w.id !== workspaceId);
                // If deleted workspace was current, switch to first available
                if (state.currentWorkspace?.id === workspaceId) {
                    state.currentWorkspace = state.workspaces[0] || null;
                    if (state.currentWorkspace) {
                        localStorage.setItem("currentWorkspaceId", state.currentWorkspace.id);
                    } else {
                        localStorage.removeItem("currentWorkspaceId");
                    }
                }
            })
            .addCase(deleteWorkspaceAsync.rejected, (state, action) => {
                state.loadingStates.workspaces = false;
                state.error = action.payload;
            })
            
            // ━━━ Add Workspace Member ━━━
            .addCase(addWorkspaceMemberAsync.pending, (state) => {
                state.loadingStates.members = true;
            })
            .addCase(addWorkspaceMemberAsync.fulfilled, (state, action) => {
                state.loadingStates.members = false;
                const { workspaceId, member } = action.payload;
                state.workspaces = state.workspaces.map((w) =>
                    w.id === workspaceId 
                        ? { ...w, members: [...(w.members || []), member] }
                        : w
                );
                if (state.currentWorkspace?.id === workspaceId) {
                    state.currentWorkspace.members = [...(state.currentWorkspace.members || []), member];
                }
            })
            .addCase(addWorkspaceMemberAsync.rejected, (state, action) => {
                state.loadingStates.members = false;
                state.error = action.payload;
            })
            
            // ━━━ Create Project ━━━
            .addCase(createProjectAsync.pending, (state) => {
                state.loadingStates.projects = true;
            })
            .addCase(createProjectAsync.fulfilled, (state, action) => {
                state.loadingStates.projects = false;
                const project = { ...action.payload, tasks: [], members: action.payload.members || [] };
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = [...(state.currentWorkspace.projects || []), project];
                }
                state.workspaces = state.workspaces.map((w) =>
                    w.id === action.payload.workspaceId 
                        ? { ...w, projects: [...(w.projects || []), project] }
                        : w
                );
            })
            .addCase(createProjectAsync.rejected, (state, action) => {
                state.loadingStates.projects = false;
                state.error = action.payload;
            })
            
            // ━━━ Update Project ━━━
            .addCase(updateProjectAsync.fulfilled, (state, action) => {
                const updated = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                        p.id === updated.id ? { ...p, ...updated } : p
                    );
                }
            })
            
            // ━━━ Delete Project ━━━
            .addCase(deleteProjectAsync.fulfilled, (state, action) => {
                const { projectId, workspaceId } = action.payload;
                if (state.currentWorkspace?.id === workspaceId) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.filter(
                        (p) => p.id !== projectId
                    );
                }
                state.workspaces = state.workspaces.map((w) =>
                    w.id === workspaceId 
                        ? { ...w, projects: (w.projects || []).filter((p) => p.id !== projectId) }
                        : w
                );
            })
            
            // ━━━ Add Project Member ━━━
            .addCase(addProjectMemberAsync.pending, (state) => {
                state.loadingStates.members = true;
            })
            .addCase(addProjectMemberAsync.fulfilled, (state, action) => {
                state.loadingStates.members = false;
                const { projectId, type, member } = action.payload;
                // Only update state if a member was added (not an invitation)
                if (type === 'member' && member && state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                        p.id === projectId 
                            ? { ...p, members: [...(p.members || []), member] }
                            : p
                    );
                }
                // Invitation case: no state update needed, UI will show toast
            })
            .addCase(addProjectMemberAsync.rejected, (state, action) => {
                state.loadingStates.members = false;
                state.error = action.payload;
            })
            
            // ━━━ Update Project Member Role ━━━
            .addCase(updateProjectMemberRoleAsync.fulfilled, (state, action) => {
                const { projectId, member } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                        p.id === projectId 
                            ? { 
                                ...p, 
                                members: p.members.map((m) => 
                                    m.id === member.id ? member : m
                                ) 
                            }
                            : p
                    );
                }
            })
            
            // ━━━ Remove Project Member ━━━
            .addCase(removeProjectMemberAsync.fulfilled, (state, action) => {
                const { projectId, memberId } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                        p.id === projectId 
                            ? { ...p, members: p.members.filter((m) => m.id !== memberId) }
                            : p
                    );
                }
            })
            
            // ━━━ Create Task ━━━
            .addCase(createTaskAsync.pending, (state) => {
                state.loadingStates.tasks = true;
            })
            .addCase(createTaskAsync.fulfilled, (state, action) => {
                state.loadingStates.tasks = false;
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
                state.loadingStates.tasks = false;
                state.error = action.payload;
            })
            
            // ━━━ Update Task ━━━
            .addCase(updateTaskAsync.pending, (state) => {
                state.loadingStates.tasks = true;
            })
            .addCase(updateTaskAsync.fulfilled, (state, action) => {
                state.loadingStates.tasks = false;
                const updatedTask = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => 
                        p.id === updatedTask.projectId 
                            ? { ...p, tasks: p.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) } 
                            : p
                    );
                }
            })
            .addCase(updateTaskAsync.rejected, (state, action) => {
                state.loadingStates.tasks = false;
                state.error = action.payload;
            })
            
            // ━━━ Delete Task ━━━
            .addCase(deleteTaskAsync.fulfilled, (state, action) => {
                const { taskId, projectId } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                        p.id === projectId 
                            ? { ...p, tasks: (p.tasks || []).filter((t) => t.id !== taskId) }
                            : p
                    );
                }
            })
            
            // ━━━ Add Task Dependency ━━━
            .addCase(addTaskDependencyAsync.pending, (state) => {
                state.loadingStates.dependencies = true;
            })
            .addCase(addTaskDependencyAsync.fulfilled, (state, action) => {
                state.loadingStates.dependencies = false;
                const { taskId, dependency } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => ({
                        ...p,
                        tasks: (p.tasks || []).map((t) =>
                            t.id === taskId 
                                ? { ...t, predecessors: [...(t.predecessors || []), dependency] }
                                : t
                        ),
                    }));
                }
            })
            .addCase(addTaskDependencyAsync.rejected, (state, action) => {
                state.loadingStates.dependencies = false;
                state.error = action.payload;
            })
            
            // ━━━ Remove Task Dependency ━━━
            .addCase(removeTaskDependencyAsync.fulfilled, (state, action) => {
                const { taskId, dependencyId } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => ({
                        ...p,
                        tasks: (p.tasks || []).map((t) =>
                            t.id === taskId 
                                ? { 
                                    ...t, 
                                    predecessors: (t.predecessors || []).filter((d) => d.id !== dependencyId) 
                                }
                                : t
                        ),
                    }));
                }
            })
            
            // ━━━ Add Comment ━━━
            .addCase(addCommentAsync.pending, (state) => {
                state.loading = true;
            })
            .addCase(addCommentAsync.fulfilled, (state, action) => {
                state.loading = false;
                const { taskId, comment } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) => ({
                        ...p,
                        tasks: (p.tasks || []).map((t) =>
                            t.id === taskId 
                                ? { ...t, comments: [...(t.comments || []), comment] }
                                : t
                        ),
                    }));
                }
            })
            .addCase(addCommentAsync.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { 
    setWorkspaces, 
    setCurrentWorkspace,
    setMyProjects,
    setCurrentProject,
    setMemberView,
    clearError,
    addWorkspace, 
    updateWorkspace, 
    deleteWorkspace, 
    addProject, 
    addTask, 
    updateTask, 
    deleteTask 
} = workspaceSlice.actions;

export default workspaceSlice.reducer;