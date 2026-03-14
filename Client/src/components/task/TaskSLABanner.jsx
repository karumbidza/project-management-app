// FOLLO SRP
import { startOfDay, differenceInDays } from "date-fns";
import { Shield } from "lucide-react";

const TaskSLABanner = ({ task }) => {
    const slaStatus = task.slaStatus || 'HEALTHY';
    const dueRaw = task.dueDate || task.plannedEndDate;
    const todayD = startOfDay(new Date());
    const dueD = dueRaw ? startOfDay(new Date(dueRaw)) : null;
    const diff = dueD ? differenceInDays(dueD, todayD) : null;

    // Dynamic countdown label for HEALTHY
    let countdownLabel = 'On track';
    let countdownStyle = { bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400' };
    if (diff !== null) {
        if (diff > 1) {
            countdownLabel = `🟢 On track — ${diff} days remaining`;
        } else if (diff === 1) {
            countdownLabel = '🟡 Due tomorrow';
            countdownStyle = { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' };
        } else if (diff === 0) {
            countdownLabel = '🟡 Due today';
            countdownStyle = { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' };
        } else if (diff === -1) {
            countdownLabel = '🔴 1 day overdue';
            countdownStyle = { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 animate-pulse', text: 'text-red-700 dark:text-red-400' };
        } else {
            countdownLabel = `🔴 ${Math.abs(diff)} days overdue`;
            countdownStyle = { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 animate-pulse', text: 'text-red-700 dark:text-red-400' };
        }
    }

    const banners = {
        HEALTHY:          { ...countdownStyle, label: countdownLabel },
        AT_RISK:          { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', label: '⚠️ Due in less than 24 hours' },
        PENDING_APPROVAL: { bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', label: '⏳ Submitted — awaiting PM review' },
        BLOCKED:          { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', label: '🚧 Blocked — SLA clock paused' },
        BREACHED:         { bg: 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700 animate-pulse', text: 'text-red-800 dark:text-red-300', label: `🔴 OVERDUE — ${task.delayDays || 0} days past due` },
        RESOLVED_ON_TIME: { bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', label: '✅ Completed on time' },
        RESOLVED_LATE:    { bg: 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700', text: 'text-zinc-600 dark:text-zinc-400', label: `✓ Completed ${task.delayDays || 0} days late` },
    };
    const b = banners[slaStatus] || banners.HEALTHY;

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-md border ${b.bg}`}>
            <Shield className={`size-5 shrink-0 ${b.text}`} />
            <span className={`text-sm font-medium ${b.text}`}>{b.label}</span>
        </div>
    );
};

export default TaskSLABanner;
