// FOLLO UI
import { CheckCircle2, HelpCircle, Clock, X, Camera, Info } from "lucide-react";
import LoadingButton from "../ui/LoadingButton";

const TaskActionPanel = ({
    task,
    user,
    formatDate,
    // Permissions
    canSubmitTask,
    canApproveReject,
    canResolveBlocker,
    // SLA action loading
    slaActionLoading,
    setSlaActionLoading,
    // Handlers
    onApproveTask,
    onRejectTask,
    onResolveBlocker,
    onRequestMoreInfo,
    onSubmitForApproval,
    onAddCompletionPhoto,
    onRaiseBlocker,
    onRequestExtension,
    onApproveExtension,
    onDenyExtension,
    onStartTask,
    // Reject form
    showRejectForm, setShowRejectForm,
    rejectReason, setRejectReason,
    // Resolve modal
    showResolveModal, setShowResolveModal,
    resolveResolution, setResolveResolution,
    resolveNote, setResolveNote,
    // Request-info form
    showRequestInfoForm, setShowRequestInfoForm,
    requestInfoQuestion, setRequestInfoQuestion,
    // Submission toggle
    showSubmission, setShowSubmission,
    // Completion modal
    showCompletionModal, setShowCompletionModal,
    completionNotes, setCompletionNotes,
    completionPhotos, setCompletionPhotos,
    declarationConfirmed, setDeclarationConfirmed,
    completionFileRef,
    completionUploading,
    // Blocker modal
    showBlockerModal, setShowBlockerModal,
    blockerDescription, setBlockerDescription,
    blockerFile, setBlockerFile,
    blockerFileRef,
    blockerUploading,
    // Extension modal
    showExtensionModal, setShowExtensionModal,
    extensionReason, setExtensionReason,
    extensionDate, setExtensionDate,
    // Deny extension form
    showDenyExtensionForm, setShowDenyExtensionForm,
    denyExtensionReason, setDenyExtensionReason,
}) => {
    const slaStatus = task.slaStatus || 'HEALTHY';
    const isAssignee = task.assigneeId === user?.id;
    const terminal = ['RESOLVED_ON_TIME', 'RESOLVED_LATE'];
    const photos = task.completionPhotos || [];

    // STATE: DONE / Resolved — show completion card with photos
    if (task.status === 'DONE' || terminal.includes(slaStatus)) {
        return (
            <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><CheckCircle2 className="size-4" /> Task Complete</p>
                {task.approvedBy && <p className="text-xs text-emerald-700 dark:text-emerald-400">Approved by {task.approvedBy.name || task.approvedBy.email || 'PM'}</p>}
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    {slaStatus === 'RESOLVED_LATE' ? `Completed ${task.delayDays || 0} days late` : 'Completed on time'}
                </p>
                {/* Completion photos */}
                {photos.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">Completion Photos ({photos.length})</p>
                        <div className="grid grid-cols-3 gap-2">
                            {photos.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="Completion photo" className="w-full h-20 object-cover rounded border border-emerald-200 dark:border-emerald-800 hover:opacity-80 transition-opacity" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
                {task.completionNotes && (
                    <div className="p-2 rounded bg-emerald-100/50 dark:bg-emerald-900/30">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Completion Notes</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500">{task.completionNotes}</p>
                    </div>
                )}
            </div>
        );
    }

    // STATE: BLOCKED
    if (slaStatus === 'BLOCKED') {
        if (canResolveBlocker) {
            return (
                <div className="p-4 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Task Actions</h3>
                    <hr className="border-zinc-200 dark:border-zinc-700" />
                    {!showResolveModal ? (
                        <button onClick={() => setShowResolveModal(true)} className="w-full py-2.5 px-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors">
                            Resolve Blocker
                        </button>
                    ) : (
                        <div className="space-y-3 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Resolve Quality Blocker</p>
                            {task.blockerDescription && (
                                <p className="text-xs text-gray-600 dark:text-zinc-400 p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                                    <span className="font-medium">Blocker:</span> {task.blockerDescription}
                                </p>
                            )}
                            <div>
                                <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Resolution action</label>
                                <select value={resolveResolution} onChange={(e) => setResolveResolution(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200">
                                    <option value="REMEDIATE">Remediate — reopen blocking task</option>
                                    <option value="NEW_TASK">Create new task — for fix work</option>
                                    <option value="OVERRIDE">Override — proceed as-is</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Note (required)</label>
                                <textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Describe the resolution..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setShowResolveModal(false); setResolveNote(''); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                                <LoadingButton onClick={onResolveBlocker} loading={slaActionLoading} className="flex-1 py-2 px-3 rounded text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors">
                                    Resolve Blocker
                                </LoadingButton>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return (
            <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 space-y-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Blocker Active</p>
                <p className="text-xs text-red-700 dark:text-red-400">SLA clock paused.</p>
                <p className="text-xs text-red-600 dark:text-red-500">Waiting for PM to resolve.</p>
            </div>
        );
    }

    // STATE: PENDING_APPROVAL — PM review panel with photo gallery
    if (slaStatus === 'PENDING_APPROVAL') {
        if (canApproveReject) {
            return (
                <div className="p-4 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PM Review Panel</h3>
                    
                    {/* Submission evidence */}
                    {photos.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-2">Completion Photos ({photos.length})</p>
                            <div className="grid grid-cols-3 gap-2">
                                {photos.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt="Evidence photo" className="w-full h-20 object-cover rounded border border-gray-200 dark:border-zinc-700 hover:opacity-80 transition-opacity" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                    {task.completionNotes && (
                        <div className="p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                            <p className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1">Completion Notes</p>
                            <p className="text-xs text-gray-600 dark:text-zinc-400">{task.completionNotes}</p>
                        </div>
                    )}
                    {task.declarationConfirmed && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-1"><CheckCircle2 className="size-3" /> Declaration confirmed by assignee</p>
                    )}

                    <hr className="border-zinc-200 dark:border-zinc-700" />

                    {/* Approve */}
                    <LoadingButton onClick={onApproveTask} loading={slaActionLoading} className="w-full py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                        Approve Task
                    </LoadingButton>

                    {/* Reject */}
                    {!showRejectForm ? (
                        <button onClick={() => setShowRejectForm(true)} className="w-full py-2.5 px-4 rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                            Reject
                        </button>
                    ) : (
                        <div className="space-y-2 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                            <label className="text-xs text-gray-600 dark:text-zinc-400 block">Reason for rejection</label>
                            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this task is being rejected..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                            <div className="flex gap-2">
                                <button onClick={() => { setShowRejectForm(false); setRejectReason(''); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                                <LoadingButton onClick={onRejectTask} loading={slaActionLoading} className="flex-1 py-2 px-3 rounded text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors">
                                    Confirm Rejection
                                </LoadingButton>
                            </div>
                        </div>
                    )}

                    {/* Request more info */}
                    {!showRequestInfoForm ? (
                        <button onClick={() => setShowRequestInfoForm(true)} className="w-full py-2.5 px-4 rounded-md border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors flex items-center justify-center gap-2">
                            <HelpCircle className="size-4" /> Request More Info
                        </button>
                    ) : (
                        <div className="space-y-2 p-3 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                            <label className="text-xs text-gray-600 dark:text-zinc-400 block">Ask a question (posted to task discussion)</label>
                            <textarea value={requestInfoQuestion} onChange={(e) => setRequestInfoQuestion(e.target.value)} placeholder="What info do you need from the assignee?" className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={2} />
                            <div className="flex gap-2">
                                <button onClick={() => { setShowRequestInfoForm(false); setRequestInfoQuestion(''); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                                <LoadingButton onClick={onRequestMoreInfo} loading={slaActionLoading} className="flex-1 py-2 px-3 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors">
                                    Ask Question
                                </LoadingButton>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        // Member view — awaiting approval with view submission toggle
        return (
            <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-2">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Awaiting Approval</p>
                <p className="text-xs text-blue-700 dark:text-blue-400">Submitted for PM review.</p>
                <button onClick={() => setShowSubmission(!showSubmission)} className="text-xs text-blue-600 dark:text-blue-400 underline hover:no-underline">
                    {showSubmission ? 'Hide Submission' : 'View Submission'}
                </button>
                {showSubmission && (
                    <div className="space-y-2 mt-2">
                        {photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {photos.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt="Submission photo" className="w-full h-16 object-cover rounded border border-blue-200 dark:border-blue-800" />
                                    </a>
                                ))}
                            </div>
                        )}
                        {task.completionNotes && <p className="text-xs text-blue-600 dark:text-blue-500">{task.completionNotes}</p>}
                    </div>
                )}
            </div>
        );
    }

    {/* FOLLO WORKFLOW — Extension Request Review (PM panel) */}
    if (task.extensionStatus === 'PENDING' && canApproveReject) {
        return (
            <div className="p-4 rounded-md bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 space-y-3">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2"><Clock className="size-4" /> Extension Request</h3>
                <div className="space-y-2 text-xs text-gray-700 dark:text-zinc-300">
                    <p><span className="font-medium">Reason:</span> {task.extensionReason}</p>
                    <p><span className="font-medium">Current deadline:</span> {formatDate(task.extensionOriginalDueDate || task.dueDate)}</p>
                    <p><span className="font-medium">Proposed deadline:</span> {formatDate(task.extensionProposedDate)}</p>
                    <p><span className="font-medium">Requested:</span> {formatDate(task.extensionRequestedAt, "dd MMM yyyy, HH:mm")}</p>
                </div>

                <LoadingButton onClick={onApproveExtension} loading={slaActionLoading} className="w-full py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                    Approve Extension
                </LoadingButton>

                {!showDenyExtensionForm ? (
                    <button onClick={() => setShowDenyExtensionForm(true)} className="w-full py-2.5 px-4 rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        Deny Extension
                    </button>
                ) : (
                    <div className="space-y-2 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                        <label className="text-xs text-gray-600 dark:text-zinc-400 block">Reason for denial (optional)</label>
                        <textarea value={denyExtensionReason} onChange={(e) => setDenyExtensionReason(e.target.value)} placeholder="Why is this extension being denied..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={2} />
                        <div className="flex gap-2">
                            <button onClick={() => { setShowDenyExtensionForm(false); setDenyExtensionReason(''); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                            <LoadingButton onClick={onDenyExtension} loading={slaActionLoading} className="flex-1 py-2 px-3 rounded text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors">
                                Deny Extension
                            </LoadingButton>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // STATE: TODO — show Start Task button (assignee only)
    if (task.status === 'TODO') {
        if (isAssignee) {
            return (
                <div className="p-4 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Task Actions</h3>
                    <hr className="border-zinc-200 dark:border-zinc-700" />
                    <LoadingButton onClick={onStartTask} loading={slaActionLoading} className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                        Start Task
                    </LoadingButton>
                </div>
            );
        }
        return (
            <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <Info className="size-4 text-zinc-400" />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Assigned to {task.assignee?.name || 'team member'} — waiting to start</p>
            </div>
        );
    }

    // STATE: IN_PROGRESS — assignee actions only
    if (task.status === 'IN_PROGRESS') {
        if (!isAssignee || !canSubmitTask) {
            return (
                <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                    <Info className="size-4 text-zinc-400" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Assigned to {task.assignee?.name || 'team member'} — in progress</p>
                </div>
            );
        }
        return (
            <div className="p-4 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Task Actions</h3>
                <hr className="border-zinc-200 dark:border-zinc-700" />
                
                {!showCompletionModal ? (
                    <button onClick={() => setShowCompletionModal(true)} className="w-full py-2.5 px-4 rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-zinc-900 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
                        Mark as Complete
                    </button>
                ) : (
                    <div className="space-y-3 p-3 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Complete & Submit for Handover</p>
                        
                        {/* Completion photos */}
                        <div>
                            <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Photo Evidence (min 1 required)</label>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                                {completionPhotos.map((url, i) => (
                                    <div key={url} className="relative group">
                                        <img src={url} alt="Completion photo" className="w-full h-20 object-cover rounded border border-emerald-200 dark:border-emerald-800" />
                                        <button
                                            onClick={() => setCompletionPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={completionFileRef} accept="image/*" className="hidden" onChange={onAddCompletionPhoto} />
                            <LoadingButton onClick={() => completionFileRef.current?.click()} loading={completionUploading} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1">
                                <Camera className="size-3" />
                                Add Photo
                            </LoadingButton>
                        </div>

                        {/* Completion notes */}
                        <div>
                            <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Completion Notes (min 20 chars)</label>
                            <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Describe the work completed, materials used, quality checks performed..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{completionNotes.length}/20 chars min</p>
                        </div>

                        {/* Declaration */}
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input type="checkbox" checked={declarationConfirmed} onChange={(e) => setDeclarationConfirmed(e.target.checked)} className="mt-0.5 rounded border-gray-300 dark:border-zinc-700" />
                            <span className="text-xs text-gray-700 dark:text-zinc-300">I confirm this work has been completed to the required standard and is ready for PM inspection.</span>
                        </label>

                        <div className="flex gap-2">
                            <button onClick={() => { setShowCompletionModal(false); setCompletionNotes(''); setCompletionPhotos([]); setDeclarationConfirmed(false); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                            <LoadingButton onClick={onSubmitForApproval} loading={slaActionLoading} disabled={completionUploading} className="flex-1 py-2 px-3 rounded text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors">
                                Submit for Handover
                            </LoadingButton>
                        </div>
                    </div>
                )}

                {/* Raise blocker */}
                {!showBlockerModal ? (
                    <button onClick={() => setShowBlockerModal(true)} className="w-full py-2.5 px-4 rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 bg-white dark:bg-zinc-900 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        Raise Blocker
                    </button>
                ) : (
                    <div className="space-y-3 p-3 rounded-md border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Raise a Quality Blocker</p>
                        <div>
                            <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">What is the issue? (min 20 chars)</label>
                            <textarea value={blockerDescription} onChange={(e) => setBlockerDescription(e.target.value)} placeholder="Describe the blocker issue..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Photo evidence (optional)</label>
                            <input type="file" ref={blockerFileRef} accept="image/*" className="hidden" onChange={(e) => setBlockerFile(e.target.files?.[0] || null)} />
                            <button onClick={() => blockerFileRef.current?.click()} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                {blockerFile ? blockerFile.name : 'Add Photo'}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowBlockerModal(false); setBlockerDescription(''); setBlockerFile(null); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                            <LoadingButton onClick={onRaiseBlocker} loading={slaActionLoading || blockerUploading} className="flex-1 py-2 px-3 rounded text-sm bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors">
                                Raise Blocker
                            </LoadingButton>
                        </div>
                    </div>
                )}

                {/* FOLLO WORKFLOW — Request Extension */}
                {task.extensionStatus !== 'PENDING' && (
                    <>
                        {!showExtensionModal ? (
                            <button onClick={() => setShowExtensionModal(true)} className="w-full py-2.5 px-4 rounded-md border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-white dark:bg-zinc-900 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors flex items-center justify-center gap-2">
                                <Clock className="size-4" /> Request Deadline Extension
                            </button>
                        ) : (
                            <div className="space-y-3 p-3 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Request Deadline Extension</p>
                                <div>
                                    <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Reason (required)</label>
                                    <textarea value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} placeholder="Why do you need more time?" className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={2} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600 dark:text-zinc-400 mb-1 block">Proposed new deadline</label>
                                    <input type="date" value={extensionDate} onChange={(e) => setExtensionDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setShowExtensionModal(false); setExtensionReason(''); setExtensionDate(''); }} className="flex-1 py-2 px-3 rounded text-sm border border-gray-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
                                    <LoadingButton onClick={onRequestExtension} loading={slaActionLoading} className="flex-1 py-2 px-3 rounded text-sm bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors">
                                        Request Extension
                                    </LoadingButton>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {task.extensionStatus === 'PENDING' && (
                    <div className="p-2 rounded bg-amber-100/50 dark:bg-amber-900/30 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <Clock className="size-3" /> Extension request pending PM review
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default TaskActionPanel;
