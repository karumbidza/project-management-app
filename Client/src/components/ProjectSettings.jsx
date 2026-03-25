// FOLLO FIX
import { format } from "date-fns";
import { Plus, Save, Mail, Shield, UserPlus, X, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import LoadingButton from "./ui/LoadingButton";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { addProjectMemberAsync, toggleProjectMemberAsync, removeProjectMemberAsync, updateProjectMemberRoleAsync, updateProjectAsync } from "../features/workspaceSlice";
import useUserRole from "../hooks/useUserRole";
import NotAuthorised from "./NotAuthorised";

// Helper to safely format date
const formatDate = (date) => {
    if (!date) return "";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return format(d, "yyyy-MM-dd");
    } catch {
        return "";
    }
};

export default function ProjectSettings({ project }) {
    const { isMemberView } = useUserRole();
    const dispatch = useDispatch();
    const { getToken } = useAuth();

    // FOLLO ACCESS-SEC: failsafe — members must never reach settings regardless of URL
    if (isMemberView) return <NotAuthorised />;
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get('id');

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        status: "PLANNING",
        priority: "MEDIUM",
        startDate: null,
        endDate: null,
        progress: 0,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Invite member state
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("CONTRIBUTOR");
    const [inviting, setInviting] = useState(false);
    const [memberLoading, setMemberLoading] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await dispatch(updateProjectAsync({
                projectId,
                projectData: {
                    name: formData.name,
                    description: formData.description,
                    status: formData.status,
                    priority: formData.priority,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    progress: formData.progress,
                },
                getToken,
            })).unwrap();
            toast.success('Project settings saved');
        } catch (err) {
            toast.error(err || 'Failed to save settings');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim() || !projectId) return;

        setInviting(true);
        try {
            const result = await dispatch(addProjectMemberAsync({
                projectId,
                email: inviteEmail.trim(),
                role: inviteRole,
                getToken,
            })).unwrap();

            if (result.type === 'invitation') {
                toast.success(`Invitation sent to ${inviteEmail}`);
            } else {
                toast.success(`Member added to project`);
            }
            setInviteEmail("");
            setInviteRole("CONTRIBUTOR");
            setShowInvite(false);
        } catch (error) {
            toast.error(error || 'Failed to add member');
        } finally {
            setInviting(false);
        }
    };

    const handleToggleMember = async (memberId, currentlyActive) => {
        setMemberLoading(memberId);
        try {
            await dispatch(toggleProjectMemberAsync({
                projectId,
                memberId,
                getToken,
            })).unwrap();
            toast.success(currentlyActive ? 'Member disabled' : 'Member enabled');
        } catch (error) {
            toast.error(error || 'Failed to toggle member');
        } finally {
            setMemberLoading(null);
        }
    };

    const handleRemoveMember = async (memberId, memberEmail) => {
        if (!window.confirm(`Remove ${memberEmail} from the project?`)) return;
        setMemberLoading(memberId);
        try {
            await dispatch(removeProjectMemberAsync({
                projectId,
                memberId,
                getToken,
            })).unwrap();
            toast.success('Member removed');
        } catch (error) {
            toast.error(error || 'Failed to remove member');
        } finally {
            setMemberLoading(null);
        }
    };

    const handleRoleChange = async (memberId, newRole) => {
        try {
            await dispatch(updateProjectMemberRoleAsync({
                projectId,
                memberId,
                role: newRole,
                getToken,
            })).unwrap();
            toast.success('Role updated');
        } catch (error) {
            toast.error(error || 'Failed to update role');
        }
    };

    useEffect(() => {
        if (project) {
            setFormData({
                name: project.name || "",
                description: project.description || "",
                status: project.status || "PLANNING",
                priority: project.priority || "MEDIUM",
                startDate: project.startDate || null,
                endDate: project.endDate || null,
                progress: project.progress || 0,
            });
        }
    }, [project]);

    const inputClasses = "w-full px-3 py-2 rounded mt-2 border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300";

    const cardClasses = "rounded-lg border p-6 not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border-zinc-300 dark:border-zinc-800";

    const labelClasses = "text-sm text-zinc-600 dark:text-zinc-400";

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            {/* Project Details */}
            <div className={cardClasses}>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300 mb-4">Project Details</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Project Name</label>
                        <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClasses} required />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Description</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={inputClasses + " h-24"} />
                    </div>

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Status</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputClasses} >
                                <option value="PLANNING">Planning</option>
                                <option value="ACTIVE">Active</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className={labelClasses}>Priority</label>
                            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className={inputClasses} >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-4 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Start Date</label>
                            <input type="date" value={formatDate(formData.startDate)} onChange={(e) => setFormData({ ...formData, startDate: e.target.value ? new Date(e.target.value) : null })} className={inputClasses} />
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>End Date</label>
                            <input type="date" value={formatDate(formData.endDate)} onChange={(e) => setFormData({ ...formData, endDate: e.target.value ? new Date(e.target.value) : null })} className={inputClasses} />
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Progress: {formData.progress}%</label>
                        <input type="range" min="0" max="100" step="5" value={formData.progress} onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })} className="w-full accent-blue-500 dark:accent-blue-400" />
                    </div>

                    {/* Save Button */}
                    <LoadingButton type="submit" loading={isSubmitting} className="ml-auto flex items-center text-sm justify-center gap-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white px-4 py-2 rounded" >
                        <Save className="size-4" /> Save Changes
                    </LoadingButton>
                </form>
            </div>

            {/* Team Members */}
            <div className="space-y-6">
                <div className={cardClasses}>
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300">
                            Team Members <span className="text-sm text-zinc-600 dark:text-zinc-400">({project.members?.length || 0})</span>
                        </h2>
                        <button 
                            type="button" 
                            onClick={() => setShowInvite(!showInvite)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-300"
                        >
                            <UserPlus className="size-4" />
                            <span className="hidden sm:inline">Invite</span>
                        </button>
                    </div>

                    {/* Invite Form */}
                    {showInvite && (
                        <form onSubmit={handleInvite} className="mb-4 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                                    <Mail className="size-4" /> Invite by Email
                                </h3>
                                <button type="button" onClick={() => setShowInvite(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                    <X className="size-4" />
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    required
                                    className="flex-1 px-3 py-2 rounded border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300 focus:outline-none focus:border-blue-500"
                                />
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="px-3 py-2 rounded border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300"
                                >
                                    <option value="CONTRIBUTOR">Contributor</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="VIEWER">Viewer</option>
                                </select>
                                <LoadingButton
                                    type="submit"
                                    loading={inviting}
                                    disabled={!inviteEmail.trim()}
                                    className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                    Send Invite
                                </LoadingButton>
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                If the user exists they'll be added immediately, otherwise an invitation email will be sent.
                            </p>
                        </form>
                    )}

                    {/* Member List */}
                    {project.members?.length > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {project.members.map((member) => {
                                const isOwner = member.role === 'OWNER';
                                const isActive = member.isActive !== false;
                                return (
                                    <div 
                                        key={member.id} 
                                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                                            isActive 
                                                ? 'bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700' 
                                                : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-60'
                                        }`} 
                                    >
                                        {/* Member Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate">
                                                    {member.user?.name || member.user?.email || "Unknown"}
                                                </span>
                                                {!isActive && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                                        Disabled
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate block">
                                                {member.user?.email}
                                            </span>
                                        </div>

                                        {/* Role */}
                                        {isOwner ? (
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                Owner
                                            </span>
                                        ) : (
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                className="px-2 py-1 rounded text-xs border dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                                            >
                                                <option value="CONTRIBUTOR">Contributor</option>
                                                <option value="MANAGER">Manager</option>
                                                <option value="VIEWER">Viewer</option>
                                            </select>
                                        )}

                                        {/* Actions (not for owner) */}
                                        {!isOwner && (
                                            <div className="flex items-center gap-1">
                                                {/* Toggle active/disabled */}
                                                <LoadingButton
                                                    onClick={() => handleToggleMember(member.id, isActive)}
                                                    loading={memberLoading === member.id}
                                                    title={isActive ? 'Disable member' : 'Enable member'}
                                                    className={`p-1.5 rounded transition-colors ${
                                                        isActive 
                                                            ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' 
                                                            : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                    }`}
                                                >
                                                    {isActive ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                                                </LoadingButton>
                                                {/* Remove */}
                                                <LoadingButton
                                                    onClick={() => handleRemoveMember(member.id, member.user?.email)}
                                                    loading={memberLoading === member.id}
                                                    title="Remove member"
                                                    className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 className="size-4" />
                                                </LoadingButton>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No members yet. Invite someone to get started.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
