// FOLLO GANTT
// FOLLO WORKFLOW
import { useSelector } from 'react-redux'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import GanttWidget from './GanttWidget'
import { 
    FolderOpenIcon, 
    CheckSquareIcon, 
    Clock, 
    AlertCircle,
    ChevronRight,
    CalendarIcon
} from 'lucide-react'

const MemberDashboard = () => {
    const { user } = useUser()
    const navigate = useNavigate()
    const { myProjects, currentProject } = useSelector((state) => state.workspace)

    // Calculate stats from all projects
    const allTasks = myProjects?.flatMap(p => p.tasks || []) || []
    const myTasks = allTasks.filter(t => t.assignee?.email === user?.primaryEmailAddress?.emailAddress)
    
    const stats = {
        totalProjects: myProjects?.length || 0,
        totalTasks: myTasks.length,
        pendingTasks: myTasks.filter(t => t.status === 'TODO' || t.status === 'IN_PROGRESS').length,
        completedTasks: myTasks.filter(t => t.status === 'DONE').length,
        overdueTasks: myTasks.filter(t => {
            if (t.slaStatus === 'BREACHED') return true
            if (!t.dueDate) return false
            return new Date(t.dueDate) < new Date() && t.status !== 'DONE'
        }).length,
        atRiskTasks: myTasks.filter(t => t.slaStatus === 'AT_RISK').length,
        blockedTasks: myTasks.filter(t => t.slaStatus === 'BLOCKED').length,
    }

    // Get upcoming tasks (due in next 7 days)
    const upcomingTasks = myTasks
        .filter(t => {
            if (!t.dueDate || t.status === 'DONE') return false
            const due = new Date(t.dueDate)
            const now = new Date()
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            return due >= now && due <= weekFromNow
        })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5)

    const priorityColors = {
        CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }

    const statusColors = {
        TODO: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300',
        IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        PENDING_APPROVAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        DONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }

    return (
        <div className='max-w-6xl mx-auto'>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                    Welcome back, {user?.fullName || 'Team Member'}
                </h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                    Here's an overview of your assigned projects and tasks
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <FolderOpenIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalProjects}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Projects</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingTasks}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Pending Tasks</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <CheckSquareIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Completed</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.overdueTasks}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Overdue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SLA Status Summary */}
            {(stats.atRiskTasks > 0 || stats.blockedTasks > 0 || stats.overdueTasks > 0) && (
                <div className="flex flex-wrap gap-2 mb-8 -mt-4">
                    {stats.overdueTasks > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{stats.overdueTasks} breached</span>}
                    {stats.blockedTasks > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{stats.blockedTasks} blocked</span>}
                    {stats.atRiskTasks > 0 && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{stats.atRiskTasks} at risk</span>}
                </div>
            )}

            {/* ══════ TIMELINE (full width, main item) ══════ */}
            <GanttWidget />

            <div className="grid lg:grid-cols-3 gap-8">
                {/* My Projects */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Projects</h2>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                            {myProjects?.map((project) => {
                                const projectTasks = project.tasks || []
                                const myProjectTasks = projectTasks.filter(t => t.assignee?.email === user?.primaryEmailAddress?.emailAddress)
                                const completedCount = myProjectTasks.filter(t => t.status === 'DONE').length
                                const progress = myProjectTasks.length > 0 
                                    ? Math.round((completedCount / myProjectTasks.length) * 100) 
                                    : 0

                                return (
                                    <div 
                                        key={project.id}
                                        className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer transition"
                                        onClick={() => navigate(`/project?id=${project.id}&tab=tasks`)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <FolderOpenIcon className="w-5 h-5 text-blue-500" />
                                                <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400">
                                                    {project.myRole || 'Member'}
                                                </span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-zinc-400">
                                            <span>{myProjectTasks.length} tasks assigned</span>
                                            <span>•</span>
                                            <span>{completedCount} completed</span>
                                        </div>
                                        <div className="mt-2">
                                            <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-500 transition-all"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {(!myProjects || myProjects.length === 0) && (
                                <div className="p-8 text-center text-gray-500 dark:text-zinc-500">
                                    <FolderOpenIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No projects assigned yet</p>
                                    <p className="text-sm mt-1">Wait for an admin to invite you to a project</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Upcoming Tasks */}
                <div>
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5" />
                                Upcoming Tasks
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                            {upcomingTasks.map((task) => (
                                <div 
                                    key={task.id}
                                    className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer transition"
                                    onClick={() => navigate(`/task?id=${task.id}`)}
                                >
                                    <p className="font-medium text-gray-900 dark:text-white text-sm mb-1 truncate">
                                        {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status]}`}>
                                            {task.status?.replace('_', ' ')}
                                        </span>
                                        {task.priority && (
                                            <span className={`text-xs px-2 py-0.5 rounded ${priorityColors[task.priority]}`}>
                                                {task.priority}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500 dark:text-zinc-400">
                                            Due {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {upcomingTasks.length === 0 && (
                                <div className="p-6 text-center text-gray-500 dark:text-zinc-500">
                                    <CheckSquareIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No upcoming tasks</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MemberDashboard
