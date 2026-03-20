// FOLLO GANTT
// FOLLO GANTT-2
// FOLLO FIX
// FOLLO PERMISSIONS
// FOLLO GANTT-FINAL
// FOLLO GANTT-DONE
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { StatusBadge, SmartTimeLabel } from './gantt/GanttHelpers';
import { getTimeOverdueShort, getTimeLeftShort } from '../lib/timeFormat';
import { calcTaskContribution } from '../lib/completionCalc';
import { useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, addDays, startOfDay } from "date-fns";
import { GripVertical, User, Calendar, ExternalLink, Lock, Search, Download, ChevronDown } from "lucide-react";
import { updateTaskAsync } from "../features/taskSlice";
import useUserRole from "../hooks/useUserRole";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ─── GANTT CSS ANIMATIONS (injected once) ──────────
const GANTT_STYLE = `
@keyframes gantt-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@keyframes gantt-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.5); }
}
@keyframes gantt-spill {
  0%   { width: 0px; opacity: 0; }
  100% { width: var(--spill-width); opacity: 0.9; }
}
@keyframes gantt-breathe {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
`;

// ─── PHASE 2: PURE HELPER FUNCTIONS ────────────────

function getTaskBarState(task, today = new Date()) {
    const due    = task.dueDate ? new Date(task.dueDate) : null;
    const actual = task.actualStartDate ? new Date(task.actualStartDate) : null;
    const start  = task.plannedStartDate ? new Date(task.plannedStartDate) : null;
    const t = new Date(today); t.setHours(0,0,0,0);
    if (start) start.setHours(0,0,0,0);

    const isDone    = task.status === 'DONE';
    const isBlocked = task.slaStatus === 'BLOCKED' || task.status === 'BLOCKED';
    const isPending = task.slaStatus === 'PENDING_APPROVAL';
    // Auto-start: if planned start date has arrived and task is still TODO (no blocker), treat as active
    const autoStarted = task.status === 'TODO' && !isBlocked && !isPending && start && start <= t;
    const isActive  = task.status === 'IN_PROGRESS' || autoStarted;
    const isTodo    = task.status === 'TODO' && !autoStarted;
    const isOverdue = !isDone && due && due < t;
    const daysOverdue = isOverdue ? Math.floor((t - due) / 864e5) : 0;
    const daysUntilDue = due ? Math.floor((due - t) / 864e5) : null;
    const isAtRisk = isActive && daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 2 && !isOverdue;

    return { isDone, isBlocked, isActive, isPending, isTodo, isOverdue, isAtRisk, daysOverdue, daysUntilDue, hasStarted: !!actual || isActive || isDone, autoStarted };
}

function getProgressBarColors(state) {
    if (state.isDone)    return { fill: '#16a34a', shimmer: false };
    if (state.isBlocked) return { fill: '#d97706', shimmer: false, breathe: true };
    if (state.isPending) return { fill: '#3b82f6', shimmer: false };
    if (state.isOverdue) return { fill: '#93c5fd', shimmer: false, spillColor: '#dc2626' };
    // isAtRisk does NOT change bar color — IN_PROGRESS stays blue regardless of days-until-due
    if (state.isActive)  return { fill: '#2563eb', shimmer: true };
    return { fill: 'transparent', shimmer: false };
}

// FOLLO GANTT-DONE
function getDoneState(task) {
  const planned      = task.dueDate ? new Date(task.dueDate) : null;
  const completedRaw = task.actualEndDate ?? task.updatedAt;
  const completed    = completedRaw ? new Date(completedRaw) : null;

  if (!planned || !completed) {
    return { type: 'on-time', daysEarly: 0, daysLate: 0, completedAt: completed };
  }

  const plannedDay   = new Date(planned);   plannedDay.setHours(0,0,0,0);
  const completedDay = new Date(completed); completedDay.setHours(0,0,0,0);
  const diffDays     = Math.round((completedDay - plannedDay) / 86400000);

  if (diffDays <= 0) {
    return { type: diffDays < -1 ? 'early' : 'on-time', daysEarly: Math.abs(diffDays), daysLate: 0, completedAt: completed };
  }
  return { type: 'late', daysEarly: 0, daysLate: diffDays, completedAt: completed };
}

// ─── LEGACY CONSTANTS (kept for reference / selected panel) ─
const STATUS_COLORS = {
    TODO: { bg: "bg-zinc-500/20", border: "border-zinc-500", text: "text-zinc-400" },
    IN_PROGRESS: { bg: "bg-blue-500/20", border: "border-blue-500", text: "text-blue-400" },
    PENDING_APPROVAL: { bg: "bg-purple-500/20", border: "border-purple-500", text: "text-purple-400" },
    BLOCKED: { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400" },
    DONE: { bg: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-400" },
};

const SLA_COLORS = {
    HEALTHY:          { bg: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-400", arrow: "#10b981" },
    AT_RISK:          { bg: "bg-amber-500/20",   border: "border-amber-500",   text: "text-amber-400",   arrow: "#f59e0b" },
    PENDING_APPROVAL: { bg: "bg-purple-500/20",  border: "border-purple-500",  text: "text-purple-400",  arrow: "#a855f7" },
    BLOCKED:          { bg: "bg-red-500/20",     border: "border-red-500",     text: "text-red-400",     arrow: "#ef4444" },
    BREACHED:         { bg: "bg-red-600/25",     border: "border-red-600",     text: "text-red-300",     arrow: "#dc2626", pulse: true },
    RESOLVED_ON_TIME: { bg: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-400", arrow: "#10b981" },
    RESOLVED_LATE:    { bg: "bg-orange-500/20",  border: "border-orange-500",  text: "text-orange-400",  arrow: "#f97316" },
};

const PRIORITY_INDICATORS = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-zinc-500",
};

const ROW_HEIGHT = 54;   // FOLLO GANTT-DONE: matched to GanttWidget (was 46)
const HEADER_H = 44;     // FOLLO GANTT-DONE: matched to GanttWidget (was HEADER_HEIGHT = 40)
const LEFT_COL = 160;    // FOLLO GANTT-DONE: matched to GanttWidget (was 200)
const BAR_H = 14;
const MAX_SPILL_COLS = 5;

// FOLLO GANTT-2 — Scale definitions (Phase 8)
const SCALES = {
    day:   { colWidth: 36,  days: 1 },
    week:  { colWidth: 120, days: 7 },
    month: { colWidth: 200, days: 30 },
};

function getWeekNum(d) {
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

// FOLLO GANTT-2 — Status filter pills
const STATUS_PILLS = [
    { key: 'all',     label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'active',  label: 'Active' },
    { key: 'done',    label: 'Done' },
];

// 6E — Check if a task is "locked" (has unresolved predecessors)
const isTaskLocked = (task, taskMap) => {
    if (!task.predecessors || task.predecessors.length === 0) return false;
    return task.predecessors.some(dep => {
        const pred = dep.predecessor || taskMap.get(dep.predecessorId);
        return pred && pred.status !== "DONE";
    });
};

// Pick the right color set for selected task panel: SLA status takes priority
const getLegacyBarColors = (task) => {
    if (task.slaStatus && SLA_COLORS[task.slaStatus]) return SLA_COLORS[task.slaStatus];
    return STATUS_COLORS[task.status] || STATUS_COLORS.TODO;
};

export default function ProjectGantt({ tasks, project }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const scrollRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const dragStartRef = useRef(null);
    const { canCreateTasks } = useUserRole();

    // FOLLO GANTT-2 — Filter bar state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [scaleMode, setScaleMode] = useState('day');
    const [exporting, setExporting] = useState(false);
    const [visibleCount, setVisibleCount] = useState(50);
    const ganttRef = useRef(null);

    // FOLLO GANTT-2 — Dynamic column width from scale
    const DAY_WIDTH = SCALES[scaleMode].colWidth / SCALES[scaleMode].days;

    // Build lookup map for tasks by id
    const taskMap = useMemo(() => {
        const map = new Map();
        tasks.forEach(t => map.set(t.id, t));
        return map;
    }, [tasks]);

    // FOLLO GANTT-2 — Filtered tasks
    const filteredTasks = useMemo(() => {
        const now = new Date(); now.setHours(0,0,0,0);
        return tasks.filter(task => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchTitle = task.title?.toLowerCase().includes(q);
                const matchAssignee = `${task.assignee?.firstName || task.assignee?.name || ''} ${task.assignee?.lastName || ''}`
                    .toLowerCase().includes(q);
                if (!matchTitle && !matchAssignee) return false;
            }
            if (statusFilter !== 'all') {
                const state = getTaskBarState(task, now);
                if (statusFilter === 'overdue' && !state.isOverdue) return false;
                if (statusFilter === 'blocked' && !state.isBlocked) return false;
                if (statusFilter === 'active' && !state.isActive) return false;
                if (statusFilter === 'done' && !state.isDone) return false;
            }
            return true;
        });
    }, [tasks, searchQuery, statusFilter]);

    // FOLLO GANTT-2 — Virtual scroll
    const visibleTasks = filteredTasks.slice(0, visibleCount);

    // FOLLO GANTT-2 — Filter summary
    const filterSummary = useMemo(() => {
        const now = new Date(); now.setHours(0,0,0,0);
        const overdue = filteredTasks.filter(t => getTaskBarState(t, now).isOverdue).length;
        const blocked = filteredTasks.filter(t => getTaskBarState(t, now).isBlocked).length;
        return { showing: filteredTasks.length, total: tasks.length, overdue, blocked };
    }, [filteredTasks, tasks]);

    // Calculate timeline bounds
    const { startDate, endDate, totalDays } = useMemo(() => {
        const today = startOfDay(new Date());
        let minDate = today;
        let maxDate = addDays(today, 30);

        tasks.forEach(task => {
            const taskStart = task.plannedStartDate ? startOfDay(new Date(task.plannedStartDate)) : null;
            const taskEnd = task.plannedEndDate ? startOfDay(new Date(task.plannedEndDate)) : 
                           task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
            
            if (taskStart && taskStart < minDate) minDate = taskStart;
            if (taskEnd && taskEnd > maxDate) maxDate = taskEnd;
        });

        // Add padding
        minDate = addDays(minDate, -7);
        maxDate = addDays(maxDate, 14);

        return {
            startDate: minDate,
            endDate: maxDate,
            totalDays: differenceInDays(maxDate, minDate) + 1
        };
    }, [tasks]);

    // Generate days array for header
    const days = useMemo(() => {
        return Array.from({ length: totalDays }, (_, i) => addDays(startDate, i));
    }, [startDate, totalDays]);

    // FOLLO GANTT-2 — Scale columns for week/month modes
    const scaleColumns = useMemo(() => {
        if (scaleMode === 'day') return [];
        const step = SCALES[scaleMode].days;
        const cols = [];
        for (let i = 0; i < totalDays; i += step) {
            const d = addDays(startDate, i);
            const span = Math.min(step, totalDays - i);
            cols.push({
                key: d.toISOString(),
                label: scaleMode === 'week'
                    ? `W${getWeekNum(d)}`
                    : d.toLocaleString('default', { month: 'short', year: '2-digit' }),
                width: span * DAY_WIDTH,
            });
        }
        return cols;
    }, [scaleMode, totalDays, startDate, DAY_WIDTH]);

    // Group days by month for header
    // Scroll to today on mount
    useEffect(() => {
        if (scrollRef.current) {
            const today = startOfDay(new Date());
            const todayOffset = differenceInDays(today, startDate) * DAY_WIDTH;
            scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200);
        }
    }, [startDate]);

    // Calculate task bar position
    const getTaskPosition = (task) => {
        const taskStart = task.plannedStartDate ? startOfDay(new Date(task.plannedStartDate)) : 
                         task.dueDate ? addDays(startOfDay(new Date(task.dueDate)), -3) : startOfDay(new Date());
        const taskEnd = task.plannedEndDate ? startOfDay(new Date(task.plannedEndDate)) : 
                       task.dueDate ? startOfDay(new Date(task.dueDate)) : addDays(taskStart, 3);
        
        const left = differenceInDays(taskStart, startDate) * DAY_WIDTH;
        const width = Math.max((differenceInDays(taskEnd, taskStart) + 1) * DAY_WIDTH - 4, DAY_WIDTH);
        
        return { left, width, taskStart, taskEnd };
    };

    // Handle drag start
    const handleMouseDown = (e, task, type) => {
        // FOLLO PERMISSIONS — Members cannot drag/resize
        if (!canCreateTasks) {
            toast.error('Only project managers can reschedule tasks');
            return;
        }
        // 6E — Prevent dragging locked tasks
        if (isTaskLocked(task, taskMap)) {
            toast.error("Unlock dependencies first");
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const { taskStart, taskEnd } = getTaskPosition(task);
        dragStartRef.current = { 
            x: e.clientX, 
            task: { ...task, startDate: taskStart, endDate: taskEnd },
            type 
        };
        setDragging({ taskId: task.id, type });
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    // Handle drag move
    const handleMouseMove = (e) => {
        if (!dragStartRef.current) return;
        const dx = e.clientX - dragStartRef.current.x;
        const daysDelta = Math.round(dx / DAY_WIDTH);
        
        if (daysDelta === 0) return;

        const { task, type } = dragStartRef.current;
        let newStart = task.startDate;
        let newEnd = task.endDate;

        if (type === "move") {
            newStart = addDays(task.startDate, daysDelta);
            newEnd = addDays(task.endDate, daysDelta);
        } else if (type === "resize-right") {
            newEnd = addDays(task.endDate, daysDelta);
            if (newEnd <= newStart) return;
        } else if (type === "resize-left") {
            newStart = addDays(task.startDate, daysDelta);
            if (newStart >= newEnd) return;
        }

        // Update the visual immediately (optimistic update)
        dragStartRef.current.newStart = newStart;
        dragStartRef.current.newEnd = newEnd;
    };

    // Handle drag end
    const handleMouseUp = async () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        if (dragStartRef.current?.newStart || dragStartRef.current?.newEnd) {
            const { task, newStart, newEnd } = dragStartRef.current;
            
            try {
                await dispatch(updateTaskAsync({
                    taskId: task.id,
                    taskData: {
                        plannedStartDate: newStart?.toISOString(),
                        plannedEndDate: newEnd?.toISOString(),
                    },
                    getToken,
                })).unwrap();
                toast.success("Task dates updated");
            } catch (error) {
                toast.error("Failed to update task dates");
            }
        }

        dragStartRef.current = null;
        setDragging(null);
    };

    // FOLLO GANTT-2 — Export PNG
    const exportPNG = async () => {
        if (!ganttRef.current) return;
        setExporting(true);
        try {
            const canvas = await html2canvas(ganttRef.current, {
                scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
            });
            const link = document.createElement('a');
            const projName = project?.name ?? 'gantt';
            const d = new Date().toISOString().split('T')[0];
            link.download = `${projName}-gantt-${d}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('[Gantt] PNG export failed:', err);
            toast.error('Export failed — please try again');
        } finally {
            setExporting(false);
        }
    };

    // FOLLO GANTT-2 — Export PDF
    const exportPDF = async () => {
        if (!ganttRef.current) return;
        setExporting(true);
        try {
            const canvas = await html2canvas(ganttRef.current, {
                scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = 12;
            const usableW = pageW - margin * 2;
            const imgW = canvas.width;
            const imgH = canvas.height;
            const ratio = usableW / imgW;
            const scaledH = imgH * ratio;
            const projName = project?.name ?? 'Project';
            const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${projName} — Gantt Chart`, margin, margin - 2);
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(120, 120, 120);
            pdf.text(`Exported ${dateStr}`, margin, margin + 4);
            pdf.setTextColor(0, 0, 0);

            let yOffset = margin + 10;
            if (scaledH + yOffset <= pageH - margin) {
                pdf.addImage(imgData, 'PNG', margin, yOffset, usableW, scaledH);
            } else {
                const pageImgH = (pageH - yOffset - margin) / ratio;
                let srcY = 0;
                let page = 0;
                while (srcY < imgH) {
                    if (page > 0) { pdf.addPage(); yOffset = margin; }
                    const sliceH = Math.min(pageImgH, imgH - srcY);
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = imgW;
                    sliceCanvas.height = sliceH;
                    sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, imgW, sliceH, 0, 0, imgW, sliceH);
                    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, yOffset, usableW, sliceH * ratio);
                    srcY += sliceH;
                    page++;
                }
            }

            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text(`${projName} · follo.app · Page ${i} of ${totalPages}`, pageW / 2, pageH - 5, { align: 'center' });
            }

            const d2 = new Date().toISOString().split('T')[0];
            pdf.save(`${projName}-gantt-${d2}.pdf`);
        } catch (err) {
            console.error('[Gantt] PDF export failed:', err);
            toast.error('Export failed — please try again');
        } finally {
            setExporting(false);
        }
    };

    const today = startOfDay(new Date());
    const todayOffset = differenceInDays(today, startDate) * DAY_WIDTH;
    const totalWidth = totalDays * DAY_WIDTH;

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="size-12 text-zinc-400 dark:text-zinc-600 mb-4" />
                <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No tasks yet</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                    Create tasks to see them in the Gantt chart
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Inject gantt animations */}
            <style dangerouslySetInnerHTML={{ __html: GANTT_STYLE }} />

            {/* ── FILTER BAR (matches reference exactly) ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', flexWrap: 'wrap' }}>
                {/* Search */}
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search tasks…"
                    style={{ padding: '5px 10px', fontSize: 12, border: '0.5px solid var(--color-border-secondary, #d4d4d8)', borderRadius: 6, background: 'var(--color-background-secondary, #f4f4f5)', color: 'var(--color-text-primary, #18181b)', width: 160, outline: 'none' }}
                />

                {/* Status pills — rounded pill shape */}
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

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Scale toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <span>Scale:</span>
                    {['day', 'week', 'month'].map(s => (
                        <button
                            key={s}
                            onClick={() => setScaleMode(s)}
                            style={{
                                padding: '4px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                                border: scaleMode === s ? 'none' : '0.5px solid var(--color-border-secondary, #d4d4d8)',
                                background: scaleMode === s ? 'var(--color-text-primary, #18181b)' : 'var(--color-background-primary, #fff)',
                                color: scaleMode === s ? 'var(--color-background-primary, #fff)' : 'var(--color-text-secondary, #71717a)',
                                fontWeight: scaleMode === s ? 600 : 400, textTransform: 'capitalize', transition: 'all .15s',
                            }}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Export buttons */}
                {/* PNG button — FOLLO GANTT-DONE: transparent bg matching GanttWidget */}
                <button
                    onClick={exportPNG}
                    disabled={exporting}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', fontSize: 11, borderRadius: 6,
                        border: '0.5px solid var(--color-border-secondary, #d4d4d8)',
                        background: 'transparent', cursor: 'pointer',
                        color: 'var(--color-text-secondary, #71717a)',
                        opacity: exporting ? 0.5 : 1,
                    }}
                >
                    <Download size={12} /> PNG
                </button>
                {/* PDF button — FOLLO GANTT-DONE: blue bg, white text, no border */}
                <button
                    onClick={exportPDF}
                    disabled={exporting}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', fontSize: 11, borderRadius: 6,
                        border: 'none', background: '#2563eb', cursor: 'pointer',
                        color: '#fff',
                        opacity: exporting ? 0.5 : 1,
                    }}
                >
                    <Download size={12} /> PDF
                </button>
            </div>

            {/* ── RESULTS SUMMARY ── */}
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', padding: '0 12px 8px' }}>
                Showing {filterSummary.showing} of {filterSummary.total} tasks
                {filterSummary.overdue > 0 && <> · {filterSummary.overdue} overdue</>}
                {filterSummary.blocked > 0 && <> · {filterSummary.blocked} blocked</>}
            </div>

            {/* Empty state */}
            {filteredTasks.length === 0 && tasks.length > 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary, #a1a1aa)', fontSize: 13 }}>
                    No tasks match the current filters.
                    <button
                        onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                        style={{ marginLeft: 8, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >
                        Clear filters
                    </button>
                </div>
            ) : (

            <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            <div ref={ganttRef} id="gantt-export-area" style={{ minWidth: totalWidth + LEFT_COL, width: '100%' }}>

            {/* ── DATE HEADER (flex: frozen corner + timeline) — FOLLO GANTT-DONE: matches GanttWidget ── */}
            <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20, height: HEADER_H }}>
                {/* Corner cell: frozen left + sticky top */}
                <div
                    className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-r border-zinc-200 dark:border-zinc-800"
                    style={{
                        width: LEFT_COL, minWidth: LEFT_COL,
                        position: 'sticky', left: 0, zIndex: 30,
                        display: 'flex', alignItems: 'flex-end', padding: '0 12px',
                    }}
                >
                    <span style={{ fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', letterSpacing: '.05em', paddingBottom: 4 }}>TASK / ASSIGNEE</span>
                </div>

                {/* Day/Week/Month header cells */}
                <div
                    className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800"
                    style={{ display: 'flex', flex: 1, minWidth: totalWidth }}
                >
                    {scaleMode === 'day' ? days.map(day => {
                        const isToday = differenceInDays(day, today) === 0;
                        return (
                            <div
                                key={day.toISOString()}
                                style={{
                                    flex: `0 0 ${DAY_WIDTH}px`, textAlign: 'center', fontSize: 10,
                                    color: isToday ? 'var(--color-text-secondary, #52525b)' : 'var(--color-text-tertiary, #a1a1aa)',
                                    fontWeight: isToday ? 500 : 400,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                {format(day, 'MMM d')}
                            </div>
                        );
                    }) : scaleColumns.map(col => (
                        <div
                            key={col.key}
                            style={{
                                flex: `0 0 ${col.width}px`, textAlign: 'center', fontSize: 10,
                                color: 'var(--color-text-tertiary, #a1a1aa)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {col.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── GANTT BODY (flat grid rows) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
                {visibleTasks.map((task) => {
                    const { left: plannedStartX, width: plannedWidth } = getTaskPosition(task);
                    const isDragging = dragging?.taskId === task.id;
                    const locked = isTaskLocked(task, taskMap);

                    const state  = getTaskBarState(task, today);
                    const colors = getProgressBarColors(state);

                    // FOLLO GANTT-DONE — compute done state for three-state rendering
                    const doneInfo = state.isDone ? getDoneState(task) : null;

                    // Actual progress bar extents
                    const actualStartX = task.actualStartDate
                        ? differenceInDays(startOfDay(new Date(task.actualStartDate)), startDate) * DAY_WIDTH
                        : plannedStartX;
                    const todayX = todayOffset + DAY_WIDTH / 2;
                    const plannedEndX = plannedStartX + plannedWidth;

                    // FOLLO GANTT-DONE — for done tasks use actualEndDate ?? updatedAt as completion point
                    const doneCompletedX = (state.isDone && doneInfo?.completedAt)
                        ? differenceInDays(startOfDay(doneInfo.completedAt), startDate) * DAY_WIDTH + DAY_WIDTH
                        : plannedEndX;

                    const actualEndX = state.isDone
                        ? doneCompletedX
                        : todayX;
                    const actualWidth = Math.max(actualEndX - actualStartX, 0);

                    const rawSpillWidth = state.isOverdue ? Math.max(todayX - plannedEndX, 0) : 0;
                    const clampedSpillWidth = Math.min(rawSpillWidth, DAY_WIDTH * MAX_SPILL_COLS);

                    // FOLLO GANTT-DONE — done-late: extension bar from dueDate → completedAt
                    const doneLateSpillWidth = (state.isDone && doneInfo?.type === 'late')
                        ? Math.max(0, Math.min(doneCompletedX - plannedEndX, totalWidth - plannedEndX))
                        : 0;

                    // Normal rows (no special tint) use same bg as header for consistency
                    const hasTint = state.isOverdue || state.isBlocked
                        || (state.isDone && doneInfo?.type === 'late')
                        || (state.isDone && doneInfo?.type === 'early');
                    const tintBg = state.isOverdue ? '#fff5f5'
                        : state.isBlocked ? '#fffbeb'
                        : (state.isDone && doneInfo?.type === 'late') ? '#fff7f7'
                        : '#f0fdf4';

                    // Row styling per reference — FOLLO GANTT-DONE adds done-early/late tinting
                    const rowStyle = {
                        display: 'grid', gridTemplateColumns: `${LEFT_COL}px 1fr`, alignItems: 'stretch',
                        height: ROW_HEIGHT, borderRadius: 7,
                        background: hasTint ? tintBg : '#fafafa',
                        border: state.isOverdue ? '0.5px solid #fecaca'
                            : state.isBlocked ? '0.5px solid #fde68a'
                            : (state.isDone && doneInfo?.type === 'late') ? '0.5px solid #fecaca'
                            : (state.isDone && doneInfo?.type === 'early') ? '0.5px solid #bbf7d0'
                            : 'none',
                        boxShadow: state.isBlocked ? '0 0 0 3px rgba(217,119,6,.08)' : undefined,
                        cursor: 'pointer',
                    };

                    return (
                        <div
                            key={task.id}
                            style={rowStyle}
                            onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                        >
                            {/* LEFT COLUMN: frozen, solid bg so scrolled bars don't show through */}
                            <div
                                className="border-r border-zinc-200 dark:border-zinc-800"
                                style={{
                                    padding: '0 12px', overflow: 'hidden',
                                    position: 'sticky', left: 0, zIndex: 10,
                                    width: LEFT_COL, minWidth: LEFT_COL,
                                    display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                    background: 'var(--color-background-secondary, #f4f4f5)',
                                }}
                                title={task.status !== 'DONE' ? `Completing this task adds ${calcTaskContribution(task, tasks)}% to project progress` : undefined}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {task.title}
                                    </div>
                                    <StatusBadge status={task.status} slaStatus={task.slaStatus} />
                                </div>
                                <div style={{ fontSize: 10, marginTop: 2, color: state.isOverdue ? '#dc2626' : state.isBlocked ? '#d97706' : state.isDone ? '#16a34a' : 'var(--color-text-tertiary, #a1a1aa)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.assignee?.name || task.assignee?.firstName || task.assignee?.email || 'Unassigned'}
                                    </span>
                                    <SmartTimeLabel task={task} state={state} />
                                </div>
                                {/* FOLLO GANTT-DONE — project name line removed: single-project view, not needed */}
                            </div>

                            {/* RIGHT COLUMN: timeline area */}
                            <div style={{ position: 'relative', height: ROW_HEIGHT, display: 'flex', alignItems: 'center' }}>
                                {/* Today line inside row */}
                                {todayOffset >= 0 && todayOffset <= totalWidth && (
                                    <div style={{ position: 'absolute', left: todayOffset + DAY_WIDTH / 2, top: 0, bottom: 0, width: '1.5px', background: state.isOverdue ? '#dc2626' : '#2563eb', opacity: state.isOverdue ? 0.35 : 0.3, zIndex: 4, pointerEvents: 'none' }} />
                                )}

                                {/* Ghost track (scheduled bar) — FOLLO GANTT-DONE: always show for done tasks */}
                                {task.plannedStartDate && task.dueDate && (
                                    <div
                                        style={{
                                            position: 'absolute', left: Math.max(0, plannedStartX), width: plannedWidth,
                                            height: BAR_H,
                                            background: 'var(--color-border-tertiary, #d4d4d8)', borderRadius: 3,
                                            opacity: state.isTodo ? 0.5 : state.isDone ? 0.4 : undefined,
                                            cursor: !locked && canCreateTasks ? 'grab' : 'default',
                                        }}
                                        className={isDragging ? 'cursor-grabbing shadow-lg' : ''}
                                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task, 'move'); }}
                                    >
                                        {!locked && canCreateTasks && (
                                            <>
                                                <div style={{ position: 'absolute', left: 0, top: 0, width: 6, height: '100%', cursor: 'ew-resize', borderRadius: '3px 0 0 3px' }}
                                                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task, 'resize-left'); }} />
                                                <div style={{ position: 'absolute', right: 0, top: 0, width: 6, height: '100%', cursor: 'ew-resize', borderRadius: '0 3px 3px 0' }}
                                                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task, 'resize-right'); }} />
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* FOLLO GANTT-DONE — three-state DONE bar rendering */}
                                {state.isDone && doneInfo ? (() => {
                                    if (doneInfo.type === 'late') {
                                        // Late: blue planned bar + red extension to completedAt
                                        const barLeft = Math.max(0, actualStartX);
                                        const barWidth = Math.max(plannedEndX - barLeft, 0);
                                        return (
                                            <>
                                                <div style={{ position: 'absolute', left: barLeft, width: barWidth, height: BAR_H, background: '#93c5fd', borderRadius: '3px 0 0 3px', pointerEvents: 'none', opacity: 0.9 }} />
                                                {doneLateSpillWidth > 0 && (
                                                    <div style={{ position: 'absolute', left: plannedEndX, width: doneLateSpillWidth, height: BAR_H, background: '#dc2626', borderRadius: '0 3px 3px 0', pointerEvents: 'none', opacity: 0.85 }} />
                                                )}
                                            </>
                                        );
                                    }
                                    // On-time or early: solid green bar from actualStartX → completedAt (or plannedEndX for on-time)
                                    const barLeft = Math.max(0, actualStartX);
                                    const barRight = doneInfo.type === 'early' ? Math.min(doneCompletedX, plannedEndX) : plannedEndX;
                                    const barWidth = Math.max(barRight - barLeft, 0);
                                    return (
                                        <div style={{ position: 'absolute', left: barLeft, width: barWidth, height: BAR_H, background: '#16a34a', borderRadius: 3, pointerEvents: 'none', opacity: 0.9 }} />
                                    );
                                })() : null}

                                {/* Progress bar (blue / green / amber) — for non-DONE tasks */}
                                {!state.isDone && (state.hasStarted || state.isOverdue) && (state.isOverdue ? plannedWidth : actualWidth) > 0 && (
                                    <div
                                        style={{
                                            position: 'absolute', left: state.isOverdue ? Math.max(0, plannedStartX) : actualStartX,
                                            width: state.isOverdue ? plannedWidth : actualWidth,
                                            height: BAR_H, background: colors.fill,
                                            borderRadius: state.isOverdue ? '3px 0 0 3px' : 3,
                                            overflow: 'hidden', pointerEvents: 'none',
                                            animation: colors.breathe ? 'gantt-breathe 2s ease-in-out infinite' : undefined,
                                        }}
                                    >
                                        {colors.shimmer && (
                                            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation: 'gantt-shimmer 2s ease-in-out infinite' }} />
                                            </div>
                                        )}
                                        {/* Completion % overlay for IN_PROGRESS tasks with completionWeight */}
                                        {state.isActive && task.completionWeight > 0 && (
                                            <div style={{
                                                position: 'absolute', left: 0, top: 0, height: '100%',
                                                width: `${Math.min(100, task.completionWeight)}%`,
                                                background: 'rgba(0,0,0,0.18)', borderRadius: 'inherit', pointerEvents: 'none',
                                            }} />
                                        )}
                                    </div>
                                )}

                                {/* Overdue spill (red extension) — non-DONE only */}
                                {!state.isDone && state.isOverdue && clampedSpillWidth > 0 && (
                                    <div style={{
                                        position: 'absolute', left: plannedEndX, height: BAR_H,
                                        background: '#dc2626', borderRadius: '0 3px 3px 0', pointerEvents: 'none',
                                        '--spill-width': `${clampedSpillWidth}px`,
                                        animation: 'gantt-spill 0.55s cubic-bezier(.34,1.56,.64,1) forwards',
                                    }} />
                                )}

                                {/* Pulse dot (active / blocked frontier) */}
                                {(state.isActive || state.isBlocked) && !state.isOverdue && state.hasStarted && actualWidth > 0 && (
                                    <div style={{
                                        position: 'absolute', left: actualStartX + actualWidth - 4,
                                        width: 8, height: 8,
                                        background: state.isBlocked ? '#d97706' : '#2563eb',
                                        borderRadius: '50%', zIndex: 2, pointerEvents: 'none',
                                        boxShadow: state.isBlocked ? '0 0 0 3px rgba(217,119,6,.25)' : '0 0 0 3px rgba(37,99,235,.2)',
                                        animation: 'gantt-pulse 1.2s ease-in-out infinite',
                                    }} />
                                )}

                                {/* Baseline marker */}
                                {task.baselineDueDate && task.dueDate &&
                                 Math.abs(new Date(task.baselineDueDate) - new Date(task.dueDate)) > 86400000 && (
                                    <div title={`Original due: ${new Date(task.baselineDueDate).toLocaleDateString()}`}
                                        style={{ position: 'absolute', left: differenceInDays(startOfDay(new Date(task.baselineDueDate)), startDate) * DAY_WIDTH, top: '50%', transform: 'translateY(-50%)', width: 2, height: 14, background: 'var(--color-text-tertiary, #a1a1aa)', opacity: 0.35, borderRadius: 1, zIndex: 1, pointerEvents: 'none' }} />
                                )}

                                {/* FOLLO GANTT-DONE — Inline status label with three-state done support */}
                                {(() => {
                                    let label = null;
                                    let color = '#a1a1aa';
                                    let bg = undefined;
                                    // For done-late: label after red extension bar
                                    // For done-early/on-time: label after green bar
                                    // For overdue: label after spill bar; others: after actual bar
                                    let x = state.isOverdue
                                        ? plannedEndX + clampedSpillWidth + 6
                                        : actualStartX + actualWidth + 8;

                                    if (state.isDone && doneInfo) {
                                        if (doneInfo.type === 'on-time') {
                                            label = '✓'; color = '#16a34a';
                                            x = plannedEndX + 6;
                                        } else if (doneInfo.type === 'early') {
                                            const d = doneInfo.daysEarly;
                                            const lbl = d >= 7 ? `${Math.floor(d/7)}w early` : `${d}d early`;
                                            label = `✓ ${lbl}`; color = '#16a34a';
                                            x = Math.min(doneCompletedX, plannedEndX) + 6;
                                        } else {
                                            // late
                                            const d = doneInfo.daysLate;
                                            const lbl = d >= 7 ? `${Math.floor(d/7)}w late` : `${d}d late`;
                                            label = `✓ +${lbl}`; color = '#dc2626';
                                            x = plannedEndX + doneLateSpillWidth + 6;
                                        }
                                    } else if (state.isBlocked) { label = 'blocked'; color = '#d97706'; bg = '#fef3c7'; }
                                    else if (state.isPending) { label = 'awaiting approval'; color = '#3b82f6'; }
                                    else if (state.isOverdue) { label = getTimeOverdueShort(task.dueDate); color = '#dc2626'; }
                                    else if (state.isAtRisk)  { label = getTimeLeftShort(task.dueDate); /* bar is blue; label uses default gray */ }
                                    else if (state.isActive && state.daysUntilDue !== null) { label = getTimeLeftShort(task.dueDate); }
                                    else if (state.isTodo && task.plannedStartDate) {
                                        const sd = new Date(task.plannedStartDate);
                                        label = `starts ${sd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                                    }

                                    return label ? (
                                        <div style={{
                                            position: 'absolute', top: ROW_HEIGHT / 2 - 7, left: x,
                                            fontSize: 10, color, fontWeight: 500, whiteSpace: 'nowrap', pointerEvents: 'none',
                                            background: bg, padding: bg ? '1px 6px' : undefined, borderRadius: bg ? 3 : undefined,
                                            zIndex: 5,
                                        }}>
                                            {label}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        </div>
                    );
                })}

                {/* Load more */}
                {filteredTasks.length > visibleCount && (
                    <button
                        onClick={() => setVisibleCount(c => c + 50)}
                        style={{ width: '100%', padding: 10, fontSize: 12, color: 'var(--color-text-secondary, #71717a)', background: 'var(--color-background-secondary, #f4f4f5)', border: '0.5px solid var(--color-border-tertiary, #e4e4e7)', borderRadius: 6, cursor: 'pointer', marginTop: 4 }}
                    >
                        Load {Math.min(50, filteredTasks.length - visibleCount)} more tasks
                        ({filteredTasks.length - visibleCount} remaining)
                    </button>
                )}
            </div>

            {/* TODAY label below chart body — FOLLO GANTT-DONE: matched GanttWidget style */}
            <div style={{ position: 'relative', height: 20, marginTop: 2 }}>
                {todayOffset >= 0 && todayOffset <= totalWidth && (
                    <div style={{ position: 'absolute', left: LEFT_COL + todayOffset + DAY_WIDTH / 2, transform: 'translateX(-50%)', fontSize: 9, color: '#2563eb', fontWeight: 600, letterSpacing: '0.05em' }}>TODAY</div>
                )}
            </div>

            </div>
            </div>
            )}

            {/* ── LEGEND ── */}
            <div style={{ display: 'flex', gap: 16, marginTop: 14, padding: '12px 12px 10px', borderTop: '0.5px solid var(--color-border-tertiary, #e4e4e7)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: 'var(--color-border-secondary, #d4d4d8)', borderRadius: 2 }} />Scheduled
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: '#2563eb', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)', animation: 'gantt-shimmer 2s ease-in-out infinite' }} />
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
                    <div style={{ width: 22, height: 8, background: '#d97706', borderRadius: 2, animation: 'gantt-breathe 2s ease-in-out infinite' }} />Blocked
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary, #71717a)' }}>
                    <div style={{ width: 22, height: 8, background: '#3b82f6', borderRadius: 2, opacity: 0.7 }} />Pending review
                </div>
            </div>

            {/* Selected Task Detail Panel */}
            {selectedTask && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-800/30">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedTask.title}</h3>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                                <span className="flex items-center gap-1">
                                    <User className="size-3" />
                                    {selectedTask.assignee?.name || selectedTask.assignee?.email || "Unassigned"}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {selectedTask.plannedStartDate && format(new Date(selectedTask.plannedStartDate), "MMM d")}
                                    {selectedTask.plannedStartDate && selectedTask.plannedEndDate && " → "}
                                    {selectedTask.plannedEndDate && format(new Date(selectedTask.plannedEndDate), "MMM d, yyyy")}
                                    {!selectedTask.plannedStartDate && !selectedTask.plannedEndDate && selectedTask.dueDate && 
                                        `Due: ${format(new Date(selectedTask.dueDate), "MMM d, yyyy")}`
                                    }
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLegacyBarColors(selectedTask).bg} ${getLegacyBarColors(selectedTask).text}`}>
                                    {selectedTask.slaStatus ? selectedTask.slaStatus.replace(/_/g, " ") : selectedTask.status.replace("_", " ")}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate(`/task?id=${selectedTask.id}`)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                        >
                            <ExternalLink className="size-3" />
                            View Details
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
