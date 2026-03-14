// FOLLO FIX
import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { FileStack, Loader2, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export default function ApplyTemplateDialog({ open, onClose, projectId, onApplied }) {
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const myProjects = useSelector((state) => state.workspace?.myProjects || []);
    const { getToken } = useAuth();

    const project = useMemo(() => {
        const wp = currentWorkspace?.projects?.find((p) => p.id === projectId);
        if (wp) return wp;
        return myProjects.find((p) => p.id === projectId);
    }, [currentWorkspace, myProjects, projectId]);

    const teamMembers = project?.members || [];

    const [projectTemplates, setProjectTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [assigneeMap, setAssigneeMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    // Fetch project templates
    useEffect(() => {
        if (!open || !currentWorkspace?.id) return;
        const load = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(
                    `${API_URL}/api/v1/templates/projects?workspaceId=${currentWorkspace.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const json = await res.json();
                if (json.success) setProjectTemplates(json.data || []);
            } catch {
                /* silent */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [open, currentWorkspace?.id, getToken]);

    const selectedTemplate = projectTemplates.find((t) => t.id === selectedTemplateId);

    // Reset assignee map when template changes
    useEffect(() => {
        setAssigneeMap({});
    }, [selectedTemplateId]);

    const handleApply = async () => {
        if (!selectedTemplateId) return toast.error("Select a project template");
        if (!startDate) return toast.error("Start date is required");

        setApplying(true);
        try {
            const token = await getToken();
            const res = await fetch(
                `${API_URL}/api/v1/templates/projects/${selectedTemplateId}/apply`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        projectId,
                        startDate,
                        assigneeMap,
                    }),
                }
            );
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to apply template");
            toast.success(json.message || `Template applied — ${json.data?.length || 0} tasks created`);
            onApplied?.();
            onClose();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setApplying(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-lg p-6 text-zinc-900 dark:text-white max-h-[85vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                    <FileStack className="size-5 text-blue-500" />
                    Apply Project Template
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
                    Stamp a pre-built set of tasks into this project.
                </p>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="size-6 animate-spin text-zinc-400" />
                    </div>
                ) : projectTemplates.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
                        <p className="mb-2">No project templates found.</p>
                        <p className="text-xs">Create templates in Settings → Project Templates.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Template Selection */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Template</label>
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Select a template --</option>
                                {projectTemplates.map((tpl) => (
                                    <option key={tpl.id} value={tpl.id}>
                                        {tpl.name} ({tpl.tasks?.length || 0} tasks)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Task Preview + Assignee Mapping */}
                        {selectedTemplate && selectedTemplate.tasks?.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Assign Tasks</label>
                                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 max-h-52 overflow-y-auto">
                                    {selectedTemplate.tasks.map((pt) => (
                                        <div key={pt.sortOrder} className="flex items-center gap-3 px-3 py-2 text-sm">
                                            <ChevronRight className="size-3 text-zinc-400 shrink-0" />
                                            <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                                                {pt.taskTemplate?.name || `Step ${idx + 1}`}
                                            </span>
                                            <select
                                                value={assigneeMap[pt.sortOrder] || ""}
                                                onChange={(e) =>
                                                    setAssigneeMap((prev) => ({
                                                        ...prev,
                                                        [pt.sortOrder]: e.target.value,
                                                    }))
                                                }
                                                className="w-36 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200"
                                            >
                                                <option value="">Auto (me)</option>
                                                {teamMembers.map((m) => (
                                                    <option key={m.user.id} value={m.user.id}>
                                                        {m.user.name || m.user.email}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-zinc-400">
                                    Dates auto-calculated from start date + offset days.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={applying || !selectedTemplateId}
                        className="px-5 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {applying && <Loader2 className="size-4 animate-spin" />}
                        Apply Template
                    </button>
                </div>
            </div>
        </div>
    );
}
