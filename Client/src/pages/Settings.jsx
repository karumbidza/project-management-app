// FOLLO FIX
// FOLLO SLA
import { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { Building2, Trash2, Loader2, Moon, Sun, Plus, ChevronDown, ChevronUp, Pencil, X, FileStack, FolderCog, GripVertical } from "lucide-react";
import LoadingButton from "../components/ui/LoadingButton";
import { deleteWorkspaceAsync } from "../features/workspaceSlice";
import { toggleTheme } from "../features/themeSlice";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ━━━ Shared fetch helper ━━━
async function apiFetch(path, getToken, options = {}) {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/v1${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Request failed');
    }
    const json = await res.json();
    return json.data;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK TEMPLATE FORM (inline)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TaskTemplateForm({ workspaceId, getToken, existing, onSaved, onCancel }) {
    const [form, setForm] = useState({
        name: existing?.name || "",
        description: existing?.description || "",
        type: existing?.type || "TASK",
        priority: existing?.priority || "MEDIUM",
        durationDays: existing?.durationDays ?? 1,
        completionWeight: existing?.completionWeight ?? 1,
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("Name is required");
        setSaving(true);
        try {
            if (existing) {
                await apiFetch(`/templates/tasks/${existing.id}`, getToken, { method: 'PUT', body: JSON.stringify(form) });
                toast.success("Task template updated");
            } else {
                await apiFetch('/templates/tasks', getToken, { method: 'POST', body: JSON.stringify({ ...form, workspaceId }) });
                toast.success("Task template created");
            }
            onSaved();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 text-sm";
    const labelCls = "block text-sm mb-1 text-zinc-700 dark:text-zinc-300";

    return (
        <form onSubmit={handleSubmit} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3 bg-zinc-50 dark:bg-zinc-800/50">
            <div>
                <label className={labelCls}>Name *</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Foundation Inspection" />
            </div>
            <div>
                <label className={labelCls}>Description</label>
                <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        {["TASK", "BUG", "FEATURE", "IMPROVEMENT", "MILESTONE", "OTHER"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Priority</label>
                    <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Duration (days)</label>
                    <input type="number" min={1} className={inputCls} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                    <label className={labelCls}>Completion Weight</label>
                    <input type="number" min={1} className={inputCls} value={form.completionWeight} onChange={(e) => setForm({ ...form, completionWeight: parseInt(e.target.value) || 1 })} />
                </div>
            </div>
            <div className="flex gap-2 pt-1">
                <LoadingButton type="submit" loading={saving} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    {existing ? "Update" : "Create Task Template"}
                </LoadingButton>
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                    Cancel
                </button>
            </div>
        </form>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROJECT TEMPLATE FORM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ProjectTemplateForm({ workspaceId, getToken, taskTemplates, existing, onSaved, onCancel }) {
    const [name, setName] = useState(existing?.name || "");
    const [description, setDescription] = useState(existing?.description || "");
    const [steps, setSteps] = useState(() => {
        if (existing?.tasks?.length) {
            return existing.tasks.map(t => ({
                taskTemplateId: t.taskTemplateId,
                offsetDays: t.offsetDays,
                predecessorIndex: t.predecessorIndex,
            }));
        }
        return [];
    });
    const [saving, setSaving] = useState(false);

    const addStep = () => setSteps([...steps, { taskTemplateId: taskTemplates[0]?.id || "", offsetDays: 0, predecessorIndex: null }]);
    const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));
    const updateStep = (i, field, value) => {
        const updated = [...steps];
        updated[i] = { ...updated[i], [field]: value };
        setSteps(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Name is required");
        if (steps.some(s => !s.taskTemplateId)) return toast.error("All steps need a task template selected");
        setSaving(true);
        try {
            const payload = {
                name,
                description,
                workspaceId,
                tasks: steps.map((s, i) => ({ ...s, sortOrder: i })),
            };
            if (existing) {
                await apiFetch(`/templates/projects/${existing.id}`, getToken, { method: 'PUT', body: JSON.stringify(payload) });
                toast.success("Project template updated");
            } else {
                await apiFetch('/templates/projects', getToken, { method: 'POST', body: JSON.stringify(payload) });
                toast.success("Project template created");
            }
            onSaved();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 text-sm";
    const labelCls = "block text-sm mb-1 text-zinc-700 dark:text-zinc-300";

    return (
        <form onSubmit={handleSubmit} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3 bg-zinc-50 dark:bg-zinc-800/50">
            <div>
                <label className={labelCls}>Template Name *</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Residential Build" />
            </div>
            <div>
                <label className={labelCls}>Description</label>
                <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>

            {/* Steps */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className={labelCls}>Task Steps</label>
                    <button type="button" onClick={addStep} disabled={taskTemplates.length === 0} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline">
                        <Plus className="size-3" /> Add Step
                    </button>
                </div>
                {taskTemplates.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Create task templates first before adding steps.</p>
                )}
                {steps.length === 0 && taskTemplates.length > 0 && (
                    <p className="text-xs text-zinc-500">No steps yet — add task template steps to this project template.</p>
                )}
                <div className="space-y-2">
                    {steps.map((step, i) => (
                        <div key={step.taskTemplateId || `step-${i}`} className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-2">
                            <GripVertical className="size-4 text-zinc-400 shrink-0" />
                            <span className="text-xs font-mono text-zinc-400 w-5 shrink-0">{i + 1}</span>
                            <select className="flex-1 px-2 py-1.5 rounded dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-200" value={step.taskTemplateId} onChange={(e) => updateStep(i, 'taskTemplateId', e.target.value)}>
                                <option value="">Select task template</option>
                                {taskTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <input type="number" min={0} className="w-20 px-2 py-1.5 rounded dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-200" value={step.offsetDays} onChange={(e) => updateStep(i, 'offsetDays', parseInt(e.target.value) || 0)} title="Offset days from project start" placeholder="Day" />
                            <select className="w-24 px-2 py-1.5 rounded dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-zinc-200" value={step.predecessorIndex ?? ""} onChange={(e) => updateStep(i, 'predecessorIndex', e.target.value === "" ? null : parseInt(e.target.value))}>
                                <option value="">No dep</option>
                                {steps.map((_, pi) => pi < i ? <option key={pi} value={pi}>Step {pi + 1}</option> : null)}
                            </select>
                            <button type="button" onClick={() => removeStep(i)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-2 pt-1">
                <LoadingButton type="submit" loading={saving} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    {existing ? "Update" : "Create Project Template"}
                </LoadingButton>
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                    Cancel
                </button>
            </div>
        </form>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN SETTINGS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Settings() {
    const { currentWorkspace, workspaces, loadingStates } = useSelector((state) => state.workspace);
    const { theme } = useSelector((state) => state.theme);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken, userId } = useAuth();
    
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    // ━━━ Template state ━━━
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [projectTemplates, setProjectTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [expandedSection, setExpandedSection] = useState("project"); // "task" | "project"
    const [deletingTemplate, setDeletingTemplate] = useState(null);

    const isOwner = currentWorkspace?.ownerId === userId;
    const loading = loadingStates?.workspaces ?? false;
    const wsId = currentWorkspace?.id;

    // ━━━ Fetch templates ━━━
    const fetchTemplates = useCallback(async () => {
        if (!wsId) return;
        setTemplatesLoading(true);
        try {
            const [tt, pt] = await Promise.all([
                apiFetch(`/templates/tasks?workspaceId=${wsId}`, getToken),
                apiFetch(`/templates/projects?workspaceId=${wsId}`, getToken),
            ]);
            setTaskTemplates(tt || []);
            setProjectTemplates(pt || []);
        } catch (err) {
            console.error('[Settings] Template fetch failed:', err.message);
        } finally {
            setTemplatesLoading(false);
        }
    }, [wsId, getToken]);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleDeleteTaskTemplate = async (id) => {
        if (!window.confirm("Delete this task template?")) return;
        setDeletingTemplate(id);
        try {
            await apiFetch(`/templates/tasks/${id}`, getToken, { method: 'DELETE' });
            toast.success("Task template deleted");
            fetchTemplates();
        } catch (err) { toast.error(err.message); }
        finally { setDeletingTemplate(null); }
    };

    const handleDeleteProjectTemplate = async (id) => {
        if (!window.confirm("Delete this project template?")) return;
        setDeletingTemplate(id);
        try {
            await apiFetch(`/templates/projects/${id}`, getToken, { method: 'DELETE' });
            toast.success("Project template deleted");
            fetchTemplates();
        } catch (err) { toast.error(err.message); }
        finally { setDeletingTemplate(null); }
    };

    const onTaskSaved = () => { setShowTaskForm(false); setEditingTask(null); fetchTemplates(); };
    const onProjectSaved = () => { setShowProjectForm(false); setEditingProject(null); fetchTemplates(); };

    const handleDeleteWorkspace = async () => {
        if (confirmText !== currentWorkspace?.name) {
            toast.error("Please type the workspace name to confirm");
            return;
        }

        try {
            await dispatch(deleteWorkspaceAsync({ 
                workspaceId: currentWorkspace.id, 
                getToken 
            })).unwrap();
            toast.success("Workspace deleted");
            setDeleteConfirm(false);
            navigate("/");
        } catch (error) {
            toast.error(error || "Failed to delete workspace");
        }
    };

    const handleToggleTheme = () => {
        dispatch(toggleTheme());
    };

    if (!currentWorkspace) {
        return (
            <div className="max-w-2xl mx-auto py-8">
                <p className="text-gray-500 dark:text-zinc-400">No workspace selected</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">
                    Settings
                </h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                    Manage your workspace and preferences
                </p>
            </div>

            {/* Workspace Info */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Workspace
                </h2>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                            {currentWorkspace.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">
                            {currentWorkspace.members?.length || 0} members · {currentWorkspace.projects?.length || 0} projects
                        </p>
                    </div>
                </div>
            </div>

            {/* Appearance */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Appearance
                </h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">Theme</p>
                        <p className="text-sm text-gray-500 dark:text-zinc-400">
                            Switch between light and dark mode
                        </p>
                    </div>
                    <button
                        onClick={handleToggleTheme}
                        className="p-2 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        {theme === "dark" ? (
                            <Sun className="w-5 h-5 text-yellow-500" />
                        ) : (
                            <Moon className="w-5 h-5 text-gray-600" />
                        )}
                    </button>
                </div>
            </div>

            {/* ━━━ Project Templates ━━━ */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === "project" ? "" : "project")} className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <FolderCog className="size-5 text-blue-500" />
                        <div className="text-left">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Project Templates</h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">{projectTemplates.length} template{projectTemplates.length !== 1 ? "s" : ""}</p>
                        </div>
                    </div>
                    {expandedSection === "project" ? <ChevronUp className="size-5 text-zinc-400" /> : <ChevronDown className="size-5 text-zinc-400" />}
                </button>

                {expandedSection === "project" && (
                    <div className="px-6 pb-5 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                        {templatesLoading ? (
                            <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> Loading…</div>
                        ) : (
                            <>
                                {/* List */}
                                {projectTemplates.length === 0 && !showProjectForm && (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No project templates yet. Create one to auto-generate tasks when starting a new project.</p>
                                )}
                                {projectTemplates.map((pt) => (
                                    <div key={pt.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{pt.name}</h3>
                                                {pt.description && <p className="text-xs text-zinc-500 mt-0.5">{pt.description}</p>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => { setEditingProject(pt); setShowProjectForm(true); }} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <LoadingButton onClick={() => handleDeleteProjectTemplate(pt.id)} loading={deletingTemplate === pt.id} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-500 hover:text-red-600">
                                                    <Trash2 className="size-3.5" />
                                                </LoadingButton>
                                            </div>
                                        </div>
                                        {pt.tasks?.length > 0 && (
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 pl-1">
                                                {pt.tasks.map((t, i) => (
                                                    <div key={t.id} className="flex gap-2">
                                                        <span className="font-mono text-zinc-400 w-4 shrink-0">{i + 1}.</span>
                                                        <span>{t.taskTemplate?.name || "Unknown"}</span>
                                                        {t.offsetDays > 0 && <span className="text-zinc-400">(+{t.offsetDays}d)</span>}
                                                        {t.predecessorIndex !== null && t.predecessorIndex !== undefined && <span className="text-zinc-400">→ after step {t.predecessorIndex + 1}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Form */}
                                {showProjectForm ? (
                                    <ProjectTemplateForm
                                        workspaceId={wsId}
                                        getToken={getToken}
                                        taskTemplates={taskTemplates}
                                        existing={editingProject}
                                        onSaved={onProjectSaved}
                                        onCancel={() => { setShowProjectForm(false); setEditingProject(null); }}
                                    />
                                ) : (
                                    <button onClick={() => { setEditingProject(null); setShowProjectForm(true); }} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                        <Plus className="size-4" /> New Project Template
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ━━━ Task Templates (building blocks) ━━━ */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === "task" ? "" : "task")} className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <FileStack className="size-5 text-purple-500" />
                        <div className="text-left">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Task Templates</h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400">{taskTemplates.length} template{taskTemplates.length !== 1 ? "s" : ""} — building blocks for project templates</p>
                        </div>
                    </div>
                    {expandedSection === "task" ? <ChevronUp className="size-5 text-zinc-400" /> : <ChevronDown className="size-5 text-zinc-400" />}
                </button>

                {expandedSection === "task" && (
                    <div className="px-6 pb-5 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                        {templatesLoading ? (
                            <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> Loading…</div>
                        ) : (
                            <>
                                {taskTemplates.length === 0 && !showTaskForm && (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No task templates yet. Task templates are reusable task blueprints used inside project templates.</p>
                                )}
                                <div className="space-y-2">
                                    {taskTemplates.map((tt) => (
                                        <div key={tt.id} className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3">
                                            <div>
                                                <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{tt.name}</h3>
                                                <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                                    <span>{tt.type}</span>
                                                    <span>{tt.priority}</span>
                                                    <span>{tt.durationDays}d duration</span>
                                                    <span>weight {tt.completionWeight}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => { setEditingTask(tt); setShowTaskForm(true); }} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <LoadingButton onClick={() => handleDeleteTaskTemplate(tt.id)} loading={deletingTemplate === tt.id} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-500 hover:text-red-600">
                                                    <Trash2 className="size-3.5" />
                                                </LoadingButton>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {showTaskForm ? (
                                    <TaskTemplateForm
                                        workspaceId={wsId}
                                        getToken={getToken}
                                        existing={editingTask}
                                        onSaved={onTaskSaved}
                                        onCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
                                    />
                                ) : (
                                    <button onClick={() => { setEditingTask(null); setShowTaskForm(true); }} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                        <Plus className="size-4" /> New Task Template
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Danger Zone - Only for owners */}
            {isOwner && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-red-200 dark:border-red-900/50 p-6">
                    <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                        Danger Zone
                    </h2>
                    
                    {!deleteConfirm ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    Delete Workspace
                                </p>
                                <p className="text-sm text-gray-500 dark:text-zinc-400">
                                    Permanently delete this workspace and all its data
                                </p>
                            </div>
                            <button
                                onClick={() => setDeleteConfirm(true)}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                            >
                                Delete Workspace
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    This action cannot be undone. This will permanently delete the 
                                    <strong> {currentWorkspace.name}</strong> workspace, all projects, 
                                    tasks, and member associations.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                                    Type <strong>{currentWorkspace.name}</strong> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="Workspace name"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setDeleteConfirm(false);
                                        setConfirmText("");
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Cancel
                                </button>
                                <LoadingButton
                                    onClick={handleDeleteWorkspace}
                                    loading={loading}
                                    disabled={confirmText !== currentWorkspace.name}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Delete Workspace
                                </LoadingButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
