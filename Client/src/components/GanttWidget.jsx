import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, addDays, startOfDay, parseISO } from "date-fns";
import { GanttChart, ExternalLink, Calendar } from "lucide-react";

const STATUS_COLORS = {
    TODO: "bg-zinc-400",
    IN_PROGRESS: "bg-blue-500",
    IN_REVIEW: "bg-purple-500",
    BLOCKED: "bg-red-500",
    DONE: "bg-emerald-500",
};

const PROJECT_COLORS = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500", 
    "bg-pink-500", "bg-cyan-500", "bg-yellow-500", "bg-red-500"
];

const DAY_WIDTH = 24;
const ROW_HEIGHT = 28;
const DAYS_TO_SHOW = 21; // 3 weeks

export default function GanttWidget() {
    const navigate = useNavigate();
    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);
    const projects = currentWorkspace?.projects || [];

    // Get all tasks across all projects for the next 3 weeks
    const { tasks, startDate, days } = useMemo(() => {
        const today = startOfDay(new Date());
        const start = addDays(today, -3);
        const end = addDays(today, DAYS_TO_SHOW - 4);

        // Collect all tasks from all projects
        const allTasks = [];
        projects.forEach((project, projectIndex) => {
            (project.tasks || []).forEach(task => {
                const parseDate = (d) => {
                    if (!d) return null;
                    try {
                        const date = typeof d === 'string' ? parseISO(d) : new Date(d);
                        return isNaN(date.getTime()) ? null : date;
                    } catch {
                        return null;
                    }
                };

                const taskStart = parseDate(task.plannedStartDate);
                const taskEnd = parseDate(task.plannedEndDate) || parseDate(task.dueDate);

                // Only include tasks that overlap with our view window
                if (taskEnd && taskEnd >= start && (taskStart || taskEnd) <= end) {
                    allTasks.push({
                        ...task,
                        projectName: project.name,
                        projectId: project.id,
                        projectColor: PROJECT_COLORS[projectIndex % PROJECT_COLORS.length],
                        startDate: taskStart || addDays(taskEnd, -2),
                        endDate: taskEnd
                    });
                }
            });
        });

        // Sort by start date
        allTasks.sort((a, b) => a.startDate - b.startDate);

        // Generate days array
        const daysArray = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(start, i));

        return { tasks: allTasks.slice(0, 8), startDate: start, days: daysArray };
    }, [projects]);

    const today = startOfDay(new Date());
    const todayOffset = differenceInDays(today, startDate) * DAY_WIDTH;
    const totalWidth = DAYS_TO_SHOW * DAY_WIDTH;

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
                        No scheduled tasks in the next {DAYS_TO_SHOW} days
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-zinc-900 dark:text-white font-medium flex items-center gap-2">
                    <GanttChart className="size-4" />
                    Timeline Overview
                </h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Next {DAYS_TO_SHOW} days
                </span>
            </div>

            {/* Timeline */}
            <div className="overflow-x-auto">
                <div style={{ width: totalWidth, minWidth: "100%" }}>
                    {/* Day header */}
                    <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
                        {days.map((day, i) => {
                            const isToday = differenceInDays(day, today) === 0;
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            
                            return (
                                <div 
                                    key={i}
                                    className={`flex flex-col items-center justify-center py-1 text-[10px]
                                        ${isToday ? 'text-blue-500 font-bold' : isWeekend ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}
                                    style={{ width: DAY_WIDTH }}
                                >
                                    <span>{format(day, "E").charAt(0)}</span>
                                    <span className={isToday ? 'bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]' : ''}>
                                        {format(day, "d")}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Task rows */}
                    <div className="relative">
                        {/* Today line */}
                        {todayOffset >= 0 && todayOffset <= totalWidth && (
                            <div
                                className="absolute top-0 w-0.5 bg-blue-500/50 z-10"
                                style={{
                                    left: todayOffset + DAY_WIDTH / 2,
                                    height: tasks.length * ROW_HEIGHT
                                }}
                            />
                        )}

                        {tasks.map((task, index) => {
                            const left = differenceInDays(task.startDate, startDate) * DAY_WIDTH;
                            const duration = differenceInDays(task.endDate, task.startDate) + 1;
                            const width = Math.max(duration * DAY_WIDTH - 2, DAY_WIDTH - 2);

                            return (
                                <div 
                                    key={task.id}
                                    className="relative border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                                    style={{ height: ROW_HEIGHT }}
                                    onClick={() => navigate(`/projectsDetail?id=${task.projectId}&tab=gantt`)}
                                >
                                    {/* Task bar */}
                                    <div
                                        className={`absolute top-1 rounded-sm ${task.projectColor} opacity-80 hover:opacity-100 transition-opacity`}
                                        style={{
                                            left: Math.max(0, left),
                                            width: width,
                                            height: ROW_HEIGHT - 8
                                        }}
                                        title={`${task.title} (${task.projectName})`}
                                    >
                                        <div className="px-1 text-[10px] text-white font-medium truncate leading-[20px]">
                                            {task.title}
                                        </div>
                                    </div>

                                    {/* Hover tooltip */}
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        <div className="bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                            {task.projectName}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer - View all link */}
            {projects.length > 0 && (
                <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/20">
                    <div className="flex flex-wrap gap-2">
                        {projects.slice(0, 4).map((project, i) => (
                            <button
                                key={project.id}
                                onClick={() => navigate(`/projectsDetail?id=${project.id}&tab=gantt`)}
                                className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition"
                            >
                                <div className={`w-2 h-2 rounded-full ${PROJECT_COLORS[i % PROJECT_COLORS.length]}`} />
                                {project.name}
                                <ExternalLink className="size-3" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
