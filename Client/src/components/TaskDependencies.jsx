/**
 * TaskDependencies Component
 * Manages task dependencies (predecessors/successors)
 */
// FOLLO DEPS
// FOLLO ACCESS

import { useState } from "react";
import { Link2, Unlink, Plus, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { addTaskDependencyAsync, removeTaskDependencyAsync } from "../features/taskSlice";
import useUserRole from "../hooks/useUserRole";

const STATUS_ICONS = {
    TODO: <Clock className="w-3 h-3 text-zinc-400" />,
    IN_PROGRESS: <Clock className="w-3 h-3 text-blue-500 animate-pulse" />,
    COMPLETED: <CheckCircle className="w-3 h-3 text-green-500" />,
    BLOCKED: <AlertTriangle className="w-3 h-3 text-red-500" />,
    PENDING_APPROVAL: <Clock className="w-3 h-3 text-amber-500" />,
};

const STATUS_COLORS = {
    TODO: 'bg-zinc-100 dark:bg-zinc-800',
    IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30',
    BLOCKED: 'bg-red-100 dark:bg-red-900/30',
    PENDING_APPROVAL: 'bg-amber-100 dark:bg-amber-900/30',
};

export default function TaskDependencies({ task, projectTasks = [], onTaskClick, onDepsChanged }) {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const loadingStates = useSelector((state) => state.workspace?.loadingStates || {});
    // FOLLO ACCESS: Only managers can add/remove dependencies
    const { isAdmin, isProjectOwner, projectRole } = useUserRole();
    const isManager = isAdmin || isProjectOwner || projectRole === 'MANAGER';
    
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedPredecessor, setSelectedPredecessor] = useState('');
    const [lagDays, setLagDays] = useState(0);

    // Get current predecessors and successors
    const predecessors = task.predecessors || [];
    const successors = task.successors || [];
    
    // Get IDs of tasks that can't be added (self, already predecessors/successors)
    const excludedIds = new Set([
        task.id,
        ...predecessors.map(d => d.predecessor?.id || d.predecessorId),
        ...successors.map(d => d.successor?.id || d.successorId),
    ]);

    // Filter available tasks
    const availableTasks = projectTasks.filter(t => !excludedIds.has(t.id));

    const handleAddDependency = async (e) => {
        e.preventDefault();
        
        if (!selectedPredecessor) {
            toast.error('Please select a predecessor task');
            return;
        }

        try {
            await dispatch(addTaskDependencyAsync({
                taskId: task.id,
                predecessorId: selectedPredecessor,
                lagDays: parseInt(lagDays) || 0,
                getToken,
            })).unwrap();
            
            toast.success('Dependency added');
            setSelectedPredecessor('');
            setLagDays(0);
            setShowAddForm(false);
            onDepsChanged?.();
        } catch (error) {
            toast.error(error || 'Failed to add dependency');
        }
    };

    const handleRemoveDependency = async (dependencyId) => {
        try {
            await dispatch(removeTaskDependencyAsync({
                taskId: task.id,
                dependencyId,
                getToken,
            })).unwrap();
            
            toast.success('Dependency removed');
            onDepsChanged?.();
        } catch (error) {
            toast.error(error || 'Failed to remove dependency');
        }
    };

    return (
        <div className="space-y-4">
            {/* Predecessors Section */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <Link2 className="w-4 h-4" />
                        Blocked By (Predecessors)
                    </h4>
                    {/* FOLLO ACCESS: Only managers can add dependencies */}
                    {isManager && (
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        <Plus className="w-3 h-3" />
                        Add
                    </button>
                    )}
                </div>

                {/* Add Form */}
                {showAddForm && (
                    <form onSubmit={handleAddDependency} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 space-y-3">
                        <div>
                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                This task depends on:
                            </label>
                            <select
                                value={selectedPredecessor}
                                onChange={(e) => setSelectedPredecessor(e.target.value)}
                                className="mt-1 w-full text-sm rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 px-2 py-1.5"
                            >
                                <option value="">Select a task...</option>
                                {availableTasks.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.title} ({t.status})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                Lag days (buffer between tasks):
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={lagDays}
                                onChange={(e) => setLagDays(e.target.value)}
                                className="mt-1 w-20 text-sm rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 px-2 py-1.5"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={loadingStates.dependencies || !selectedPredecessor}
                                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loadingStates.dependencies ? 'Adding...' : 'Add Dependency'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {/* Predecessors List */}
                {predecessors.length > 0 ? (
                    <div className="space-y-2">
                        {predecessors.map((dep) => {
                            const predecessor = dep.predecessor;
                            if (!predecessor) return null;
                            
                            return (
                                <div
                                    key={dep.id}
                                    className={`flex items-center justify-between p-2 rounded-lg ${STATUS_COLORS[predecessor.status] || 'bg-zinc-100 dark:bg-zinc-800'}`}
                                >
                                    <button
                                        onClick={() => onTaskClick?.(predecessor.id)}
                                        className="flex items-center gap-2 text-sm hover:underline text-left flex-1"
                                    >
                                        {STATUS_ICONS[predecessor.status]}
                                        <span className="truncate">{predecessor.title}</span>
                                        {dep.lagDays > 0 && (
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                +{dep.lagDays}d
                                            </span>
                                        )}
                                    </button>
                                    {/* FOLLO ACCESS: Only managers can remove dependencies */}
                                    {isManager && (
                                    <button
                                        onClick={() => handleRemoveDependency(dep.id)}
                                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-red-500"
                                        title="Remove dependency"
                                    >
                                        <Unlink className="w-3 h-3" />
                                    </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        {isManager ? 'No predecessors - this task can start anytime' : 'No prerequisites set.'}
                    </p>
                )}
            </div>

            {/* Successors Section */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <Link2 className="w-4 h-4 rotate-180" />
                    Blocking (Successors)
                </h4>

                {successors.length > 0 ? (
                    <div className="space-y-2">
                        {successors.map((dep) => {
                            const successor = dep.successor;
                            if (!successor) return null;
                            
                            return (
                                <div
                                    key={dep.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg ${STATUS_COLORS[successor.status] || 'bg-zinc-100 dark:bg-zinc-800'}`}
                                >
                                    <button
                                        onClick={() => onTaskClick?.(successor.id)}
                                        className="flex items-center gap-2 text-sm hover:underline text-left flex-1"
                                    >
                                        {STATUS_ICONS[successor.status]}
                                        <span className="truncate">{successor.title}</span>
                                        {dep.lagDays > 0 && (
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                +{dep.lagDays}d
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        No successors - no tasks are waiting on this one
                    </p>
                )}
            </div>

            {/* Warning if blocked */}
            {predecessors.some(d => d.predecessor?.status !== 'COMPLETED') && task.status === 'TODO' && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        This task has incomplete predecessors. It should wait until they are completed.
                    </p>
                </div>
            )}
        </div>
    );
}
