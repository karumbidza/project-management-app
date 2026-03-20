// FOLLO PERMISSIONS
// FOLLO WORKFLOW
// FOLLO BUGFIX-REFRESH
// FOLLO ACCESS
// FOLLO MEMBER-GANTT
// FOLLO AUTOSTART
// FOLLO ACCESS-UX
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useUser, useAuth } from '@clerk/clerk-react'
import { Link, useNavigate } from 'react-router-dom'
import { 
    CheckSquareIcon, 
    Clock, 
    AlertCircle,
    Search,
    Shield,
    PlayCircle,
    CheckCircle2,
    ExternalLink,
    ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useUserRole from '../hooks/useUserRole'
import { updateTaskAsync } from '../features/taskSlice'
import MiniGantt from '../components/task/MiniGantt'

// ─── GANTT CSS ANIMATIONS ──────────
const GANTT_STYLE = `
@keyframes gantt-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@keyframes gantt-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(1.4); }
}
@keyframes gantt-spill {
  0%   { width: 0px; opacity: 0; }
  100% { width: var(--spill-width); opacity: 0.9; }
}
@keyframes gantt-breathe {
  0%, 100% { opacity: 0.65; }
  50%      { opacity: 1; }
}
`;

// ─── FILTER PILLS (matches ProjectGantt pill style) ──────────
const STATUS_FILTER_PILLS = [
    { key: 'ALL',              label: 'All' },
    { key: 'TODO',             label: 'To Do' },
    { key: 'IN_PROGRESS',     label: 'Active' },
    { key: 'PENDING_APPROVAL', label: 'Pending' },
    { key: 'BLOCKED',         label: 'Blocked' },
    { key: 'DONE',            label: 'Done' },
];

const PRIORITY_FILTER_PILLS = [
    { key: 'ALL',      label: 'All' },
    { key: 'CRITICAL', label: 'Critical' },
    { key: 'HIGH',     label: 'High' },
    { key: 'MEDIUM',   label: 'Medium' },
    { key: 'LOW',      label: 'Low' },
];

const MyTasks = () => {
    const { user } = useUser()
    const { getToken } = useAuth()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { myProjects, currentWorkspace } = useSelector((state) => state.workspace)
    const { canApproveReject, isMemberView } = useUserRole()
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [priorityFilter, setPriorityFilter] = useState('ALL')
    const [actionLoading, setActionLoading] = useState(null)
    // FOLLO ACCESS-UX — State 5 (show completed) + State 17 (project filter)
    const [showCompleted, setShowCompleted] = useState(false)
    const [projectFilter, setProjectFilter] = useState('ALL')

    // Inject gantt animations once
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = GANTT_STYLE;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // FOLLO ACCESS: Use isMemberView for reliable data source selection.
    // Members get tasks from myProjects (already scoped by backend).
    // Admins get tasks from currentWorkspace.projects.
    const allTasks = useMemo(() => {
        const userEmail = user?.primaryEmailAddress?.emailAddress
        const source = isMemberView ? myProjects : (currentWorkspace?.projects || [])
        
        return (source || []).flatMap(project => 
            (project.tasks || [])
                .filter(t => t.assignee?.email === userEmail || t.assigneeId === user?.id)
                .map(t => ({ ...t, projectName: project.name, projectId: project.id }))
        )
    }, [myProjects, currentWorkspace, user, isMemberView])

    // FOLLO ACCESS: Summary stats for header pills
    const stats = useMemo(() => {
        const now = new Date()
        return {
            inProgress: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
            overdue: allTasks.filter(t => {
                if (t.slaStatus === 'BREACHED') return true
                if (!t.dueDate || t.status === 'DONE') return false
                return new Date(t.dueDate) < now
            }).length,
            blocked: allTasks.filter(t => t.slaStatus === 'BLOCKED' || t.status === 'BLOCKED').length,
            todo: allTasks.filter(t => t.status === 'TODO').length,
        }
    }, [allTasks])

    // FOLLO ACCESS-UX — State 17: unique projects from allTasks for project tabs
    const taskProjects = useMemo(() => {
        const map = {}
        allTasks.forEach(t => {
            if (t.projectId && t.projectName) map[t.projectId] = t.projectName
        })
        return Object.entries(map).map(([id, name]) => ({ id, name }))
    }, [allTasks])

    // FOLLO ACCESS-UX — State 5: completed count + all-active-done flag
    const completedCount = useMemo(() => allTasks.filter(t => t.status === 'DONE').length, [allTasks])
    const allActiveDone = allTasks.length > 0 && completedCount === allTasks.length

    // Filter tasks — FOLLO ACCESS-UX: also filter by project and showCompleted
    const filteredTasks = useMemo(() => {
        return allTasks.filter(task => {
            if (!showCompleted && task.status === 'DONE') return false
            if (projectFilter !== 'ALL' && task.projectId !== projectFilter) return false
            const matchesSearch = !searchTerm ||
                task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter
            const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter
            return matchesSearch && matchesStatus && matchesPriority
        })
    }, [allTasks, searchTerm, statusFilter, priorityFilter, projectFilter, showCompleted])

    // FOLLO ACCESS: Sort by urgency — overdue first, then blocked, active, todo, done
    const sortedTasks = useMemo(() => {
        const now = new Date()
        const isOverdue = (t) => {
            if (t.slaStatus === 'BREACHED') return true
            if (!t.dueDate || t.status === 'DONE') return false
            return new Date(t.dueDate) < now
        }
        const isBlocked = (t) => t.slaStatus === 'BLOCKED' || t.status === 'BLOCKED'
        
        return [...filteredTasks].sort((a, b) => {
            // Urgency tiers: 0=overdue, 1=blocked, 2=in_progress, 3=todo, 4=pending_approval, 5=done
            const tier = (t) => {
                if (isOverdue(t) && t.status !== 'DONE') return 0
                if (isBlocked(t)) return 1
                if (t.status === 'IN_PROGRESS') return 2
                if (t.status === 'TODO') return 3
                if (t.status === 'PENDING_APPROVAL') return 4
                return 5
            }
            const ta = tier(a), tb = tier(b)
            if (ta !== tb) return ta - tb
            // Within same tier, sort by due date (soonest first), done by most recent
            if (ta === 5) return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
            if (a.dueDate) return -1
            if (b.dueDate) return 1
            return 0
        })
    }, [filteredTasks])

    // FOLLO ACCESS: Quick action handlers
    const handleStartTask = useCallback(async (e, task) => {
        e.preventDefault()
        e.stopPropagation()
        setActionLoading(task.id)
        try {
            await dispatch(updateTaskAsync({
                taskId: task.id,
                updates: { status: 'IN_PROGRESS' },
                getToken,
            })).unwrap()
            toast.success('Task started')
        } catch (err) {
            toast.error(err || 'Failed to start task')
        } finally {
            setActionLoading(null)
        }
    }, [dispatch, getToken])

    const handleViewDetails = useCallback((e, task) => {
        e.preventDefault()
        e.stopPropagation()
        navigate(`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`)
    }, [navigate])

    // FOLLO AUTOSTART: Submit task for manager/admin approval
    const handleSubmitForApproval = useCallback(async (e, task) => {
        e.preventDefault()
        e.stopPropagation()
        setActionLoading(task.id)
        try {
            await dispatch(updateTaskAsync({
                taskId: task.id,
                updates: { status: 'PENDING_APPROVAL' },
                getToken,
            })).unwrap()
            toast.success('Submitted for approval')
        } catch (err) {
            toast.error(err || 'Failed to submit')
        } finally {
            setActionLoading(null)
        }
    }, [dispatch, getToken])

    const statusColors = {
        TODO: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300',
        IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        PENDING_APPROVAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        DONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }

    const priorityColors = {
        CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    }

    const isOverdue = (dueDate) => {
        if (!dueDate) return false
        return new Date(dueDate) < new Date()
    }

    const getDaysLabel = (dueDate) => {
        if (!dueDate) return null
        const now = new Date()
        const due = new Date(dueDate)
        const diffMs = due - now
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
        if (diffDays === 0) return 'Due today'
        if (diffDays === 1) return 'Due tomorrow'
        return `${diffDays}d left`
    }

    // SLA badge
    const renderSlaBadge = (slaStatus) => {
        const map = {
            AT_RISK:          { text: 'text-amber-700 dark:text-amber-400', label: 'At Risk' },
            PENDING_APPROVAL: { text: 'text-blue-700 dark:text-blue-400', label: canApproveReject ? 'Needs Review' : 'Pending' },
            BLOCKED:          { text: 'text-red-700 dark:text-red-400', label: 'Blocked' },
            BREACHED:         { text: 'text-red-700 dark:text-red-400', label: 'Overdue' },
            RESOLVED_ON_TIME: { text: 'text-emerald-700 dark:text-emerald-400', label: '✓ On Time' },
            RESOLVED_LATE:    { text: 'text-zinc-600 dark:text-zinc-400', label: 'Late' },
        }
        const b = map[slaStatus]
        if (!b) return null
        return (
            <span className={`inline-flex items-center gap-1 text-xs ${b.text}`}>
                <Shield className="size-3" />
                {b.label}
            </span>
        )
    }

    // FOLLO AUTOSTART: Action button per task status
    const renderActionButton = (task) => {
        if (actionLoading === task.id) {
            return <span className="text-xs text-gray-400 dark:text-zinc-500 px-3 py-1.5">...</span>
        }
        switch (task.status) {
            case 'TODO':
                // Only show manual Start if no planned start date
                // (tasks with a start date auto-start when the day arrives)
                if (task.plannedStartDate) return null
                return (
                    <button
                        onClick={(e) => handleStartTask(e, task)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition whitespace-nowrap"
                    >
                        <PlayCircle className="w-3 h-3" /> Start
                    </button>
                )
            case 'IN_PROGRESS':
                // Submit for manager/admin approval (not direct completion)
                return (
                    <button
                        onClick={(e) => handleSubmitForApproval(e, task)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition whitespace-nowrap"
                    >
                        <CheckCircle2 className="w-3 h-3" /> Mark Complete
                    </button>
                )
            case 'PENDING_APPROVAL':
                return (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Clock className="w-3 h-3" /> Awaiting Approval
                    </span>
                )
            case 'BLOCKED':
                return (
                    <button
                        onClick={(e) => handleViewDetails(e, task)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition whitespace-nowrap"
                    >
                        <ExternalLink className="w-3 h-3" /> Details
                    </button>
                )
            default:
                return null
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-0.5">
                    My Tasks
                </h1>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {new Date().toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                </p>
            </div>

            {/* FOLLO ACCESS-UX — State 17: Project filter tabs (only when multiple projects) */}
            {taskProjects.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {[{ id: 'ALL', name: 'All Projects' }, ...taskProjects].map(proj => (
                        <button
                            key={proj.id}
                            onClick={() => setProjectFilter(proj.id)}
                            className={`px-3 py-1 text-xs rounded-full border transition ${
                                projectFilter === proj.id
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
                            }`}
                        >
                            {proj.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Filters — compact dropdown bar */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search tasks…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 w-44 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition placeholder:text-zinc-400"
                    />
                </div>

                {/* Status dropdown */}
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                        {STATUS_FILTER_PILLS.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.key === 'ALL' ? 'All Status' : opt.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
                </div>

                {/* Priority dropdown */}
                <div className="relative">
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                        {PRIORITY_FILTER_PILLS.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.key === 'ALL' ? 'All Priority' : opt.label}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" />
                </div>

                {/* Active filter indicators */}
                {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || projectFilter !== 'ALL' || searchTerm) && (
                    <button
                        onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL'); setProjectFilter('ALL'); setSearchTerm(''); }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Clear filters
                    </button>
                )}

                {/* FOLLO ACCESS-UX — State 5: show completed toggle */}
                {completedCount > 0 && (
                    <button
                        onClick={() => setShowCompleted(prev => !prev)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                            showCompleted
                                ? 'bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400'
                        }`}
                    >
                        {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
                    </button>
                )}

                <div className="flex-1" />
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {sortedTasks.length} of {allTasks.length} tasks
                    {stats.overdue > 0 && <span className="text-red-500"> · {stats.overdue} overdue</span>}
                    {stats.blocked > 0 && <span className="text-red-500"> · {stats.blocked} blocked</span>}
                </p>
            </div>

            {/* FOLLO ACCESS-UX — State 5: All done banner */}
            {allActiveDone && !showCompleted && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-5 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">All caught up!</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">All your tasks are complete. Great work.</p>
                    <button
                        onClick={() => setShowCompleted(true)}
                        className="mt-3 text-xs text-emerald-700 dark:text-emerald-400 underline hover:no-underline"
                    >
                        Show completed tasks ({completedCount})
                    </button>
                </div>
            )}

            {/* FOLLO MEMBER-GANTT: Mini Gantt timeline */}
            <MiniGantt tasks={allTasks} />

            {/* FOLLO ACCESS: Task cards sorted by urgency */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                {sortedTasks.length === 0 ? (
                    <div className="p-12 text-center">
                        {/* FOLLO ACCESS-UX — State 14: new member onboarding */}
                        {isMemberView && (!myProjects || myProjects.length === 0) ? (
                            <>
                                <div className="text-4xl mb-4">👋</div>
                                <p className="font-medium text-gray-700 dark:text-zinc-300 mb-2">Welcome to your workspace!</p>
                                <p className="text-sm text-gray-400 dark:text-zinc-500 max-w-xs mx-auto leading-relaxed">
                                    You haven't been added to any projects yet. Ask your workspace admin to assign you to a project to get started.
                                </p>
                            </>
                        ) : allTasks.length === 0 ? (
                            /* FOLLO ACCESS-UX — State 2: has projects but no tasks assigned */
                            <>
                                <CheckSquareIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-zinc-600" />
                                <p className="font-medium text-gray-700 dark:text-zinc-300 mb-1">No tasks assigned yet</p>
                                <p className="text-sm text-gray-400 dark:text-zinc-500">
                                    Tasks assigned to you will appear here.
                                </p>
                            </>
                        ) : (
                            /* Filters active but no match */
                            <>
                                <Search className="w-10 h-10 mx-auto mb-4 text-gray-300 dark:text-zinc-600" />
                                <p className="font-medium text-gray-700 dark:text-zinc-300 mb-1">No matching tasks</p>
                                <p className="text-sm text-gray-400 dark:text-zinc-500">Try adjusting your filters</p>
                                <button
                                    onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL'); setProjectFilter('ALL'); setSearchTerm(''); }}
                                    className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Clear all filters
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                        {sortedTasks.map((task) => (
                            <Link
                                key={task.id}
                                to={`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`}
                                className={`block p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition ${
                                    task.status === 'DONE' ? 'opacity-50' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between gap-4">
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
                                            {task.slaStatus && renderSlaBadge(task.slaStatus)}
                                            {task.dueDate && (
                                                <span className={`text-xs flex items-center gap-1 ${
                                                    isOverdue(task.dueDate) && task.status !== 'DONE'
                                                        ? 'text-red-500 font-medium' 
                                                        : 'text-gray-500 dark:text-zinc-400'
                                                }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {getDaysLabel(task.dueDate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* FOLLO ACCESS: Inline action button */}
                                    <div className="flex-shrink-0">
                                        {renderActionButton(task)}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

        </div>
    )
}

export default MyTasks
