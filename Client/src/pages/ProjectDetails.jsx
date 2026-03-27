// FOLLO ACCESS-SEC
// FOLLO PERF
// FOLLO FIX
// FOLLO PERMISSIONS
// FOLLO REALTIME
// FOLLO PROJECTS-PAGE
// FOLLO CLEAN-NAV
// FOLLO PROJECT-OVERVIEW
// FOLLO ROLE-FLASH
// FOLLO NAV
import { useState, useEffect, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { ArrowLeftIcon, PlusIcon, FolderDown } from "lucide-react";

import ProjectSettings from "../components/ProjectSettings";
import CreateTaskDialog from "../components/CreateTaskDialog";
import ApplyTemplateDialog from "../components/ApplyTemplateDialog";
import ProjectCalendar from "../components/ProjectCalendar";
import ProjectTasks from "../components/ProjectTasks";
import ProjectGantt from "../components/ProjectGantt";
import useUserRole from "../hooks/useUserRole";
import NotAuthorised from "../components/NotAuthorised";
import EmptyState from "../components/EmptyState"; // FOLLO ACCESS-UX
import { fetchWorkspaces, fetchMyProjects } from "../features/workspaceSlice";
import { addTaskToProject, updateTaskInProject } from "../features/taskSlice";
import { io as ioClient } from "socket.io-client";

// FOLLO NAV: overview tab removed — admins access overview via /projectOverview standalone page
const TAB_LABELS = {
    tasks: "Tasks",
    gantt: "Gantt",
    calendar: "Calendar",
    settings: "Settings",
};

export default function ProjectDetail() {

    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab') || 'tasks';
    const id = searchParams.get('id');

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { user } = useUser();
    const { isMemberView, canCreateTasks, canManageTemplates, canApproveReject, isAdmin } = useUserRole();

    // FOLLO NAV: redirect ?tab=overview to tasks (overview is now a standalone page)
    // FOLLO ROLE-FLASH: members must not see Settings tab — redirect to tasks.
    const tab = (rawTab === 'overview' || (isMemberView && rawTab === 'settings')) ? 'tasks' : rawTab;

    // FOLLO ROLE-FLASH / FOLLO NAV: tabs available to the current user
    // Members see tasks/gantt/calendar; admins see tasks/gantt/calendar/settings (no overview tab)
    const visibleTabs = isMemberView
        ? { tasks: 'Tasks', gantt: 'Gantt', calendar: 'Calendar' }
        : TAB_LABELS;
    
    const workspaceProjects = useSelector((state) => state?.workspace?.currentWorkspace?.projects || []);
    const myProjects = useSelector((state) => state?.workspace?.myProjects || []);
    const projectsLoading = useSelector((state) => state?.workspace?.loadingStates?.myProjects || state?.workspace?.loadingStates?.workspaces);
    
    const project = useMemo(() => {
        if (!id) return null;
        if (isMemberView) return myProjects.find(p => p.id === id) || null;
        return workspaceProjects.find(p => p.id === id) || myProjects.find(p => p.id === id) || null;
    }, [id, workspaceProjects, myProjects, isMemberView]);

    const tasks = useMemo(() => project?.tasks || [], [project]);

    const [showCreateTask, setShowCreateTask] = useState(false);
    const [showApplyTemplate, setShowApplyTemplate] = useState(false);
    const socketRef = useRef(null);
    const userIdRef = useRef(user?.id);
    userIdRef.current = user?.id;

    // FOLLO REALTIME — Join project socket room for live task updates
    useEffect(() => {
        if (!id) return;

        const socket = ioClient(
            import.meta.env.VITE_API_URL || 'http://localhost:5001',
            { withCredentials: true }
        );
        socketRef.current = socket;

        socket.emit('join_project', id);

        socket.on('task_created', ({ task, projectId, createdById }) => {
            if (projectId === id && createdById !== userIdRef.current) {
                dispatch(addTaskToProject(task));
            }
        });

        socket.on('task_updated', ({ task, projectId, lastUpdatedById }) => {
            if (projectId === id && lastUpdatedById !== userIdRef.current) {
                dispatch(updateTaskInProject(task));
            }
        });

        // FOLLO ACCESS-SEC — redirect immediately if this user's access is revoked
        socket.on('permission:revoked', ({ userId: revokedId, workspaceId, projectId: revokedProjectId }) => {
            if (revokedId !== userIdRef.current) return;
            const affectsHere = revokedProjectId === id || workspaceId !== undefined;
            if (!affectsHere) return;
            dispatch(fetchWorkspaces(getToken));
            navigate('/projects', { replace: true });
        });

        return () => {
            socket.emit('leave_project', id);
            socket.off('task_created');
            socket.off('task_updated');
            socket.off('permission:revoked');
            socket.disconnect();
        };
    }, [id, dispatch]);

    const statusColors = {
        PLANNING: "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200",
        ACTIVE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-900",
        ON_HOLD: "bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-900",
        COMPLETED: "bg-blue-200 text-blue-900 dark:bg-blue-500 dark:text-blue-900",
        CANCELLED: "bg-red-200 text-red-900 dark:bg-red-500 dark:text-red-900",
    };

    if (!project) {
        if (projectsLoading) {
            return (
                <div className="animate-pulse space-y-4 p-8 max-w-5xl mx-auto">
                    <div className="h-6 w-48 bg-gray-100 dark:bg-zinc-700 rounded" />
                    <div className="h-[400px] bg-gray-100 dark:bg-zinc-700 rounded-lg" />
                </div>
            );
        }
        // FOLLO ACCESS-SEC / FOLLO ACCESS-UX — State 9: friendly not-found empty state
        return (
            <EmptyState
                emoji="🗂️"
                title="Project not found"
                description="This project may have been deleted, moved, or you may no longer have access."
                action={() => navigate('/projects')}
                actionLabel="Back to Projects"
            />
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 text-zinc-900 dark:text-white">

            {/* Minimal header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400" onClick={() => navigate('/projects')}>
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            {/* FOLLO NAV: admin/PM clicking project name goes to standalone overview */}
                            {!isMemberView ? (
                                <button onClick={() => navigate(`/projectOverview?id=${id}`)} className="text-lg font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    {project.name}
                                </button>
                            ) : (
                                <h1 className="text-lg font-medium">{project.name}</h1>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[11px] capitalize ${statusColors[project.status]}`}>
                                {project.status.replace("_", " ")}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions — only on Tasks tab */}
                {tab === 'tasks' && (
                    <div className="flex items-center gap-2">
                        {canManageTemplates && (
                            <button onClick={() => setShowApplyTemplate(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                <FolderDown className="size-3.5" />
                                Template
                            </button>
                        )}
                        {canCreateTasks && (
                            <button onClick={() => setShowCreateTask(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                                <PlusIcon className="size-3.5" />
                                New Task
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* FOLLO PROJECT-OVERVIEW — Tab bar */}
            {/* FOLLO ROLE-FLASH: visibleTabs excludes Overview for members */}
            <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
                {Object.entries(visibleTabs).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setSearchParams({ id, tab: key })}
                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            tab === key
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Content — FOLLO NAV: overview tab removed, handled by /projectOverview page */}
            <div>
                {tab === "tasks"     && <ProjectTasks tasks={tasks} projectId={id} />}
                {tab === "gantt"     && <ProjectGantt tasks={tasks} project={project} />}
                {tab === "calendar"  && <ProjectCalendar tasks={tasks} />}
                {tab === "settings"  && <ProjectSettings project={project} />}
            </div>

            {/* Create Task Modal */}
            {showCreateTask && <CreateTaskDialog showCreateTask={showCreateTask} setShowCreateTask={setShowCreateTask} projectId={id} />}

            {/* Apply Template Modal */}
            <ApplyTemplateDialog
                open={showApplyTemplate}
                onClose={() => setShowApplyTemplate(false)}
                projectId={id}
                onApplied={() => {
                    if (isMemberView) {
                        dispatch(fetchMyProjects(getToken));
                    } else {
                        dispatch(fetchWorkspaces(getToken));
                    }
                }}
            />
        </div>
    );
}
