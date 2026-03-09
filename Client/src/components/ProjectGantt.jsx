import { useState, useRef, useEffect, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, addDays, startOfDay } from "date-fns";
import { GripVertical, User, Calendar, ExternalLink } from "lucide-react";
import { updateTaskAsync } from "../features/workspaceSlice";
import toast from "react-hot-toast";

// Status colors for task bars
const STATUS_COLORS = {
    TODO: { bg: "bg-zinc-500/20", border: "border-zinc-500", text: "text-zinc-400" },
    IN_PROGRESS: { bg: "bg-blue-500/20", border: "border-blue-500", text: "text-blue-400" },
    IN_REVIEW: { bg: "bg-purple-500/20", border: "border-purple-500", text: "text-purple-400" },
    BLOCKED: { bg: "bg-red-500/20", border: "border-red-500", text: "text-red-400" },
    DONE: { bg: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-400" },
};

const PRIORITY_INDICATORS = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-zinc-500",
};

const DAY_WIDTH = 36;
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 280;

export default function ProjectGantt({ tasks, project }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const scrollRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const dragStartRef = useRef(null);

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

    // Group days by month for header
    const monthGroups = useMemo(() => {
        const groups = [];
        let currentMonth = null;
        let currentGroup = null;

        days.forEach((day, index) => {
            const monthKey = format(day, "MMM yyyy");
            if (monthKey !== currentMonth) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = { label: monthKey, start: index, count: 1 };
                currentMonth = monthKey;
            } else {
                currentGroup.count++;
            }
        });
        if (currentGroup) groups.push(currentGroup);
        return groups;
    }, [days]);

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
            {/* Main container with sidebar and chart */}
            <div className="flex">
                {/* Sidebar - Task list */}
                <div className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800" style={{ width: SIDEBAR_WIDTH }}>
                    {/* Sidebar header */}
                    <div 
                        className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-end"
                        style={{ height: HEADER_HEIGHT }}
                    >
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pb-3">
                            Task Name
                        </span>
                    </div>

                    {/* Task rows */}
                    <div className="overflow-y-auto" style={{ maxHeight: `calc(100vh - ${HEADER_HEIGHT + 200}px)` }}>
                        {tasks.map((task, index) => (
                            <div
                                key={task.id}
                                className={`flex items-center gap-3 px-4 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-colors
                                    ${selectedTask?.id === task.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                            >
                                <div className={`w-1 h-6 rounded-full ${PRIORITY_INDICATORS[task.priority]}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                        {task.title}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-1">
                                        <User className="size-3" />
                                        {task.assignee?.name || task.assignee?.email || "Unassigned"}
                                    </div>
                                </div>
                                <div className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[task.status]?.bg} ${STATUS_COLORS[task.status]?.text}`}>
                                    {task.status.replace("_", " ")}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Gantt Chart Area */}
                <div className="flex-1 overflow-hidden">
                    <div 
                        ref={scrollRef} 
                        className="overflow-x-auto overflow-y-auto"
                        style={{ maxHeight: `calc(100vh - 200px)` }}
                    >
                        <div style={{ width: totalWidth, minWidth: "100%" }}>
                            {/* Header - Months and Days */}
                            <div 
                                className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 z-10"
                                style={{ height: HEADER_HEIGHT }}
                            >
                                {/* Month row */}
                                <div className="flex border-b border-zinc-200 dark:border-zinc-700" style={{ height: 24 }}>
                                    {monthGroups.map((group, i) => (
                                        <div 
                                            key={i}
                                            className="flex items-center px-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-700"
                                            style={{ width: group.count * DAY_WIDTH }}
                                        >
                                            {group.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Day row */}
                                <div className="flex" style={{ height: HEADER_HEIGHT - 24 }}>
                                    {days.map((day, i) => {
                                        const isToday = differenceInDays(day, today) === 0;
                                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                        
                                        return (
                                            <div 
                                                key={i}
                                                className={`flex flex-col items-center justify-center text-xs border-r border-zinc-100 dark:border-zinc-800
                                                    ${isToday ? 'text-blue-500 font-bold' : isWeekend ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}
                                                style={{ width: DAY_WIDTH }}
                                            >
                                                <span>{format(day, "EEE").charAt(0)}</span>
                                                <span className={`${isToday ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}`}>
                                                    {format(day, "d")}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Chart body */}
                            <div className="relative">
                                {/* Weekend shading */}
                                {days.map((day, i) => {
                                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                                    if (!isWeekend) return null;
                                    return (
                                        <div
                                            key={`weekend-${i}`}
                                            className="absolute top-0 bg-zinc-100/50 dark:bg-zinc-800/30"
                                            style={{
                                                left: i * DAY_WIDTH,
                                                width: DAY_WIDTH,
                                                height: tasks.length * ROW_HEIGHT
                                            }}
                                        />
                                    );
                                })}

                                {/* Today line */}
                                {todayOffset >= 0 && todayOffset <= totalWidth && (
                                    <div
                                        className="absolute top-0 w-0.5 bg-blue-500 z-20"
                                        style={{
                                            left: todayOffset + DAY_WIDTH / 2,
                                            height: tasks.length * ROW_HEIGHT
                                        }}
                                    >
                                        <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-blue-500" />
                                    </div>
                                )}

                                {/* Task rows */}
                                {tasks.map((task, index) => {
                                    const { left, width } = getTaskPosition(task);
                                    const isDragging = dragging?.taskId === task.id;
                                    const colors = STATUS_COLORS[task.status] || STATUS_COLORS.TODO;

                                    return (
                                        <div 
                                            key={task.id}
                                            className="relative border-b border-zinc-100 dark:border-zinc-800"
                                            style={{ height: ROW_HEIGHT }}
                                        >
                                            {/* Grid lines */}
                                            <div 
                                                className="absolute inset-0 pointer-events-none"
                                                style={{
                                                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${DAY_WIDTH - 1}px, rgba(0,0,0,0.05) ${DAY_WIDTH - 1}px, rgba(0,0,0,0.05) ${DAY_WIDTH}px)`
                                                }}
                                            />

                                            {/* Task bar */}
                                            <div
                                                className={`absolute top-2 rounded-md border ${colors.bg} ${colors.border} cursor-grab transition-shadow
                                                    ${selectedTask?.id === task.id ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-900' : ''}
                                                    ${isDragging ? 'cursor-grabbing shadow-lg' : 'hover:shadow-md'}`}
                                                style={{
                                                    left: Math.max(0, left),
                                                    width: width,
                                                    height: ROW_HEIGHT - 16
                                                }}
                                                onMouseDown={(e) => handleMouseDown(e, task, "move")}
                                            >
                                                {/* Progress fill */}
                                                {task.status === "DONE" && (
                                                    <div 
                                                        className={`absolute inset-0 rounded-md opacity-40 ${colors.bg.replace('/20', '/60')}`}
                                                        style={{ width: "100%" }}
                                                    />
                                                )}
                                                
                                                {/* Task name */}
                                                <div className={`absolute inset-0 px-2 flex items-center text-xs font-medium ${colors.text} truncate`}>
                                                    {task.title}
                                                </div>

                                                {/* Resize handles */}
                                                <div 
                                                    className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 dark:hover:bg-white/10 rounded-l-md"
                                                    onMouseDown={(e) => handleMouseDown(e, task, "resize-left")}
                                                />
                                                <div 
                                                    className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-black/10 dark:hover:bg-white/10 rounded-r-md"
                                                    onMouseDown={(e) => handleMouseDown(e, task, "resize-right")}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
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
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[selectedTask.status]?.bg} ${STATUS_COLORS[selectedTask.status]?.text}`}>
                                    {selectedTask.status.replace("_", " ")}
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
