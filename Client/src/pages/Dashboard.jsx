// FOLLO UI
// FOLLO DASHBOARD
// FOLLO ACCESS
// FOLLO ACTION-CARDS
// FOLLO CARD-HISTORY
// FOLLO GANTT-FINAL
import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, Navigate } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns';
import {
    Plus,
    Clock,
    ShieldAlert,
    AlertTriangle,
    CalendarClock,
    ChevronRight,
} from 'lucide-react';
import CreateProjectDialog from '../components/CreateProjectDialog';
import GanttWidget from '../components/GanttWidget';
import SlidePanel from '../components/SlidePanel';
import ActionPanel from '../components/dashboard/ActionPanel';
import useUserRole from '../hooks/useUserRole';

// ─── Helpers ───────────────────────────────────────
const safeDate = (d) => {
    if (!d) return null;
    try {
        const date = typeof d === 'string' ? parseISO(d) : new Date(d);
        return isValid(date) ? date : null;
    } catch { return null; }
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
    const navigate = useNavigate();
    const { canCreateProjects, isMemberView, isAdmin } = useUserRole();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activePanel, setActivePanel] = useState(null);
    // FOLLO CARD-HISTORY
    const [panelMode, setPanelMode] = useState('active');
    const [counts, setCounts] = useState({
        approvalsResolvedThisMonth: 0,
        blockersResolvedThisMonth: 0,
        breachesResolvedThisMonth: 0,
        extensionsResolvedThisMonth: 0,
    });

    const { getToken } = useAuth();
    const currentWorkspace = useSelector(s => s.workspace.currentWorkspace);
    const projects = currentWorkspace?.projects || [];

    // ─── Derived data from Redux state ─────────────
    // FOLLO ACTION-CARDS — include projectId + projectName on every task for panel navigation
    const allTasks = useMemo(() => projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectId: p.id, projectName: p.name }))), [projects]);

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

    // FOLLO ACTION-CARDS — Combined breach + overdue list (deduplicated)
    // This is used for BOTH the card count AND the panel list — always consistent
    const allOverdueTasks = useMemo(() => {
        const map = new Map();
        breachedTasks.forEach(t => map.set(t.id, t));
        overdueTasks.forEach(t => { if (!map.has(t.id)) map.set(t.id, t); });
        return [...map.values()].sort((a, b) => {
            const dA = safeDate(a.dueDate);
            const dB = safeDate(b.dueDate);
            if (!dA || !dB) return 0;
            return dA - dB; // most overdue first
        });
    }, [breachedTasks, overdueTasks]);
    const allOverdueCount = allOverdueTasks.length;

    // FOLLO CARD-HISTORY — fetch monthly resolved counts from backend
    useEffect(() => {
        if (!currentWorkspace?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const token = await getToken();
                const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';
                const res = await fetch(
                    `${apiBase}/api/v1/workspaces/dashboard/stats?workspaceId=${currentWorkspace.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const json = await res.json();
                if (!cancelled && json?.data) setCounts(json.data);
            } catch (err) {
                console.error('[Dashboard] Failed to fetch dashboard stats', err);
            }
        })();
        return () => { cancelled = true; };
    }, [currentWorkspace?.id, getToken]);

    // FOLLO CARD-HISTORY — handler for history link clicks
    const handleHistoryClick = (e, historyType) => {
        e.stopPropagation();
        setActivePanel(historyType.replace('-history', ''));
        setPanelMode('history');
    };

    // FOLLO ACTION-CARDS — map panel type to its task list (single source of truth)
    const panelLists = {
        [PANELS.APPROVALS]:  pendingApprovals,
        [PANELS.BLOCKERS]:   blockedTasks,
        [PANELS.BREACHES]:   allOverdueTasks,
        [PANELS.EXTENSIONS]: extensionRequests,
    };
    const panelTitles = {
        [PANELS.APPROVALS]:  `Pending Approvals (${pendingApprovals.length})`,
        [PANELS.BLOCKERS]:   `Active Blockers (${blockedTasks.length})`,
        [PANELS.BREACHES]:   `SLA Breaches (${allOverdueCount})`,
        [PANELS.EXTENSIONS]: `Extension Requests (${extensionRequests.length})`,
    };

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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Pending Approvals */}
                    <button onClick={() => { setActivePanel(PANELS.APPROVALS); setPanelMode('active'); }} className="text-left p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 hover:border-blue-300 dark:hover:border-blue-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                                <Clock className="size-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <ChevronRight className="size-4 text-blue-400 dark:text-blue-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pendingApprovals.length}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Pending Approvals</p>
                        <p className="text-[11px] text-blue-500/70 dark:text-blue-500/50 mt-0.5">{pendingApprovals.length} task(s) awaiting your review</p>
                        {/* FOLLO CARD-HISTORY */}
                        <div className="mt-2.5 pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                            <button
                                onClick={(e) => handleHistoryClick(e, 'approvals-history')}
                                className="text-[10px] bg-transparent border-0 p-0"
                                style={{ color: counts.approvalsResolvedThisMonth > 0 ? undefined : 'rgba(59,130,246,0.4)', cursor: counts.approvalsResolvedThisMonth > 0 ? 'pointer' : 'default' }}
                            >
                                {counts.approvalsResolvedThisMonth > 0 ? `${counts.approvalsResolvedThisMonth} resolved this month →` : 'No activity this month'}
                            </button>
                        </div>
                    </button>

                    {/* Active Blockers */}
                    <button onClick={() => { setActivePanel(PANELS.BLOCKERS); setPanelMode('active'); }} className="text-left p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 hover:border-orange-300 dark:hover:border-orange-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                                <ShieldAlert className="size-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <ChevronRight className="size-4 text-orange-400 dark:text-orange-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{blockedTasks.length}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Active Blockers</p>
                        <p className="text-[11px] text-orange-500/70 dark:text-orange-500/50 mt-0.5">{blockedTasks.length} task(s) blocked and paused</p>
                        {/* FOLLO CARD-HISTORY */}
                        <div className="mt-2.5 pt-2 border-t border-orange-200/60 dark:border-orange-800/60">
                            <button
                                onClick={(e) => handleHistoryClick(e, 'blockers-history')}
                                className="text-[10px] bg-transparent border-0 p-0"
                                style={{ color: counts.blockersResolvedThisMonth > 0 ? undefined : 'rgba(249,115,22,0.4)', cursor: counts.blockersResolvedThisMonth > 0 ? 'pointer' : 'default' }}
                            >
                                {counts.blockersResolvedThisMonth > 0 ? `${counts.blockersResolvedThisMonth} resolved this month →` : 'No activity this month'}
                            </button>
                        </div>
                    </button>

                    {/* SLA Breaches */}
                    <button onClick={() => { setActivePanel(PANELS.BREACHES); setPanelMode('active'); }} className="text-left p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                                <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                            </div>
                            <ChevronRight className="size-4 text-red-400 dark:text-red-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{allOverdueCount}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">SLA Breaches</p>
                        <p className="text-[11px] text-red-500/70 dark:text-red-500/50 mt-0.5">{allOverdueCount} task(s) past due date</p>
                        {/* FOLLO CARD-HISTORY */}
                        <div className="mt-2.5 pt-2 border-t border-red-200/60 dark:border-red-800/60">
                            <button
                                onClick={(e) => handleHistoryClick(e, 'breaches-history')}
                                className="text-[10px] bg-transparent border-0 p-0"
                                style={{ color: counts.breachesResolvedThisMonth > 0 ? undefined : 'rgba(239,68,68,0.4)', cursor: counts.breachesResolvedThisMonth > 0 ? 'pointer' : 'default' }}
                            >
                                {counts.breachesResolvedThisMonth > 0 ? `${counts.breachesResolvedThisMonth} resolved this month →` : 'No activity this month'}
                            </button>
                        </div>
                    </button>

                    {/* Extension Requests */}
                    <button onClick={() => { setActivePanel(PANELS.EXTENSIONS); setPanelMode('active'); }} className="text-left p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-700 transition group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                <CalendarClock className="size-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <ChevronRight className="size-4 text-amber-400 dark:text-amber-600 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{extensionRequests.length}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Extension Requests</p>
                        <p className="text-[11px] text-amber-500/70 dark:text-amber-500/50 mt-0.5">{extensionRequests.length} pending approval</p>
                        {/* FOLLO CARD-HISTORY */}
                        <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                            <button
                                onClick={(e) => handleHistoryClick(e, 'extensions-history')}
                                className="text-[10px] bg-transparent border-0 p-0"
                                style={{ color: counts.extensionsResolvedThisMonth > 0 ? undefined : 'rgba(245,158,11,0.4)', cursor: counts.extensionsResolvedThisMonth > 0 ? 'pointer' : 'default' }}
                            >
                                {counts.extensionsResolvedThisMonth > 0 ? `${counts.extensionsResolvedThisMonth} resolved this month →` : 'No activity this month'}
                            </button>
                        </div>
                    </button>
                </div>

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



            {/* ══════ SLIDE PANEL — FOLLO ACTION-CARDS ══════ */}
            <SlidePanel
                isOpen={!!activePanel}
                onClose={() => { setActivePanel(null); setPanelMode('active'); }}
                bare
            >
                {activePanel && (
                    <ActionPanel
                        type={activePanel}
                        tasks={panelLists[activePanel] ?? []}
                        onClose={() => { setActivePanel(null); setPanelMode('active'); }}
                        mode={panelMode}
                        workspaceId={currentWorkspace?.id}
                    />
                )}
            </SlidePanel>
        </div>
    );
};

export default Dashboard;
