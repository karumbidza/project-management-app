// FOLLO SRP
// FOLLO TASK-UI
import { useNavigate } from "react-router-dom";

const ProjectInfoCard = ({ project, task, userId }) => {
    const navigate = useNavigate();
    if (!project && !task?.project) return null;

    const p = task?.project || project || {};
    const progress = p.progress ?? 0;

    const memberRole = (() => {
        const members = p.members || project?.members || [];
        const match = members.find(m => (m.userId || m.user?.id) === userId);
        if (!match) return 'Contributor';
        const r = match.role || match.user?.role;
        if (!r) return 'Contributor';
        return r.charAt(0) + r.slice(1).toLowerCase();
    })();

    return (
        <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: '12px',
            overflow: 'hidden',
        }}>
            {/* Thin blue strip */}
            <div style={{ height: '3px', background: '#2563eb' }} />

            <div style={{ padding: '16px' }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: '14px',
                }}>
                    <div style={{
                        fontSize: '11px', fontWeight: 500,
                        color: 'var(--color-text-tertiary)',
                        letterSpacing: '.05em',
                    }}>PROJECT</div>
                    <span
                        onClick={() => navigate(`/projectsDetail?id=${task?.projectId || project?.id}&tab=overview`)}
                        style={{
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            cursor: 'pointer',
                        }}
                    >View full project →</span>
                </div>

                {/* Project name */}
                <div style={{
                    fontSize: '15px', fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    marginBottom: '2px',
                }}>
                    {p.name ?? '—'}
                </div>

                {/* Description */}
                {p.description && (
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: '12px',
                    }}>{p.description}</div>
                )}

                {/* Progress bar */}
                <div style={{
                    height: '4px',
                    background: 'var(--color-border-tertiary)',
                    borderRadius: '2px',
                    marginBottom: '5px',
                    marginTop: '12px',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%', borderRadius: '2px',
                        background: '#2563eb',
                        width: `${progress}%`,
                        transition: 'width .6s ease',
                    }} />
                </div>
                <div style={{
                    fontSize: '11px',
                    color: 'var(--color-text-tertiary)',
                    marginBottom: '14px',
                }}>
                    {progress}% complete
                    {(p.endDate) && ` · Due ${new Date(p.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </div>

                {/* Key-value rows */}
                {[
                    { label: 'Status', value: p.status ?? '—' },
                    { label: 'Your role', value: memberRole },
                    {
                        label: 'Start date',
                        value: p.startDate
                            ? new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—',
                    },
                ].map(({ label, value }, i, arr) => (
                    <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: '12px', padding: '8px 0',
                        borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                    }}>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectInfoCard;
