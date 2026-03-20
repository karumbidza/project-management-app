// FOLLO FIX
// FOLLO SLA
// FOLLO GLITCH-FIX
import { useState, useEffect } from "react";
import { XIcon, Loader2 } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { createProjectAsync, fetchWorkspaces } from "../features/workspaceSlice";
import toast from "react-hot-toast";
import LoadingButton from "./ui/LoadingButton";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const CreateProjectDialog = ({ isDialogOpen, setIsDialogOpen }) => {

    const { currentWorkspace } = useSelector((state) => state.workspace);
    const dispatch = useDispatch();
    const { getToken } = useAuth();

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        status: "PLANNING",
        priority: "MEDIUM",
        startDate: "",
        endDate: "",
        team_members: [],
        team_lead: "",
        progress: 0,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesFailed, setTemplatesFailed] = useState(false);

    // Fetch project templates when dialog opens
    useEffect(() => {
        if (!isDialogOpen || !currentWorkspace?.id) return;
        let cancelled = false;
        const fetchTemplates = async () => {
            setTemplatesLoading(true);
            setTemplatesFailed(false);
            try {
                const token = await getToken();
                const res = await fetch(
                    `${API_URL}/api/v1/templates/projects?workspaceId=${currentWorkspace.id}`,
                    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
                );
                if (!res.ok) throw new Error();
                const json = await res.json();
                if (!cancelled) setTemplates(json.data || []);
            } catch {
                if (!cancelled) setTemplatesFailed(true);
            } finally {
                if (!cancelled) setTemplatesLoading(false);
            }
        };
        fetchTemplates();
        return () => { cancelled = true; };
    }, [isDialogOpen, currentWorkspace?.id, getToken]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentWorkspace) {
            toast.error("No workspace selected");
            return;
        }

        if (!formData.name.trim()) {
            toast.error("Project name is required");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await dispatch(createProjectAsync({
                workspaceId: currentWorkspace.id,
                projectData: {
                    name: formData.name,
                    description: formData.description,
                    status: formData.status,
                    priority: formData.priority,
                    startDate: formData.startDate || null,
                    endDate: formData.endDate || null,
                    ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
                },
                getToken,
            })).unwrap();
            
            toast.success("Project created successfully!");
            setIsDialogOpen(false);
            // FOLLO GLITCH-FIX: dispatch a fresh fetchWorkspaces so its requestId becomes
            // the latest. Any in-flight focus-triggered GET (older requestId) will be
            // discarded by the reducer, preventing it from overwriting the new project.
            dispatch(fetchWorkspaces(getToken));
            // Reset form
            setFormData({
                name: "",
                description: "",
                status: "PLANNING",
                priority: "MEDIUM",
                startDate: "",
                endDate: "",
                team_members: [],
                team_lead: "",
                progress: 0,
            });
            setSelectedTemplateId("");
        } catch (error) {
            toast.error(error || "Failed to create project");
        } finally {
            setIsSubmitting(false);
        }
    };

    const removeTeamMember = (email) => {
        setFormData((prev) => ({ ...prev, team_members: prev.team_members.filter(m => m !== email) }));
    };

    // Close on Escape key
    useEffect(() => {
        if (!isDialogOpen) return;
        const h = (e) => { if (e.key === 'Escape') setIsDialogOpen(false); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [isDialogOpen, setIsDialogOpen]);

    if (!isDialogOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur flex items-center justify-center text-left z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-lg text-zinc-900 dark:text-zinc-200 relative">
                <button className="absolute top-3 right-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" onClick={() => setIsDialogOpen(false)} >
                    <XIcon className="size-5" />
                </button>

                <h2 className="text-xl font-medium mb-1">Create New Project</h2>
                {currentWorkspace && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        In workspace: <span className="text-blue-600 dark:text-blue-400">{currentWorkspace.name}</span>
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Project Name */}
                    <div>
                        <label className="block text-sm mb-1">Project Name</label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter project name" className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm" required />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm mb-1">Description</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe your project" className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm h-20" />
                    </div>

                    {/* Project Template (optional) */}
                    {!templatesFailed && (
                        <div>
                            <label className="block text-sm mb-1">Project Template</label>
                            {templatesLoading ? (
                                <div className="flex items-center gap-2 px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-sm text-zinc-500">
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading templates…
                                </div>
                            ) : (
                                <select
                                    value={selectedTemplateId}
                                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                                    className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm"
                                >
                                    <option value="">
                                        {templates.length === 0
                                            ? "No templates available — you can add tasks manually"
                                            : "No template — start blank"}
                                    </option>
                                    {templates.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1">Status</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm" >
                                <option value="PLANNING">Planning</option>
                                <option value="ACTIVE">Active</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm mb-1">Priority</label>
                            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm" >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1">Start Date</label>
                            <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">End Date</label>
                            <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} min={formData.startDate && new Date(formData.startDate).toISOString().split('T')[0]} className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm" />
                        </div>
                    </div>

                    {/* Lead */}
                    <div>
                        <label className="block text-sm mb-1">Project Lead</label>
                        <select value={formData.team_lead} onChange={(e) => setFormData({ ...formData, team_lead: e.target.value, team_members: e.target.value ? [...new Set([...formData.team_members, e.target.value])] : formData.team_members, })} className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm" >
                            <option value="">No lead</option>
                            {currentWorkspace?.members?.map((member) => (
                                <option key={member.user.email} value={member.user.email}>
                                    {member.user.email}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Team Members */}
                    <div>
                        <label className="block text-sm mb-1">Team Members</label>
                        <select className="w-full px-3 py-2 rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 mt-1 text-zinc-900 dark:text-zinc-200 text-sm"
                            onChange={(e) => {
                                if (e.target.value && !formData.team_members.includes(e.target.value)) {
                                    setFormData((prev) => ({ ...prev, team_members: [...prev.team_members, e.target.value] }));
                                }
                            }}
                        >
                            <option value="">Add team members</option>
                            {currentWorkspace?.members
                                ?.filter((email) => !formData.team_members.includes(email))
                                .map((member) => (
                                    <option key={member.user.email} value={member.email}>
                                        {member.user.email}
                                    </option>
                                ))}
                        </select>

                        {formData.team_members.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {formData.team_members.map((email) => (
                                    <div key={email} className="flex items-center gap-1 bg-blue-200/50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-md text-sm" >
                                        {email}
                                        <button type="button" onClick={() => removeTeamMember(email)} className="ml-1 hover:bg-blue-300/30 dark:hover:bg-blue-500/30 rounded" >
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2 text-sm">
                        <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800" >
                            Cancel
                        </button>
                        <LoadingButton type="submit" loading={isSubmitting} disabled={!currentWorkspace} className="px-4 py-2 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white dark:text-zinc-200" >
                            Create Project
                        </LoadingButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProjectDialog;