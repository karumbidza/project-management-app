// FOLLO ACCESS-SEC
// FOLLO AUDIT
// FOLLO PERF
// FOLLO SRP
// FOLLO WORKFLOW
// FOLLO DEPS
// FOLLO ASSIGN
// FOLLO TASK-UI
import { format, parseISO, isValid } from "date-fns";
import toast from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { io as ioClient } from "socket.io-client";
import { updateTaskAsync } from "../features/taskSlice";
import { addCommentAsync } from "../features/commentSlice";
import {
    submitTaskAsync,
    approveTaskAsync,
    rejectTaskAsync,
    raiseBlockerAsync,
    resolveBlockerAsync,
    fetchTaskSlaAsync,
    requestMoreInfoAsync,
    requestExtensionAsync,
    approveExtensionAsync,
    denyExtensionAsync,
} from "../features/slaSlice";
import useUserRole from "../hooks/useUserRole";
import { useMediaUpload, MEDIA_LIMITS, detectMediaType } from "../hooks/useMediaUpload";
import TaskSLABanner from "../components/task/TaskSLABanner";
import TaskInfoCard from "../components/task/TaskInfoCard";
import TaskActionPanel from "../components/task/TaskActionPanel";
import TaskCommentPanel from "../components/task/TaskCommentPanel";
import ProjectInfoCard from "../components/task/ProjectInfoCard";
import TaskDependencies from "../components/TaskDependencies"; // FOLLO DEPS
import NotAuthorised from "../components/NotAuthorised";

const COMMENT_POLL_INTERVAL = 10000; // 10 seconds

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Safe date formatter
const formatDate = (dateValue, formatStr = "dd MMM yyyy") => {
    if (!dateValue) return "-";
    try {
        const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
        return isValid(date) ? format(date, formatStr) : "-";
    } catch {
        return "-";
    }
};

const TaskDetails = () => {

    const [searchParams, setSearchParams] = useSearchParams();
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");
    const navigate = useNavigate();

    const { user } = useUser();
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const { canSubmitTask, canApproveReject, canRaiseBlocker, canResolveBlocker, canAssignTasks } = useUserRole();
    
    const [task, setTask] = useState(null);
    const [project, setProject] = useState(null);
    const [newComment, setNewComment] = useState("");
    // FOLLO ACCESS-SEC
    const [accessError, setAccessError] = useState(null); // 'not_found' | 'forbidden' | null
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // FOLLO DEPS — project tasks for dependency picker
    const [projectTasks, setProjectTasks] = useState([]);
    
    // FOLLO PERMISSIONS - SLA state
    const [slaData, setSlaData] = useState(null);
    const [showBlockerModal, setShowBlockerModal] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [blockerDescription, setBlockerDescription] = useState("");
    const [blockerFile, setBlockerFile] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [resolveResolution, setResolveResolution] = useState("REMEDIATE");
    const [resolveNote, setResolveNote] = useState("");
    const [slaActionLoading, setSlaActionLoading] = useState(false);
    
    // FOLLO WORKFLOW — completion modal state
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionNotes, setCompletionNotes] = useState("");
    const [completionPhotos, setCompletionPhotos] = useState([]);
    const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
    const completionFileRef = useRef(null);
    const { upload: completionUpload, uploading: completionUploading } = useMediaUpload();
    // FOLLO WORKFLOW — request-info state
    const [showRequestInfoForm, setShowRequestInfoForm] = useState(false);
    const [requestInfoQuestion, setRequestInfoQuestion] = useState("");
    // FOLLO WORKFLOW — view submission toggle
    const [showSubmission, setShowSubmission] = useState(false);
    // FOLLO WORKFLOW — extension request state
    const [showExtensionModal, setShowExtensionModal] = useState(false);
    const [extensionReason, setExtensionReason] = useState("");
    const [extensionDate, setExtensionDate] = useState("");
    const [showDenyExtensionForm, setShowDenyExtensionForm] = useState(false);
    const [denyExtensionReason, setDenyExtensionReason] = useState("");
    
    // Ref for getToken so fetchTaskDetails doesn't recreate on auth re-renders
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    
    // FOLLO MEDIA - file upload state
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const fileInputRef = useRef(null);
    const { upload, uploading, progress, error: uploadError, clearError } = useMediaUpload();
    const { upload: blockerUpload, uploading: blockerUploading } = useMediaUpload();
    const blockerFileRef = useRef(null);

    const { currentWorkspace, myProjects } = useSelector((state) => state.workspace);

    // FOLLO ASSIGN — workspace members with project-membership flag
    const workspaceMembers = useMemo(() => {
        const members = currentWorkspace?.members || [];
        const projectMemberIds = new Set(
            (project?.members || []).map(m => m.userId || m.user?.id)
        );
        return members.map(m => ({
            ...m,
            isProjectMember: projectMemberIds.has(m.userId || m.user?.id),
        }));
    }, [currentWorkspace?.members, project?.members]);

    // Auto-scroll chat to bottom
    const chatEndRef = useRef(null);
    // Stable ref to current user ID for socket event filtering
    const userIdRef = useRef(user?.id);
    userIdRef.current = user?.id;
    // Track pending optimistic comments so polling doesn't wipe them
    const pendingCommentIds = useRef(new Set());
    // Track confirmed comment IDs for tick UI (auto-clears after a few seconds)
    const [confirmedCommentIds, setConfirmedCommentIds] = useState(new Set());
    // Track failed comment IDs for retry UI
    const [failedCommentIds, setFailedCommentIds] = useState(new Set());
    // Mirror failed IDs in a ref so fetchTaskDetails merge can read without re-creating the callback
    const failedCommentIdsRef = useRef(failedCommentIds);
    failedCommentIdsRef.current = failedCommentIds;

    const fetchTaskDetails = useCallback(async ({ silent = false } = {}) => {
        if (!taskId) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        try {
            const token = await getTokenRef.current();
            
            const response = await fetch(`${API_URL}/api/v1/tasks/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            // FOLLO ACCESS-SEC — handle access errors gracefully
            if (response.status === 404) {
                setAccessError('not_found');
                if (!silent) setLoading(false);
                return;
            }
            if (response.status === 403) {
                setAccessError('forbidden');
                if (!silent) setLoading(false);
                return;
            }

            if (response.ok && result.success && result.data) {
                if (silent) {
                    // MERGE: keep pending/failed optimistic comments, add server comments, dedupe
                    setTask(prev => {
                        if (!prev) return result.data;
                        const serverComments = result.data.comments || [];
                        const serverIds = new Set(serverComments.map(c => c.id));
                        // Keep pending/failed comments that the server doesn't know about yet
                        const localOnly = (prev.comments || []).filter(c =>
                            (pendingCommentIds.current.has(c.id) || failedCommentIdsRef.current.has(c.id)) && !serverIds.has(c.id)
                        );
                        const merged = [...serverComments, ...localOnly].sort(
                            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
                        );
                        return { ...result.data, comments: merged };
                    });
                } else {
                    setTask(result.data);
                }
                setProject(result.data.project);
            } else {
                if (!silent) {
                    console.error('[TaskDetails] API error:', result.error);
                    toast.error(result.error?.message || 'Failed to load task');
                }
            }
        } catch (error) {
            if (!silent) {
                console.error('[TaskDetails] Fetch error:', error);
                toast.error('Failed to load task details');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [taskId]);

    const handleAddComment = async () => {
        // FOLLO PERF: Bulletproof empty comment prevention
        const trimmedComment = (newComment || '').trim();
        const hasContent = trimmedComment.length > 0;
        const hasFile = !!selectedFile;
        
        // Early return: must have content OR file, and not already submitting
        if (isSubmitting) return;
        if (!hasContent && !hasFile) {
            return;
        }

        // FOLLO PERF: Optimistic update - add comment IMMEDIATELY before API call
        const tempId = `temp-${Date.now()}`;
        pendingCommentIds.current.add(tempId);
        const optimisticComment = {
            id: tempId,
            content: trimmedComment,
            type: selectedFile ? 'FILE' : 'TEXT',
            userId: user?.id,
            taskId,
            createdAt: new Date().toISOString(),
            user: {
                id: user?.id,
                name: user?.fullName || 'You',
                image: user?.imageUrl
            }
        };
        
        // Add to UI immediately - user sees their comment right away
        setTask(prev => ({
            ...prev,
            comments: [...(prev.comments || []), optimisticComment]
        }));
        
        // Scroll to bottom immediately
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        
        // Clear input immediately for snappy UX
        const savedComment = newComment;
        setNewComment("");
        
        setIsSubmitting(true);
        try {
            let mediaData = null;

            // Upload file first if selected
            if (selectedFile) {
                try {
                    mediaData = await upload(selectedFile);
                } catch (uploadErr) {
                    toast.error(uploadErr.message || "Failed to upload file");
                    // Rollback optimistic update
                    pendingCommentIds.current.delete(tempId);
                    setTask(prev => ({
                        ...prev,
                        comments: (prev.comments || []).filter(c => c.id !== tempId)
                    }));
                    setNewComment(savedComment);
                    setIsSubmitting(false);
                    return;
                }
            }

            // Build comment data
            const commentData = {
                taskId,
                getToken,
                ...(mediaData ? {
                    type: mediaData.type,
                    url: mediaData.url,
                    fileKey: mediaData.fileKey,
                    thumbnailUrl: mediaData.thumbnailUrl,
                    duration: mediaData.duration,
                    sizeBytes: mediaData.sizeBytes,
                    fileName: mediaData.fileName,
                    muxUploadId: mediaData.muxUploadId,
                    muxAssetId: mediaData.muxAssetId,
                    muxPlaybackId: mediaData.muxPlaybackId,
                    content: trimmedComment || null,
                } : {
                    content: trimmedComment,
                    type: 'TEXT',
                }),
            };

            const isMedia = !!mediaData;
            // Fire API call but DON'T wait for it to complete UI
            dispatch(addCommentAsync(commentData))
                .unwrap()
                .then(result => {
                    // Replace temp comment with real one (with real ID)
                    if (result?.comment) {
                        const realId = result.comment.id;
                        // Protect the real ID from stale in-flight poll responses
                        pendingCommentIds.current.add(realId);
                        setTask(prev => ({
                            ...prev,
                            comments: (prev.comments || []).map(c => 
                                c.id === tempId ? { ...result.comment, user: result.comment.user || optimisticComment.user } : c
                            )
                        }));
                        // CRITICAL: Do NOT delete tempId synchronously here.
                        // React queues setTask — if a poll's setTask is already queued,
                        // it reads pendingCommentIds at execution time. Deleting tempId
                        // before React processes the queue causes the poll to drop the
                        // temp comment before .then()'s setTask can replace it.
                        // Clean up both IDs after React has flushed and next poll has fresh data.
                        setTimeout(() => {
                            pendingCommentIds.current.delete(tempId);
                            pendingCommentIds.current.delete(realId);
                        }, COMMENT_POLL_INTERVAL + 2000);
                    } else {
                        setTimeout(() => {
                            pendingCommentIds.current.delete(tempId);
                        }, COMMENT_POLL_INTERVAL + 2000);
                    }
                    // Show ✓ tick on the comment instead of a toast
                    const confirmedId = result?.comment?.id || tempId;
                    setConfirmedCommentIds(prev => new Set(prev).add(confirmedId));
                    // Auto-clear the tick after 4 seconds
                    setTimeout(() => {
                        setConfirmedCommentIds(prev => {
                            const next = new Set(prev);
                            next.delete(confirmedId);
                            return next;
                        });
                    }, 4000);
                })
                .catch(err => {
                    pendingCommentIds.current.delete(tempId);
                    console.error('[TaskDetails] Comment API error:', err);
                    // Mark as failed — keep visible with retry label, never remove silently
                    setFailedCommentIds(prev => new Set(prev).add(tempId));
                    toast.error('Failed to post comment');
                });
            
            clearSelectedFile();
        } catch (error) {
            console.error('[TaskDetails] Comment error:', error);
            // Mark as failed — keep visible with retry label
            pendingCommentIds.current.delete(tempId);
            setFailedCommentIds(prev => new Set(prev).add(tempId));
            toast.error(error || "Failed to add comment");
        } finally {
            setIsSubmitting(false);
        }
    };

    // FOLLO MEDIA - File selection handlers
    const handleFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const mediaType = detectMediaType(file);
        const maxSize = MEDIA_LIMITS[mediaType];

        if (file.size > maxSize) {
            const maxMB = maxSize / 1024 / 1024;
            toast.error(`File too large. Max size for ${mediaType} is ${maxMB}MB`);
            return;
        }

        setSelectedFile(file);
        clearError();

        // Create preview for images
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => setFilePreview(e.target?.result);
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }
    }, [clearError]);

    const clearSelectedFile = useCallback(() => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    // FOLLO WORKFLOW — Submit with completion evidence
    const handleSubmitForApproval = async () => {
        if (slaActionLoading) return;
        if (completionNotes.trim().length < 20) {
            toast.error('Completion notes must be at least 20 characters');
            return;
        }
        if (completionPhotos.length < 1) {
            toast.error('At least one completion photo is required');
            return;
        }
        if (!declarationConfirmed) {
            toast.error('You must confirm the declaration');
            return;
        }
        setSlaActionLoading(true);
        try {
            await dispatch(submitTaskAsync({
                taskId: task.id,
                completionNotes: completionNotes.trim(),
                completionPhotos,
                declaration: true,
                getToken,
            })).unwrap();
            toast.success('Submitted! Awaiting PM approval.');
            setShowCompletionModal(false);
            setCompletionNotes('');
            setCompletionPhotos([]);
            setDeclarationConfirmed(false);
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to submit task');
        } finally {
            setSlaActionLoading(false);
        }
    };

    // FOLLO WORKFLOW — Add completion photo
    const handleAddCompletionPhoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Only images are allowed for completion photos');
            return;
        }
        try {
            const result = await completionUpload(file);
            setCompletionPhotos(prev => [...prev, result.url]);
        } catch (err) {
            toast.error(err?.message || 'Failed to upload photo');
        }
        if (completionFileRef.current) completionFileRef.current.value = '';
    };

    // FOLLO WORKFLOW — Request more info
    const handleRequestMoreInfo = async () => {
        if (slaActionLoading || !requestInfoQuestion.trim()) {
            if (!requestInfoQuestion.trim()) toast.error('Please enter a question');
            return;
        }
        setSlaActionLoading(true);
        try {
            await dispatch(requestMoreInfoAsync({ taskId: task.id, question: requestInfoQuestion.trim(), getToken })).unwrap();
            toast.success('Question posted to task discussion');
            setShowRequestInfoForm(false);
            setRequestInfoQuestion('');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to request info');
        } finally {
            setSlaActionLoading(false);
        }
    };

    // FOLLO ASSIGN — update task assignee (or any field)
    const handleUpdateTask = async (data) => {
        try {
            await dispatch(updateTaskAsync({
                taskId: task.id,
                projectId,
                taskData: data,
                getToken,
            })).unwrap();
            fetchTaskDetails();
            toast.success('Task updated');
        } catch (err) {
            toast.error(err?.message || err || 'Failed to update task');
            throw err;
        }
    };

    // FOLLO WORKFLOW — toggle priority manual override
    const handleTogglePriorityOverride = async () => {
        try {
            const newVal = !task.priorityOverride;
            await dispatch(updateTaskAsync({
                taskId: task.id,
                projectId,
                taskData: { priorityOverride: newVal },
                getToken,
            })).unwrap();
            setTask(prev => ({ ...prev, priorityOverride: newVal }));
            toast.success(newVal ? 'Priority locked to manual' : 'Priority set to auto-calculate');
        } catch (err) {
            toast.error(err?.message || err || 'Failed to toggle priority override');
        }
    };

    const handleApproveTask = async () => {
        if (slaActionLoading) return;
        if (!window.confirm('Approve this task as complete?')) return;
        setSlaActionLoading(true);
        try {
            await dispatch(approveTaskAsync({ taskId: task.id, getToken })).unwrap();
            toast.success('Task approved! Project completion updated.');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to approve task');
        } finally {
            setSlaActionLoading(false);
        }
    };

    const handleRejectTask = async () => {
        if (slaActionLoading || !rejectReason.trim()) {
            if (!rejectReason.trim()) toast.error('Please provide a reason for rejection');
            return;
        }
        setSlaActionLoading(true);
        try {
            await dispatch(rejectTaskAsync({ taskId: task.id, reason: rejectReason.trim(), getToken })).unwrap();
            toast.success('Task rejected. Assignee has been notified.');
            setShowRejectForm(false);
            setRejectReason('');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to reject task');
        } finally {
            setSlaActionLoading(false);
        }
    };

    const handleRaiseBlocker = async () => {
        if (slaActionLoading) return;
        if (blockerDescription.trim().length < 20) {
            toast.error('Please describe the issue in at least 20 characters');
            return;
        }
        setSlaActionLoading(true);
        try {
            let mediaUrl = null;
            if (blockerFile) {
                const mediaResult = await blockerUpload(blockerFile);
                mediaUrl = mediaResult.url;
            }
            await dispatch(raiseBlockerAsync({ taskId: task.id, description: blockerDescription.trim(), mediaUrl, getToken })).unwrap();
            toast.success('Blocker raised. PM has been notified.');
            setShowBlockerModal(false);
            setBlockerDescription('');
            setBlockerFile(null);
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to raise blocker');
        } finally {
            setSlaActionLoading(false);
        }
    };

    const handleResolveBlocker = async () => {
        if (slaActionLoading || !resolveNote.trim()) {
            if (!resolveNote.trim()) toast.error('Please provide a resolution note');
            return;
        }
        setSlaActionLoading(true);
        try {
            await dispatch(resolveBlockerAsync({ taskId: task.id, resolution: resolveResolution, note: resolveNote.trim(), getToken })).unwrap();
            toast.success('Blocker resolved. Assignee notified.');
            setShowResolveModal(false);
            setResolveNote('');
            setResolveResolution('REMEDIATE');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to resolve blocker');
        } finally {
            setSlaActionLoading(false);
        }
    };

    // FOLLO WORKFLOW — extension handlers
    const handleRequestExtension = async () => {
        if (slaActionLoading || !extensionReason.trim() || !extensionDate) {
            if (!extensionReason.trim()) toast.error('Please provide a reason');
            if (!extensionDate) toast.error('Please select a proposed date');
            return;
        }
        setSlaActionLoading(true);
        try {
            await dispatch(requestExtensionAsync({ taskId: task.id, reason: extensionReason.trim(), proposedDate: extensionDate, getToken })).unwrap();
            toast.success('Extension request submitted');
            setShowExtensionModal(false);
            setExtensionReason('');
            setExtensionDate('');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to request extension');
        } finally {
            setSlaActionLoading(false);
        }
    };

    const handleApproveExtension = async () => {
        if (slaActionLoading) return;
        setSlaActionLoading(true);
        try {
            await dispatch(approveExtensionAsync({ taskId: task.id, getToken })).unwrap();
            toast.success('Extension approved. Deadline updated.');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to approve extension');
        } finally {
            setSlaActionLoading(false);
        }
    };

    const handleDenyExtension = async () => {
        if (slaActionLoading) return;
        setSlaActionLoading(true);
        try {
            await dispatch(denyExtensionAsync({ taskId: task.id, reason: denyExtensionReason.trim(), getToken })).unwrap();
            toast.success('Extension denied.');
            setShowDenyExtensionForm(false);
            setDenyExtensionReason('');
            fetchTaskDetails();
        } catch (err) {
            toast.error(err?.message || err || 'Failed to deny extension');
        } finally {
            setSlaActionLoading(false);
        }
    };

    // FOLLO PERF — Parallel fetch: task details + SLA data together
    useEffect(() => { 
        if (taskId) {
            fetchTaskDetails();
            dispatch(fetchTaskSlaAsync({ taskId, getToken }))
                .unwrap()
                .then(result => setSlaData(result?.sla))
                .catch(err => console.error('[TaskDetails] SLA fetch failed:', err?.message || err));
        }
    }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-refresh comments via polling
    useEffect(() => {
        if (!taskId) return;
        const interval = setInterval(() => {
            fetchTaskDetails({ silent: true });
        }, COMMENT_POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

    // FOLLO TASK-UI — Real-time Socket.IO listener for task updates
    useEffect(() => {
        if (!projectId) return;
        const socket = ioClient(
            import.meta.env.VITE_API_URL || 'http://localhost:5001',
            { withCredentials: true }
        );
        socket.emit('join_project', projectId);

        socket.on('task_updated', ({ task: updatedTask, lastUpdatedById }) => {
            if (!updatedTask || updatedTask.id !== taskId) return;
            if (lastUpdatedById === userIdRef.current) return;
            fetchTaskDetails({ silent: true });
            dispatch(fetchTaskSlaAsync({ taskId, getToken }))
                .unwrap()
                .then(result => setSlaData(result?.sla))
                .catch(() => {});
        });

        // FOLLO ACCESS-SEC
        socket.on('task_deleted', ({ taskId: deletedId }) => {
            if (deletedId === taskId) {
                import('react-hot-toast').then(({ default: toast }) => {
                    toast('This task has been deleted.', { icon: 'ℹ️' });
                });
                navigate('/tasks', { replace: true });
            }
        });

        return () => {
            socket.emit('leave_project', projectId);
            socket.off('task_updated');
            socket.off('task_deleted');
            socket.disconnect();
        };
    }, [projectId, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

    // FOLLO DEPS — fetch project tasks for dependency picker
    useEffect(() => {
        if (!projectId) return;
        const loadProjectTasks = async () => {
            try {
                const token = await getTokenRef.current();
                const res = await fetch(`${API_URL}/api/v1/tasks/project/${projectId}`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                });
                const result = await res.json();
                if (result.success) setProjectTasks(result.data || []);
            } catch { /* silent */ }
        };
        loadProjectTasks();
    }, [projectId]);

    // FOLLO DEPS — navigate to a dependency task
    const handleDepTaskClick = (depTaskId) => {
        setSearchParams({ projectId, taskId: depTaskId });
    };

    // FOLLO DEPS — re-fetch after dependency add/remove
    const handleDepsChanged = useCallback(() => {
        fetchTaskDetails({ silent: true });
    }, [fetchTaskDetails]);

    // Get comments from task - filter out empty text comments
    const comments = (task?.comments || []).filter(c => {
        // Skip invalid/null comments
        if (!c) return false;
        // Keep media comments
        if (c.type && c.type !== 'TEXT') return true;
        // Keep text comments with content
        if (c.content && String(c.content).trim()) return true;
        // Filter out empty text comments
        return false;
    });
    
    // Auto-scroll to bottom when comments change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments.length]);

    if (loading) return (
        <div className="animate-pulse p-6 space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-1/3" />
            <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-2/3" />
            <div className="h-32 bg-gray-200 dark:bg-zinc-700 rounded" />
            <div className="h-24 bg-gray-200 dark:bg-zinc-700 rounded" />
        </div>
    );

    // FOLLO ACCESS-SEC
    if (accessError === 'forbidden') return <NotAuthorised message="You don't have access to this task." />;
    if (accessError === 'not_found' || !task) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center', gap: '12px' }}>
            <div style={{ fontSize: '32px' }}>🗂️</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text-primary, #18181b)' }}>Task not found</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #52525b)' }}>This task may have been deleted or you don't have access.</div>
            <button onClick={() => navigate(-1)} style={{ marginTop: '8px', padding: '8px 20px', fontSize: '13px', border: '0.5px solid #d4d4d8', borderRadius: '8px', background: 'none', color: '#52525b', cursor: 'pointer' }}>Go back</button>
        </div>
    );

    // FOLLO ACCESS-SEC
    const isReadOnly = project?.status === 'COMPLETED' || project?.status === 'CANCELLED';

    // FOLLO WORKFLOW — Start task handler (passed to TaskActionPanel)
    const handleStartTask = async () => {
        if (slaActionLoading) return;
        setSlaActionLoading(true);
        try {
            await dispatch(updateTaskAsync({ taskId: task.id, taskData: { status: 'IN_PROGRESS' }, getToken })).unwrap();
            toast.success('Task started!');
            setTask(prev => ({ ...prev, status: 'IN_PROGRESS' }));
        } catch (err) {
            toast.error(err?.message || err || 'Failed to start task');
        } finally {
            setSlaActionLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 max-w-6xl mx-auto">
            {/* FOLLO ACCESS-UX — State 10: viewing task not assigned to current user */}
            {task.assigneeId && task.assigneeId !== user?.id && !canApproveReject && (
                <div style={{
                    padding: '10px 16px',
                    background: 'var(--color-background-secondary, #f4f4f5)',
                    border: '0.5px solid #d4d4d8',
                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                    color: 'var(--color-text-secondary, #52525b)',
                }}>
                    <span>ℹ️</span>
                    <span>This task is assigned to <strong>{task.assignee?.name || 'another team member'}</strong>. You are viewing in read-only mode.</span>
                </div>
            )}
            {/* FOLLO ACCESS-SEC — read-only banner for completed/cancelled projects */}
            {isReadOnly && (
                <div style={{
                    padding: '10px 16px', marginBottom: '12px',
                    background: project.status === 'COMPLETED' ? '#f0fdf4' : '#f4f4f5',
                    border: `0.5px solid ${project.status === 'COMPLETED' ? '#bbf7d0' : '#d4d4d8'}`,
                    borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                    color: 'var(--color-text-secondary, #52525b)',
                }}>
                    <span>{project.status === 'COMPLETED' ? '✅' : '📁'}</span>
                    <span>This project is {project.status.toLowerCase()}. All data is read-only.</span>
                </div>
            )}
            <div className="flex flex-col-reverse lg:flex-row gap-6 sm:p-4 text-gray-900 dark:text-zinc-100">
            {/* Left: Comments / Chatbox */}
            <div className="w-full lg:w-2/3">
                <TaskCommentPanel
                    comments={comments}
                    user={user}
                    formatDate={formatDate}
                    newComment={newComment}
                    setNewComment={setNewComment}
                    isSubmitting={isSubmitting}
                    onAddComment={handleAddComment}
                    selectedFile={selectedFile}
                    filePreview={filePreview}
                    fileInputRef={fileInputRef}
                    onFileSelect={handleFileSelect}
                    onClearFile={clearSelectedFile}
                    uploading={uploading}
                    progress={progress}
                    uploadError={uploadError}
                    chatEndRef={chatEndRef}
                    pendingCommentIds={pendingCommentIds}
                    confirmedCommentIds={confirmedCommentIds}
                    failedCommentIds={failedCommentIds}
                    setFailedCommentIds={setFailedCommentIds}
                    setTask={setTask}
                />
            </div>

            {/* Right: Task + Project Info */}
            <div className="w-full lg:w-1/2 flex flex-col gap-6">
                <TaskSLABanner task={task} />
                <TaskInfoCard task={task} formatDate={formatDate} canManagePriority={canApproveReject} onTogglePriorityOverride={handleTogglePriorityOverride} canAssign={canAssignTasks} workspaceMembers={workspaceMembers} onUpdateTask={handleUpdateTask} />
                {/* FOLLO DEPS — Task Dependencies */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <TaskDependencies
                        task={task}
                        projectTasks={projectTasks}
                        onTaskClick={handleDepTaskClick}
                        onDepsChanged={handleDepsChanged}
                    />
                </div>
                {!isReadOnly && (
                <TaskActionPanel
                    task={task}
                    user={user}
                    formatDate={formatDate}
                    canSubmitTask={canSubmitTask}
                    canApproveReject={canApproveReject}
                    canResolveBlocker={canResolveBlocker}
                    slaActionLoading={slaActionLoading}
                    setSlaActionLoading={setSlaActionLoading}
                    onApproveTask={handleApproveTask}
                    onRejectTask={handleRejectTask}
                    onResolveBlocker={handleResolveBlocker}
                    onRequestMoreInfo={handleRequestMoreInfo}
                    onSubmitForApproval={handleSubmitForApproval}
                    onAddCompletionPhoto={handleAddCompletionPhoto}
                    onRaiseBlocker={handleRaiseBlocker}
                    onRequestExtension={handleRequestExtension}
                    onApproveExtension={handleApproveExtension}
                    onDenyExtension={handleDenyExtension}
                    onStartTask={handleStartTask}
                    showRejectForm={showRejectForm} setShowRejectForm={setShowRejectForm}
                    rejectReason={rejectReason} setRejectReason={setRejectReason}
                    showResolveModal={showResolveModal} setShowResolveModal={setShowResolveModal}
                    resolveResolution={resolveResolution} setResolveResolution={setResolveResolution}
                    resolveNote={resolveNote} setResolveNote={setResolveNote}
                    showRequestInfoForm={showRequestInfoForm} setShowRequestInfoForm={setShowRequestInfoForm}
                    requestInfoQuestion={requestInfoQuestion} setRequestInfoQuestion={setRequestInfoQuestion}
                    showSubmission={showSubmission} setShowSubmission={setShowSubmission}
                    showCompletionModal={showCompletionModal} setShowCompletionModal={setShowCompletionModal}
                    completionNotes={completionNotes} setCompletionNotes={setCompletionNotes}
                    completionPhotos={completionPhotos} setCompletionPhotos={setCompletionPhotos}
                    declarationConfirmed={declarationConfirmed} setDeclarationConfirmed={setDeclarationConfirmed}
                    completionFileRef={completionFileRef}
                    completionUploading={completionUploading}
                    showBlockerModal={showBlockerModal} setShowBlockerModal={setShowBlockerModal}
                    blockerDescription={blockerDescription} setBlockerDescription={setBlockerDescription}
                    blockerFile={blockerFile} setBlockerFile={setBlockerFile}
                    blockerFileRef={blockerFileRef}
                    blockerUploading={blockerUploading}
                    showExtensionModal={showExtensionModal} setShowExtensionModal={setShowExtensionModal}
                    extensionReason={extensionReason} setExtensionReason={setExtensionReason}
                    extensionDate={extensionDate} setExtensionDate={setExtensionDate}
                    showDenyExtensionForm={showDenyExtensionForm} setShowDenyExtensionForm={setShowDenyExtensionForm}
                    denyExtensionReason={denyExtensionReason} setDenyExtensionReason={setDenyExtensionReason}
                />
                )}
                <ProjectInfoCard project={project} task={task} userId={user?.id} />
            </div>
            </div>
        </div>
    );
};

export default TaskDetails;
