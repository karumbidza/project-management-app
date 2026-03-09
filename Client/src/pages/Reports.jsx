import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
    BarChart3, 
    TrendingUp, 
    Users, 
    CheckCircle2, 
    Clock, 
    AlertTriangle,
    Download,
    Calendar,
    Loader2
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import useUserRole from '../hooks/useUserRole';

const Reports = () => {
    const { canViewReports, isAdmin, currentWorkspace } = useUserRole();
    const projects = currentWorkspace?.projects || [];
    
    const [dateRange, setDateRange] = useState('month'); // 'week', 'month', 'quarter', 'year'
    const [selectedProject, setSelectedProject] = useState('all');

    // Calculate stats
    const stats = useMemo(() => {
        const allTasks = projects.flatMap(p => p.tasks || []);
        const filteredTasks = selectedProject === 'all' 
            ? allTasks 
            : allTasks.filter(t => t.projectId === selectedProject);

        const completed = filteredTasks.filter(t => t.status === 'DONE').length;
        const inProgress = filteredTasks.filter(t => t.status === 'IN_PROGRESS').length;
        const overdue = filteredTasks.filter(t => {
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < new Date() && t.status !== 'DONE';
        }).length;
        const totalTasks = filteredTasks.length;

        return {
            totalTasks,
            completed,
            inProgress,
            overdue,
            completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'IN_PROGRESS').length,
            totalMembers: currentWorkspace?.members?.length || 0,
        };
    }, [projects, selectedProject, currentWorkspace]);

    // Project breakdown
    const projectBreakdown = useMemo(() => {
        return projects.map(project => {
            const tasks = project.tasks || [];
            const completed = tasks.filter(t => t.status === 'DONE').length;
            const total = tasks.length;
            return {
                id: project.id,
                name: project.name,
                status: project.status,
                progress: project.progress || 0,
                tasksCompleted: completed,
                tasksTotal: total,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
        });
    }, [projects]);

    // Task status distribution
    const taskDistribution = useMemo(() => {
        const allTasks = projects.flatMap(p => p.tasks || []);
        return {
            todo: allTasks.filter(t => t.status === 'TODO').length,
            inProgress: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
            inReview: allTasks.filter(t => t.status === 'IN_REVIEW').length,
            done: allTasks.filter(t => t.status === 'DONE').length,
        };
    }, [projects]);

    if (!canViewReports) {
        return (
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col items-center justify-center py-20">
                    <AlertTriangle className="size-12 text-yellow-500 mb-4" />
                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Access Restricted</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">You don't have permission to view reports. Contact your workspace admin.</p>
                </div>
            </div>
        );
    }

    const cardClasses = "rounded-lg border p-6 bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border-zinc-200 dark:border-zinc-800";
    const statCardClasses = "rounded-lg border p-4 bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800";

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white mb-1">Reports & Analytics</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Workspace performance insights and metrics</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    >
                        <option value="all">All Projects</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <button className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                        <Download className="size-4" /> Export
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={statCardClasses}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-500 dark:text-zinc-400 text-sm">Total Tasks</span>
                        <CheckCircle2 className="size-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalTasks}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{stats.completed} completed</p>
                </div>
                
                <div className={statCardClasses}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-500 dark:text-zinc-400 text-sm">Completion Rate</span>
                        <TrendingUp className="size-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.completionRate}%</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{stats.inProgress} in progress</p>
                </div>
                
                <div className={statCardClasses}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-500 dark:text-zinc-400 text-sm">Overdue Tasks</span>
                        <AlertTriangle className="size-5 text-red-500" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.overdue}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">need attention</p>
                </div>
                
                <div className={statCardClasses}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-zinc-500 dark:text-zinc-400 text-sm">Team Members</span>
                        <Users className="size-5 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalMembers}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{stats.activeProjects} active projects</p>
                </div>
            </div>

            {/* Task Distribution */}
            <div className={cardClasses}>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Task Status Distribution</h2>
                <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-3">
                            <div 
                                className="h-full bg-zinc-400 rounded-full" 
                                style={{ width: `${stats.totalTasks > 0 ? (taskDistribution.todo / stats.totalTasks) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{taskDistribution.todo}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">To Do</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-3">
                            <div 
                                className="h-full bg-blue-500 rounded-full" 
                                style={{ width: `${stats.totalTasks > 0 ? (taskDistribution.inProgress / stats.totalTasks) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{taskDistribution.inProgress}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">In Progress</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-3">
                            <div 
                                className="h-full bg-yellow-500 rounded-full" 
                                style={{ width: `${stats.totalTasks > 0 ? (taskDistribution.inReview / stats.totalTasks) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{taskDistribution.inReview}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">In Review</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                        <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-3">
                            <div 
                                className="h-full bg-green-500 rounded-full" 
                                style={{ width: `${stats.totalTasks > 0 ? (taskDistribution.done / stats.totalTasks) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{taskDistribution.done}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Done</p>
                    </div>
                </div>
            </div>

            {/* Project Breakdown */}
            <div className={cardClasses}>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Project Breakdown</h2>
                {projectBreakdown.length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">No projects yet</p>
                ) : (
                    <div className="space-y-4">
                        {projectBreakdown.map(project => (
                            <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-medium text-zinc-900 dark:text-white">{project.name}</h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                                            project.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                            project.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                            project.status === 'ON_HOLD' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                            'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                                        }`}>
                                            {project.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                                            <div 
                                                className="h-full bg-blue-500 rounded-full transition-all" 
                                                style={{ width: `${project.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-zinc-500 dark:text-zinc-400 w-12">{project.progress}%</span>
                                    </div>
                                </div>
                                <div className="text-right ml-6">
                                    <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                                        {project.tasksCompleted}/{project.tasksTotal}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">tasks completed</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Team Performance */}
            <div className={cardClasses}>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Team Overview</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentWorkspace?.members?.map(member => {
                        const memberTasks = projects.flatMap(p => p.tasks || []).filter(t => t.assigneeId === member.userId);
                        const completedTasks = memberTasks.filter(t => t.status === 'DONE').length;
                        const totalTasks = memberTasks.length;
                        
                        return (
                            <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                                <img 
                                    src={member.user?.image || `https://ui-avatars.com/api/?name=${member.user?.name || 'User'}&background=random`} 
                                    alt={member.user?.name}
                                    className="size-10 rounded-full"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-zinc-900 dark:text-white truncate">{member.user?.name || 'Unknown'}</p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{completedTasks}/{totalTasks} tasks</p>
                                </div>
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    member.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                    'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                                }`}>
                                    {member.role}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default Reports;
