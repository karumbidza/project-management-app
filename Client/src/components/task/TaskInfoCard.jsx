// FOLLO SRP
// FOLLO WORKFLOW
import { CalendarIcon, Lock, Unlock } from "lucide-react";
import { getPriorityStyle } from "../../lib/priorityStyles";

const TaskInfoCard = ({ task, formatDate, canManagePriority, onTogglePriorityOverride }) => {
    const ps = getPriorityStyle(task.priority);

    return (
        <div className="p-5 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 ">
            <div className="mb-3">
                <h1 className="text-lg font-medium text-gray-900 dark:text-zinc-100">{task.title}</h1>
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                    <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-300 text-xs">
                        {task.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${ps.bg} ${ps.color}`}>
                        {ps.label}
                    </span>
                    {canManagePriority && onTogglePriorityOverride && (
                        <button
                            onClick={onTogglePriorityOverride}
                            title={task.priorityOverride ? "Priority is manually locked — click to auto-calculate" : "Priority auto-calculated — click to lock"}
                            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            {task.priorityOverride
                                ? <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
                                : <Unlock className="size-3.5 text-zinc-400 dark:text-zinc-500" />
                            }
                        </button>
                    )}
                </div>
            </div>

            {task.description && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">{task.description}</p>
            )}

            <hr className="border-zinc-200 dark:border-zinc-700 my-3" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                    <img src={task.assignee?.image} className="size-5 rounded-full" alt="avatar" />
                    {task.assignee?.name || "Unassigned"}
                </div>
                <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-gray-500 dark:text-zinc-500" />
                    Due : {formatDate(task.dueDate || task.plannedEndDate)}
                </div>
            </div>
        </div>
    );
};

export default TaskInfoCard;
