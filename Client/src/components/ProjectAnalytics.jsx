// FOLLO FIX
// FOLLO WORKFLOW
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { CheckCircle, Clock, AlertTriangle, Users, ArrowRightIcon } from "lucide-react";

// Colors for charts and priorities
const PRIORITY_COLORS = {
    CRITICAL: "text-red-600 bg-red-200 dark:text-red-500 dark:bg-red-600",
    LOW: "text-green-600 bg-green-200 dark:text-green-500 dark:bg-green-600",
    MEDIUM: "text-yellow-600 bg-yellow-200 dark:text-yellow-500 dark:bg-yellow-600",
    HIGH: "text-orange-600 bg-orange-200 dark:text-orange-500 dark:bg-orange-600",
};

const ProjectAnalytics = ({ project, tasks }) => {
    const { stats, statusData, priorityData } = useMemo(() => {
        const now = new Date();
        const total = tasks.length;

        const stats = {
            total,
            completed: 0,
            inProgress: 0,
            todo: 0,
            overdue: 0,
        };

        const statusMap = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
        const priorityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

        tasks.forEach((t) => {
            if (t.status === "DONE") stats.completed++;
            if (t.status === "IN_PROGRESS") stats.inProgress++;
            if (t.status === "TODO") stats.todo++;
            if (new Date(t.due_date) < now && t.status !== "DONE") stats.overdue++;

            if (statusMap[t.status] !== undefined) statusMap[t.status]++;
            if (priorityMap[t.priority] !== undefined) priorityMap[t.priority]++;
        });

        return {
            stats,
            statusData: Object.entries(statusMap).map(([k, v]) => ({ name: k.replace("_", " "), value: v })),
            priorityData: Object.entries(priorityMap).map(([k, v]) => ({
                name: k,
                value: v,
                percentage: total > 0 ? Math.round((v / total) * 100) : 0,
            })),
        };
    }, [tasks]);

    const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

    const metrics = [
        {
            label: "Completion Rate",
            value: `${completionRate}%`,
            color: "text-emerald-600 dark:text-emerald-400",
            icon: <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />,
            bg: "bg-emerald-200 dark:bg-emerald-500/10",
        },
        {
            label: "Active Tasks",
            value: stats.inProgress,
            color: "text-blue-600 dark:text-blue-400",
            icon: <Clock className="size-5 text-blue-600 dark:text-blue-400" />,
            bg: "bg-blue-200 dark:bg-blue-500/10",
        },
        {
            label: "Overdue Tasks",
            value: stats.overdue,
            color: "text-red-600 dark:text-red-400",
            icon: <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />,
            bg: "bg-red-200 dark:bg-red-500/10",
        },
        {
            label: "Team Size",
            value: project?.members?.length || 0,
            color: "text-purple-600 dark:text-purple-400",
            icon: <Users className="size-5 text-purple-600 dark:text-purple-400" />,
            bg: "bg-purple-200 dark:bg-purple-500/10",
        },
    ];

    return (
        <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m) => (
                    <div
                        key={m.label}
                        className="not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-6"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm">{m.label}</p>
                                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                            </div>
                            <div className={`p-2 rounded-md ${m.bg}`}>{m.icon}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-1 gap-6">
                {/* Tasks by Status */}
                <div className="not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-6">
                    <h2 className="text-zinc-900 dark:text-white mb-4 font-medium">Tasks by Status</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={statusData}>
                            <XAxis
                                dataKey="name"
                                tick={{ fill: "#52525b", fontSize: 12 }}
                                axisLine={{ stroke: "#d4d4d8" }}
                                dark={{ stroke: "#27272a" }}
                            />
                            <YAxis tick={{ fill: "#52525b", fontSize: 12 }} axisLine={{ stroke: "#d4d4d8" }} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Priority Breakdown */}
            <div className="not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-6">
                <h2 className="text-zinc-900 dark:text-white mb-4 font-medium">Tasks by Priority</h2>
                <div className="space-y-4">
                    {priorityData.map((p) => (
                        <div key={p.name} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <ArrowRightIcon className={`size-3.5 ${PRIORITY_COLORS[p.name]} bg-transparent dark:bg-transparent`} />
                                    <span className="text-zinc-900 dark:text-zinc-200 capitalize">{p.name.toLowerCase()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-600 dark:text-zinc-400 text-sm">{p.value} tasks</span>
                                    <span className="px-2 py-0.5 border border-zinc-400 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                                        {p.percentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full bg-zinc-300 dark:bg-zinc-800 rounded-full h-1.5">
                                <div
                                    className={`h-1.5 rounded-full ${PRIORITY_COLORS[p.name]}`}
                                    style={{ width: `${p.percentage}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectAnalytics;
