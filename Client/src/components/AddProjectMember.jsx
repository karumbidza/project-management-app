import { useState } from "react";
import { Mail, UserPlus, Shield } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { addProjectMemberAsync } from "../features/workspaceSlice";

const PROJECT_ROLES = [
    { value: 'CONTRIBUTOR', label: 'Contributor', description: 'Can create and edit tasks' },
    { value: 'MANAGER', label: 'Manager', description: 'Can manage tasks and members' },
    { value: 'VIEWER', label: 'Viewer', description: 'Can view only' },
];

const AddProjectMember = ({ isDialogOpen, setIsDialogOpen }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth();
    const [searchParams] = useSearchParams();

    const id = searchParams.get('id');

    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const loadingStates = useSelector((state) => state.workspace?.loadingStates || {});

    const project = currentWorkspace?.projects?.find((p) => p.id === id);
    const projectMemberUserIds = project?.members?.map((member) => member.user?.id || member.userId) || [];

    const [email, setEmail] = useState('');
    const [role, setRole] = useState('CONTRIBUTOR');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!email || !project) {
            toast.error('Please select a member');
            return;
        }

        try {
            await dispatch(addProjectMemberAsync({
                projectId: project.id,
                email,
                role,
                getToken,
            })).unwrap();
            
            toast.success('Member added to project');
            setEmail('');
            setRole('CONTRIBUTOR');
            setIsDialogOpen(false);
        } catch (error) {
            toast.error(error || 'Failed to add member');
        }
    };

    // Get workspace members who are not project members
    const availableMembers = currentWorkspace?.members?.filter(
        (member) => !projectMemberUserIds.includes(member.user?.id || member.userId)
    ) || [];

    if (!isDialogOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                {/* Header */}
                <div className="mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserPlus className="size-5 text-zinc-900 dark:text-zinc-200" /> Add Member to Project
                    </h2>
                    {project && (
                        <p className="text-sm text-zinc-700 dark:text-zinc-400">
                            Adding to Project: <span className="text-blue-600 dark:text-blue-400">{project.name}</span>
                        </p>
                    )}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email Selection */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                            Select Member
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 w-4 h-4 pointer-events-none" />
                            <select 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                className="pl-10 mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 text-sm placeholder-zinc-400 dark:placeholder-zinc-500 py-2 focus:outline-none focus:border-blue-500" 
                                required 
                            >
                                <option value="">Select a workspace member</option>
                                {availableMembers.map((member) => (
                                    <option key={member.user?.id || member.id} value={member.user?.email}>
                                        {member.user?.name || member.user?.email} ({member.user?.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {availableMembers.length === 0 && (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                All workspace members are already in this project
                            </p>
                        )}
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Role
                        </label>
                        <div className="space-y-2">
                            {PROJECT_ROLES.map((r) => (
                                <label 
                                    key={r.value} 
                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                        role === r.value 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={r.value}
                                        checked={role === r.value}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium text-sm">{r.label}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setIsDialogOpen(false)} 
                            className="px-5 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition" 
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loadingStates.members || !email || availableMembers.length === 0} 
                            className="px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white disabled:opacity-50 transition" 
                        >
                            {loadingStates.members ? "Adding..." : "Add Member"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddProjectMember;
