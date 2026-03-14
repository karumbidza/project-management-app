// FOLLO PERF
// FOLLO FIX
// FOLLO PERMISSIONS
// FOLLO REALTIME
import { useState, useEffect, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { ArrowLeftIcon, PlusIcon, SettingsIcon, BarChart3Icon, CalendarIcon, FileStackIcon, ZapIcon, GanttChart, ShieldCheck, FolderDown, LayoutDashboard } from "lucide-react";
import ProjectOverview from "../components/project/ProjectOverview";
import ProjectAnalytics from "../components/ProjectAnalytics";
import ProjectSettings from "../components/ProjectSettings";
import CreateTaskDialog from "../components/CreateTaskDialog";
import ApplyTemplateDialog from "../components/ApplyTemplateDialog";
import ProjectCalendar from "../components/ProjectCalendar";
import ProjectTasks from "../components/ProjectTasks";
import ProjectGantt from "../components/ProjectGantt";
import useUserRole from "../hooks/useUserRole";
import SLADashboard from "../components/SLADashboard";
import { fetchWorkspaces, fetchMyProjects } from "../features/workspaceSlice";
import { addTaskToProject, updateTaskInProject } from "../features/taskSlice";
import { io as ioClient } from "socket.io-client";

export default function ProjectDetail() {

    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab');
    const id = searchParams.get('id');

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const { user } = useUser();
    const { isMemberView, canCreateTasks, canManageTemplates, canApproveReject } = useUserRole();
    
    // Get projects from either workspace (admin) or myProjects (member)
    const workspaceProjects = useSelector((state) => state?.workspace?.currentWorkspace?.projects || []);
    const myProjects = useSelector((state) => state?.workspace?.myProjects || []);
    const projectsLoading = useSelector((state) => state?.workspace?.loadingStates?.myProjects || state?.workspace?.loadingStates?.workspaces);
    
    // Admin sees all workspace projects; member sees assigned projects
    // Always merge so a project can be found in either source
    const projects = useMemo(() => {
        if (isMemberView) return myProjects;
        const map = new Map();
        workspaceProjects.forEach(p => map.set(p.id, p));
        myProjects.forEach(p => map.set(p.id, p));
        return [...map.values()];
    }, [workspaceProjects, myProjects, isMemberView]);

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [showApplyTemplate, setShowApplyTemplate] = useState(false);
    const [activeTab, setActiveTab] = useState(tab || "overview");
    const socketRef = useRef(null);
    const userIdRef = useRef(user?.id);
    userIdRef.current = user?.id;

    useEffect(() => {
        if (tab) setActiveTab(tab);
    }, [tab]);

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

    useEffect(() => {
        if (projects && projects.length > 0) {
            const proj = projects.find((p) => p.id === id);
            setProject(proj);
            setTasks(proj?.tasks || []);
        }
    }, [id, projects]);

    const statusColors = {
        PLANNING: "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200",
        ACTIVE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-900",
        ON_HOLD: "bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-900",
        COMPLETED: "bg-blue-200 text-blue-900 dark:bg-blue-500 dark:text-blue-900",
        CANCELLED: "bg-red-200 text-red-900 dark:bg-red-500 dark:text-red-900",
    };

    if (!project) {
        // FOLLO PERF — skeleton while data is still loading
        if (projectsLoading) {
            return (
                <div className="animate-pulse space-y-3 p-6 max-w-6xl mx-auto">
                    {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-zinc-700 rounded-lg" />)}
                </div>
            );
        }
        return (
            <div className="p-6 text-center text-zinc-900 dark:text-zinc-200">
                <p className="text-3xl md:text-5xl mt-40 mb-10">Project not found</p>
                <button onClick={() => navigate(isMemberView ? '/' : '/projects')} className="mt-4 px-4 py-2 rounded bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600" >
                    {isMemberView ? 'Back to Dashboard' : 'Back to Projects'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5 max-w-6xl mx-auto text-zinc-900 dark:text-white">
            {/* Header */}
            <div className="flex max-md:flex-col gap-4 flex-wrap items-start justify-between max-w-6xl">
                <div className="flex items-center gap-4">
                    <button className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400" onClick={() => navigate(isMemberView ? '/' : '/projects')}>
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-medium">{project.name}</h1>
                        <span className={`px-2 py-1 rounded text-xs capitalize ${statusColors[project.status]}`} >
                            {project.status.replace("_", " ")}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canManageTemplates && (
                    <button onClick={() => setShowApplyTemplate(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40" >
                        <FolderDown className="size-4" />
                        From Template
                    </button>
                    )}
                    {canCreateTasks && (
                    <button onClick={() => setShowCreateTask(true)} className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white" >
                        <PlusIcon className="size-4" />
                        New Task
                    </button>
                    )}
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 sm:flex flex-wrap gap-6">
                {[
                    { label: "Total Tasks", value: tasks.length, color: "text-zinc-900 dark:text-white" },
                    { label: "Completed", value: tasks.filter((t) => t.status === "DONE").length, color: "text-emerald-700 dark:text-emerald-400" },
                    { label: "In Progress", value: tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO").length, color: "text-amber-700 dark:text-amber-400" },
                    { label: "Team Members", value: project.members?.length || 0, color: "text-blue-700 dark:text-blue-400" },
                ].map((card) => (
                    <div key={card.label} className=" dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex justify-between sm:min-w-60 p-4 py-2.5 rounded">
                        <div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">{card.label}</div>
                            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                        </div>
                        <ZapIcon className={`size-4 ${card.color}`} />
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div>
                <div className="inline-flex flex-wrap max-sm:grid grid-cols-3 gap-2 border border-zinc-200 dark:border-zinc-800 rounded overflow-hidden">
                    {[
                        { key: "overview", label: "Overview", icon: LayoutDashboard },
                        { key: "tasks", label: "Tasks", icon: FileStackIcon },
                        { key: "gantt", label: "Gantt", icon: GanttChart },
                        { key: "calendar", label: "Calendar", icon: CalendarIcon },
                        { key: "analytics", label: "Analytics", icon: BarChart3Icon },
                        { key: "sla", label: "SLA", icon: ShieldCheck },
                        ...(canApproveReject ? [{ key: "settings", label: "Settings", icon: SettingsIcon }] : []),
                    ].map((tabItem) => (
                        <button key={tabItem.key} onClick={() => { setActiveTab(tabItem.key); setSearchParams({ id: id, tab: tabItem.key }) }} className={`flex items-center gap-2 px-4 py-2 text-sm transition-all ${activeTab === tabItem.key ? "bg-zinc-100 dark:bg-zinc-800/80" : "hover:bg-zinc-50 dark:hover:bg-zinc-700"}`} >
                            <tabItem.icon className="size-3.5" />
                            {tabItem.label}
                        </button>
                    ))}
                </div>

                <div className="mt-6">
                    {activeTab === "overview" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectOverview project={project} tasks={tasks} />
                        </div>
                    )}
                    {activeTab === "tasks" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectTasks tasks={tasks} projectId={id} />
                        </div>
                    )}
                    {activeTab === "gantt" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectGantt tasks={tasks} project={project} />
                        </div>
                    )}
                    {activeTab === "analytics" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectAnalytics tasks={tasks} project={project} />
                        </div>
                    )}
                    {activeTab === "calendar" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectCalendar tasks={tasks} />
                        </div>
                    )}
                    {activeTab === "sla" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <SLADashboard tasks={tasks} project={project} />
                        </div>
                    )}
                    {activeTab === "settings" && (
                        <div className=" dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectSettings project={project} />
                        </div>
                    )}
                </div>
            </div>

            {/* Create Task Modal */}
            {showCreateTask && <CreateTaskDialog showCreateTask={showCreateTask} setShowCreateTask={setShowCreateTask} projectId={id} />}

            {/* Apply Template Modal */}
            <ApplyTemplateDialog
                open={showApplyTemplate}
                onClose={() => setShowApplyTemplate(false)}
                projectId={id}
                onApplied={() => {
                    // Refresh project data to pick up newly created tasks
                    if (isMemberView) {
                        dispatch(fetchMyProjects(getToken));
                    } else if (currentWorkspace?.id) {
                        dispatch(fetchWorkspaces(getToken));
                    }
                }}
            />
        </div>
    );
}
