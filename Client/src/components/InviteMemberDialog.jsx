// FOLLO FIX
import { useState, useEffect } from "react";
import { Mail, UserPlus, Building2, FolderOpen, Loader2 } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import { addProjectMemberAsync } from "../features/workspaceSlice";
import toast from "react-hot-toast";
import LoadingButton from "./ui/LoadingButton";

const InviteMemberDialog = ({ isDialogOpen, setIsDialogOpen }) => {
    const dispatch = useDispatch();
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const projects = currentWorkspace?.projects || [];
    const { getToken } = useAuth();
    const { organization } = useOrganization();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // "workspace" = add to workspace (core team), "project" = add to specific project (contractor)
    const [inviteType, setInviteType] = useState("project");
    
    const [formData, setFormData] = useState({
        email: "",
        workspaceRole: "MEMBER",
        projectId: "",
        projectRole: "CONTRIBUTOR",
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentWorkspace) {
            toast.error("No workspace selected");
            return;
        }

        if (inviteType === "project" && !formData.projectId) {
            toast.error("Please select a project");
            return;
        }

        setIsSubmitting(true);
        try {
            if (inviteType === "workspace") {
                // Use Clerk's built-in organization invitation system
                // This sends the email automatically via Clerk
                if (!organization) {
                    toast.error("No organization found. Please select a workspace.");
                    return;
                }
                
                // Map our roles to Clerk roles: ADMIN -> admin, MEMBER -> basic_member
                const clerkRole = formData.workspaceRole === "ADMIN" ? "admin" : "basic_member";
                
                await organization.inviteMember({
                    emailAddress: formData.email,
                    role: clerkRole,
                });
                
                toast.success(`Invitation sent to ${formData.email}! They'll receive an email from Clerk.`);
            } else {
                // Add to specific project (contractor) - uses our custom API + Resend
                const result = await dispatch(addProjectMemberAsync({
                    projectId: formData.projectId,
                    email: formData.email,
                    role: formData.projectRole,
                    getToken,
                })).unwrap();
                
                const projectName = projects.find(p => p.id === formData.projectId)?.name;
                if (result.type === 'invitation') {
                    toast.success(`Invitation sent to ${formData.email} for project "${projectName}"!`);
                } else {
                    toast.success(`Member added to project "${projectName}"!`);
                }
            }
            
            setFormData({ email: "", workspaceRole: "MEMBER", projectId: "", projectRole: "CONTRIBUTOR" });
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Invite error:", error);
            toast.error(error?.errors?.[0]?.message || error?.message || error || "Failed to send invitation");
        } finally {
            setIsSubmitting(false);
        }
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
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                {/* Header */}
                <div className="mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserPlus className="size-5 text-zinc-900 dark:text-zinc-200" /> Invite Member
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Add someone to your team or a specific project
                    </p>
                </div>

                {/* Invite Type Toggle */}
                <div className="flex gap-2 mb-6 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setInviteType("project")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                            inviteType === "project"
                                ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                    >
                        <FolderOpen className="size-4" />
                        Project Member
                    </button>
                    <button
                        type="button"
                        onClick={() => setInviteType("workspace")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                            inviteType === "workspace"
                                ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                    >
                        <Building2 className="size-4" />
                        Workspace Admin
                    </button>
                </div>

                {/* Description based on type */}
                <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    {inviteType === "project" ? (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            <strong className="text-zinc-800 dark:text-zinc-200">Project Member:</strong> Can only access the selected project and its tasks. Ideal for contractors and external collaborators.
                        </p>
                    ) : (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            <strong className="text-zinc-800 dark:text-zinc-200">Workspace Admin:</strong> Has access to all projects in the workspace. Use for core team members and administrators.
                        </p>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 w-4 h-4" />
                            <input 
                                type="email" 
                                value={formData.email} 
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                                placeholder="Enter email address" 
                                className="pl-10 mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 text-sm placeholder-zinc-400 dark:placeholder-zinc-500 py-2 focus:outline-none focus:border-blue-500" 
                                required 
                            />
                        </div>
                    </div>

                    {/* Project Selection (only for project type) */}
                    {inviteType === "project" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                                Project <span className="text-red-500">*</span>
                            </label>
                            <select 
                                value={formData.projectId} 
                                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} 
                                className="w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 py-2 px-3 mt-1 focus:outline-none focus:border-blue-500 text-sm"
                                required={inviteType === "project"}
                            >
                                <option value="">Select a project...</option>
                                {projects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                            {projects.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    No projects yet. Create a project first to add members.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Role */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-200">Role</label>
                        {inviteType === "workspace" ? (
                            <select 
                                value={formData.workspaceRole} 
                                onChange={(e) => setFormData({ ...formData, workspaceRole: e.target.value })} 
                                className="w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 py-2 px-3 mt-1 focus:outline-none focus:border-blue-500 text-sm"
                            >
                                <option value="MEMBER">Member - View all projects</option>
                                <option value="ADMIN">Admin - Full access & management</option>
                            </select>
                        ) : (
                            <select 
                                value={formData.projectRole} 
                                onChange={(e) => setFormData({ ...formData, projectRole: e.target.value })} 
                                className="w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 py-2 px-3 mt-1 focus:outline-none focus:border-blue-500 text-sm"
                            >
                                <option value="CONTRIBUTOR">Contributor - Can work on tasks</option>
                                <option value="MANAGER">Manager - Can manage project</option>
                                <option value="VIEWER">Viewer - Read-only access</option>
                            </select>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsDialogOpen(false)} 
                            className="px-5 py-2 rounded text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                        >
                            Cancel
                        </button>
                        <LoadingButton 
                            type="submit" 
                            loading={isSubmitting}
                            disabled={!currentWorkspace || (inviteType === "project" && !formData.projectId)} 
                            className="px-5 py-2 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-50 hover:opacity-90 transition flex items-center gap-2"
                        >
                            Add Member
                        </LoadingButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InviteMemberDialog;
