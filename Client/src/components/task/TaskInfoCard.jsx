// FOLLO SRP
// FOLLO WORKFLOW
// FOLLO ASSIGN
import { useState } from "react";
import { CalendarIcon, Lock, Unlock } from "lucide-react";
import { getPriorityStyle } from "../../lib/priorityStyles";

const TaskInfoCard = ({ task, formatDate, canManagePriority, onTogglePriorityOverride, canAssign, workspaceMembers, onUpdateTask }) => {
    const ps = getPriorityStyle(task.priority);
    const [editingAssignee, setEditingAssignee] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleAssigneeChange = async (newAssigneeId) => {
        setSaving(true);
        try {
            await onUpdateTask({ assigneeId: newAssigneeId || null });
            setEditingAssignee(false);
        } finally {
            setSaving(false);
        }
    };

    const initials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    };

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

            {/* FOLLO ASSIGN — Assignee row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {task.assignee ? (
                        <>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: '#dbeafe', color: '#1e40af',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 500, flexShrink: 0,
                                overflow: 'hidden',
                            }}>
                                {task.assignee.image
                                    ? <img src={task.assignee.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : initials(task.assignee.name)
                                }
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                    {task.assignee.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                                    Assignee
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                            Unassigned
                        </div>
                    )}
                </div>

                {canAssign && !editingAssignee && (
                    <button
                        onClick={() => setEditingAssignee(true)}
                        style={{
                            fontSize: 11, padding: '3px 8px',
                            border: '0.5px solid var(--color-border-secondary)',
                            borderRadius: 5, background: 'none',
                            color: 'var(--color-text-tertiary)', cursor: 'pointer',
                        }}
                    >
                        {task.assignee ? 'Change' : 'Assign'}
                    </button>
                )}
            </div>

            {/* FOLLO ASSIGN — Assignee edit dropdown */}
            {canAssign && editingAssignee && (
                <div style={{ marginBottom: 12 }}>
                    <select
                        defaultValue={task.assigneeId ?? ''}
                        onChange={e => handleAssigneeChange(e.target.value)}
                        disabled={saving}
                        style={{
                            width: '100%', padding: '7px 10px', fontSize: 12,
                            border: '0.5px solid var(--color-border-secondary)',
                            borderRadius: 6, background: 'var(--color-background-secondary)',
                            color: 'var(--color-text-primary)', outline: 'none',
                        }}
                    >
                        <option value="">Unassigned</option>
                        {(workspaceMembers || []).map(m => {
                            const uid = m.userId || m.user?.id;
                            const name = m.user?.name || m.name || m.user?.email || uid;
                            return (
                                <option key={uid} value={uid}>
                                    {name}{m.isProjectMember ? '' : ' (will be added to project)'}
                                </option>
                            );
                        })}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                        Assigning a non-member automatically adds them to this project.
                    </div>
                    <button
                        onClick={() => setEditingAssignee(false)}
                        style={{
                            marginTop: 6, fontSize: 11, padding: '3px 8px',
                            border: '0.5px solid var(--color-border-secondary)',
                            borderRadius: 5, background: 'none',
                            color: 'var(--color-text-tertiary)', cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-gray-500 dark:text-zinc-500" />
                    Due : {formatDate(task.dueDate || task.plannedEndDate)}
                </div>
            </div>
        </div>
    );
};

export default TaskInfoCard;
