// FOLLO PERF
// FOLLO FIX
// FOLLO PERMISSIONS
// FOLLO REALTIME
// FOLLO PROJECTS-PAGE
// FOLLO CLEAN-NAV
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
import { fetchWorkspaces, fetchMyProjects } from "../features/workspaceSlice";
import { addTaskToProject, updateTaskInProject } from "../features/taskSlice";
import { io as ioClient } from "socket.io-client";

const TAB_LABELS = {
    tasks: "Tasks",
    gantt: "Gantt",
    calendar: "Calendar",
    settings: "Settings",
};

export default function ProjectDetail() {

    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') || 'tasks';
    const id = searchParams.get('id');

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { user } = useUser();
    const { isMemberView, canCreateTasks, canManageTemplates, canApproveReject } = useUserRole();
    
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

        return () => {
            socket.emit('leave_project', id);
            socket.off('task_created');
            socket.off('task_updated');
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
        return (
            <div className="p-8 text-center text-zinc-900 dark:text-zinc-200">
                <p className="text-2xl mt-32 mb-8">Project not found</p>
                <button onClick={() => navigate('/projects')} className="px-4 py-2 text-sm rounded bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600" >
                    Back to Projects
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 text-zinc-900 dark:text-white">

            {/* Minimal header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400" onClick={() => navigate('/projects')}>
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-medium">{project.name}</h1>
                            <span className={`px-2 py-0.5 rounded text-[11px] capitalize ${statusColors[project.status]}`}>
                                {project.status.replace("_", " ")}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {TAB_LABELS[tab] || 'Overview'}
                        </p>
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

            {/* Content — one section at a time, no tabs */}
            <div>
                {tab === "tasks" && <ProjectTasks tasks={tasks} projectId={id} />}
                {tab === "gantt" && <ProjectGantt tasks={tasks} project={project} />}
                {tab === "calendar" && <ProjectCalendar tasks={tasks} />}
                {tab === "settings" && <ProjectSettings project={project} />}
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
