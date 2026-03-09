import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useOrganizationList, useAuth } from '@clerk/clerk-react';
import { useDispatch } from 'react-redux';
import { fetchWorkspaces } from '../features/workspaceSlice';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function CreateWorkspaceDialog({ isOpen, onClose }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { createOrganization, setActive } = useOrganizationList();
    const { getToken, userId } = useAuth();
    const dispatch = useDispatch();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!name.trim()) {
            toast.error('Workspace name is required');
            return;
        }

        setLoading(true);
        try {
            // Create organization in Clerk
            const organization = await createOrganization({ name: name.trim() });
            
            // Also create in our database immediately (don't wait for webhook)
            const token = await getToken();
            await fetch(`${API_URL}/api/v1/workspaces/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug,
                    ownerId: userId,
                    image_url: organization.imageUrl,
                }),
            });
            
            // Set this as the active organization
            await setActive({ organization: organization.id });
            
            // Refresh workspaces list (pass getToken directly)
            await dispatch(fetchWorkspaces(getToken));
            
            toast.success('Workspace created successfully!');
            setName('');
            setDescription('');
            onClose();
        } catch (error) {
            console.error('Failed to create workspace:', error);
            toast.error(error?.errors?.[0]?.message || 'Failed to create workspace');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Workspace</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                            Workspace Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Workspace"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={loading}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this workspace for?"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            disabled={loading}
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Workspace'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateWorkspaceDialog;
