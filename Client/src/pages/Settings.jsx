import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { Building2, Trash2, Loader2, Moon, Sun } from "lucide-react";
import { deleteWorkspaceAsync } from "../features/workspaceSlice";
import { toggleTheme } from "../features/themeSlice";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Settings() {
    const { currentWorkspace, workspaces, loadingStates } = useSelector((state) => state.workspace);
    const { theme } = useSelector((state) => state.theme);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { getToken, userId } = useAuth();
    
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    const isOwner = currentWorkspace?.ownerId === userId;
    const loading = loadingStates?.workspaces ?? false;

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
                                <button
                                    onClick={handleDeleteWorkspace}
                                    disabled={loading || confirmText !== currentWorkspace.name}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={16} />
                                            Delete Workspace
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
