// FOLLO PROJECTS-PAGE
// FOLLO PROJECTS-C
// FOLLO CLEAN-NAV
// FOLLO INSTANT
import { useState, useEffect, useMemo, useRef } from "react";
import { useSelector, shallowEqual } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import CreateProjectDialog from "../components/CreateProjectDialog";
import CreateWorkspaceDialog from "../components/CreateWorkspaceDialog";
import useUserRole from "../hooks/useUserRole";

const EMPTY_ARRAY = [];

const fmt = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

/** Calculate max overdue days across tasks */
function maxOverdueDays(tasks) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let max = 0;
    for (const t of tasks) {
        if (t.status === 'DONE') continue;
        const due = t.dueDate ? new Date(t.dueDate) : null;
        if (due && due < now) {
            const days = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
            if (days > max) max = days;
        }
    }
    return max;
}

/** Calculate days behind schedule for a project */
function daysBehind(project) {
    const start = project?.startDate ? new Date(project.startDate) : null;
    const end = project?.endDate || project?.dueDate ? new Date(project.endDate || project.dueDate) : null;
    if (!start || !end) return 0;
    const now = new Date();
    const totalDuration = end - start;
    if (totalDuration <= 0) return 0;
    const elapsed = now - start;
    const timeElapsedPct = Math.min(100, Math.round((elapsed / totalDuration) * 100));
    const tasks = project.tasks ?? [];
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const diff = timeElapsedPct - completionPct;
    if (diff <= 0) return 0;
    // Convert percentage gap to days
    const totalDays = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
    return Math.round((diff / 100) * totalDays);
}

export default function Projects() {
    const navigate = useNavigate();
    const { canCreateProjects, isAdmin, isMemberView } = useUserRole();

    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace);
    const hasWorkspace = Boolean(currentWorkspace?.id);

    const workspaceProjects = useSelector(
        (state) => state?.workspace?.currentWorkspace?.projects ?? EMPTY_ARRAY,
        shallowEqual
    );
    const myProjects = useSelector(
        (state) => state?.workspace?.myProjects ?? EMPTY_ARRAY,
        shallowEqual
    );

    const projects = isMemberView ? myProjects : workspaceProjects;

    const [selectedId, setSelectedId] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
    const [search, setSearch] = useState('');

    // FOLLO INSTANT — Auto-select first project on load, and select newest project when list grows
    const prevProjectsLengthRef = useRef(projects.length);
    useEffect(() => {
        const prevLen = prevProjectsLengthRef.current;
        prevProjectsLengthRef.current = projects.length;

        if (projects.length === 0) return;

        // Initial load — select first project
        if (!selectedId) {
            setSelectedId(projects[0].id);
            return;
        }

        // A project was just added — select it immediately
        if (projects.length > prevLen) {
            setSelectedId(projects[projects.length - 1].id);
        }
    }, [projects]);

    const selectedProject = projects.find(p => p.id === selectedId);
    const selectedTasks = selectedProject?.tasks ?? [];

    const filteredProjects = useMemo(() => {
        if (!search.trim()) return projects;
        const q = search.toLowerCase();
        return projects.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
        );
    }, [projects, search]);

    // Right panel stats
    const rightStats = useMemo(() => {
        const total = selectedTasks.length;
        const done = selectedTasks.filter(t => t.status === 'DONE').length;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const overdue = selectedTasks.filter(t => {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            return t.status !== 'DONE' && due && due < now;
        });
        const blocked = selectedTasks.filter(t => t.slaStatus === 'BLOCKED');
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const behind = selectedProject ? daysBehind(selectedProject) : 0;
        return { total, done, overdue, blocked, pct, behind };
    }, [selectedTasks, selectedProject]);

    // Needs attention tasks
    const attentionTasks = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const items = [];
        for (const t of selectedTasks) {
            if (t.status === 'DONE') continue;
            const due = t.dueDate ? new Date(t.dueDate) : null;
            if (due && due < now) {
                const days = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
                items.push({ ...t, reason: 'overdue', label: `${days}d overdue` });
            } else if (t.slaStatus === 'BLOCKED') {
                items.push({ ...t, reason: 'blocked', label: 'Blocked' });
            }
        }
        return items;
    }, [selectedTasks]);

    const handleNewProject = () => {
        if (!hasWorkspace) {
            if (isAdmin) setShowCreateWorkspace(true);
            return;
        }
        setIsDialogOpen(true);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 60px)',
            padding: '20px 24px',
            gap: '16px',
            boxSizing: 'border-box',
        }}>

            {/* No-workspace banner — admin only */}
            {!hasWorkspace && isAdmin && (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300" style={{ flexShrink: 0 }}>
                    <AlertCircle className="size-5 shrink-0" />
                    <div className="flex-1 text-sm">
                        <span className="font-medium">No workspace found.</span> Create a workspace to get started.
                    </div>
                    <button onClick={() => setShowCreateWorkspace(true)} className="px-4 py-1.5 text-sm rounded bg-amber-600 text-white hover:bg-amber-700 transition whitespace-nowrap">
                        Create Workspace
                    </button>
                </div>
            )}

            {/* Page header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div>
                    <h1 style={{
                        fontSize: '20px', fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        margin: 0,
                    }}>
                        Projects
                    </h1>
                    <p style={{
                        fontSize: '12px',
                        color: 'var(--color-text-tertiary)',
                        margin: '3px 0 0',
                    }}>
                        {projects.length} project{projects.length !== 1 ? 's' : ''} in this workspace
                    </p>
                </div>
                {canCreateProjects && (
                    <button
                        onClick={handleNewProject}
                        disabled={!hasWorkspace}
                        style={{
                            padding: '8px 16px', fontSize: '13px',
                            borderRadius: '8px', border: 'none',
                            background: '#2563eb', color: '#fff',
                            cursor: hasWorkspace ? 'pointer' : 'not-allowed',
                            fontWeight: 500,
                            opacity: hasWorkspace ? 1 : 0.5,
                        }}
                    >
                        + New Project
                    </button>
                )}
            </div>

            {/* Split panel */}
            <div style={{
                display: 'flex',
                gap: '12px',
                flex: 1,
                minHeight: 0,
            }}>

                {/* ── LEFT PANEL — Project List ── */}
                <div style={{
                    width: '260px',
                    flexShrink: 0,
                    background: 'var(--color-background-primary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}>
                    {/* Search */}
                    <div style={{
                        padding: '12px',
                        borderBottom: '0.5px solid var(--color-border-tertiary)',
                    }}>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search projects…"
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '12px',
                                border: '0.5px solid var(--color-border-secondary)',
                                borderRadius: '6px',
                                background: 'var(--color-background-secondary)',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {/* Project list — scrollable */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredProjects.map((project) => {
                            const tasks   = project.tasks ?? [];
                            const total   = tasks.length;
                            const done    = tasks.filter(t => t.status === 'DONE').length;
                            const overdue = maxOverdueDays(tasks);
                            const blocked = tasks.filter(t => t.slaStatus === 'BLOCKED').length;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                            // RAG status
                            const rag = overdue > 0 || blocked > 0
                                ? '#dc2626'
                                : project.status === 'DONE' || pct === 100
                                ? '#94a3b8'
                                : '#16a34a';

                            const isSelected = project.id === selectedId;

                            return (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedId(project.id)}
                                    style={{
                                        padding: '12px',
                                        borderBottom: '0.5px solid var(--color-border-tertiary)',
                                        borderLeft: isSelected
                                            ? '3px solid #2563eb' : '3px solid transparent',
                                        background: isSelected
                                            ? 'var(--color-background-info)'
                                            : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'background .1s',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSelected)
                                            e.currentTarget.style.background = 'var(--color-background-secondary)';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSelected)
                                            e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    {/* Project name + RAG dot */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '6px',
                                    }}>
                                        <div style={{
                                            width: '8px', height: '8px',
                                            borderRadius: '50%',
                                            background: rag,
                                            flexShrink: 0,
                                        }} />
                                        <span style={{
                                            fontSize: '13px', fontWeight: 500,
                                            color: 'var(--color-text-primary)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                        }}>
                                            {project.name}
                                        </span>
                                    </div>

                                    {/* Mini progress bar */}
                                    <div style={{
                                        height: '4px', borderRadius: '2px',
                                        background: 'var(--color-border-tertiary)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%', borderRadius: '2px',
                                            width: `${pct}%`,
                                            background: rag === '#dc2626'
                                                ? '#dc2626'
                                                : rag === '#94a3b8'
                                                ? '#16a34a'
                                                : '#2563eb',
                                        }} />
                                    </div>

                                    {/* Stats line */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '10px',
                                        marginTop: '5px',
                                    }}>
                                        <span style={{
                                            color: rag === '#dc2626' ? '#dc2626'
                                                : rag === '#94a3b8'
                                                ? 'var(--color-text-tertiary)'
                                                : '#16a34a',
                                        }}>
                                            {pct}%
                                            {overdue > 0 && ` · ${overdue}d late`}
                                            {overdue === 0 && blocked > 0 && ` · ${blocked} blocked`}
                                            {overdue === 0 && blocked === 0 && pct < 100 && ' · On track'}
                                            {pct === 100 && ' · Done'}
                                        </span>
                                        <span style={{ color: 'var(--color-text-tertiary)' }}>
                                            {total} tasks
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredProjects.length === 0 && (
                            <div style={{
                                padding: '24px',
                                fontSize: '12px',
                                color: 'var(--color-text-tertiary)',
                                textAlign: 'center',
                            }}>
                                No projects found.
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL — Selected Project Detail ── */}
                <div style={{
                    flex: 1,
                    background: 'var(--color-background-primary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {!selectedProject ? (
                        <div style={{
                            flex: 1, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px',
                            color: 'var(--color-text-tertiary)',
                        }}>
                            {projects.length === 0
                                ? (canCreateProjects
                                    ? 'No projects yet. Create your first project.'
                                    : 'No projects assigned to you yet.')
                                : 'Select a project to view details'}
                        </div>
                    ) : (
                        <>
                            {/* Right panel header */}
                            <div style={{
                                padding: '20px 24px 16px',
                                borderBottom: '0.5px solid var(--color-border-tertiary)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                flexShrink: 0,
                            }}>
                                <div>
                                    <div style={{
                                        fontSize: '20px', fontWeight: 600,
                                        color: 'var(--color-text-primary)',
                                    }}>
                                        {selectedProject.name}
                                    </div>
                                    <div style={{
                                        fontSize: '13px',
                                        color: 'var(--color-text-tertiary)',
                                        marginTop: '4px',
                                    }}>
                                        {fmt(selectedProject.endDate || selectedProject.dueDate)
                                            ? `Due ${fmt(selectedProject.endDate || selectedProject.dueDate)}`
                                            : selectedProject.status ?? 'Active'}
                                        {' · '}{rightStats.total} task{rightStats.total !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/projectsDetail?id=${selectedProject.id}&tab=tasks`)}
                                    style={{
                                        padding: '8px 18px', fontSize: '13px',
                                        borderRadius: '20px', border: 'none',
                                        background: '#2563eb', color: '#fff',
                                        cursor: 'pointer', fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Open full view →
                                </button>
                            </div>

                            {/* Right panel body — scrollable */}
                            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

                                {/* Completion bar */}
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center',
                                        justifyContent: 'space-between', marginBottom: '8px',
                                    }}>
                                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                            Completion
                                        </span>
                                        <span style={{
                                            fontSize: '13px', fontWeight: 600,
                                            color: rightStats.behind > 0 ? '#dc2626'
                                                : rightStats.pct === 100 ? '#16a34a' : '#2563eb',
                                        }}>
                                            {rightStats.pct}%
                                            {rightStats.behind > 0 && ` · ${rightStats.behind}d behind`}
                                        </span>
                                    </div>
                                    <div style={{
                                        height: '8px', borderRadius: '4px',
                                        background: 'var(--color-border-tertiary)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%', borderRadius: '4px',
                                            width: `${rightStats.pct}%`,
                                            background: rightStats.behind > 0 ? '#dc2626'
                                                : rightStats.pct === 100 ? '#16a34a' : '#2563eb',
                                            transition: 'width .4s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Stat cards */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '10px',
                                    marginBottom: '28px',
                                }}>
                                    {[
                                        { label: 'Total', value: rightStats.total, color: 'var(--color-text-primary)' },
                                        { label: 'Done', value: rightStats.done, color: 'var(--color-text-primary)' },
                                        { label: 'Overdue', value: rightStats.overdue.length, color: rightStats.overdue.length > 0 ? '#dc2626' : 'var(--color-text-primary)' },
                                        { label: 'Blocked', value: rightStats.blocked.length, color: rightStats.blocked.length > 0 ? '#dc2626' : 'var(--color-text-primary)' },
                                    ].map((s) => (
                                        <div key={s.label} style={{
                                            padding: '16px',
                                            borderRadius: '10px',
                                            border: `1px solid ${s.value > 0 && (s.label === 'Overdue' || s.label === 'Blocked') ? (s.label === 'Overdue' ? '#fca5a5' : '#fde68a') : 'var(--color-border-tertiary)'}`,
                                            background: s.value > 0 && s.label === 'Overdue' ? 'rgba(220,38,38,0.05)'
                                                : s.value > 0 && s.label === 'Blocked' ? 'rgba(234,179,8,0.05)'
                                                : 'var(--color-background-secondary)',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '24px', fontWeight: 600, color: s.color }}>
                                                {s.value}
                                            </div>
                                            <div style={{
                                                fontSize: '11px', fontWeight: 500,
                                                color: s.value > 0 && (s.label === 'Overdue' || s.label === 'Blocked') ? s.color : 'var(--color-text-tertiary)',
                                                marginTop: '2px',
                                            }}>
                                                {s.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Needs attention */}
                                {attentionTasks.length > 0 && (
                                    <div>
                                        <div style={{
                                            fontSize: '11px', fontWeight: 600,
                                            color: 'var(--color-text-tertiary)',
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase',
                                            marginBottom: '12px',
                                        }}>
                                            Needs Attention
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {attentionTasks.map((t) => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => navigate(`/projectsDetail?id=${selectedProject.id}&tab=tasks`)}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: `1px solid ${t.reason === 'overdue' ? '#fca5a5' : '#fde68a'}`,
                                                        background: t.reason === 'overdue'
                                                            ? 'rgba(220,38,38,0.05)' : 'rgba(234,179,8,0.05)',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{
                                                        fontSize: '13px', fontWeight: 600,
                                                        color: t.reason === 'overdue' ? '#dc2626' : '#ca8a04',
                                                    }}>
                                                        {t.title} — {t.label}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '12px',
                                                        color: 'var(--color-text-tertiary)',
                                                        marginTop: '3px',
                                                    }}>
                                                        {t.assignee?.name || 'Unassigned'}
                                                        {t.reason === 'blocked' && t.blockerDescription
                                                            ? ` · ${t.blockerDescription}` : ''}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {attentionTasks.length === 0 && rightStats.total > 0 && (
                                    <div style={{
                                        padding: '32px',
                                        textAlign: 'center',
                                        fontSize: '13px',
                                        color: 'var(--color-text-tertiary)',
                                    }}>
                                        All tasks are on track
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            {showCreateWorkspace && (
                <CreateWorkspaceDialog isOpen={showCreateWorkspace} onClose={() => setShowCreateWorkspace(false)} />
            )}
        </div>
    );
}
