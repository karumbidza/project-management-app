// FOLLO AUTH-FIX
// FOLLO SRP
// FOLLO ROLE-FLASH
// FOLLO FIX
// FOLLO PERMISSIONS
// FOLLO WORKFLOW
// FOLLO REALTIME
// FOLLO BUGFIX-REFRESH
// FOLLO ACTION-CARDS
// FOLLO INSTANT
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiCall, API_V1 } from "./apiHelper";

// ━━━ Cross-slice imports (for extraReducers) ━━━
import {
    createTaskAsync, updateTaskAsync, deleteTaskAsync,
    addTaskDependencyAsync, removeTaskDependencyAsync,
    addTaskToProject, updateTaskInProject,
} from "./taskSlice";
import { addCommentAsync } from "./commentSlice";
import {
    submitTaskAsync, approveTaskAsync, rejectTaskAsync,
    raiseBlockerAsync, resolveBlockerAsync,
    fetchTaskSlaAsync,
    requestExtensionAsync, approveExtensionAsync, denyExtensionAsync,
} from "./slaSlice";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE THUNKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fetchWorkspaces = createAsyncThunk(
    'workspace/fetchWorkspaces',
    async (getToken, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/workspaces`, {}, getToken);
            return result.data;
        } catch (error) {
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

export const fetchAllUsersAsync = createAsyncThunk(
    'workspace/fetchAllUsers',
    async (getToken, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/workspaces/users`, {}, getToken);
            return result.data;
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
            return result.data;
        } catch (error) {
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

export const toggleProjectMemberAsync = createAsyncThunk(
    'workspace/toggleProjectMember',
    async ({ projectId, memberId, getToken }, { rejectWithValue }) => {
        try {
            const result = await apiCall(`${API_V1}/projects/${projectId}/members/${memberId}/toggle`, {
                method: 'PATCH',
            }, getToken);
            return { projectId, member: result.data };
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
    roleConfirmed: false, // FOLLO ROLE-FLASH: true after first fetchWorkspaces resolves — gates sidebar render
    // FOLLO GLITCH-FIX: track the requestId of the latest fetchWorkspaces dispatch.
    // Stale in-flight responses (requestId mismatch) are discarded so a focus-triggered
    // GET that started before a project was created can't overwrite the fresh Redux state.
    _latestWorkspacesRequestId: null,
    allUsers: [], // All system users (for admin invite dropdown)
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
        // FOLLO AUTH-FIX — reset all state when userId changes (account switch)
        // FOLLO ROLE-FLASH — also resets roleConfirmed so skeleton re-shows for new user
        clearWorkspaceState: (state) => {
            state.workspaces = [];
            state.currentWorkspace = null;
            state.myProjects = [];
            state.currentProject = null;
            state.allUsers = [];
            state.isMemberView = false;
            state.roleConfirmed = false;
            state._latestWorkspacesRequestId = null; // FOLLO GLITCH-FIX
            state.loading = false;
            state.error = null;
            state.loadingStates = {
                workspaces: false,
                projects: false,
                myProjects: false,
                tasks: false,
                members: false,
                dependencies: false,
            };
        },
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
            // ━━━ Realtime sync actions (from taskSlice) ━━━
            .addCase(addTaskToProject, (state, action) => {
                const task = action.payload;
                const addToProject = (p) => {
                    if (p.id !== task.projectId) return p;
                    const exists = (p.tasks || []).some(t => t.id === task.id);
                    if (exists) return p;
                    return { ...p, tasks: [...(p.tasks || []), task] };
                };
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map(addToProject);
                }
                if (state.myProjects.length > 0) {
                    state.myProjects = state.myProjects.map(addToProject);
                }
            })
            .addCase(updateTaskInProject, (state, action) => {
                const updatedTask = action.payload;
                const patchTask = (p) => {
                    if (p.id !== updatedTask.projectId) return p;
                    return {
                        ...p,
                        tasks: (p.tasks || []).map(t =>
                            t.id === updatedTask.id ? updatedTask : t
                        ),
                    };
                };
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map(patchTask);
                }
                if (state.myProjects.length > 0) {
                    state.myProjects = state.myProjects.map(patchTask);
                }
            })

            // ━━━ Fetch Workspaces ━━━
            .addCase(fetchWorkspaces.pending, (state, action) => {
                state.loadingStates.workspaces = true;
                state._latestWorkspacesRequestId = action.meta.requestId; // FOLLO GLITCH-FIX: track latest
                state.error = null;
            })
            .addCase(fetchWorkspaces.fulfilled, (state, action) => {
                // FOLLO GLITCH-FIX: discard stale responses — only the latest dispatch wins.
                // A focus-triggered GET that started before a project POST must not overwrite
                // the Redux state that already has the newly created project.
                if (action.meta.requestId !== state._latestWorkspacesRequestId) {
                    state.loadingStates.workspaces = false;
                    return;
                }
                state.loadingStates.workspaces = false;
                state.roleConfirmed = true; // FOLLO ROLE-FLASH: role is now knowable — unblock sidebar
                state.workspaces = action.payload || [];
                
                // FOLLO BUGFIX-REFRESH: Don't blindly set isMemberView = false.
                // Only disable member view if user is ADMIN/OWNER in some workspace.
                // Non-admin workspace members should stay in member view.
                
                const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
                if (savedWorkspaceId && action.payload?.find(w => w.id === savedWorkspaceId)) {
                    state.currentWorkspace = action.payload.find(w => w.id === savedWorkspaceId);
                } else if (action.payload?.length > 0) {
                    state.currentWorkspace = action.payload[0];
                    localStorage.setItem("currentWorkspaceId", action.payload[0].id);
                }
            })
            .addCase(fetchWorkspaces.rejected, (state, action) => {
                // FOLLO GLITCH-FIX: only process if this is still the latest request
                if (action.meta.requestId !== state._latestWorkspacesRequestId) {
                    state.loadingStates.workspaces = false;
                    return;
                }
                state.loadingStates.workspaces = false;
                state.roleConfirmed = true; // FOLLO ROLE-FLASH: even on error, stop blocking sidebar
                state.error = action.payload;
                console.error('[Workspace] fetchWorkspaces rejected:', action.payload); // FOLLO BUGFIX-REFRESH
            })
            
            // ━━━ Fetch My Projects (for members without workspace access) ━━━
            .addCase(fetchMyProjects.pending, (state) => {
                state.loadingStates.myProjects = true;
                state.error = null;
            })
            .addCase(fetchMyProjects.fulfilled, (state, action) => {
                state.loadingStates.myProjects = false;
                state.myProjects = action.payload || [];
                
                // FOLLO BUGFIX-REFRESH: Don't set isMemberView here — the reducer
                // has no access to userId so it can't determine admin status.
                // useUserRole() hook is the single source of truth for member view.
                const hasProjects = action.payload?.length > 0;
                
                if (hasProjects) {
                    const savedProjectId = localStorage.getItem("currentProjectId");
                    if (savedProjectId && action.payload?.find(p => p.id === savedProjectId)) {
                        state.currentProject = action.payload.find(p => p.id === savedProjectId);
                    } else if (!state.currentProject && action.payload?.length > 0) {
                        state.currentProject = action.payload[0];
                        localStorage.setItem("currentProjectId", action.payload[0].id);
                    }
                }
            })
            .addCase(fetchMyProjects.rejected, (state, action) => {
                state.loadingStates.myProjects = false;
                state.error = action.payload;
                console.error('[Workspace] fetchMyProjects rejected:', action.payload); // FOLLO BUGFIX-REFRESH
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
                // Clear project data that belonged to the deleted workspace so
                // stale projects don't surface in member-view after deletion.
                state.myProjects = state.myProjects.filter(p => p.workspaceId !== workspaceId);
                if (state.currentProject?.workspaceId === workspaceId) {
                    state.currentProject = null;
                    localStorage.removeItem("currentProjectId");
                }
                // FOLLO GLITCH-FIX: stamp a sentinel so any in-flight fetchWorkspaces
                // (e.g. focus-triggered) resolves with a mismatched requestId and is
                // discarded — preventing the deleted workspace from being restored.
                state._latestWorkspacesRequestId = `deleted-${workspaceId}`;
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
                // FOLLO INSTANT — preserve tasks from payload (template-seeded projects have pre-created tasks)
                state.loadingStates.projects = false;
                const project = { ...action.payload, tasks: action.payload.tasks || [], members: action.payload.members || [] };
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = [...(state.currentWorkspace.projects || []), project];
                }
                state.workspaces = state.workspaces.map((w) =>
                    w.id === action.payload.workspaceId
                        ? { ...w, projects: [...(w.projects || []), project] }
                        : w
                );
                // FOLLO INSTANT — also update myProjects so member-view shows new project immediately
                if (state.myProjects.length > 0) {
                    state.myProjects = [...state.myProjects, project];
                }
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

            // ━━━ Toggle Project Member Active ━━━
            .addCase(toggleProjectMemberAsync.fulfilled, (state, action) => {
                const { projectId, member } = action.payload;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                        p.id === projectId
                            ? { ...p, members: p.members.map((m) => m.id === member.id ? member : m) }
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
                const addTask = (p) => p.id === task.projectId ? { ...p, tasks: [...(p.tasks || []), task] } : p;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map(addTask);
                }
                if (state.myProjects.length > 0) {
                    state.myProjects = state.myProjects.map(addTask);
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
                const patchTask = (p) => p.id === updatedTask.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === updatedTask.id ? updatedTask : t) } : p;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map(patchTask);
                }
                if (state.myProjects.length > 0) {
                    state.myProjects = state.myProjects.map(patchTask);
                }
            })
            .addCase(updateTaskAsync.rejected, (state, action) => {
                state.loadingStates.tasks = false;
                state.error = action.payload;
            })
            
            // ━━━ Delete Task ━━━
            .addCase(deleteTaskAsync.fulfilled, (state, action) => {
                const { taskId, projectId } = action.payload;
                const removeTask = (p) => p.id === projectId ? { ...p, tasks: (p.tasks || []).filter((t) => t.id !== taskId) } : p;
                if (state.currentWorkspace) {
                    state.currentWorkspace.projects = state.currentWorkspace.projects.map(removeTask);
                }
                if (state.myProjects.length > 0) {
                    state.myProjects = state.myProjects.map(removeTask);
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
            // Note: TaskDetails uses local state for comments, so no Redux state update needed here.
            // We only track loading granularly to avoid affecting unrelated UI.
            .addCase(addCommentAsync.pending, (state) => {
                state.loadingStates.tasks = true;
            })
            .addCase(addCommentAsync.fulfilled, (state) => {
                state.loadingStates.tasks = false;
            })
            .addCase(addCommentAsync.rejected, (state, action) => {
                state.loadingStates.tasks = false;
                state.error = action.payload;
            })
            
            // ━━━ SLA: Submit Task ━━━
            .addCase(submitTaskAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(submitTaskAsync.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // ━━━ SLA: Approve Task ━━━
            .addCase(approveTaskAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(approveTaskAsync.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // ━━━ SLA: Reject Task ━━━
            .addCase(rejectTaskAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(rejectTaskAsync.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // ━━━ SLA: Raise Blocker ━━━
            .addCase(raiseBlockerAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(raiseBlockerAsync.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // ━━━ SLA: Resolve Blocker ━━━
            .addCase(resolveBlockerAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(resolveBlockerAsync.rejected, (state, action) => {
                state.error = action.payload;
            })
            
            // ━━━ SLA: Fetch Task SLA ━━━
            .addCase(fetchTaskSlaAsync.fulfilled, () => {
                // SLA data is consumed directly by components via unwrap(), not stored in slice state
            })
            .addCase(fetchTaskSlaAsync.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ━━━ FOLLO WORKFLOW: Request Extension ━━━
            .addCase(requestExtensionAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(requestExtensionAsync.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ━━━ FOLLO WORKFLOW: Approve Extension ━━━
            .addCase(approveExtensionAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(approveExtensionAsync.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ━━━ FOLLO WORKFLOW: Deny Extension ━━━
            .addCase(denyExtensionAsync.fulfilled, (state, action) => {
                const task = action.payload;
                if (task) {
                    const merge = (p) => p.id === task.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === task.id ? { ...t, ...task } : t) } : p;
                    if (state.currentWorkspace) state.currentWorkspace.projects = state.currentWorkspace.projects.map(merge);
                    if (state.myProjects.length > 0) state.myProjects = state.myProjects.map(merge);
                }
            })
            .addCase(denyExtensionAsync.rejected, (state, action) => {
                state.error = action.payload;
            })

            // ━━━ Fetch All Users (admin only) ━━━
            .addCase(fetchAllUsersAsync.fulfilled, (state, action) => {
                state.allUsers = action.payload || [];
            });
    }
});

export const { 
    clearWorkspaceState,
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
    deleteTask,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;