// FOLLO FIX
// FOLLO PERMISSIONS
// FOLLO WORKFLOW
import { format, parseISO, isValid } from "date-fns";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { updateTaskAsync, deleteTaskAsync } from "../features/taskSlice";
import { CalendarIcon, Shield, Trash, XIcon } from "lucide-react";
import useUserRole from "../hooks/useUserRole";
import { getPriorityStyle } from "../lib/priorityStyles";

// Safe date formatter
const formatDate = (dateValue, formatStr = "dd MMMM") => {
    if (!dateValue) return "-";
    try {
        const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
        return isValid(date) ? format(date, formatStr) : "-";
    } catch {
        return "-";
    }
};

// FOLLO WORKFLOW — status display helper (read-only)
const statusLabels = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    BLOCKED: 'Blocked',
    PENDING_APPROVAL: 'Pending Approval',
    DONE: 'Done',
};

const ProjectTasks = ({ tasks, projectId: propProjectId }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { canApproveReject } = useUserRole();
    const [selectedTasks, setSelectedTasks] = useState([]);

    const [filters, setFilters] = useState({
        status: "",
        priority: "",
        assignee: "",
    });

    const assigneeList = useMemo(
        () => Array.from(new Set(tasks.map((t) => t.assignee?.name).filter(Boolean))),
        [tasks]
    );

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const { status, priority, assignee } = filters;
            return (
                (!status || task.status === status) &&
                (!priority || task.priority === priority) &&
                (!assignee || task.assignee?.name === assignee)
            );
        });
    }, [filters, tasks]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleDelete = async () => {
        try {
            const confirm = window.confirm("Are you sure you want to delete the selected tasks?");
            if (!confirm) return;

            toast.loading("Deleting tasks...");
            await Promise.all(
                selectedTasks.map(taskId =>
                    dispatch(deleteTaskAsync({
                        taskId,
                        projectId: propProjectId,
                        getToken,
                    })).unwrap()
                )
            );
            setSelectedTasks([]);
            toast.dismissAll();
            toast.success("Tasks deleted successfully");
        } catch (error) {
            toast.dismissAll();
            toast.error(error || 'Failed to delete tasks');
        }
    };

    // FOLLO PERMISSIONS — SLA status badge
    const renderSlaBadge = (slaStatus) => {
        const map = {
            AT_RISK:          { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'At Risk' },
            PENDING_APPROVAL: { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', label: canApproveReject ? 'Needs Review' : 'Pending' },
            BLOCKED:          { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', label: 'Blocked' },
            BREACHED:         { dot: 'bg-red-500 animate-pulse', text: 'text-red-700 dark:text-red-400', label: 'Overdue' },
            RESOLVED_ON_TIME: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: '✓ On Time' },
            RESOLVED_LATE:    { dot: 'bg-zinc-400', text: 'text-zinc-600 dark:text-zinc-400', label: 'Late' },
        };
        const b = map[slaStatus];
        if (!b) return null;
        return (
            <span className={`inline-flex items-center gap-1 text-xs ${b.text}`}>
                <Shield className="size-3" />
                {b.label}
            </span>
        );
    };

    return (
        <div>
            {/* Filters — FOLLO WORKFLOW: type filter removed */}
            <div className="flex flex-wrap gap-4 mb-4">
                {["status", "priority", "assignee"].map((name) => {
                    const options = {
                        status: [
                            { label: "All Statuses", value: "" },
                            { label: "To Do", value: "TODO" },
                            { label: "In Progress", value: "IN_PROGRESS" },
                            { label: "Blocked", value: "BLOCKED" },
                            { label: "Pending Approval", value: "PENDING_APPROVAL" },
                            { label: "Done", value: "DONE" },
                        ],
                        priority: [
                            { label: "All Priorities", value: "" },
                            { label: "Critical", value: "CRITICAL" },
                            { label: "High", value: "HIGH" },
                            { label: "Medium", value: "MEDIUM" },
                            { label: "Low", value: "LOW" },
                        ],
                        assignee: [
                            { label: "All Assignees", value: "" },
                            ...assigneeList.map((n) => ({ label: n, value: n })),
                        ],
                    };
                    return (
                        <select key={name} name={name} onChange={handleFilterChange} className=" border not-dark:bg-white border-zinc-300 dark:border-zinc-800 outline-none px-3 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200" >
                            {options[name].map((opt) => (
                                <option key={`${name}-${opt.value}`} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    );
                })}

                {/* Reset filters */}
                {(filters.status || filters.priority || filters.assignee) && (
                    <button type="button" onClick={() => setFilters({ status: "", priority: "", assignee: "" })} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-purple-400 to-purple-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors" >
                        <XIcon className="size-3" /> Reset
                    </button>
                )}

                {selectedTasks.length > 0 && (
                    <button type="button" onClick={handleDelete} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-indigo-400 to-indigo-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors" >
                        <Trash className="size-3" /> Delete
                    </button>
                )}
            </div>

            {/* Tasks Table */}
            <div className="overflow-auto rounded-lg lg:border border-zinc-300 dark:border-zinc-800">
                <div className="w-full">
                    {/* Desktop/Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full text-sm text-left not-dark:bg-white text-zinc-900 dark:text-zinc-300">
                            <thead className="text-xs uppercase dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 ">
                                <tr>
                                    <th className="pl-2 pr-1">
                                        <input onChange={() => selectedTasks.length > 1 ? setSelectedTasks([]) : setSelectedTasks(tasks.map((t) => t.id))} checked={selectedTasks.length === tasks.length} type="checkbox" className="size-3 accent-zinc-600 dark:accent-zinc-500" />
                                    </th>
                                    <th className="px-4 pl-0 py-3">Title</th>
                                    <th className="px-4 py-3">Priority</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Assignee</th>
                                    <th className="px-4 py-3">Due Date</th>
                                    <th className="px-4 py-3">SLA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.length > 0 ? (
                                    filteredTasks.map((task) => {
                                        const ps = getPriorityStyle(task.priority);

                                        return (
                                            <tr key={task.id} onClick={() => navigate(`/taskDetails?projectId=${task.projectId || propProjectId}&taskId=${task.id}`)} className=" border-t border-zinc-300 dark:border-zinc-800 group hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all cursor-pointer" >
                                                <td onClick={e => e.stopPropagation()} className="pl-2 pr-1">
                                                    <input type="checkbox" className="size-3 accent-zinc-600 dark:accent-zinc-500" onChange={() => selectedTasks.includes(task.id) ? setSelectedTasks(selectedTasks.filter((i) => i !== task.id)) : setSelectedTasks((prev) => [...prev, task.id])} checked={selectedTasks.includes(task.id)} />
                                                </td>
                                                <td className="px-4 pl-0 py-2">{task.title}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`text-xs px-2 py-1 rounded ${ps.bg} ${ps.color}`}>
                                                        {ps.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                        {statusLabels[task.status] || task.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <img src={task.assignee?.image} className="size-5 rounded-full" alt="avatar" />
                                                        {task.assignee?.name || "-"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                                                        <CalendarIcon className="size-4" />
                                                        {formatDate(task.dueDate || task.plannedEndDate)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {renderSlaBadge(task.slaStatus)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center text-zinc-500 dark:text-zinc-400 py-6">
                                            No tasks found for the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Card View */}
                    <div className="lg:hidden flex flex-col gap-4">
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map((task) => {
                                const ps = getPriorityStyle(task.priority);

                                return (
                                    <div 
                                        key={task.id} 
                                        onClick={() => navigate(`/taskDetails?projectId=${task.projectId || propProjectId}&taskId=${task.id}`)}
                                        className="dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-zinc-900 dark:text-zinc-200 text-sm font-semibold">{task.title}</h3>
                                            <input 
                                                type="checkbox" 
                                                className="size-4 accent-zinc-600 dark:accent-zinc-500" 
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => selectedTasks.includes(task.id) ? setSelectedTasks(selectedTasks.filter((i) => i !== task.id)) : setSelectedTasks((prev) => [...prev, task.id])} 
                                                checked={selectedTasks.includes(task.id)} 
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded ${ps.bg} ${ps.color}`}>
                                                {ps.label}
                                            </span>
                                            <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                {statusLabels[task.status] || task.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                            <img src={task.assignee?.image} className="size-5 rounded-full" alt="avatar" />
                                            {task.assignee?.name || "-"}
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                            <CalendarIcon className="size-4" />
                                            {formatDate(task.dueDate || task.plannedEndDate)}
                                        </div>
                                        {task.slaStatus && renderSlaBadge(task.slaStatus)}
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-zinc-500 dark:text-zinc-400 py-4">
                                No tasks found for the selected filters.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectTasks;
