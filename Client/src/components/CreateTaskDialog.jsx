// FOLLO FIX
// FOLLO WORKFLOW
// FOLLO DEPS
// FOLLO ASSIGN
import { useState, useMemo, useEffect } from "react";
import { Calendar as CalendarIcon, FileStack } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { format, addDays } from "date-fns";
import { createTaskAsync } from "../features/taskSlice";
import toast from "react-hot-toast";
import LoadingButton from "./ui/LoadingButton";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function CreateTaskDialog({ showCreateTask, setShowCreateTask, projectId }) {
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const myProjects = useSelector((state) => state.workspace?.myProjects || []);
    
    // Get project from either workspace projects or myProjects
    const project = useMemo(() => {
        const workspaceProject = currentWorkspace?.projects?.find((p) => p.id === projectId);
        if (workspaceProject) return workspaceProject;
        return myProjects.find((p) => p.id === projectId);
    }, [currentWorkspace, myProjects, projectId]);
    
    const teamMembers = project?.members || [];
    // FOLLO ASSIGN — show all workspace members, flag who is already on this project
    const projectMemberIds = new Set(teamMembers.map(m => m.userId || m.user?.id));
    const allMembers = (currentWorkspace?.members || []).map(m => ({
        ...m,
        isProjectMember: projectMemberIds.has(m.userId || m.user?.id),
    }));
    const assigneeList = allMembers.length > 0 ? allMembers : teamMembers.map(m => ({ ...m, isProjectMember: true }));
    const dispatch = useDispatch();
    const { getToken } = useAuth();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        assigneeId: "",
        start_date: "",
        due_date: "",
    });

    // Close on Escape key
    useEffect(() => {
        if (!showCreateTask) return;
        const h = (e) => { if (e.key === 'Escape') setShowCreateTask(false); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [showCreateTask, setShowCreateTask]);

    // Fetch task templates for this workspace
    useEffect(() => {
        if (!currentWorkspace?.id) return;
        const loadTemplates = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_URL}/api/v1/templates/tasks?workspaceId=${currentWorkspace.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const json = await res.json();
                if (json.success) setTaskTemplates(json.data || []);
            } catch (err) { console.error('[CreateTaskDialog] Template load failed:', err.message); }
        };
        loadTemplates();
    }, [currentWorkspace?.id, getToken]);

    // When a template is selected, pre-fill the form
    const handleTemplateSelect = (templateId) => {
        setSelectedTemplateId(templateId);
        if (!templateId) return; // "Custom" selected — keep current values
        const tpl = taskTemplates.find((t) => t.id === templateId);
        if (!tpl) return;
        const today = new Date();
        const dueDate = addDays(today, tpl.durationDays || 1);
        setFormData((prev) => ({
            ...prev,
            title: tpl.name,
            description: tpl.description || "",
            start_date: format(today, "yyyy-MM-dd"),
            due_date: format(dueDate, "yyyy-MM-dd"),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            toast.error("Task title is required");
            return;
        }

        if (!formData.start_date) {
            toast.error("Start date is required");
            return;
        }

        if (!formData.due_date) {
            toast.error("Due date is required");
            return;
        }

        if (new Date(formData.start_date) > new Date(formData.due_date)) {
            toast.error("Start date must be before due date");
            return;
        }

        setIsSubmitting(true);
        try {
            await dispatch(createTaskAsync({
                projectId,
                taskData: {
                    title: formData.title,
                    description: formData.description,
                    ...(formData.assigneeId && { assigneeId: formData.assigneeId }),
                    plannedStartDate: formData.start_date,
                    plannedEndDate: formData.due_date,
                    due_date: formData.due_date,
                },
                getToken,
            })).unwrap();
            
            toast.success("Task created successfully!");
            setShowCreateTask(false);
            // Reset form
            setFormData({
                title: "",
                description: "",
                assigneeId: "",
                start_date: "",
                due_date: "",
            });
        } catch (error) {
            toast.error(error || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    return showCreateTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 text-zinc-900 dark:text-white">
                <h2 className="text-xl font-bold mb-4">Create New Task</h2>

                {/* Template Picker */}
                {taskTemplates.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20">
                        <label className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                            <FileStack className="size-4" />
                            Use a Task Template
                        </label>
                        <select
                            value={selectedTemplateId}
                            onChange={(e) => handleTemplateSelect(e.target.value)}
                            className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- Custom (manual) --</option>
                            {taskTemplates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                    {tpl.name} — {tpl.priority}, {tpl.durationDays}d
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div className="space-y-1">
                        <label htmlFor="title" className="text-sm font-medium">Title</label>
                        <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Task title" className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label htmlFor="description" className="text-sm font-medium">Description</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the task" className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* FOLLO DEPS — Assignee (priority auto-calculated from dependencies) */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Assignee</label>
                        <select value={formData.assigneeId} onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1" >
                            <option value="">Unassigned</option>
                            {assigneeList.map((member) => {
                                const uid = member.userId || member.user?.id;
                                const name = member.user?.name || member.name || member.user?.email || uid;
                                return (
                                    <option key={uid} value={uid}>
                                        {name}{member.isProjectMember ? '' : ' (will be added to project)'}
                                    </option>
                                );
                            })}
                        </select>
                        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
                            Assigning someone not yet on this project will add them automatically.
                        </p>
                    </div>

                    {/* Start Date & Due Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Start Date</label>
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="size-5 text-zinc-500 dark:text-zinc-400" />
                                <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} min={new Date().toISOString().split('T')[0]} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1" />
                            </div>
                            {formData.start_date && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {format(new Date(formData.start_date), "PPP")}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Due Date</label>
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="size-5 text-zinc-500 dark:text-zinc-400" />
                                <input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} min={formData.start_date || new Date().toISOString().split('T')[0]} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1" />
                            </div>
                            {formData.due_date && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {format(new Date(formData.due_date), "PPP")}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowCreateTask(false)} className="rounded border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" >
                            Cancel
                        </button>
                        <LoadingButton type="submit" loading={isSubmitting} className="rounded px-5 py-2 text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white dark:text-zinc-200 transition" >
                            Create Task
                        </LoadingButton>
                    </div>
                </form>
            </div>
        </div>
    ) : null;
}
