// FOLLO ACTION-CARDS
// FOLLO CARD-HISTORY
import { useState, useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO, isValid, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
    approveTaskAsync,
    rejectTaskAsync,
    resolveBlockerAsync,
    approveExtensionAsync,
    denyExtensionAsync,
} from '../../features/slaSlice';
import { addCommentAsync } from '../../features/commentSlice';
import LoadingButton from '../ui/LoadingButton';

const TITLES = {
    approvals:  'Pending Approvals',
    blockers:   'Active Blockers',
    breaches:   'SLA Breaches',
    extensions: 'Extension Requests',
};

const EMPTY = {
    approvals:  'No tasks awaiting approval.',
    blockers:   'No active blockers.',
    breaches:   'No SLA breaches.',
    extensions: 'No pending extension requests.',
};

const safeDate = (d) => {
    if (!d) return null;
    try {
        const date = typeof d === 'string' ? parseISO(d) : new Date(d);
        return isValid(date) ? date : null;
    } catch { return null; }
};

const fmtDate = (d) => {
    const date = safeDate(d);
    if (!date) return '—';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const timeAgo = (d) => {
    const date = safeDate(d);
    return date ? formatDistanceToNow(date, { addSuffix: true }) : '—';
};

export default function ActionPanel({ type, tasks, onClose, onActionComplete, mode = 'active', workspaceId }) {
    const dispatch   = useDispatch();
    const navigate   = useNavigate();
    const { getToken } = useAuth();

    // FOLLO CARD-HISTORY
    const [history,     setHistory]     = useState([]);
    const [histLoading, setHistLoading] = useState(false);

    // FOLLO CARD-HISTORY — event type mapping per panel type
    const eventTypeMap = {
        approvals:  'APPROVED,REJECTED',
        blockers:   'BLOCKER_RAISED,BLOCKER_RESOLVED',
        breaches:   'APPROVED,BREACHED',
        extensions: 'EXTENSION_APPROVED,EXTENSION_DENIED',
    };

    useEffect(() => {
        if (mode !== 'history' || !workspaceId) return;
        let cancelled = false;
        const load = async () => {
            setHistLoading(true);
            try {
                const token = await getToken();
                const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:5001';
                const typesParam = eventTypeMap[type] ?? '';
                const res = await fetch(
                    `${apiBase}/api/v1/workspaces/dashboard/history?workspaceId=${workspaceId}&types=${typesParam}&limit=20`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const json = await res.json();
                if (!cancelled) setHistory(json.data ?? json ?? []);
            } catch (err) {
                console.error('[ActionPanel] history load failed', err);
            } finally {
                if (!cancelled) setHistLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, type, workspaceId]);

    const [loadingId,     setLoadingId]     = useState(null);
    const [rejectReason,  setRejectReason]  = useState('');
    const [showReject,    setShowReject]    = useState(null);
    const [denyReason,    setDenyReason]    = useState('');
    const [showDeny,      setShowDeny]      = useState(null);
    const [messagingId,   setMessagingId]   = useState(null);
    const [messageText,   setMessageText]   = useState('');

    // ── Action handlers ──

    const handleApprove = useCallback(async (taskId) => {
        setLoadingId(taskId);
        try {
            await dispatch(approveTaskAsync({ taskId, getToken })).unwrap();
            toast.success('Task approved');
            onActionComplete?.();
        } catch (e) { toast.error(e?.message || 'Failed to approve'); }
        finally { setLoadingId(null); }
    }, [dispatch, getToken, onActionComplete]);

    const handleReject = useCallback(async (taskId) => {
        if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
        setLoadingId(taskId);
        try {
            await dispatch(rejectTaskAsync({ taskId, reason: rejectReason.trim(), getToken })).unwrap();
            toast.success('Task rejected');
            setShowReject(null);
            setRejectReason('');
            onActionComplete?.();
        } catch (e) { toast.error(e?.message || 'Failed to reject'); }
        finally { setLoadingId(null); }
    }, [dispatch, getToken, rejectReason, onActionComplete]);

    const handleResolveBlocker = useCallback(async (taskId) => {
        setLoadingId(taskId);
        try {
            await dispatch(resolveBlockerAsync({ taskId, getToken })).unwrap();
            toast.success('Blocker resolved');
            onActionComplete?.();
        } catch (e) { toast.error(e?.message || 'Failed to resolve'); }
        finally { setLoadingId(null); }
    }, [dispatch, getToken, onActionComplete]);

    const handleApproveExtension = useCallback(async (taskId) => {
        setLoadingId(taskId);
        try {
            await dispatch(approveExtensionAsync({ taskId, getToken })).unwrap();
            toast.success('Extension approved');
            onActionComplete?.();
        } catch (e) { toast.error(e?.message || 'Failed to approve extension'); }
        finally { setLoadingId(null); }
    }, [dispatch, getToken, onActionComplete]);

    const handleDenyExtension = useCallback(async (taskId) => {
        setLoadingId(taskId);
        try {
            await dispatch(denyExtensionAsync({ taskId, reason: denyReason.trim(), getToken })).unwrap();
            toast.success('Extension denied');
            setShowDeny(null);
            setDenyReason('');
            onActionComplete?.();
        } catch (e) { toast.error(e?.message || 'Failed to deny extension'); }
        finally { setLoadingId(null); }
    }, [dispatch, getToken, denyReason, onActionComplete]);

    const handleSendMessage = useCallback(async (task) => {
        if (!messageText.trim()) return;
        try {
            await dispatch(addCommentAsync({
                taskId: task.id,
                getToken,
                content: messageText.trim(),
                type: 'TEXT',
            })).unwrap();
            toast.success(`Message sent to ${task.assignee?.name?.split(' ')[0] || 'assignee'}`);
            setMessageText('');
        } catch (e) { toast.error(e?.message || 'Failed to send message'); }
    }, [dispatch, getToken, messageText]);

    const daysOverdue = (dueDate) => {
        const due = safeDate(dueDate);
        if (!due) return 0;
        return differenceInDays(new Date(), due);
    };

    const count = tasks?.length ?? 0;
    const messagingTask = messagingId ? tasks?.find(t => t.id === messagingId) : null;
    const firstName = messagingTask?.assignee?.name?.split(' ')[0] || 'assignee';

    const breachReason = (task) => {
        if (!task.assignee) return 'Task has no assignee — was never started.';
        if (task.status === 'TODO') return 'Task was not started before due date.';
        if (task.status === 'IN_PROGRESS') return 'Task started but not completed by due date.';
        return 'Task was not completed by due date.';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* ── Panel Header ── */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '0.5px solid var(--color-border-tertiary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
            }}>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {TITLES[type]}{type === 'breaches' && mode === 'active' ? ` (${count})` : ''}{mode === 'history' ? ' — History' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {mode === 'history' ? 'Actions recorded this month' : `${count} item${count !== 1 ? 's' : ''} requiring action`}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', fontSize: 20,
                        cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4,
                    }}
                >
                    ×
                </button>
            </div>

            {/* ── FOLLO CARD-HISTORY: history view ── */}
            {mode === 'history' && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {histLoading ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                            Loading history…
                        </div>
                    ) : history.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                            No actions recorded this month.
                        </div>
                    ) : history.map(event => {
                        const colorMap = {
                            APPROVED:           '#16a34a',
                            REJECTED:           '#dc2626',
                            BLOCKER_RAISED:     '#d97706',
                            BLOCKER_RESOLVED:   '#2563eb',
                            BREACHED:           '#dc2626',
                            EXTENSION_APPROVED: '#7c3aed',
                            EXTENSION_DENIED:   '#dc2626',
                        };
                        const labelMap = {
                            APPROVED:           'Approved',
                            REJECTED:           'Rejected',
                            BLOCKER_RAISED:     'Blocker raised',
                            BLOCKER_RESOLVED:   'Blocker resolved',
                            BREACHED:           'SLA breached',
                            EXTENSION_APPROVED: 'Extension approved',
                            EXTENSION_DENIED:   'Extension denied',
                        };
                        const timeAgoFn = (d) => {
                            const mins = Math.floor((Date.now() - new Date(d)) / 60000);
                            if (mins < 60) return `${mins}m ago`;
                            const hrs = Math.floor(mins / 60);
                            if (hrs < 24) return `${hrs}h ago`;
                            return `${Math.floor(hrs / 24)}d ago`;
                        };
                        const color = colorMap[event.type] ?? '#6b7280';
                        const label = labelMap[event.type] ?? event.type;
                        return (
                            <div key={event.id} style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                                            {event.task?.title ?? '—'}
                                        </span>
                                        <span style={{ color: 'var(--color-text-tertiary)', margin: '0 6px' }}>·</span>
                                        <span style={{ color, fontSize: '12px' }}>{label}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                                        {timeAgoFn(event.createdAt)}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px', paddingLeft: '16px' }}>
                                    {event.task?.project?.name}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Body: task list + optional message column ── */}
            {mode === 'active' && <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

                {/* ── Task list column ── */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {(!tasks || count === 0) ? (
                        <div style={{
                            padding: 40, textAlign: 'center',
                            fontSize: 13, color: 'var(--color-text-tertiary)',
                        }}>
                            {EMPTY[type]}
                        </div>
                    ) : (
                        tasks.map(task => {
                            const assigneeName = task.assignee?.name || 'Unassigned';
                            const assigneeFirst = task.assignee?.name?.split(' ')[0];
                            const isLoading = loadingId === task.id;
                            const days = daysOverdue(task.dueDate);

                            /* Row background per type */
                            const rowBg = type === 'blockers' ? '#fffbeb'
                                : type === 'breaches' ? '#fff5f5'
                                : 'var(--color-background-primary)';

                            return (
                                <div key={task.id} style={{
                                    padding: '14px 16px',
                                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                                    background: rowBg,
                                }}>

                                    {/* ── Row header: title + badges + View → ── */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                                    {task.title}
                                                </span>

                                                {/* Status badge */}
                                                {type === 'approvals' && (
                                                    <span style={{
                                                        background: '#ede9fe', color: '#5b21b6',
                                                        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                    }}>PENDING</span>
                                                )}
                                                {type === 'blockers' && (
                                                    <span style={{
                                                        background: '#fef3c7', color: '#92400e',
                                                        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                    }}>BLOCKED</span>
                                                )}
                                                {type === 'blockers' && task.priority && ['HIGH', 'CRITICAL'].includes(task.priority) && (
                                                    <span style={{
                                                        background: '#fee2e2', color: '#991b1b',
                                                        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                    }}>{task.priority}</span>
                                                )}
                                                {type === 'breaches' && (
                                                    <>
                                                        <span style={{
                                                            background: '#fee2e2', color: '#991b1b',
                                                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                        }}>OVERDUE</span>
                                                        <span style={{
                                                            background: '#fee2e2', color: '#991b1b',
                                                            padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                        }}>{days}d late</span>
                                                    </>
                                                )}
                                                {type === 'extensions' && (
                                                    <span style={{
                                                        background: '#fef3c7', color: '#92400e',
                                                        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                    }}>EXTENSION PENDING</span>
                                                )}
                                            </div>

                                            {/* Subtitle */}
                                            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                                                {task.projectName} · {assigneeName}
                                                {type === 'approvals' && task.submittedAt && ` · Submitted ${timeAgo(task.submittedAt)}`}
                                                {type === 'blockers' && task.blockerRaisedAt && ` · Blocked ${timeAgo(task.blockerRaisedAt)}`}
                                                {type === 'breaches' && task.dueDate && ` · Was due ${fmtDate(task.dueDate)}`}
                                                {type === 'extensions' && task.extensionRequestedAt && ` · Requested ${timeAgo(task.extensionRequestedAt)}`}
                                            </div>
                                        </div>

                                        {/* View → */}
                                        <button
                                            onClick={() => navigate(`/taskDetails?taskId=${task.id}&projectId=${task.projectId}`)}
                                            style={{
                                                fontSize: 11, padding: '3px 8px',
                                                border: '0.5px solid var(--color-border-secondary)',
                                                borderRadius: 5, background: 'none',
                                                color: 'var(--color-text-tertiary)', cursor: 'pointer',
                                                whiteSpace: 'nowrap', flexShrink: 0,
                                            }}
                                        >
                                            View →
                                        </button>
                                    </div>

                                    {/* ── Context blocks per type ── */}

                                    {/* APPROVALS: completion notes */}
                                    {type === 'approvals' && task.completionNotes && (
                                        <div style={{
                                            marginTop: 8, marginBottom: 10, padding: '8px 10px',
                                            background: 'var(--color-background-secondary)',
                                            borderRadius: 6, borderLeft: '3px solid #7c3aed',
                                            fontSize: 12, color: 'var(--color-text-secondary)',
                                        }}>
                                            &ldquo;{task.completionNotes}&rdquo;
                                        </div>
                                    )}

                                    {/* APPROVALS: completion photos */}
                                    {type === 'approvals' && task.completionPhotos?.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, marginBottom: 6 }}>
                                            {task.completionPhotos.slice(0, 3).map((url, i) => (
                                                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                                    <img src={url} alt={`Photo ${i + 1}`} style={{
                                                        width: 64, height: 48, objectFit: 'cover',
                                                        borderRadius: 4, border: '0.5px solid var(--color-border-secondary)',
                                                    }} />
                                                </a>
                                            ))}
                                            {task.completionPhotos.length > 3 && (
                                                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>
                                                    +{task.completionPhotos.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* BLOCKERS: blocker reason */}
                                    {type === 'blockers' && task.blockerDescription && (
                                        <div style={{
                                            marginTop: 8, marginBottom: 6, padding: '10px 12px',
                                            background: '#fffbeb', border: '0.5px solid #fde68a',
                                            borderRadius: 8,
                                        }}>
                                            <div style={{
                                                fontSize: 10, fontWeight: 500, color: '#92400e',
                                                marginBottom: 4, letterSpacing: '0.04em',
                                            }}>BLOCKER REASON</div>
                                            <div style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
                                                {task.blockerDescription}
                                            </div>
                                        </div>
                                    )}

                                    {/* BLOCKERS: downstream impact */}
                                    {type === 'blockers' && task.dependants?.length > 0 && (
                                        <div style={{
                                            padding: '6px 10px', background: 'var(--color-background-secondary)',
                                            borderRadius: 6, marginBottom: 10,
                                            fontSize: 11, color: 'var(--color-text-secondary)',
                                        }}>
                                            ⚠ {task.dependants.length} task(s) blocked downstream
                                        </div>
                                    )}

                                    {/* BREACHES: breach reason */}
                                    {type === 'breaches' && task.dueDate && (
                                        <div style={{
                                            padding: '6px 10px', background: '#fff5f5',
                                            border: '0.5px solid #fecaca', borderRadius: 6,
                                            marginTop: 8, marginBottom: 10,
                                            fontSize: 11, color: '#dc2626',
                                        }}>
                                            {breachReason(task)}
                                        </div>
                                    )}

                                    {/* EXTENSIONS: dates */}
                                    {type === 'extensions' && (
                                        <div style={{
                                            padding: '8px 10px', background: 'var(--color-background-secondary)',
                                            borderRadius: 6, marginTop: 8, marginBottom: 4,
                                            fontSize: 12, color: 'var(--color-text-secondary)',
                                        }}>
                                            Original due: {fmtDate(task.extensionOriginalDueDate || task.dueDate)} → Requested: {fmtDate(task.extensionProposedDate)}
                                        </div>
                                    )}

                                    {/* EXTENSIONS: reason */}
                                    {type === 'extensions' && task.extensionReason && (
                                        <div style={{
                                            padding: '8px 10px', background: '#fffbeb',
                                            border: '0.5px solid #fde68a', borderRadius: 6,
                                            marginBottom: 10,
                                            fontSize: 12, color: 'var(--color-text-primary)',
                                        }}>
                                            &ldquo;{task.extensionReason}&rdquo;
                                        </div>
                                    )}

                                    {/* ── Reject reason textarea ── */}
                                    {type === 'approvals' && showReject === task.id && (
                                        <div style={{ marginTop: 8 }}>
                                            <textarea
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                placeholder="Reason for rejection (required)…"
                                                rows={2}
                                                style={{
                                                    width: '100%', fontSize: 12, padding: '7px 10px',
                                                    border: '0.5px solid var(--color-border-secondary)',
                                                    borderRadius: 6, background: 'var(--color-background-secondary)',
                                                    color: 'var(--color-text-primary)', resize: 'none',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                <LoadingButton
                                                    onClick={() => handleReject(task.id)}
                                                    loading={isLoading}
                                                    style={{
                                                        background: '#dc2626', color: '#fff', border: 'none',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Confirm Reject
                                                </LoadingButton>
                                                <button
                                                    onClick={() => { setShowReject(null); setRejectReason(''); }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '0.5px solid var(--color-border-secondary)',
                                                        color: 'var(--color-text-secondary)',
                                                        padding: '5px 12px', borderRadius: 6,
                                                        fontSize: 11, cursor: 'pointer',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Deny reason textarea ── */}
                                    {type === 'extensions' && showDeny === task.id && (
                                        <div style={{ marginTop: 8 }}>
                                            <textarea
                                                value={denyReason}
                                                onChange={e => setDenyReason(e.target.value)}
                                                placeholder="Reason for denial (optional)…"
                                                rows={2}
                                                style={{
                                                    width: '100%', fontSize: 12, padding: '7px 10px',
                                                    border: '0.5px solid var(--color-border-secondary)',
                                                    borderRadius: 6, background: 'var(--color-background-secondary)',
                                                    color: 'var(--color-text-primary)', resize: 'none',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                <LoadingButton
                                                    onClick={() => handleDenyExtension(task.id)}
                                                    loading={isLoading}
                                                    style={{
                                                        background: '#dc2626', color: '#fff', border: 'none',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Confirm Deny
                                                </LoadingButton>
                                                <button
                                                    onClick={() => { setShowDeny(null); setDenyReason(''); }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '0.5px solid var(--color-border-secondary)',
                                                        color: 'var(--color-text-secondary)',
                                                        padding: '5px 12px', borderRadius: 6,
                                                        fontSize: 11, cursor: 'pointer',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Action buttons ── */}
                                    <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>

                                        {/* APPROVALS */}
                                        {type === 'approvals' && showReject !== task.id && (
                                            <>
                                                <LoadingButton
                                                    onClick={() => handleApprove(task.id)}
                                                    loading={isLoading}
                                                    style={{
                                                        background: '#16a34a', color: '#fff', border: 'none',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    ✓ Approve
                                                </LoadingButton>
                                                <button
                                                    onClick={() => setShowReject(task.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '0.5px solid #dc2626', color: '#dc2626',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Reject
                                                </button>
                                                {task.assignee && (
                                                    <button
                                                        onClick={() => setMessagingId(messagingId === task.id ? null : task.id)}
                                                        style={{
                                                            marginLeft: 'auto', background: 'transparent',
                                                            border: '0.5px solid var(--color-border-secondary)',
                                                            color: 'var(--color-text-secondary)',
                                                            padding: '5px 12px', borderRadius: 6,
                                                            fontSize: 11, cursor: 'pointer',
                                                        }}
                                                    >
                                                        💬 Message {assigneeFirst}
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* BLOCKERS */}
                                        {type === 'blockers' && (
                                            <>
                                                <LoadingButton
                                                    onClick={() => handleResolveBlocker(task.id)}
                                                    loading={isLoading}
                                                    style={{
                                                        background: '#d97706', color: '#fff', border: 'none',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Mark Resolved
                                                </LoadingButton>
                                                <button
                                                    onClick={() => navigate(`/taskDetails?taskId=${task.id}&projectId=${task.projectId}`)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '0.5px solid var(--color-border-secondary)',
                                                        color: 'var(--color-text-secondary)',
                                                        padding: '5px 12px', borderRadius: 6,
                                                        fontSize: 11, cursor: 'pointer',
                                                    }}
                                                >
                                                    Reassign Task
                                                </button>
                                                {task.assignee && (
                                                    <button
                                                        onClick={() => setMessagingId(messagingId === task.id ? null : task.id)}
                                                        style={{
                                                            marginLeft: 'auto', background: 'transparent',
                                                            border: '0.5px solid var(--color-border-secondary)',
                                                            color: 'var(--color-text-secondary)',
                                                            padding: '5px 12px', borderRadius: 6,
                                                            fontSize: 11, cursor: 'pointer',
                                                        }}
                                                    >
                                                        💬 Message {assigneeFirst}
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* BREACHES */}
                                        {type === 'breaches' && (
                                            <>
                                                <button
                                                    onClick={() => navigate(`/taskDetails?taskId=${task.id}&projectId=${task.projectId}`)}
                                                    style={{
                                                        background: '#2563eb', color: '#fff', border: 'none',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Open Task
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/taskDetails?taskId=${task.id}&projectId=${task.projectId}`)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '0.5px solid #d97706', color: '#d97706',
                                                        padding: '5px 12px', borderRadius: 6,
                                                        fontSize: 11, cursor: 'pointer',
                                                    }}
                                                >
                                                    Extend Deadline
                                                </button>
                                                {task.assignee && (
                                                    <button
                                                        onClick={() => setMessagingId(messagingId === task.id ? null : task.id)}
                                                        style={{
                                                            marginLeft: 'auto', background: 'transparent',
                                                            border: '0.5px solid var(--color-border-secondary)',
                                                            color: 'var(--color-text-secondary)',
                                                            padding: '5px 12px', borderRadius: 6,
                                                            fontSize: 11, cursor: 'pointer',
                                                        }}
                                                    >
                                                        💬 Message {assigneeFirst}
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {/* EXTENSIONS */}
                                        {type === 'extensions' && showDeny !== task.id && (
                                            <>
                                                <LoadingButton
                                                    onClick={() => handleApproveExtension(task.id)}
                                                    loading={isLoading}
                                                    style={{
                                                        background: '#16a34a', color: '#fff', border: 'none',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Approve
                                                </LoadingButton>
                                                <button
                                                    onClick={() => setShowDeny(task.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '0.5px solid #dc2626', color: '#dc2626',
                                                        padding: '5px 14px', borderRadius: 6,
                                                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                                    }}
                                                >
                                                    Deny
                                                </button>
                                                {task.assignee && (
                                                    <button
                                                        onClick={() => setMessagingId(messagingId === task.id ? null : task.id)}
                                                        style={{
                                                            marginLeft: 'auto', background: 'transparent',
                                                            border: '0.5px solid var(--color-border-secondary)',
                                                            color: 'var(--color-text-secondary)',
                                                            padding: '5px 12px', borderRadius: 6,
                                                            fontSize: 11, cursor: 'pointer',
                                                        }}
                                                    >
                                                        💬 Message {assigneeFirst}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Quick Message column ── */}
                {messagingTask && (
                    <div style={{
                        width: 220, flexShrink: 0,
                        borderLeft: '0.5px solid var(--color-border-tertiary)',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Message header */}
                        <div style={{
                            padding: '12px 14px',
                            background: 'var(--color-background-secondary)',
                            borderBottom: '0.5px solid var(--color-border-tertiary)',
                        }}>
                            <div style={{
                                fontSize: 11, fontWeight: 500,
                                color: 'var(--color-text-tertiary)',
                                letterSpacing: '0.04em',
                            }}>QUICK MESSAGE</div>
                            <div style={{
                                fontSize: 12, fontWeight: 500,
                                color: 'var(--color-text-primary)',
                                marginTop: 2,
                            }}>{messagingTask.assignee?.name || 'Assignee'}</div>
                        </div>

                        {/* Message area */}
                        <div style={{
                            flex: 1, overflowY: 'auto',
                            padding: 12, display: 'flex',
                            flexDirection: 'column', gap: 8,
                        }}>
                            <p style={{
                                fontSize: 12, color: 'var(--color-text-secondary)',
                                fontStyle: 'italic', margin: 0,
                            }}>
                                Messages sent as task comments and notify {firstName}.
                            </p>
                        </div>

                        {/* Message input */}
                        <div style={{
                            padding: 10,
                            borderTop: '0.5px solid var(--color-border-tertiary)',
                        }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    type="text"
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && messageText.trim()) handleSendMessage(messagingTask);
                                    }}
                                    placeholder={`Message ${firstName}…`}
                                    style={{
                                        flex: 1, padding: '5px 8px', fontSize: 11,
                                        border: '0.5px solid var(--color-border-secondary)',
                                        borderRadius: 6, background: 'var(--color-background-secondary)',
                                        color: 'var(--color-text-primary)', outline: 'none',
                                        minWidth: 0,
                                    }}
                                />
                                <button
                                    onClick={() => handleSendMessage(messagingTask)}
                                    style={{
                                        padding: '5px 10px', fontSize: 11,
                                        border: 'none', background: '#2563eb',
                                        color: '#fff', borderRadius: 6,
                                        cursor: 'pointer', flexShrink: 0,
                                    }}
                                >
                                    →
                                </button>
                            </div>
                            <div style={{
                                fontSize: 10, color: 'var(--color-text-tertiary)',
                                marginTop: 4,
                            }}>
                                Sent as a task comment + notification
                            </div>
                        </div>
                    </div>
                )}
            </div>}
        </div>
    );
}
