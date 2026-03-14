// FOLLO PERMISSIONS
// FOLLO WORKFLOW
// FOLLO BUGFIX-REFRESH
// FOLLO ACCESS
// FOLLO MEMBER-GANTT
// FOLLO AUTOSTART
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

            {/* Filters — above Gantt, matches ProjectGantt filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#a1a1aa' }} />
                    <input
                        type="text"
                        placeholder="Search tasks…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '5px 10px 5px 28px', fontSize: 12, border: '0.5px solid var(--color-border-secondary, #d4d4d8)', borderRadius: 6, background: 'var(--color-background-secondary, #f4f4f5)', color: 'var(--color-text-primary, #18181b)', width: 180, outline: 'none' }}
                    />
                </div>

                {/* Status pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {STATUS_FILTER_PILLS.map(pill => (
                        <button
                            key={pill.key}
                            onClick={() => setStatusFilter(pill.key)}
                            style={{
                                padding: '4px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                                border: statusFilter === pill.key ? 'none' : '0.5px solid var(--color-border-secondary, #d4d4d8)',
                                background: statusFilter === pill.key ? 'var(--color-text-primary, #18181b)' : 'var(--color-background-primary, #fff)',
                                color: statusFilter === pill.key ? 'var(--color-background-primary, #fff)' : 'var(--color-text-secondary, #71717a)',
                                transition: 'all .15s',
                            }}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>

                {/* Priority pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {PRIORITY_FILTER_PILLS.map(pill => (
                        <button
                            key={pill.key}
                            onClick={() => setPriorityFilter(pill.key)}
                            style={{
                                padding: '4px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                                border: priorityFilter === pill.key ? 'none' : '0.5px solid var(--color-border-secondary, #d4d4d8)',
                                background: priorityFilter === pill.key ? 'var(--color-text-primary, #18181b)' : 'var(--color-background-primary, #fff)',
                                color: priorityFilter === pill.key ? 'var(--color-background-primary, #fff)' : 'var(--color-text-secondary, #71717a)',
                                transition: 'all .15s',
                            }}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>

                {/* Results summary */}
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)' }}>
                    Showing {sortedTasks.length} of {allTasks.length} tasks
                    {stats.overdue > 0 && <> · {stats.overdue} overdue</>}
                    {stats.blocked > 0 && <> · {stats.blocked} blocked</>}
                </div>
            </div>

            {/* FOLLO MEMBER-GANTT: Mini Gantt timeline */}
            <MiniGantt tasks={allTasks} />

            {/* FOLLO ACCESS: Task cards sorted by urgency */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                {sortedTasks.length === 0 ? (
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

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'TO DO', count: allTasks.filter(t => t.status === 'TODO').length, color: 'text-gray-700 dark:text-zinc-300' },
                    { label: 'IN PROGRESS', count: allTasks.filter(t => t.status === 'IN_PROGRESS').length, color: 'text-blue-700 dark:text-blue-400' },
                    { label: 'PENDING', count: allTasks.filter(t => t.status === 'PENDING_APPROVAL').length, color: 'text-purple-700 dark:text-purple-400' },
                    { label: 'DONE', count: allTasks.filter(t => t.status === 'DONE').length, color: 'text-green-700 dark:text-green-400' },
                ].map(({ label, count, color }) => (
                    <div 
                        key={label}
                        className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-4"
                    >
                        <p className={`text-2xl font-bold ${color}`}>{count}</p>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">{label.replace('_', ' ')}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default MyTasks
