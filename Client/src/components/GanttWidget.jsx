// FOLLO GANTT
// FOLLO GANTT-2
import { useMemo, useRef, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, addDays, startOfDay, parseISO } from "date-fns";
import { GanttChart, Calendar } from "lucide-react";

const STATUS_PILLS = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'active', label: 'Active' },
    { key: 'done', label: 'Done' },
];

const PROJECT_COLORS_HEX = [
    "#3b82f6", "#10b981", "#a855f7", "#f97316",
    "#ec4899", "#06b6d4", "#eab308", "#ef4444"
];

const DAY_WIDTH = 24;
const ROW_HEIGHT = 46;
const BAR_HEIGHT = 20;
const TASK_COL_WIDTH = 190;

// ─── GANTT CSS ANIMATIONS ──────────────
const WIDGET_GANTT_STYLE = `
@keyframes wg-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@keyframes wg-breathe {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
@keyframes wg-spill {
  0%   { width: 0px; opacity: 0; }
  100% { width: var(--spill-width); opacity: 0.9; }
}
@keyframes wg-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.5); }
}
`;

function getWidgetBarState(task) {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = task.dueDate ? new Date(task.dueDate) : null;
    // Use plannedStartDate, fall back to widget's computed startDate
    const rawStart = task.plannedStartDate || task.startDate;
    const start = rawStart ? new Date(rawStart) : null;
    if (start) start.setHours(0,0,0,0);
    const isDone = task.status === 'DONE';
    const isBlocked = task.slaStatus === 'BLOCKED' || task.status === 'BLOCKED';
    const isPending = task.slaStatus === 'PENDING_APPROVAL';
    // Auto-start: if planned start date has arrived and task is still TODO (no blocker), treat as active
    const autoStarted = task.status === 'TODO' && !isBlocked && !isPending && start && start <= today;
    const isActive = task.status === 'IN_PROGRESS' || autoStarted;
    const isTodo = task.status === 'TODO' && !autoStarted;
    const isOverdue = !isDone && due && due < today;
    const daysOverdue = isOverdue ? Math.floor((today - due) / 864e5) : 0;
    const daysUntilDue = due ? Math.floor((due - today) / 864e5) : null;
    const isAtRisk = isActive && daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 2 && !isOverdue;
    const hasStarted = !!task.actualStartDate || isActive || isDone;
    return { isDone, isBlocked, isActive, isPending, isTodo, isOverdue, isAtRisk, daysOverdue, daysUntilDue, hasStarted, autoStarted };
}

function getWidgetBarColor(state, projectColor) {
    if (state.isDone)    return '#16a34a';
    if (state.isBlocked) return '#d97706';
    if (state.isOverdue) return '#dc2626';
    if (state.isPending) return '#3b82f6';
    if (state.isAtRisk)  return '#f97316';
    if (state.isActive)  return projectColor || '#2563eb';
    return projectColor || '#94a3b8';
}

export default function GanttWidget() {
    const navigate = useNavigate();
    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);
    const projects = currentWorkspace?.projects || [];

    // Collect ALL tasks across all projects (no date filter — show historical + future)
    const { tasks, startDate, totalDays, days } = useMemo(() => {
        const today = startOfDay(new Date());

        const allTasks = [];
        projects.forEach((project, projectIndex) => {
            (project.tasks || []).forEach(task => {
                const parseDate = (d) => {
                    if (!d) return null;
                    try {
                        const date = typeof d === 'string' ? parseISO(d) : new Date(d);
                        return isNaN(date.getTime()) ? null : date;
                    } catch { return null; }
                };

                const taskStart = parseDate(task.plannedStartDate);
                const taskEnd = parseDate(task.plannedEndDate) || parseDate(task.dueDate);

                if (taskStart || taskEnd) {
                    allTasks.push({
                        ...task,
                        projectName: project.name,
                        projectId: project.id,
                        projectColorHex: PROJECT_COLORS_HEX[projectIndex % PROJECT_COLORS_HEX.length],
                        startDate: taskStart || addDays(taskEnd, -2),
                        endDate: taskEnd || addDays(taskStart, 2),
                    });
                }
            });
        });

        allTasks.sort((a, b) => a.startDate - b.startDate);

        // Dynamic date range: earliest task → latest task, with padding
        let minDate = today;
        let maxDate = addDays(today, 14);
        allTasks.forEach(t => {
            if (t.startDate < minDate) minDate = t.startDate;
            if (t.endDate > maxDate) maxDate = t.endDate;
        });
        const start = startOfDay(addDays(minDate, -7));
        const end = startOfDay(addDays(maxDate, 14));
        const numDays = differenceInDays(end, start) + 1;
        const daysArray = Array.from({ length: numDays }, (_, i) => startOfDay(addDays(start, i)));

        return { tasks: allTasks, startDate: start, totalDays: numDays, days: daysArray };
    }, [projects]);

    const scrollRef = useRef(null);
    const today = startOfDay(new Date());
    const todayOffset = Math.round((today - startDate) / 864e5) * DAY_WIDTH;
    const totalWidth = totalDays * DAY_WIDTH;

    // Scroll to today on mount
    useEffect(() => {
        if (scrollRef.current) {
            const scrollTarget = todayOffset - 200;
            scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
        }
    }, [todayOffset]);

    // FOLLO GANTT-2 — Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Unique project names for dropdown
    const uniqueProjects = useMemo(() => {
        const names = [...new Set(tasks.map(t => t.projectName).filter(Boolean))];
        names.sort();
        return names;
    }, [tasks]);

    // Filtered tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!task.title?.toLowerCase().includes(q) && !task.projectName?.toLowerCase().includes(q)) return false;
            }
            if (projectFilter && task.projectName !== projectFilter) return false;
            if (statusFilter !== 'all') {
                const state = getWidgetBarState(task);
                if (statusFilter === 'overdue' && !state.isOverdue) return false;
                if (statusFilter === 'blocked' && !state.isBlocked) return false;
                if (statusFilter === 'active' && !state.isActive) return false;
                if (statusFilter === 'done' && !state.isDone) return false;
            }
            return true;
        });
    }, [tasks, searchQuery, projectFilter, statusFilter]);

    const filterSummary = useMemo(() => {
        const overdue = filteredTasks.filter(t => getWidgetBarState(t).isOverdue).length;
        const blocked = filteredTasks.filter(t => getWidgetBarState(t).isBlocked).length;
        return { showing: filteredTasks.length, total: tasks.length, overdue, blocked };
    }, [filteredTasks, tasks]);

    const bodyHeight = filteredTasks.length * ROW_HEIGHT;

    if (tasks.length === 0) {
        return (
            <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-zinc-900 dark:text-white font-medium flex items-center gap-2">
                        <GanttChart className="size-4" />
                        Timeline Overview
                    </h3>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Calendar className="size-8 text-zinc-400 dark:text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-500">
                        No scheduled tasks found
                    </p>
                </div>
            </div>
        );
    }

    const MAX_SPILL_PX = DAY_WIDTH * 4;
    const HEADER_H = 44;

    return (
        <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <style dangerouslySetInnerHTML={{ __html: WIDGET_GANTT_STYLE }} />

            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
                <h3 className="text-zinc-900 dark:text-white font-medium flex items-center gap-2">
                    <GanttChart className="size-4" />
                    Timeline Overview
                </h3>
            </div>

            {/* ── FILTER BAR ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
                {/* Search */}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tasks…"
                    style={{ padding: '5px 10px', fontSize: 12, border: '0.5px solid var(--color-border-secondary, #d4d4d8)', borderRadius: 6, background: 'var(--color-background-secondary, #f4f4f5)', color: 'var(--color-text-primary, #18181b)', width: 160, outline: 'none' }}
                />

                {/* Project filter dropdown */}
                <select
                    value={projectFilter}
                    onChange={e => setProjectFilter(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, border: '0.5px solid var(--color-border-secondary, #d4d4d8)', borderRadius: 6, background: 'var(--color-background-secondary, #f4f4f5)', color: 'var(--color-text-primary, #18181b)', outline: 'none' }}
                >
                    <option value="">All projects</option>
                    {uniqueProjects.map(name => <option key={name} value={name}>{name}</option>)}
                </select>

                {/* Status pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {STATUS_PILLS.map(pill => (
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
            </div>

            {/* ── RESULTS SUMMARY ── */}
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', padding: '0 12px 8px' }}>
                Showing {filterSummary.showing} of {filterSummary.total} tasks
                {filterSummary.overdue > 0 && <> · {filterSummary.overdue} overdue</>}
                {filterSummary.blocked > 0 && <> · {filterSummary.blocked} blocked</>}
            </div>

            {/* Empty state when filters match nothing */}
            {filteredTasks.length === 0 && tasks.length > 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary, #a1a1aa)', fontSize: 13 }}>
                    No tasks match the current filters.
                    <button
                        onClick={() => { setSearchQuery(''); setProjectFilter(''); setStatusFilter('all'); }}
                        style={{ marginLeft: 8, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >
                        Clear filters
                    </button>
                </div>
            ) : (

            <div
                ref={scrollRef}
                style={{ maxHeight: 480, overflow: 'auto', position: 'relative' }}
            >
                {/* Inner content — full timeline width + task column */}
                <div style={{ width: TASK_COL_WIDTH + totalWidth, minHeight: HEADER_H + bodyHeight }}>

                    {/* ── HEADER ROW ── */}
                    <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20, height: HEADER_H }}>
                        {/* Corner cell: frozen left + sticky top */}
                        <div
                            className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-r border-zinc-200 dark:border-zinc-800"
                            style={{
                                width: TASK_COL_WIDTH, minWidth: TASK_COL_WIDTH,
                                position: 'sticky', left: 0, zIndex: 30,
                                display: 'flex', alignItems: 'flex-end', padding: '0 12px',
                            }}
                        >
                            <span className="text-[11px] font-medium tracking-wider text-zinc-400 dark:text-zinc-500 uppercase pb-2">Task</span>
                        </div>

                        {/* Day headers */}
                        <div
                            className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800"
                            style={{ display: 'flex', width: totalWidth }}
                        >
                            {days.map((day) => {
                                const isToday = differenceInDays(day, today) === 0;
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={`flex flex-col items-center justify-center text-[10px]
                                            ${isToday ? 'text-blue-500 font-bold' : isWeekend ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}
                                        style={{ width: DAY_WIDTH, flexShrink: 0 }}
                                    >
                                        <span>{format(day, "E").charAt(0)}</span>
                                        <span className={isToday ? 'bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]' : ''}>
                                            {format(day, "d")}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── BODY ROWS ── */}
                    <div style={{ position: 'relative' }}>
                        {/* Today line spanning all rows */}
                        {todayOffset >= 0 && todayOffset <= totalWidth && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: TASK_COL_WIDTH + todayOffset + DAY_WIDTH / 2,
                                    top: 0, width: '1.5px', background: '#2563eb', opacity: 0.2,
                                    height: bodyHeight, zIndex: 10, pointerEvents: 'none',
                                }}
                            >
                                <div style={{ position: 'absolute', top: bodyHeight + 4, left: -14, fontSize: 9, color: '#2563eb', fontWeight: 500 }}>TODAY</div>
                            </div>
                        )}

                        {filteredTasks.map((task) => {
                            const state = getWidgetBarState(task);
                            const barColor = getWidgetBarColor(state, task.projectColorHex);

                            const left = differenceInDays(task.startDate, startDate) * DAY_WIDTH;
                            const duration = differenceInDays(task.endDate, task.startDate) + 1;
                            const ghostWidth = Math.max(duration * DAY_WIDTH - 2, DAY_WIDTH - 2);
                            const todayX = todayOffset + DAY_WIDTH / 2;
                            const plannedEndX = Math.max(0, left) + ghostWidth;

                            const actualStartX = left;
                            const actualEndX = state.isDone
                                ? (task.completedAt ? differenceInDays(startOfDay(new Date(task.completedAt)), startDate) * DAY_WIDTH + DAY_WIDTH : plannedEndX)
                                : todayX;
                            const actualWidth = state.hasStarted ? Math.max(actualEndX - actualStartX, 0) : 0;

                            const rawSpill = state.isOverdue ? Math.max(todayX - plannedEndX, 0) : 0;
                            const clampedSpill = Math.min(rawSpill, MAX_SPILL_PX);

                            // Row styling per reference: rounded cards with state-based tinting
                            const rowBg = state.isOverdue ? '#fff5f5' : state.isBlocked ? '#fffbeb' : 'var(--color-background-secondary, #fafafa)';
                            const rowBorder = state.isOverdue ? '0.5px solid #fecaca' : state.isBlocked ? '0.5px solid #fde68a' : 'none';
                            const rowShadow = state.isBlocked ? '0 0 0 3px rgba(217,119,6,.08)' : undefined;
                            const subColor = state.isOverdue ? '#dc2626' : state.isBlocked ? '#d97706' : state.isDone ? '#16a34a' : state.isPending ? '#3b82f6' : undefined;

                            return (
                                <div
                                    key={task.id}
                                    style={{ display: 'flex', height: ROW_HEIGHT, borderRadius: 7, background: rowBg, border: rowBorder, boxShadow: rowShadow, marginBottom: 2, cursor: 'pointer' }}
                                    onClick={() => navigate(`/task?taskId=${task.id}&projectId=${task.projectId}`)}
                                >
                                    {/* Frozen task name cell */}
                                    <div
                                        className="bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800"
                                        style={{
                                            width: TASK_COL_WIDTH, minWidth: TASK_COL_WIDTH,
                                            position: 'sticky', left: 0, zIndex: 15,
                                            display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                            padding: '0 12px', overflow: 'hidden',
                                        }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {task.title}
                                        </div>
                                        <div style={{ fontSize: 10, marginTop: 1, color: subColor || 'var(--color-text-tertiary, #a1a1aa)' }}>
                                            {task.assignee?.name || task.assignee?.email || 'Unassigned'}
                                            {state.isOverdue && ` · ${state.daysOverdue}d overdue`}
                                            {state.isBlocked && ' · Blocked'}
                                            {state.isPending && ' · Awaiting approval'}
                                            {state.isDone && ' · Completed'}
                                            {state.isActive && state.daysUntilDue !== null && !state.isOverdue && ` · ${state.daysUntilDue}d left`}
                                        </div>
                                    </div>

                                    {/* Bar area cell */}
                                    <div
                                        style={{ position: 'relative', width: totalWidth, flexShrink: 0, height: ROW_HEIGHT, display: 'flex', alignItems: 'center' }}
                                    >
                                        {/* Today line inside row */}
                                        {todayOffset >= 0 && todayOffset <= totalWidth && (
                                            <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: '1.5px', background: state.isOverdue ? '#dc2626' : '#2563eb', opacity: state.isOverdue ? 0.35 : 0.2, zIndex: 4, pointerEvents: 'none' }} />
                                        )}

                                        {/* Ghost track */}
                                        <div
                                            style={{
                                                position: 'absolute', left: Math.max(0, left), width: ghostWidth,
                                                height: BAR_HEIGHT, background: 'var(--color-border-tertiary, #d4d4d8)', borderRadius: 3,
                                                opacity: state.isTodo ? 0.5 : undefined,
                                            }}
                                        />

                                        {/* Progress bar */}
                                        {(state.hasStarted || state.isOverdue) && (state.isOverdue ? ghostWidth : actualWidth) > 0 && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: state.isOverdue ? Math.max(0, left) : actualStartX, height: BAR_HEIGHT,
                                                    width: state.isOverdue ? ghostWidth : actualWidth,
                                                    background: state.isOverdue ? '#93c5fd' : barColor,
                                                    borderRadius: state.isOverdue ? '3px 0 0 3px' : 3,
                                                    overflow: 'hidden', pointerEvents: 'none',
                                                    opacity: state.isDone ? 0.9 : undefined,
                                                    animation: state.isBlocked ? 'wg-breathe 2s ease-in-out infinite' : undefined,
                                                }}
                                            >
                                                {state.isActive && !state.isOverdue && (
                                                    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
                                                        <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation: 'wg-shimmer 2s ease-in-out infinite' }} />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Spill bar (red overdue extension) */}
                                        {state.isOverdue && clampedSpill > 0 && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: plannedEndX, height: BAR_HEIGHT,
                                                    background: '#dc2626', borderRadius: '0 3px 3px 0',
                                                    pointerEvents: 'none',
                                                    '--spill-width': `${clampedSpill}px`,
                                                    animation: 'wg-spill 0.55s cubic-bezier(.34,1.56,.64,1) forwards',
                                                }}
                                            />
                                        )}

                                        {/* Pulse dot */}
                                        {(state.isActive || state.isBlocked) && !state.isOverdue && state.hasStarted && actualWidth > 0 && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    left: actualStartX + actualWidth - 4,
                                                    width: 8, height: 8,
                                                    background: state.isBlocked ? '#d97706' : '#2563eb',
                                                    borderRadius: '50%', zIndex: 2, pointerEvents: 'none',
                                                    boxShadow: state.isBlocked ? '0 0 0 3px rgba(217,119,6,.25)' : '0 0 0 3px rgba(37,99,235,.2)',
                                                    animation: 'wg-pulse 1.2s ease-in-out infinite',
                                                }}
                                            />
                                        )}

                                        {/* Inline status label */}
                                        {(() => {
                                            let label = null; let color = '#a1a1aa'; let bg;
                                            let x = Math.max(0, left) + ghostWidth + (state.isOverdue ? clampedSpill : 0) + 6;
                                            if (state.isDone) { label = '✓ done'; color = '#16a34a'; }
                                            else if (state.isOverdue) { label = `+${state.daysOverdue}d`; color = '#dc2626'; x = plannedEndX + clampedSpill + 6; }
                                            else if (state.isBlocked) { label = 'blocked'; color = '#d97706'; bg = '#fef3c7'; }
                                            else if (state.isAtRisk) { label = `${state.daysUntilDue}d left`; color = '#f97316'; }
                                            else if (state.isActive && state.daysUntilDue !== null) { label = `${state.daysUntilDue}d left`; }
                                            else if (state.isTodo && task.plannedStartDate) {
                                                const sd = new Date(task.plannedStartDate);
                                                label = `starts ${sd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                                            }
                                            return label ? (
                                                <div style={{ position: 'absolute', top: ROW_HEIGHT / 2 - 7, left: x, fontSize: 10, color, fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none', background: bg, padding: bg ? '1px 6px' : undefined, borderRadius: bg ? 3 : undefined }}>{label}</div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            )}

            {/* Status legend */}
            <div style={{ display: 'flex', gap: 16, padding: '12px 12px 10px', borderTop: '0.5px solid var(--color-border-tertiary, #e4e4e7)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: 'var(--color-border-secondary, #d4d4d8)', borderRadius: 2 }} />Scheduled
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: '#2563eb', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation: 'wg-shimmer 2s ease-in-out infinite' }} />
                    </div>Active
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: '#16a34a', borderRadius: 2 }} />Done
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ display: 'flex' }}>
                        <div style={{ width: 10, height: 8, borderRadius: '2px 0 0 2px', background: '#93c5fd' }} />
                        <div style={{ width: 12, height: 8, borderRadius: '0 2px 2px 0', background: '#dc2626', marginLeft: -1 }} />
                    </div>Overdue
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: '#d97706', borderRadius: 2, animation: 'wg-breathe 2s ease-in-out infinite' }} />Blocked
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: '#3b82f6', borderRadius: 2, opacity: 0.7 }} />Pending review
                </div>

            </div>
        </div>
    );
}
