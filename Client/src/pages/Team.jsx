import { useEffect, useState, useMemo } from "react";
import { UsersIcon, Search, UserPlus, Trash2 } from "lucide-react";
import InviteMemberDialog from "../components/InviteMemberDialog";
import { useSelector, useDispatch } from "react-redux";
import { useUserRole } from "../hooks/useUserRole";
import { useAuth } from "@clerk/clerk-react";
import { fetchAllUsersAsync, addWorkspaceMemberAsync, removeWorkspaceMemberAsync } from "../features/workspaceSlice";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

const Team = () => {
    const { canManageMembers, isAdmin } = useUserRole();
    const dispatch = useDispatch();
    const { getToken } = useAuth();

    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [confirmRemoveId, setConfirmRemoveId] = useState(null); // userId pending confirmation
    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);
    const allUsers = useSelector((state) => state?.workspace?.allUsers || []);

    // Fetch all system users for admin
    useEffect(() => {
        if (canManageMembers) {
            dispatch(fetchAllUsersAsync(getToken));
        }
    }, [canManageMembers, dispatch]);

    // Users not in current workspace
    const otherUsers = useMemo(() => {
        const memberIds = new Set((currentWorkspace?.members || []).map(m => m.userId || m.user?.id));
        return allUsers.filter(u => !memberIds.has(u.id));
    }, [allUsers, currentWorkspace?.members]);

    const filteredUsers = users.filter(
        (user) =>
            user?.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user?.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredOtherUsers = otherUsers.filter(
        (user) =>
            user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        setUsers(currentWorkspace?.members || []);
    }, [currentWorkspace]);

    // Non-admins cannot access Team page
    if (!isAdmin) {
        return <Navigate to="/tasks" replace />;
    }

    const handleRemoveMember = async (userId) => {
        if (!currentWorkspace) return;
        try {
            await dispatch(removeWorkspaceMemberAsync({
                workspaceId: currentWorkspace.id,
                userId,
                getToken,
            })).unwrap();
            toast.success('Member removed from workspace');
            setConfirmRemoveId(null);
        } catch (error) {
            toast.error(error || 'Failed to remove member');
            setConfirmRemoveId(null);
        }
    };

    const handleQuickAdd = async (userToAdd) => {
        if (!currentWorkspace) return;
        try {
            await dispatch(addWorkspaceMemberAsync({
                workspaceId: currentWorkspace.id,
                email: userToAdd.email,
                role: "MEMBER",
                getToken,
            })).unwrap();
            toast.success(`${userToAdd.name} added to workspace`);
        } catch (error) {
            toast.error(error || "Failed to add member");
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">Team</h1>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm">
                        Manage team members and their contributions
                    </p>
                </div>
                {canManageMembers && (
                    <button onClick={() => setIsDialogOpen(true)} className="flex items-center px-5 py-2 rounded text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white transition" >
                        <UserPlus className="w-4 h-4 mr-2" /> Invite Member
                    </button>
                )}
                <InviteMemberDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 size-3" />
                <input placeholder="Search team members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full text-sm rounded-md border border-gray-300 dark:border-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 py-2 focus:outline-none focus:border-blue-500" />
            </div>

            {/* Team Members */}
            <div className="w-full">
                {filteredUsers.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <UsersIcon className="w-12 h-12 text-gray-400 dark:text-zinc-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {users.length === 0
                                ? "No team members yet"
                                : "No members match your search"}
                        </h3>
                        <p className="text-gray-500 dark:text-zinc-400 mb-6">
                            {users.length === 0
                                ? "Invite team members to start collaborating"
                                : "Try adjusting your search term"}
                        </p>
                    </div>
                ) : (
                    <div className="max-w-4xl w-full">
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto rounded-md border border-gray-200 dark:border-zinc-800">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                                <thead className="bg-gray-50 dark:bg-zinc-900/50">
                                    <tr>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">
                                            Name
                                        </th>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">
                                            Email
                                        </th>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">
                                            Role
                                        </th>
                                        {canManageMembers && (
                                            <th className="px-6 py-2.5 text-right font-medium text-sm"></th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {filteredUsers.map((user) => {
                                        const memberId = user.userId || user.user?.id;
                                        const isOwner = currentWorkspace?.ownerId === memberId;
                                        const isPending = confirmRemoveId === memberId;
                                        return (
                                        <tr
                                            key={user.id}
                                            className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                                        >
                                            <td className="px-6 py-2.5 whitespace-nowrap flex items-center gap-3">
                                                <img
                                                    src={user.user.image}
                                                    alt={user.user.name}
                                                    className="size-7 rounded-full bg-gray-200 dark:bg-zinc-800"
                                                />
                                                <span className="text-sm text-zinc-800 dark:text-white truncate">
                                                    {user.user?.name || "Unknown User"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                                                {user.user.email}
                                            </td>
                                            <td className="px-6 py-2.5 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs rounded-md ${
                                                    isOwner
                                                        ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                                        : user.role === "ADMIN"
                                                        ? "bg-purple-100 dark:bg-purple-500/20 text-purple-500 dark:text-purple-400"
                                                        : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                                                }`}>
                                                    {isOwner ? "Owner" : user.role || "User"}
                                                </span>
                                            </td>
                                            {canManageMembers && (
                                                <td className="px-6 py-2.5 whitespace-nowrap text-right">
                                                    {!isOwner && (
                                                        isPending ? (
                                                            <span className="inline-flex items-center gap-2">
                                                                <span className="text-xs text-gray-500 dark:text-zinc-400">Remove?</span>
                                                                <button onClick={() => handleRemoveMember(memberId)} className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700">Yes</button>
                                                                <button onClick={() => setConfirmRemoveId(null)} className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-600">No</button>
                                                            </span>
                                                        ) : (
                                                            <button onClick={() => setConfirmRemoveId(memberId)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        )
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden space-y-3">
                            {filteredUsers.map((user) => {
                                const memberId = user.userId || user.user?.id;
                                const isOwner = currentWorkspace?.ownerId === memberId;
                                const isPending = confirmRemoveId === memberId;
                                return (
                                <div key={user.id} className="p-4 border border-gray-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-3">
                                            <img src={user.user.image} alt={user.user.name} className="size-9 rounded-full bg-gray-200 dark:bg-zinc-800" />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{user.user?.name || "Unknown User"}</p>
                                                <p className="text-sm text-gray-500 dark:text-zinc-400">{user.user.email}</p>
                                            </div>
                                        </div>
                                        {canManageMembers && !isOwner && (
                                            isPending ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <button onClick={() => handleRemoveMember(memberId)} className="px-2 py-1 text-xs rounded bg-red-600 text-white">Yes</button>
                                                    <button onClick={() => setConfirmRemoveId(null)} className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300">No</button>
                                                </span>
                                            ) : (
                                                <button onClick={() => setConfirmRemoveId(memberId)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            )
                                        )}
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-md ${
                                        isOwner ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                        : user.role === "ADMIN" ? "bg-purple-100 dark:bg-purple-500/20 text-purple-500 dark:text-purple-400"
                                        : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300"
                                    }`}>
                                        {isOwner ? "Owner" : user.role || "User"}
                                    </span>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Other System Users (not in workspace) */}
            {canManageMembers && filteredOtherUsers.length > 0 && (
                <div className="w-full">
                    <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-3">
                        Other Users ({filteredOtherUsers.length})
                    </h2>
                    <div className="max-w-4xl w-full">
                        {/* Desktop */}
                        <div className="hidden sm:block overflow-x-auto rounded-md border border-dashed border-gray-300 dark:border-zinc-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                                <thead className="bg-gray-50/50 dark:bg-zinc-900/30">
                                    <tr>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">Name</th>
                                        <th className="px-6 py-2.5 text-left font-medium text-sm">Email</th>
                                        <th className="px-6 py-2.5 text-right font-medium text-sm"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {filteredOtherUsers.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-2.5 whitespace-nowrap flex items-center gap-3">
                                                <img src={u.image} alt={u.name} className="size-7 rounded-full bg-gray-200 dark:bg-zinc-800" />
                                                <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{u.name}</span>
                                            </td>
                                            <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-400 dark:text-zinc-500">{u.email}</td>
                                            <td className="px-6 py-2.5 whitespace-nowrap text-right">
                                                <button onClick={() => handleQuickAdd(u)} className="px-3 py-1 text-xs rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition">
                                                    + Add
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile */}
                        <div className="sm:hidden space-y-3">
                            {filteredOtherUsers.map((u) => (
                                <div key={u.id} className="p-4 border border-dashed border-gray-300 dark:border-zinc-700 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img src={u.image} alt={u.name} className="size-9 rounded-full bg-gray-200 dark:bg-zinc-800" />
                                            <div>
                                                <p className="font-medium text-gray-700 dark:text-zinc-300 text-sm">{u.name}</p>
                                                <p className="text-xs text-gray-400 dark:text-zinc-500">{u.email}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleQuickAdd(u)} className="px-3 py-1 text-xs rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            + Add
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Team;
