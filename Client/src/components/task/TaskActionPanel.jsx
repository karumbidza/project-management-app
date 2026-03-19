// FOLLO UI
// FOLLO TASK-UI
import { CheckCircle2, X, Camera } from "lucide-react";
import LoadingButton from "../ui/LoadingButton";

// ── Shared inline-style fragments ──────────────────────────
const card = {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: '12px',
    padding: '16px',
};

const sectionLabel = {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    letterSpacing: '.05em',
    marginBottom: '14px',
};

const primaryBtn = (bg) => ({
    width: '100%',
    padding: '10px',
    fontSize: '13px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '8px',
    background: bg,
    color: '#fff',
    cursor: 'pointer',
    marginBottom: '8px',
});

const secondaryBtn = {
    flex: 1,
    padding: '7px 0',
    fontSize: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    textAlign: 'center',
};

const thinDivider = {
    height: '0.5px',
    background: 'var(--color-border-tertiary)',
    margin: '4px 0 8px',
};

const vertDivider = {
    width: '0.5px',
    background: 'var(--color-border-tertiary)',
};

const infoStrip = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'var(--color-background-secondary)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
};

// ── Status context strip builder ───────────────────────────
const StatusStrip = ({ task }) => {
    const dotColor =
        task.status === 'IN_PROGRESS'       ? '#2563eb'
      : task.status === 'BLOCKED'           ? '#d97706'
      : task.status === 'PENDING_APPROVAL'  ? '#7c3aed'
      : task.slaStatus === 'BREACHED'       ? '#dc2626'
      : '#94a3b8';

    const label =
        task.status === 'IN_PROGRESS'       ? 'In progress'
      : task.status === 'BLOCKED'           ? 'Blocked'
      : task.status === 'PENDING_APPROVAL'  ? 'Awaiting approval'
      : task.status === 'TODO'              ? 'Not started'
      : task.status;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '16px', padding: '10px 12px',
            background: 'var(--color-background-secondary)', borderRadius: '8px',
        }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor }} />
            <div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                    {task.dueDate
                        ? `Due ${new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'No due date set'}
                </div>
            </div>
        </div>
    );
};

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

    // ── STATE: DONE / Resolved ─────────────────────────────
    if (task.status === 'DONE' || terminal.includes(slaStatus)) {
        return (
            <div style={card}>
                <div style={sectionLabel}>TASK COMPLETE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {slaStatus === 'RESOLVED_LATE' ? `Completed ${task.delayDays || 0} days late` : 'Completed on time'}
                    </span>
                </div>
                {task.approvedBy && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>
                        Approved by {task.approvedBy.name || task.approvedBy.email || 'PM'}
                    </div>
                )}
                {photos.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>
                            Completion Photos ({photos.length})
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {photos.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="Completion" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }} />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
                {task.completionNotes && (
                    <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>Completion Notes</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{task.completionNotes}</div>
                    </div>
                )}
            </div>
        );
    }

    // ── STATE: BLOCKED ─────────────────────────────────────
    if (slaStatus === 'BLOCKED') {
        if (canResolveBlocker) {
            return (
                <div style={card}>
                    <div style={sectionLabel}>TASK ACTIONS</div>
                    <StatusStrip task={task} />
                    {!showResolveModal ? (
                        <LoadingButton onClick={() => setShowResolveModal(true)} loading={false} style={primaryBtn('#2563eb')}>
                            Resolve Blocker
                        </LoadingButton>
                    ) : (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '10px' }}>Resolve Quality Blocker</div>
                            {task.blockerDescription && (
                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '8px', borderRadius: '6px', background: 'var(--color-background-primary)', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 500 }}>Blocker:</span> {task.blockerDescription}
                                </div>
                            )}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Resolution action</label>
                                <select value={resolveResolution} onChange={(e) => setResolveResolution(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200">
                                    <option value="REMEDIATE">Remediate — reopen blocking task</option>
                                    <option value="NEW_TASK">Create new task — for fix work</option>
                                    <option value="OVERRIDE">Override — proceed as-is</option>
                                </select>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Note (required)</label>
                                <textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Describe the resolution..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => { setShowResolveModal(false); setResolveNote(''); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                                <LoadingButton onClick={onResolveBlocker} loading={slaActionLoading} style={{ ...primaryBtn('#2563eb'), flex: 1, marginBottom: 0 }}>
                                    Resolve Blocker
                                </LoadingButton>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return (
            <div style={card}>
                <div style={sectionLabel}>TASK ACTIONS</div>
                <div style={infoStrip}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: '#d97706' }} />
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Blocker Active</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>SLA clock paused — waiting for PM to resolve</div>
                    </div>
                </div>
            </div>
        );
    }

    // ── STATE: PENDING_APPROVAL ────────────────────────────
    if (slaStatus === 'PENDING_APPROVAL') {
        if (canApproveReject) {
            return (
                <div style={card}>
                    <div style={sectionLabel}>PM REVIEW</div>
                    <StatusStrip task={task} />

                    {/* Submission evidence */}
                    {photos.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>Completion Photos ({photos.length})</div>
                            <div className="grid grid-cols-3 gap-2">
                                {photos.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt="Evidence" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                    {task.completionNotes && (
                        <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--color-background-secondary)', marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>Completion Notes</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{task.completionNotes}</div>
                        </div>
                    )}
                    {task.declarationConfirmed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a', marginBottom: '12px' }}>
                            <CheckCircle2 size={12} /> Declaration confirmed by assignee
                        </div>
                    )}

                    {/* Approve — primary green */}
                    <LoadingButton onClick={onApproveTask} loading={slaActionLoading} style={primaryBtn('#16a34a')}>
                        Approve
                    </LoadingButton>

                    {/* Reject + Request Info — secondary text row */}
                    {!showRejectForm && !showRequestInfoForm && (
                        <>
                            <div style={thinDivider} />
                            <div style={{ display: 'flex' }}>
                                <button onClick={() => setShowRejectForm(true)} style={secondaryBtn}>Reject</button>
                                <div style={vertDivider} />
                                <button onClick={() => setShowRequestInfoForm(true)} style={secondaryBtn}>Request Info</button>
                            </div>
                        </>
                    )}

                    {/* Reject form */}
                    {showRejectForm && (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Reason for rejection</label>
                            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this task is being rejected..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button onClick={() => { setShowRejectForm(false); setRejectReason(''); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                                <LoadingButton onClick={onRejectTask} loading={slaActionLoading} style={{ ...primaryBtn('#dc2626'), flex: 1, marginBottom: 0 }}>
                                    Confirm Rejection
                                </LoadingButton>
                            </div>
                        </div>
                    )}

                    {/* Request info form */}
                    {showRequestInfoForm && (
                        <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Ask a question (posted to task discussion)</label>
                            <textarea value={requestInfoQuestion} onChange={(e) => setRequestInfoQuestion(e.target.value)} placeholder="What info do you need from the assignee?" className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={2} />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button onClick={() => { setShowRequestInfoForm(false); setRequestInfoQuestion(''); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                                <LoadingButton onClick={onRequestMoreInfo} loading={slaActionLoading} style={{ ...primaryBtn('#2563eb'), flex: 1, marginBottom: 0 }}>
                                    Ask Question
                                </LoadingButton>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        // Member view — awaiting approval
        return (
            <div style={card}>
                <div style={sectionLabel}>TASK ACTIONS</div>
                <div style={infoStrip}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: '#7c3aed' }} />
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Awaiting Approval</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>Submitted for PM review</div>
                    </div>
                </div>
                <button
                    onClick={() => setShowSubmission(!showSubmission)}
                    style={{ ...secondaryBtn, textAlign: 'left', textDecoration: 'underline', padding: '6px 0', flex: 'none' }}
                >
                    {showSubmission ? 'Hide Submission' : 'View Submission'}
                </button>
                {showSubmission && (
                    <div style={{ marginTop: '8px' }}>
                        {photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2" style={{ marginBottom: '6px' }}>
                                {photos.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt="Submission" style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }} />
                                    </a>
                                ))}
                            </div>
                        )}
                        {task.completionNotes && (
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{task.completionNotes}</div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Extension Request Review (PM) ──────────────────────
    if (task.extensionStatus === 'PENDING' && canApproveReject) {
        return (
            <div style={card}>
                <div style={sectionLabel}>EXTENSION REQUEST</div>
                <StatusStrip task={task} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
                    <div><span style={{ fontWeight: 500 }}>Reason:</span> {task.extensionReason}</div>
                    <div><span style={{ fontWeight: 500 }}>Current deadline:</span> {formatDate(task.extensionOriginalDueDate || task.dueDate)}</div>
                    <div><span style={{ fontWeight: 500 }}>Proposed deadline:</span> {formatDate(task.extensionProposedDate)}</div>
                    <div><span style={{ fontWeight: 500 }}>Requested:</span> {formatDate(task.extensionRequestedAt, "dd MMM yyyy, HH:mm")}</div>
                </div>

                {/* Approve — primary green */}
                <LoadingButton onClick={onApproveExtension} loading={slaActionLoading} style={primaryBtn('#16a34a')}>
                    Approve Extension
                </LoadingButton>

                {/* Deny — secondary text */}
                {!showDenyExtensionForm && (
                    <>
                        <div style={thinDivider} />
                        <div style={{ display: 'flex' }}>
                            <button onClick={() => setShowDenyExtensionForm(true)} style={secondaryBtn}>Deny Extension</button>
                        </div>
                    </>
                )}
                {showDenyExtensionForm && (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                        <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Reason for denial (optional)</label>
                        <textarea value={denyExtensionReason} onChange={(e) => setDenyExtensionReason(e.target.value)} placeholder="Why is this extension being denied..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={2} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button onClick={() => { setShowDenyExtensionForm(false); setDenyExtensionReason(''); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                            <LoadingButton onClick={onDenyExtension} loading={slaActionLoading} style={{ ...primaryBtn('#dc2626'), flex: 1, marginBottom: 0 }}>
                                Deny Extension
                            </LoadingButton>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── STATE: TODO ────────────────────────────────────────
    if (task.status === 'TODO') {
        if (isAssignee) {
            return (
                <div style={card}>
                    <div style={sectionLabel}>TASK ACTIONS</div>
                    <StatusStrip task={task} />
                    <LoadingButton onClick={onStartTask} loading={slaActionLoading} style={primaryBtn('#2563eb')}>
                        Start Task
                    </LoadingButton>
                </div>
            );
        }
        return (
            <div style={card}>
                <div style={sectionLabel}>TASK ACTIONS</div>
                <div style={infoStrip}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: '#94a3b8' }} />
                    <span>Assigned to {task.assignee?.name || 'team member'} — waiting to start</span>
                </div>
            </div>
        );
    }

    // ── STATE: IN_PROGRESS ─────────────────────────────────
    if (task.status === 'IN_PROGRESS') {
        if (!isAssignee || !canSubmitTask) {
            return (
                <div style={card}>
                    <div style={sectionLabel}>TASK ACTIONS</div>
                    <div style={infoStrip}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: '#2563eb' }} />
                        <span>Assigned to {task.assignee?.name || 'team member'} — in progress</span>
                    </div>
                </div>
            );
        }

        const showRaiseBlocker = !showBlockerModal;
        const showRequestExtension = task.extensionStatus !== 'PENDING' && !showExtensionModal;

        return (
            <div style={card}>
                <div style={sectionLabel}>TASK ACTIONS</div>
                <StatusStrip task={task} />

                {/* Primary — Mark as Complete */}
                {!showCompletionModal ? (
                    <LoadingButton onClick={() => setShowCompletionModal(true)} loading={false} style={primaryBtn('#16a34a')}>
                        Mark as Complete
                    </LoadingButton>
                ) : (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '10px' }}>Complete & Submit for Handover</div>

                        {/* Completion photos */}
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Photo Evidence (min 1 required)</label>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                                {completionPhotos.map((url, i) => (
                                    <div key={url} className="relative group">
                                        <img src={url} alt="Completion" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, border: '0.5px solid var(--color-border-tertiary)' }} />
                                        <button
                                            onClick={() => setCompletionPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                            style={{ position: 'absolute', top: 2, right: 2, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', padding: 2, cursor: 'pointer', lineHeight: 0 }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={completionFileRef} accept="image/*" className="hidden" onChange={onAddCompletionPhoto} />
                            <LoadingButton onClick={() => completionFileRef.current?.click()} loading={completionUploading} style={{ fontSize: '11px', padding: '5px 10px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '6px', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Camera size={12} /> Add Photo
                            </LoadingButton>
                        </div>

                        {/* Completion notes */}
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Completion Notes (min 20 chars)</label>
                            <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Describe the work completed, materials used, quality checks performed..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{completionNotes.length}/20 chars min</div>
                        </div>

                        {/* Declaration */}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}>
                            <input type="checkbox" checked={declarationConfirmed} onChange={(e) => setDeclarationConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>I confirm this work has been completed to the required standard and is ready for PM inspection.</span>
                        </label>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setShowCompletionModal(false); setCompletionNotes(''); setCompletionPhotos([]); setDeclarationConfirmed(false); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                            <LoadingButton onClick={onSubmitForApproval} loading={slaActionLoading} disabled={completionUploading} style={{ ...primaryBtn('#16a34a'), flex: 1, marginBottom: 0 }}>
                                Submit for Handover
                            </LoadingButton>
                        </div>
                    </div>
                )}

                {/* Blocker modal */}
                {showBlockerModal && (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '10px' }}>Raise a Quality Blocker</div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>What is the issue? (min 20 chars)</label>
                            <textarea value={blockerDescription} onChange={(e) => setBlockerDescription(e.target.value)} placeholder="Describe the blocker issue..." className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={3} />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Photo evidence (optional)</label>
                            <input type="file" ref={blockerFileRef} accept="image/*" className="hidden" onChange={(e) => setBlockerFile(e.target.files?.[0] || null)} />
                            <button onClick={() => blockerFileRef.current?.click()} style={{ fontSize: '11px', padding: '5px 10px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '6px', background: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                {blockerFile ? blockerFile.name : 'Add Photo'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setShowBlockerModal(false); setBlockerDescription(''); setBlockerFile(null); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                            <LoadingButton onClick={onRaiseBlocker} loading={slaActionLoading || blockerUploading} style={{ ...primaryBtn('#dc2626'), flex: 1, marginBottom: 0 }}>
                                Raise Blocker
                            </LoadingButton>
                        </div>
                    </div>
                )}

                {/* Extension modal */}
                {showExtensionModal && (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-background-secondary)', marginBottom: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '10px' }}>Request Extension</div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Reason (required)</label>
                            <textarea value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} placeholder="Why do you need more time?" className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200 resize-none" rows={2} />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: '4px' }}>Proposed new deadline</label>
                            <input type="date" value={extensionDate} onChange={(e) => setExtensionDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-200" />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setShowExtensionModal(false); setExtensionReason(''); setExtensionDate(''); }} style={{ ...secondaryBtn, border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '8px' }}>Cancel</button>
                            <LoadingButton onClick={onRequestExtension} loading={slaActionLoading} style={{ ...primaryBtn('#2563eb'), flex: 1, marginBottom: 0 }}>
                                Request Extension
                            </LoadingButton>
                        </div>
                    </div>
                )}

                {/* Extension pending notice */}
                {task.extensionStatus === 'PENDING' && !showBlockerModal && !showExtensionModal && (
                    <div style={{ ...infoStrip, marginTop: '4px' }}>
                        Extension request pending PM review
                    </div>
                )}

                {/* Secondary actions — Raise Blocker / Request Extension */}
                {(showRaiseBlocker || showRequestExtension) && !showCompletionModal && (
                    <>
                        <div style={thinDivider} />
                        <div style={{ display: 'flex' }}>
                            {showRaiseBlocker && (
                                <button onClick={() => setShowBlockerModal(true)} style={secondaryBtn}>Raise Blocker</button>
                            )}
                            {showRaiseBlocker && showRequestExtension && <div style={vertDivider} />}
                            {showRequestExtension && (
                                <button onClick={() => setShowExtensionModal(true)} style={secondaryBtn}>Request Extension</button>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    return null;
};

export default TaskActionPanel;
