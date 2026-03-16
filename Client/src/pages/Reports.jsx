// FOLLO FIX
// FOLLO DASHBOARD
import { useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import useUserRole from '../hooks/useUserRole';
import {
    BarChart3,
    TrendingUp,
    Users,
    CheckCircle2,
    AlertTriangle,
    Download,
    Loader2,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Search,
} from 'lucide-react';
import { format, parseISO, isValid, differenceInDays, subWeeks, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import toast from 'react-hot-toast';
import LoadingButton from '../components/ui/LoadingButton';
import { exportReportPDF } from '../lib/exportReport';
import ProjectAnalytics from '../components/ProjectAnalytics';
import SLADashboard from '../components/SLADashboard';

// ─── helpers ──────────────────────────────────────
const safeDate = (d) => {
    if (!d) return null;
    try { const dt = typeof d === 'string' ? parseISO(d) : new Date(d); return isValid(dt) ? dt : null; } catch { return null; }
};

const calcProgress = (project) => {
    if (project.progress > 0) return project.progress;
    const tasks = project.tasks || [];
    const done = tasks.filter(t => t.status === 'DONE').length;
    return tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
};

// ─── component ────────────────────────────────────
const Reports = () => {
    const { canViewReports, currentWorkspace } = useUserRole();
    const { user } = useUser();
    const navigate = useNavigate();
    const projects = currentWorkspace?.projects || [];
    const members = currentWorkspace?.members || [];

    const [activeTab, setActiveTab] = useState('reports');
    const [selectedProject, setSelectedProject] = useState('all');
    const [exporting, setExporting] = useState(false);
    const [taskSearch, setTaskSearch] = useState('');
    const [taskStatusFilter, setTaskStatusFilter] = useState('all');
    const [taskSlaFilter, setTaskSlaFilter] = useState('all');
    const [taskSort, setTaskSort] = useState({ key: 'dueDate', dir: 'asc' });

    // ── all tasks, respecting project filter ──────
    const allTasks = useMemo(() => {
        const tasks = projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectName: p.name })));
        return selectedProject === 'all' ? tasks : tasks.filter(t => t.projectId === selectedProject);
    }, [projects, selectedProject]);

    // ── ROW 1: headline metrics ───────────────────
    const metrics = useMemo(() => {
        const total = allTasks.length;
        const done = allTasks.filter(t => t.status === 'DONE').length;
        const overdue = allTasks.filter(t => t.slaStatus === 'BREACHED').length;
        const onTime = allTasks.filter(t => t.slaStatus === 'RESOLVED_ON_TIME').length;
        const late = allTasks.filter(t => t.slaStatus === 'RESOLVED_LATE').length;
        const resolved = onTime + late;
        const slaRate = resolved > 0 ? Math.round((onTime / resolved) * 100) : 100;
        const atRisk = allTasks.filter(t => t.slaStatus === 'AT_RISK').length;
        return { total, done, overdue, slaRate, atRisk, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 };
    }, [allTasks]);

    // ── ROW 2a: Completion Trend (last 8 weeks) ──
    const completionTrend = useMemo(() => {
        const now = new Date();
        const start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 7);
        const end = endOfWeek(now, { weekStartsOn: 1 });
        const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
        return weeks.map(weekStart => {
            const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
            const label = format(weekStart, 'dd MMM');
            const doneThisWeek = allTasks.filter(t => {
                if (t.status !== 'DONE') return false;
                const d = safeDate(t.approvedAt) || safeDate(t.updatedAt);
                return d && d >= weekStart && d <= wEnd;
            }).length;
            const cumulDone = allTasks.filter(t => {
                if (t.status !== 'DONE') return false;
                const d = safeDate(t.approvedAt) || safeDate(t.updatedAt);
                return d && d <= wEnd;
            }).length;
            return { label, done: doneThisWeek, cumul: cumulDone };
        });
    }, [allTasks]);

    // ── ROW 2b: SLA Health breakdown ──────────────
    const slaHealth = useMemo(() => {
        const buckets = { HEALTHY: 0, AT_RISK: 0, PENDING_APPROVAL: 0, BLOCKED: 0, BREACHED: 0, RESOLVED_ON_TIME: 0, RESOLVED_LATE: 0 };
        allTasks.forEach(t => { const s = t.slaStatus || 'HEALTHY'; if (buckets[s] !== undefined) buckets[s]++; });
        const colors = { HEALTHY: '#10b981', AT_RISK: '#f59e0b', PENDING_APPROVAL: '#3b82f6', BLOCKED: '#f97316', BREACHED: '#ef4444', RESOLVED_ON_TIME: '#22d3ee', RESOLVED_LATE: '#a855f7' };
        return Object.entries(buckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, fill: colors[name] || '#71717a' }));
    }, [allTasks]);

    // ── ROW 3: Contractor performance ─────────────
    const contractorPerf = useMemo(() => {
        return members.map(m => {
            const mTasks = allTasks.filter(t => t.assigneeId === m.userId);
            const total = mTasks.length;
            if (total === 0) return null;
            const done = mTasks.filter(t => t.status === 'DONE').length;
            const onTime = mTasks.filter(t => t.slaStatus === 'RESOLVED_ON_TIME').length;
            const late = mTasks.filter(t => t.slaStatus === 'RESOLVED_LATE').length;
            const breached = mTasks.filter(t => t.slaStatus === 'BREACHED').length;
            const resolved = onTime + late;
            const slaRate = resolved > 0 ? Math.round((onTime / resolved) * 100) : (breached > 0 ? 0 : 100);
            return {
                id: m.userId,
                name: m.user?.name || 'Unknown',
                image: m.user?.image,
                role: m.role,
                total,
                done,
                slaRate,
                breached,
                avgDays: mTasks.reduce((acc, t) => {
                    const start = safeDate(t.actualStartDate) || safeDate(t.createdAt);
                    const end = safeDate(t.approvedAt) || (t.status === 'DONE' ? safeDate(t.updatedAt) : null);
                    if (start && end) return acc + differenceInDays(end, start);
                    return acc;
                }, 0) / (done || 1),
            };
        }).filter(Boolean).sort((a, b) => b.slaRate - a.slaRate);
    }, [members, allTasks]);

    // ── ROW 4: Project breakdown ──────────────────
    const projectBreakdown = useMemo(() => {
        return projects.map(p => {
            const tasks = p.tasks || [];
            const done = tasks.filter(t => t.status === 'DONE').length;
            const breached = tasks.filter(t => t.slaStatus === 'BREACHED').length;
            const pct = calcProgress(p);
            return { id: p.id, name: p.name, status: p.status, pct, done, total: tasks.length, breached };
        });
    }, [projects]);

    // ── ROW 5: Filterable task table ──────────────
    const filteredTasks = useMemo(() => {
        let list = [...allTasks];
        if (taskSearch) {
            const q = taskSearch.toLowerCase();
            list = list.filter(t => t.title?.toLowerCase().includes(q) || t.assignee?.name?.toLowerCase().includes(q) || t.projectName?.toLowerCase().includes(q));
        }
        if (taskStatusFilter !== 'all') list = list.filter(t => t.status === taskStatusFilter);
        if (taskSlaFilter !== 'all') list = list.filter(t => t.slaStatus === taskSlaFilter);
        list.sort((a, b) => {
            const { key, dir } = taskSort;
            let av = a[key], bv = b[key];
            if (key === 'dueDate') { av = safeDate(av) || new Date(0); bv = safeDate(bv) || new Date(0); }
            if (key === 'title' || key === 'status' || key === 'slaStatus') { av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase(); }
            if (av < bv) return dir === 'asc' ? -1 : 1;
            if (av > bv) return dir === 'asc' ? 1 : -1;
            return 0;
        });
        return list.slice(0, 50);
    }, [allTasks, taskSearch, taskStatusFilter, taskSlaFilter, taskSort]);

    const toggleSort = useCallback((key) => {
        setTaskSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    }, []);

    // ── PDF export ────────────────────────────────
    const handleExport = useCallback(async () => {
        setExporting(true);
        try {
            const flatTasks = projects.flatMap(p => (p.tasks || []));
            const teamMembers = members.map(m => ({
                userId: m.userId,
                name: m.user?.name || m.user?.firstName || 'Unknown',
                email: m.user?.email || '',
                contractorScore: m.contractorScore,
            }));
            await exportReportPDF({
                workspaceName: currentWorkspace?.name || 'Redan Projects',
                projects,
                allTasks: flatTasks,
                members: teamMembers,
                generatedBy: user?.fullName || user?.firstName || 'Admin',
            });
        } catch (e) { console.error('Export failed:', e); toast.error('PDF export failed. Please try again.'); }
        finally { setExporting(false); }
    }, [currentWorkspace, projects, members, user]);

    // ── Access guard ──────────────────────────────
    if (!canViewReports) {
        return <Navigate to="/tasks" replace />;
    }

    const card = 'rounded-lg border bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border-zinc-200 dark:border-zinc-800';

    // Project for Analytics/SLA tabs
    const activeProject = projects.find(p => p.id === selectedProject);
    const activeProjectTasks = activeProject?.tasks || [];

    const TABS = [
        { key: 'reports', label: 'Reports' },
        { key: 'analytics', label: 'Analytics' },
        { key: 'sla', label: 'SLA' },
    ];

    // ── status badge ──────────────────────────────
    const SlaBadge = ({ sla }) => {
        const map = {
            HEALTHY: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
            AT_RISK: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
            PENDING_APPROVAL: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            BLOCKED: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
            BREACHED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
            RESOLVED_ON_TIME: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
            RESOLVED_LATE: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
        };
        const cls = map[sla] || 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400';
        return <span className={`px-2 py-0.5 text-[11px] rounded-full whitespace-nowrap ${cls}`}>{(sla || 'HEALTHY').replace(/_/g, ' ')}</span>;
    };

    const SlaTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', fontSize: 13 }}>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>{payload[0]?.payload?.name}</p>
                <p style={{ color: '#6b7280' }}>Tasks: <strong>{payload[0]?.value}</strong></p>
            </div>
        );
    };

    const SortHeader = ({ label, sortKey }) => (
        <button onClick={() => toggleSort(sortKey)} className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition">
            {label}
            {taskSort.key === sortKey && (taskSort.dir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* ══════ Header ══════ */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white mb-1">Reports &amp; Analytics</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">Workspace performance insights &middot; {format(new Date(), 'd MMMM yyyy')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'reports' ? (
                        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                            <option value="all">All Projects</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    ) : (
                        <select value={selectedProject === 'all' && projects.length > 0 ? projects[0].id : selectedProject} onChange={e => setSelectedProject(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                    {activeTab === 'reports' && (
                        <LoadingButton onClick={handleExport} loading={exporting} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-50">
                            <Download className="size-4" /> Export PDF
                        </LoadingButton>
                    )}
                </div>
            </div>

            {/* ══════ Tab Navigation ══════ */}
            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === t.key
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ Analytics / SLA tabs ═══ */}
            {activeTab === 'analytics' && (
                activeProject ? (
                    <ProjectAnalytics tasks={activeProjectTasks} project={activeProject} />
                ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-16">Select a project to view analytics</p>
                )
            )}
            {activeTab === 'sla' && (
                activeProject ? (
                    <SLADashboard tasks={activeProjectTasks} project={activeProject} />
                ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-16">Select a project to view SLA dashboard</p>
                )
            )}

            {/* ═══ Printable area (Reports tab) ═══ */}
            {activeTab === 'reports' && <div id="report-content" className="space-y-6">

                {/* ══════ ROW 1 — HEADLINE METRICS ══════ */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <MetricCard label="Total Tasks" value={metrics.total} sub={`${allTasks.length - metrics.done} remaining`} icon={<BarChart3 className="size-5 text-blue-500" />} />
                    <MetricCard label="Completion" value={`${metrics.completionRate}%`} sub={`${metrics.done} done`} icon={<CheckCircle2 className="size-5 text-emerald-500" />} />
                    <MetricCard label="SLA On-Time" value={`${metrics.slaRate}%`} sub="resolved on time" icon={<TrendingUp className="size-5 text-cyan-500" />} />
                    <MetricCard label="Overdue" value={metrics.overdue} sub="breached SLA" icon={<AlertTriangle className="size-5 text-red-500" />} accent={metrics.overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
                    <MetricCard label="At Risk" value={metrics.atRisk} sub="approaching deadline" icon={<ShieldAlert className="size-5 text-amber-500" />} accent={metrics.atRisk > 0 ? 'text-amber-600 dark:text-amber-400' : undefined} />
                </div>

                {/* ══════ ROW 2 — CHARTS ══════ */}
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Completion Trend */}
                    <div className={`${card} p-5`}>
                        <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">Completion Trend (8 weeks)</h2>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={completionTrend}>
                                    <defs>
                                        <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.2} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#71717a" />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#71717a" />
                                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }} />
                                    <Area type="monotone" dataKey="cumul" name="Cumulative Done" stroke="#3b82f6" fill="url(#gradBlue)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="done" name="Done This Week" stroke="#10b981" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* SLA Health */}
                    <div className={`${card} p-5`}>
                        <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">SLA Health Breakdown</h2>
                        <div className="h-56">
                            {slaHealth.length === 0 ? (
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center pt-20">No task data</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={slaHealth} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.2} horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#71717a" />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#71717a" width={100} />
                                        <Tooltip content={<SlaTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                        <Bar dataKey="value" name="Tasks" radius={[0, 4, 4, 0]} barSize={18}>
                                            {slaHealth.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                                            <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                {/* ══════ ROW 3 — CONTRACTOR PERFORMANCE ══════ */}
                <div className={`${card} overflow-hidden`}>
                    <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2"><Users className="size-4" /> Contractor Performance</h2>
                    </div>
                    {contractorPerf.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No members with tasks</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                                        <th className="text-left p-3 font-medium">Member</th>
                                        <th className="text-center p-3 font-medium">Tasks</th>
                                        <th className="text-center p-3 font-medium">Done</th>
                                        <th className="text-center p-3 font-medium">SLA %</th>
                                        <th className="text-center p-3 font-medium">Breached</th>
                                        <th className="text-center p-3 font-medium">Avg Days</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {contractorPerf.map(c => (
                                        <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                                            <td className="p-3 flex items-center gap-2">
                                                {c.image ? (
                                                    <img src={c.image} alt="" className="size-7 rounded-full" />
                                                ) : (
                                                    <span className="size-7 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-[10px] font-medium">{c.name?.[0]}</span>
                                                )}
                                                <span className="text-zinc-900 dark:text-white">{c.name}</span>
                                            </td>
                                            <td className="p-3 text-center text-zinc-600 dark:text-zinc-400">{c.total}</td>
                                            <td className="p-3 text-center text-zinc-600 dark:text-zinc-400">{c.done}</td>
                                            <td className="p-3 text-center">
                                                <span className={`font-medium ${c.slaRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : c.slaRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{c.slaRate}%</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {c.breached > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{c.breached}</span> : <span className="text-zinc-400">0</span>}
                                            </td>
                                            <td className="p-3 text-center text-zinc-600 dark:text-zinc-400">{Math.round(c.avgDays)}d</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ══════ ROW 4 — PROJECT BREAKDOWN ══════ */}
                <div className={`${card} overflow-hidden`}>
                    <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-sm font-medium text-zinc-900 dark:text-white">Project Breakdown</h2>
                    </div>
                    {projectBreakdown.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No projects yet</p>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {projectBreakdown.map(p => (
                                <button key={p.id} onClick={() => navigate(`/projectsDetail?id=${p.id}&tab=tasks`)} className="w-full text-left p-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="font-medium text-sm text-zinc-900 dark:text-white truncate">{p.name}</span>
                                            <span className={`px-2 py-0.5 text-[11px] rounded-full ${
                                                p.status === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                p.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                                            }`}>{(p.status || 'PLANNING').replace(/_/g, ' ')}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${p.pct}%` }} />
                                            </div>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400 w-9 text-right">{p.pct}%</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-semibold text-zinc-900 dark:text-white">{p.done}/{p.total}</p>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">tasks done</p>
                                    </div>
                                    {p.breached > 0 && (
                                        <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 shrink-0">{p.breached} breached</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ══════ ROW 5 — TASK TABLE ══════ */}
                <div className={`${card} overflow-hidden`}>
                    <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <h2 className="text-sm font-medium text-zinc-900 dark:text-white shrink-0">All Tasks</h2>
                        <div className="flex-1 flex flex-wrap items-center gap-2 ml-0 sm:ml-auto">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                                <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks…" className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
                            </div>
                            <select value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)} className="px-2 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                <option value="all">All Status</option>
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="PENDING_APPROVAL">Pending Approval</option>
                                <option value="BLOCKED">Blocked</option>
                                <option value="DONE">Done</option>
                            </select>
                            <select value={taskSlaFilter} onChange={e => setTaskSlaFilter(e.target.value)} className="px-2 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                <option value="all">All SLA</option>
                                <option value="HEALTHY">Healthy</option>
                                <option value="AT_RISK">At Risk</option>
                                <option value="BREACHED">Breached</option>
                                <option value="BLOCKED">Blocked</option>
                                <option value="PENDING_APPROVAL">Pending Approval</option>
                            </select>
                        </div>
                    </div>
                    {filteredTasks.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No tasks match filters</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left">
                                        <th className="p-3"><SortHeader label="Task" sortKey="title" /></th>
                                        <th className="p-3"><SortHeader label="Project" sortKey="projectName" /></th>
                                        <th className="p-3">Assignee</th>
                                        <th className="p-3"><SortHeader label="Status" sortKey="status" /></th>
                                        <th className="p-3"><SortHeader label="SLA" sortKey="slaStatus" /></th>
                                        <th className="p-3"><SortHeader label="Due" sortKey="dueDate" /></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {filteredTasks.map(t => (
                                        <tr key={t.id} onClick={() => navigate(`/task?taskId=${t.id}&projectId=${t.projectId}`)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition">
                                            <td className="p-3 text-zinc-900 dark:text-white font-medium max-w-[200px] truncate">{t.title}</td>
                                            <td className="p-3 text-zinc-500 dark:text-zinc-400 max-w-[140px] truncate">{t.projectName}</td>
                                            <td className="p-3 text-zinc-500 dark:text-zinc-400">{t.assignee?.name || '—'}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 text-[11px] rounded-full ${
                                                    t.status === 'DONE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                    t.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                    t.status === 'PENDING_APPROVAL' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                                    'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                                                }`}>{(t.status || 'TODO').replace(/_/g, ' ')}</span>
                                            </td>
                                            <td className="p-3"><SlaBadge sla={t.slaStatus} /></td>
                                            <td className="p-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{safeDate(t.dueDate) ? format(safeDate(t.dueDate), 'dd MMM yyyy') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {allTasks.length > 50 && (
                        <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 py-3 border-t border-zinc-200 dark:border-zinc-800">Showing first 50 of {allTasks.length} tasks</p>
                    )}
                </div>

            </div>}
        </div>
    );
};

// ─── Metric Card sub-component ─────────────────────
const MetricCard = ({ label, value, sub, icon, accent }) => (
    <div className="rounded-lg border p-4 bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 dark:text-zinc-400 text-xs">{label}</span>
            {icon}
        </div>
        <p className={`text-2xl font-bold ${accent || 'text-zinc-900 dark:text-white'}`}>{value}</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{sub}</p>
    </div>
);

export default Reports;
