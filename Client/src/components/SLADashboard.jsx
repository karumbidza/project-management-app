// FOLLO PERMISSIONS
// FOLLO SLA — Phase 9: SLA Dashboard Panel
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useUserRole from "../hooks/useUserRole";
import {
    Shield,
    AlertTriangle,
    Clock,
    CheckCircle,
    XCircle,
    Lock,
    User,
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react";

// ━━━ SLA status color map ━━━
const SLA_BADGE = {
    HEALTHY:          { bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", label: "Healthy" },
    AT_RISK:          { bg: "bg-amber-100 dark:bg-amber-500/15",     text: "text-amber-700 dark:text-amber-400",     label: "At Risk" },
    PENDING_APPROVAL: { bg: "bg-purple-100 dark:bg-purple-500/15",   text: "text-purple-700 dark:text-purple-400",   label: "Pending Approval" },
    BLOCKED:          { bg: "bg-red-100 dark:bg-red-500/15",         text: "text-red-700 dark:text-red-400",         label: "Blocked" },
    BREACHED:         { bg: "bg-red-200 dark:bg-red-600/20",         text: "text-red-800 dark:text-red-300",         label: "Breached" },
    RESOLVED_ON_TIME: { bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400", label: "On Time" },
    RESOLVED_LATE:    { bg: "bg-orange-100 dark:bg-orange-500/15",   text: "text-orange-700 dark:text-orange-400",   label: "Late" },
};

const SlaBadge = ({ status }) => {
    const s = SLA_BADGE[status] || SLA_BADGE.HEALTHY;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

// ━━━ Score trend icon ━━━
const ScoreIcon = ({ score }) => {
    if (score >= 80) return <TrendingUp className="size-4 text-emerald-500" />;
    if (score >= 50) return <Minus className="size-4 text-amber-500" />;
    return <TrendingDown className="size-4 text-red-500" />;
};

const scoreColor = (score) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function SLADashboard({ tasks, project }) {
    const navigate = useNavigate();
    const { canApproveReject } = useUserRole();

    // ━━━ Compute stats ━━━
    const {
        healthCounts,
        pendingApproval,
        activeBlockers,
        breachedTasks,
        contractorScores,
        projectHealth,
        completionPct,
    } = useMemo(() => {
        const counts = { HEALTHY: 0, AT_RISK: 0, PENDING_APPROVAL: 0, BLOCKED: 0, BREACHED: 0, RESOLVED_ON_TIME: 0, RESOLVED_LATE: 0 };
        const pending = [];
        const blockers = [];
        const breached = [];

        // Contractor score aggregation (group by assignee)
        const scoreMap = new Map();

        tasks.forEach((t) => {
            const status = t.slaStatus || "HEALTHY";
            if (counts[status] !== undefined) counts[status]++;

            if (status === "PENDING_APPROVAL") pending.push(t);
            if (status === "BLOCKED") blockers.push(t);
            if (status === "BREACHED") breached.push(t);

            // Build per-assignee stats
            const aId = t.assigneeId;
            if (aId) {
                if (!scoreMap.has(aId)) {
                    scoreMap.set(aId, {
                        id: aId,
                        name: t.assignee?.name || t.assignee?.email || "Unknown",
                        image: t.assignee?.image,
                        total: 0,
                        onTime: 0,
                        late: 0,
                        breached: 0,
                        blocked: 0,
                    });
                }
                const s = scoreMap.get(aId);
                s.total++;
                if (status === "RESOLVED_ON_TIME") s.onTime++;
                if (status === "RESOLVED_LATE") s.late++;
                if (status === "BREACHED") s.breached++;
                if (status === "BLOCKED") s.blocked++;
            }
        });

        // Compute a simple derived score per contractor (100-based)
        const scores = [...scoreMap.values()].map((s) => {
            const resolved = s.onTime + s.late;
            const onTimePct = resolved > 0 ? Math.round((s.onTime / resolved) * 100) : 100;
            const penalty = s.breached * 10 + s.late * 5;
            const score = Math.max(0, Math.min(100, onTimePct - penalty));
            return { ...s, score };
        });
        scores.sort((a, b) => b.score - a.score);

        // Overall project health
        const active = tasks.filter((t) => !["RESOLVED_ON_TIME", "RESOLVED_LATE"].includes(t.slaStatus || "HEALTHY"));
        const atRiskOrWorse = counts.AT_RISK + counts.BLOCKED + counts.BREACHED;
        let health = "Healthy";
        if (counts.BREACHED > 0) health = "Critical";
        else if (atRiskOrWorse > active.length * 0.3) health = "At Risk";
        else if (atRiskOrWorse > 0) health = "Warning";

        const done = counts.RESOLVED_ON_TIME + counts.RESOLVED_LATE;
        const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

        return {
            healthCounts: counts,
            pendingApproval: pending,
            activeBlockers: blockers,
            breachedTasks: breached,
            contractorScores: scores,
            projectHealth: health,
            completionPct: pct,
        };
    }, [tasks]);

    const healthColor = {
        Healthy: "text-emerald-600 dark:text-emerald-400",
        Warning: "text-amber-600 dark:text-amber-400",
        "At Risk": "text-orange-600 dark:text-orange-400",
        Critical: "text-red-600 dark:text-red-400",
    };

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Shield className="size-12 text-zinc-400 dark:text-zinc-600 mb-4" />
                <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No SLA data yet</h3>
                <p className="text-sm text-zinc-500 mt-1">Create tasks to start tracking SLA compliance</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ━━━ Header stats ━━━ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Project Health", value: projectHealth, color: healthColor[projectHealth], icon: Shield },
                    { label: "Completion", value: `${completionPct}%`, color: "text-blue-600 dark:text-blue-400", icon: CheckCircle },
                    { label: "Breached", value: healthCounts.BREACHED, color: healthCounts.BREACHED > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400", icon: XCircle },
                    { label: "Pending Approval", value: healthCounts.PENDING_APPROVAL, color: healthCounts.PENDING_APPROVAL > 0 ? "text-purple-600 dark:text-purple-400" : "text-zinc-600 dark:text-zinc-400", icon: Clock },
                ].map((card) => (
                    <div key={card.label} className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                            <card.icon className="size-3.5" />
                            {card.label}
                        </div>
                        <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* ━━━ SLA Status Breakdown ━━━ */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">SLA Status Breakdown</h3>
                </div>
                <div className="p-4">
                    {/* Progress bar */}
                    <div className="flex h-3 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 mb-4">
                        {tasks.length > 0 && Object.entries(healthCounts).map(([status, count]) => {
                            if (count === 0) return null;
                            const pct = (count / tasks.length) * 100;
                            const colors = {
                                HEALTHY: "bg-emerald-500", AT_RISK: "bg-amber-500", PENDING_APPROVAL: "bg-purple-500",
                                BLOCKED: "bg-red-500", BREACHED: "bg-red-700", RESOLVED_ON_TIME: "bg-emerald-400", RESOLVED_LATE: "bg-orange-500",
                            };
                            return <div key={status} className={`${colors[status]}`} style={{ width: `${pct}%` }} title={`${SLA_BADGE[status]?.label}: ${count}`} />;
                        })}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {Object.entries(healthCounts).map(([status, count]) => {
                            if (count === 0) return null;
                            const badge = SLA_BADGE[status];
                            return (
                                <span key={status} className="flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${status === "HEALTHY" ? "bg-emerald-500" : status === "AT_RISK" ? "bg-amber-500" : status === "PENDING_APPROVAL" ? "bg-purple-500" : status === "BLOCKED" ? "bg-red-500" : status === "BREACHED" ? "bg-red-700" : status === "RESOLVED_ON_TIME" ? "bg-emerald-400" : "bg-orange-500"}`} />
                                    {badge?.label} ({count})
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* ━━━ Pending Approvals (PM/admin only) ━━━ */}
                {canApproveReject && (
                <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                            <Clock className="size-4 text-purple-500" />
                            Pending Approvals
                        </h3>
                        <span className="text-xs font-bold bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">{pendingApproval.length}</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                        {pendingApproval.length === 0 ? (
                            <div className="p-6 text-center text-sm text-zinc-500">No tasks awaiting approval</div>
                        ) : (
                            pendingApproval.map((t) => (
                                <div key={t.id} onClick={() => navigate(`/task?id=${t.id}`)} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{t.title}</div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                        <span className="flex items-center gap-1">
                                            <User className="size-3" />
                                            {t.assignee?.name || "Unassigned"}
                                        </span>
                                        {t.submittedAt && (
                                            <span>Submitted {new Date(t.submittedAt).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                )}

                {/* ━━━ Active Blockers ━━━ */}
                <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                            <Lock className="size-4 text-red-500" />
                            Active Blockers
                        </h3>
                        <span className="text-xs font-bold bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">{activeBlockers.length}</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                        {activeBlockers.length === 0 ? (
                            <div className="p-6 text-center text-sm text-zinc-500">No active blockers</div>
                        ) : (
                            activeBlockers.map((t) => (
                                <div key={t.id} onClick={() => navigate(`/task?id=${t.id}`)} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{t.title}</div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                        <span className="flex items-center gap-1">
                                            <User className="size-3" />
                                            {t.assignee?.name || "Unassigned"}
                                        </span>
                                        {t.blockerDescription && (
                                            <span className="truncate max-w-48">{t.blockerDescription}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ━━━ Breached Tasks ━━━ */}
            {breachedTasks.length > 0 && (
                <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-red-200 dark:border-red-900/50 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
                        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
                            <AlertTriangle className="size-4" />
                            SLA Breaches ({breachedTasks.length})
                        </h3>
                    </div>
                    <div className="divide-y divide-red-100 dark:divide-red-900/30 max-h-48 overflow-y-auto">
                        {breachedTasks.map((t) => (
                            <div key={t.id} onClick={() => navigate(`/task?id=${t.id}`)} className="px-4 py-3 hover:bg-red-50/50 dark:hover:bg-red-900/10 cursor-pointer transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{t.title}</div>
                                    {t.delayDays > 0 && (
                                        <span className="text-xs font-bold text-red-600 dark:text-red-400">+{t.delayDays}d overdue</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    <span className="flex items-center gap-1">
                                        <User className="size-3" />
                                        {t.assignee?.name || "Unassigned"}
                                    </span>
                                    {t.dueDate && (
                                        <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ━━━ Contractor Scores (PM/admin only) ━━━ */}
            {canApproveReject && contractorScores.length > 0 && (
                <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Contractor Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                                    <th className="text-left px-4 py-2 font-medium">Contractor</th>
                                    <th className="text-center px-3 py-2 font-medium">Score</th>
                                    <th className="text-center px-3 py-2 font-medium">Tasks</th>
                                    <th className="text-center px-3 py-2 font-medium">On Time</th>
                                    <th className="text-center px-3 py-2 font-medium">Late</th>
                                    <th className="text-center px-3 py-2 font-medium">Breached</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {contractorScores.map((c) => (
                                    <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                {c.image ? (
                                                    <img src={c.image} alt="" className="size-6 rounded-full" />
                                                ) : (
                                                    <div className="size-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                                        {c.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-32">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-center px-3 py-2.5">
                                            <div className="flex items-center justify-center gap-1">
                                                <ScoreIcon score={c.score} />
                                                <span className={`font-bold ${scoreColor(c.score)}`}>{c.score}</span>
                                            </div>
                                        </td>
                                        <td className="text-center px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{c.total}</td>
                                        <td className="text-center px-3 py-2.5 text-emerald-600 dark:text-emerald-400">{c.onTime}</td>
                                        <td className="text-center px-3 py-2.5 text-orange-600 dark:text-orange-400">{c.late}</td>
                                        <td className="text-center px-3 py-2.5 text-red-600 dark:text-red-400">{c.breached}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ━━━ All Tasks SLA List ━━━ */}
            <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">All Tasks — SLA Status</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                                <th className="text-left px-4 py-2 font-medium">Task</th>
                                <th className="text-left px-3 py-2 font-medium">Assignee</th>
                                <th className="text-center px-3 py-2 font-medium">SLA</th>
                                <th className="text-center px-3 py-2 font-medium">Due</th>
                                <th className="text-center px-3 py-2 font-medium">Delay</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {tasks.map((t) => (
                                <tr key={t.id} onClick={() => navigate(`/task?id=${t.id}`)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                                    <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200 font-medium truncate max-w-48">{t.title}</td>
                                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 truncate max-w-32">{t.assignee?.name || "—"}</td>
                                    <td className="px-3 py-2.5 text-center"><SlaBadge status={t.slaStatus || "HEALTHY"} /></td>
                                    <td className="px-3 py-2.5 text-center text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {t.delayDays > 0 ? (
                                            <span className="text-xs font-bold text-red-600 dark:text-red-400">+{t.delayDays}d</span>
                                        ) : (
                                            <span className="text-xs text-zinc-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
