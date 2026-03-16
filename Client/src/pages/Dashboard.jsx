// FOLLO UI
// FOLLO DASHBOARD
// FOLLO ACCESS
import { useState, useMemo, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { format, formatDistanceToNow, parseISO, isValid, differenceInDays } from 'date-fns';
import {
    Plus,
    Clock,
    ShieldAlert,
    AlertTriangle,
    CalendarClock,
    ChevronRight,
    Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CreateProjectDialog from '../components/CreateProjectDialog';
import GanttWidget from '../components/GanttWidget';
import SlidePanel from '../components/SlidePanel';
import useUserRole from '../hooks/useUserRole';
import LoadingButton from '../components/ui/LoadingButton';
import {
    approveTaskAsync,
    rejectTaskAsync,
    approveExtensionAsync,
    denyExtensionAsync,
} from '../features/slaSlice';

// ─── Helpers ───────────────────────────────────────
const safeDate = (d) => {
    if (!d) return null;
    try {
        const date = typeof d === 'string' ? parseISO(d) : new Date(d);
        return isValid(date) ? date : null;
    } catch { return null; }
};

const fmtDate = (d, f = 'dd MMM yyyy') => {
    const date = safeDate(d);
    return date ? format(date, f) : '—';
};

const timeAgo = (d) => {
    const date = safeDate(d);
    return date ? formatDistanceToNow(date, { addSuffix: true }) : '—';
};

/** Calculate correct project completion % */
const calcProgress = (project) => {
    if (project.progress > 0) return project.progress;
    const tasks = project.tasks || [];
    const done = tasks.filter(t => t.status === 'DONE').length;
    return tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
};

/** RAG status for a project */
const ragStatus = (project) => {
    const tasks = project.tasks || [];
    const hasBreach = tasks.some(t => t.slaStatus === 'BREACHED');
    const hasBlocked = tasks.some(t => t.slaStatus === 'BLOCKED');
    const hasAtRisk = tasks.some(t => t.slaStatus === 'AT_RISK');
    if (hasBreach || hasBlocked) return 'RED';
    if (hasAtRisk) return 'AMBER';
    return 'GREEN';
};

const ragDot = { GREEN: 'bg-emerald-500', AMBER: 'bg-amber-500', RED: 'bg-red-500' };
const ragLabel = (project) => {
    const tasks = project.tasks || [];
    const breached = tasks.filter(t => t.slaStatus === 'BREACHED').length;
    const blocked = tasks.filter(t => t.slaStatus === 'BLOCKED').length;
    const atRisk = tasks.filter(t => t.slaStatus === 'AT_RISK').length;
    if (breached > 0) return `${breached} breached`;
    if (blocked > 0) return `${blocked} blocked`;
    if (atRisk > 0) return `${atRisk} at risk`;
    return 'On track';
};

// ─── Panel IDs ─────────────────────────────────────
const PANELS = { APPROVALS: 'approvals', BLOCKERS: 'blockers', BREACHES: 'breaches', EXTENSIONS: 'extensions' };

// ─── Main Component ────────────────────────────────
const Dashboard = () => {
    const { user } = useUser();
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { canCreateProjects, isMemberView, isAdmin } = useUserRole();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activePanel, setActivePanel] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingTaskId, setRejectingTaskId] = useState(null);
    const [denyReason, setDenyReason] = useState('');
    const [denyingExtId, setDenyingExtId] = useState(null);

    const currentWorkspace = useSelector(s => s.workspace.currentWorkspace);
    const projects = currentWorkspace?.projects || [];

    // ─── Derived data from Redux state ─────────────
    const allTasks = useMemo(() => projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectName: p.name }))), [projects]);

    const pendingApprovals = useMemo(() => allTasks.filter(t => t.slaStatus === 'PENDING_APPROVAL'), [allTasks]);
    const blockedTasks = useMemo(() => allTasks.filter(t => t.slaStatus === 'BLOCKED'), [allTasks]);
    const breachedTasks = useMemo(() => allTasks.filter(t => t.slaStatus === 'BREACHED'), [allTasks]);
    const extensionRequests = useMemo(() => allTasks.filter(t => t.extensionStatus === 'PENDING'), [allTasks]);

    // Client-side overdue detection — catches tasks the backend cron hasn't flagged yet
    const overdueTasks = useMemo(() => {
        const now = new Date();
        const terminal = ['DONE', 'RESOLVED_ON_TIME', 'RESOLVED_LATE', 'BREACHED'];
        return allTasks.filter(t => {
            if (terminal.includes(t.status) || terminal.includes(t.slaStatus)) return false;
            const due = safeDate(t.dueDate);
            return due && due < now;
        });
    }, [allTasks]);

    // Combined breach + overdue count (deduplicated)
    const allOverdueCount = useMemo(() => {
        const ids = new Set(breachedTasks.map(t => t.id));
        overdueTasks.forEach(t => ids.add(t.id));
        return ids.size;
    }, [breachedTasks, overdueTasks]);

    const allClear = pendingApprovals.length === 0 && blockedTasks.length === 0 && allOverdueCount === 0 && extensionRequests.length === 0;

    // ─── Inline actions ────────────────────────────
    const handleApprove = useCallback(async (taskId) => {
        setActionLoading(taskId);
        try {
            await dispatch(approveTaskAsync({ taskId, getToken })).unwrap();
            toast.success('Task approved');
        } catch (e) { toast.error(e?.message || 'Failed to approve'); }
        finally { setActionLoading(null); }
    }, [dispatch, getToken]);

    const handleReject = useCallback(async (taskId) => {
        if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
        setActionLoading(taskId);
        try {
            await dispatch(rejectTaskAsync({ taskId, reason: rejectReason.trim(), getToken })).unwrap();
            toast.success('Task rejected');
            setRejectingTaskId(null);
            setRejectReason('');
        } catch (e) { toast.error(e?.message || 'Failed to reject'); }
        finally { setActionLoading(null); }
    }, [dispatch, getToken, rejectReason]);

    const handleApproveExtension = useCallback(async (taskId) => {
        setActionLoading(taskId);
        try {
            await dispatch(approveExtensionAsync({ taskId, getToken })).unwrap();
            toast.success('Extension approved');
        } catch (e) { toast.error(e?.message || 'Failed to approve extension'); }
        finally { setActionLoading(null); }
    }, [dispatch, getToken]);

    const handleDenyExtension = useCallback(async (taskId) => {
        setActionLoading(taskId);
        try {
            await dispatch(denyExtensionAsync({ taskId, reason: denyReason.trim(), getToken })).unwrap();
            toast.success('Extension denied');
            setDenyingExtId(null);
            setDenyReason('');
        } catch (e) { toast.error(e?.message || 'Failed to deny extension'); }
        finally { setActionLoading(null); }
    }, [dispatch, getToken, denyReason]);

    // FOLLO ACCESS — Non-admins see My Tasks as their home, not admin dashboard
    if (!isAdmin) {
        return <Navigate to="/tasks" replace />;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* ══════ Header ══════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                        Welcome back, {user?.fullName || 'User'}
                    </h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Here&apos;s what&apos;s happening with your projects today &middot; {format(new Date(), 'EEEE, d MMMM yyyy')}
                    </p>
                </div>
                {canCreateProjects && (
                    <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">
                        <Plus size={16} /> New Project
                    </button>
                )}
                <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* ══════ ROW 1 — ACTION REQUIRED ══════ */}
            {allClear ? (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-center">
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium">All clear — No items need your attention right now</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Pending Approvals */}
                    <button onClick={() => setActivePanel(PANELS.APPROVALS)} className="text-left p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 hover:border-blue-300 dark:hover:border-blue-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                <Clock className="size-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <ChevronRight className="size-4 text-blue-400 dark:text-blue-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pendingApprovals.length}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Pending Approvals</p>
                        <p className="text-[11px] text-blue-500/70 dark:text-blue-500/50 mt-0.5">{pendingApprovals.length} task(s) awaiting your review</p>
                    </button>

                    {/* Active Blockers */}
                    <button onClick={() => setActivePanel(PANELS.BLOCKERS)} className="text-left p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 hover:border-orange-300 dark:hover:border-orange-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                                <ShieldAlert className="size-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <ChevronRight className="size-4 text-orange-400 dark:text-orange-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{blockedTasks.length}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Active Blockers</p>
                        <p className="text-[11px] text-orange-500/70 dark:text-orange-500/50 mt-0.5">{blockedTasks.length} task(s) blocked and paused</p>
                    </button>

                    {/* SLA Breaches */}
                    <button onClick={() => setActivePanel(PANELS.BREACHES)} className="text-left p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                                <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                            </div>
                            <ChevronRight className="size-4 text-red-400 dark:text-red-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{allOverdueCount}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">SLA Breaches</p>
                        <p className="text-[11px] text-red-500/70 dark:text-red-500/50 mt-0.5">{allOverdueCount} task(s) past due date</p>
                    </button>

                    {/* Extension Requests */}
                    <button onClick={() => setActivePanel(PANELS.EXTENSIONS)} className="text-left p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                <CalendarClock className="size-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <ChevronRight className="size-4 text-amber-400 dark:text-amber-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{extensionRequests.length}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Extension Requests</p>
                        <p className="text-[11px] text-amber-500/70 dark:text-amber-500/50 mt-0.5">{extensionRequests.length} pending approval</p>
                    </button>
                </div>
            )}

            {/* ══════ ROW 2 — TIMELINE (full width, main item) ══════ */}
            <GanttWidget />

            {/* ══════ ROW 3 — PROJECT HEALTH ══════ */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="font-medium text-zinc-900 dark:text-white">Project Health</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 dark:divide-zinc-800">
                    {projects.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8 col-span-full">No projects yet</p>
                    ) : projects.map(project => {
                        const pct = calcProgress(project);
                        const tasks = project.tasks || [];
                        const done = tasks.filter(t => t.status === 'DONE').length;
                        const rag = ragStatus(project);
                        return (
                            <button
                                key={project.id}
                                onClick={() => navigate(`/projectsDetail?id=${project.id}&tab=tasks`)}
                                className="w-full text-left p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${ragDot[rag]}`} />
                                    <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">{project.name}</span>
                                </div>
                                <div className="flex items-center gap-3 mb-1.5">
                                    <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400 w-9 text-right">{pct}%</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                                    <span>{done}/{tasks.length} tasks</span>
                                    <span>{ragLabel(project)}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>



            {/* ══════ SLIDE PANELS ══════ */}

            {/* Pending Approvals Panel */}
            <SlidePanel isOpen={activePanel === PANELS.APPROVALS} onClose={() => setActivePanel(null)} title={`Pending Approvals (${pendingApprovals.length})`}>
                {pendingApprovals.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No pending approvals</p>
                ) : (
                    <div className="space-y-4">
                        {pendingApprovals.map(task => (
                            <div key={task.id} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                                <div>
                                    <button onClick={() => navigate(`/task?taskId=${task.id}&projectId=${task.projectId}`)} className="text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition">{task.title}</button>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.projectName}</p>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Submitted by: {task.assignee?.name || 'Unknown'} &middot; {timeAgo(task.submittedAt)}</p>
                                {task.completionNotes && <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 p-2 rounded">{task.completionNotes.slice(0, 100)}{task.completionNotes.length > 100 ? '…' : ''}</p>}
                                {task.completionPhotos?.length > 0 && (
                                    <div className="flex gap-2">
                                        {task.completionPhotos.slice(0, 3).map((url) => (
                                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`Photo ${i + 1}`} className="w-16 h-12 object-cover rounded border border-zinc-200 dark:border-zinc-700" />
                                            </a>
                                        ))}
                                        {task.completionPhotos.length > 3 && <span className="text-xs text-zinc-400 self-center">+{task.completionPhotos.length - 3} more</span>}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <LoadingButton onClick={() => handleApprove(task.id)} loading={actionLoading === task.id} className="flex-1 py-2 rounded text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition">
                                        Approve
                                    </LoadingButton>
                                    {rejectingTaskId === task.id ? (
                                        <div className="flex-1 space-y-2">
                                            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason…" className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs resize-none" rows={2} />
                                            <div className="flex gap-1">
                                                <button onClick={() => { setRejectingTaskId(null); setRejectReason(''); }} className="flex-1 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700">Cancel</button>
                                                <LoadingButton onClick={() => handleReject(task.id)} loading={actionLoading === task.id} className="flex-1 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-50">Reject</LoadingButton>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setRejectingTaskId(task.id)} className="flex-1 py-2 rounded text-xs border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                                            Reject
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SlidePanel>

            {/* Active Blockers Panel */}
            <SlidePanel isOpen={activePanel === PANELS.BLOCKERS} onClose={() => setActivePanel(null)} title={`Active Blockers (${blockedTasks.length})`}>
                {blockedTasks.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No active blockers</p>
                ) : (
                    <div className="space-y-4">
                        {blockedTasks.map(task => (
                            <div key={task.id} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                                <div>
                                    <button onClick={() => navigate(`/task?taskId=${task.id}&projectId=${task.projectId}`)} className="text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition">{task.title}</button>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.projectName}</p>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Blocked by: {task.assignee?.name || 'Unknown'} &middot; {timeAgo(task.blockerRaisedAt)}</p>
                                {task.blockerDescription && <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-red-50 dark:bg-red-950/20 p-2 rounded">{task.blockerDescription}</p>}
                                <button
                                    onClick={() => navigate(`/task?taskId=${task.id}&projectId=${task.projectId}`)}
                                    className="w-full py-2 rounded text-xs bg-amber-600 hover:bg-amber-700 text-white transition"
                                >
                                    Resolve Blocker
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </SlidePanel>

            {/* Breaches Panel */}
            <SlidePanel isOpen={activePanel === PANELS.BREACHES} onClose={() => setActivePanel(null)} title={`SLA Breaches (${breachedTasks.length})`}>
                {breachedTasks.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No SLA breaches</p>
                ) : (
                    <div className="space-y-4">
                        {[...breachedTasks].sort((a, b) => {
                            const dA = safeDate(a.dueDate);
                            const dB = safeDate(b.dueDate);
                            if (!dA || !dB) return 0;
                            return dA - dB;
                        }).map(task => {
                            const due = safeDate(task.dueDate);
                            const days = due ? differenceInDays(new Date(), due) : 0;
                            return (
                                <div key={task.id} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <button onClick={() => navigate(`/task?taskId=${task.id}&projectId=${task.projectId}`)} className="text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition">{task.title}</button>
                                        <span className="text-xs font-medium text-red-600 dark:text-red-400">{days}d overdue</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.projectName} &middot; {task.assignee?.name || 'Unassigned'}</p>
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Due: {fmtDate(task.dueDate)}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SlidePanel>

            {/* Extension Requests Panel */}
            <SlidePanel isOpen={activePanel === PANELS.EXTENSIONS} onClose={() => setActivePanel(null)} title={`Extension Requests (${extensionRequests.length})`}>
                {extensionRequests.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No pending extension requests</p>
                ) : (
                    <div className="space-y-4">
                        {extensionRequests.map(task => (
                            <div key={task.id} className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                                <div>
                                    <button onClick={() => navigate(`/task?taskId=${task.id}&projectId=${task.projectId}`)} className="text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition">{task.title}</button>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{task.projectName}</p>
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                                    <p>Requested by: {task.assignee?.name || 'Unknown'}</p>
                                    <p>Current due: {fmtDate(task.extensionOriginalDueDate || task.dueDate)} &rarr; Proposed: <span className="text-zinc-900 dark:text-white font-medium">{fmtDate(task.extensionProposedDate)}</span></p>
                                    {task.extensionReason && <p className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded">Reason: {task.extensionReason}</p>}
                                </div>
                                <div className="flex gap-2">
                                    <LoadingButton onClick={() => handleApproveExtension(task.id)} loading={actionLoading === task.id} className="flex-1 py-2 rounded text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition">
                                        Approve
                                    </LoadingButton>
                                    {denyingExtId === task.id ? (
                                        <div className="flex-1 space-y-2">
                                            <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)} placeholder="Reason (optional)…" className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs resize-none" rows={2} />
                                            <div className="flex gap-1">
                                                <button onClick={() => { setDenyingExtId(null); setDenyReason(''); }} className="flex-1 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700">Cancel</button>
                                                <LoadingButton onClick={() => handleDenyExtension(task.id)} loading={actionLoading === task.id} className="flex-1 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-50">Deny</LoadingButton>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setDenyingExtId(task.id)} className="flex-1 py-2 rounded text-xs border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                                            Deny
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SlidePanel>
        </div>
    );
};

export default Dashboard;
