// FOLLO SRP
import { MessageCircle, User, Paperclip, X, Image as ImageIcon, Film, Music, FileText } from "lucide-react";
import { MediaRenderer } from "../MediaRenderer";
import LoadingButton from "../ui/LoadingButton";

const getFileIcon = (file) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
    if (file.type.startsWith("video/")) return <Film className="w-4 h-4" />;
    if (file.type.startsWith("audio/")) return <Music className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
};

const TaskCommentPanel = ({
    comments,
    user,
    formatDate,
    // Comment input
    newComment, setNewComment,
    isSubmitting,
    onAddComment,
    // File upload
    selectedFile,
    filePreview,
    fileInputRef,
    onFileSelect,
    onClearFile,
    uploading,
    progress,
    uploadError,
    // Chat refs
    chatEndRef,
    pendingCommentIds,
    confirmedCommentIds,
    failedCommentIds,
    setFailedCommentIds,
    setTask,
}) => {
    return (
        <div className="p-5 rounded-md border border-gray-300 dark:border-zinc-800 flex flex-col h-[60vh] sm:h-[70vh] lg:h-[80vh]">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-4 text-gray-900 dark:text-white">
                <MessageCircle className="size-5" /> Task Discussion ({comments.length})
            </h2>

            <div className="flex-1 overflow-y-auto">
                {comments.length > 0 ? (
                    <div className="flex flex-col gap-4 mb-6 mr-2">
                        {comments.map((comment, index) => {
                            // WhatsApp-style: own messages on right, others on left
                            const isOwnMessage = comment.userId === user?.id;
                            
                            // Skip rendering empty text comments (shouldn't happen but safety net)
                            if ((!comment.type || comment.type === 'TEXT') && !comment.content?.trim()) {
                                return null;
                            }
                            
                            const isPending = pendingCommentIds.current.has(comment.id);
                            const isConfirmed = confirmedCommentIds.has(comment.id);
                            const isFailed = failedCommentIds.has(comment.id);
                            
                            return (
                            <div 
                                key={comment.id || `temp-${index}`} 
                                className={`sm:max-w-4/5 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-900 border border-gray-300 dark:border-zinc-700 p-3 rounded-md ${isOwnMessage ? "ml-auto bg-blue-50 dark:bg-blue-900/20" : "mr-auto"} ${isFailed ? "border-red-400 dark:border-red-600" : ""}`} 
                            >
                                <div className="flex items-center gap-2 mb-1 text-sm text-gray-500 dark:text-zinc-400">
                                    {comment.user?.image ? (
                                        <img src={comment.user.image} alt="avatar" className="size-5 rounded-full" />
                                    ) : (
                                        <div className="size-5 rounded-full bg-blue-500 flex items-center justify-center">
                                            <User className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                    <span className="font-medium text-gray-900 dark:text-white">{comment.user?.name || 'Unknown'}</span>
                                    <span className="text-xs text-gray-400 dark:text-zinc-600">
                                        • {comment.createdAt ? formatDate(comment.createdAt, "dd MMM yyyy, HH:mm") : 'Just now'}
                                    </span>
                                    {isPending && !isConfirmed && <span className="text-xs" title="Sending...">🕐</span>}
                                    {isConfirmed && <span className="text-xs text-green-500" title="Sent">✓</span>}
                                </div>
                                
                                {/* FOLLO MEDIA - Render media content */}
                                {comment.type && comment.type !== 'TEXT' && comment.url && (
                                    <div className="mt-2 mb-2">
                                        <MediaRenderer comment={comment} />
                                    </div>
                                )}
                                
                                {/* Text content */}
                                {comment.content && (
                                    <p className="text-sm text-gray-900 dark:text-zinc-200">{comment.content}</p>
                                )}
                                
                                {/* Failed retry label */}
                                {isFailed && (
                                    <button
                                        onClick={() => {
                                            // Remove failed state and re-submit
                                            setFailedCommentIds(prev => {
                                                const next = new Set(prev);
                                                next.delete(comment.id);
                                                return next;
                                            });
                                            setTask(prev => ({
                                                ...prev,
                                                comments: (prev.comments || []).filter(c => c.id !== comment.id)
                                            }));
                                            // Restore content to input for re-send
                                            if (comment.content) setNewComment(comment.content);
                                        }}
                                        className="mt-1 text-xs text-red-500 hover:text-red-400 font-medium"
                                    >
                                        Failed — tap to retry
                                    </button>
                                )}
                            </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-600 dark:text-zinc-500 mb-4 text-sm">No comments yet. Be the first!</p>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Add Comment with FOLLO MEDIA upload */}
            <div className="space-y-3">
                {/* File Preview */}
                {selectedFile && (
                    <div className="flex items-center gap-3 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        {filePreview ? (
                            <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                        ) : (
                            <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 rounded flex items-center justify-center">
                                {getFileIcon(selectedFile)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                                {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                        <button
                            onClick={onClearFile}
                            className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            disabled={uploading}
                        >
                            <X className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                        </button>
                    </div>
                )}

                {/* Upload Progress */}
                {uploading && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400">
                            <span>Uploading...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Upload Error */}
                {uploadError && (
                    <p className="text-sm text-red-500">{uploadError}</p>
                )}

                {/* Input Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                    <div className="flex-1 w-full relative">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={selectedFile ? "Add a caption (optional)..." : "Write a comment..."}
                            className="w-full dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 pr-10 text-sm text-gray-900 dark:text-zinc-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-600"
                            rows={3}
                            disabled={isSubmitting || uploading}
                        />
                        
                        {/* Attach file button */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={onFileSelect}
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                            className="hidden"
                            disabled={uploading}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-2 right-2 p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-gray-500 dark:text-zinc-400"
                            disabled={uploading}
                            title="Attach file"
                        >
                            <Paperclip className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <LoadingButton 
                        onClick={onAddComment} 
                        loading={isSubmitting || uploading}
                        disabled={!newComment.trim() && !selectedFile}
                        className="bg-gradient-to-l from-blue-500 to-blue-600 transition-colors text-white text-sm px-5 py-2 rounded disabled:opacity-50 flex items-center gap-2" 
                    >
                        {uploading ? 'Uploading...' : 'Post'}
                    </LoadingButton>
                </div>
            </div>
        </div>
    );
};

export default TaskCommentPanel;
