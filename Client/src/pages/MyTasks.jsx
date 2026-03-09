import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { 
    CheckSquareIcon, 
    Clock, 
    AlertCircle,
    Filter,
    Search
} from 'lucide-react'

const MyTasks = () => {
    const { user } = useUser()
    const { myProjects, currentWorkspace } = useSelector((state) => state.workspace)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [priorityFilter, setPriorityFilter] = useState('ALL')

    // Get tasks from either myProjects (member view) or currentWorkspace (admin view)
    const allTasks = useMemo(() => {
        const userEmail = user?.primaryEmailAddress?.emailAddress
        
        if (myProjects?.length > 0) {
            // Member view - get tasks from all assigned projects
            return myProjects.flatMap(project => 
                (project.tasks || [])
                    .filter(t => t.assignee?.email === userEmail)
                    .map(t => ({ ...t, projectName: project.name, projectId: project.id }))
            )
        } else if (currentWorkspace?.projects) {
            // Admin view - get tasks from current workspace
            return currentWorkspace.projects.flatMap(project => 
                (project.tasks || [])
                    .filter(t => t.assignee?.email === userEmail)
                    .map(t => ({ ...t, projectName: project.name, projectId: project.id }))
            )
        }
        return []
    }, [myProjects, currentWorkspace, user])

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return allTasks.filter(task => {
            const matchesSearch = !searchTerm || 
                task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchTerm.toLowerCase())
            
            const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter
            const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter
            
            return matchesSearch && matchesStatus && matchesPriority
        })
    }, [allTasks, searchTerm, statusFilter, priorityFilter])

    // Group tasks by status
    const tasksByStatus = useMemo(() => ({
        TODO: filteredTasks.filter(t => t.status === 'TODO'),
        IN_PROGRESS: filteredTasks.filter(t => t.status === 'IN_PROGRESS'),
        IN_REVIEW: filteredTasks.filter(t => t.status === 'IN_REVIEW'),
        DONE: filteredTasks.filter(t => t.status === 'DONE'),
    }), [filteredTasks])

    const statusColors = {
        TODO: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300',
        IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        IN_REVIEW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        DONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }

    const priorityColors = {
        HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }

    const isOverdue = (dueDate) => {
        if (!dueDate) return false
        return new Date(dueDate) < new Date()
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                    My Tasks
                </h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                    {allTasks.length} tasks assigned to you
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                >
                    <option value="ALL">All Status</option>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                </select>
                <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                >
                    <option value="ALL">All Priority</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                </select>
            </div>

            {/* Task List */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700">
                {filteredTasks.length === 0 ? (
                    <div className="p-12 text-center">
                        <CheckSquareIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-zinc-600" />
                        <p className="text-gray-500 dark:text-zinc-400">No tasks found</p>
                        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">
                            {allTasks.length === 0 
                                ? "You don't have any tasks assigned yet" 
                                : "Try adjusting your filters"}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {filteredTasks.map((task) => (
                            <Link
                                key={task.id}
                                to={`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`}
                                className="block p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                                {task.title}
                                            </h3>
                                            {isOverdue(task.dueDate) && task.status !== 'DONE' && (
                                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-zinc-400 truncate mb-2">
                                            {task.projectName}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status]}`}>
                                                {task.status?.replace('_', ' ')}
                                            </span>
                                            {task.priority && (
                                                <span className={`text-xs px-2 py-0.5 rounded ${priorityColors[task.priority]}`}>
                                                    {task.priority}
                                                </span>
                                            )}
                                            {task.dueDate && (
                                                <span className={`text-xs flex items-center gap-1 ${
                                                    isOverdue(task.dueDate) && task.status !== 'DONE'
                                                        ? 'text-red-500' 
                                                        : 'text-gray-500 dark:text-zinc-400'
                                                }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(tasksByStatus).map(([status, tasks]) => (
                    <div 
                        key={status}
                        className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4"
                    >
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{tasks.length}</p>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">{status.replace('_', ' ')}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default MyTasks
