// FOLLO PROJECT-OVERVIEW
import useProjectStats from '../../hooks/useProjectStats';
import useUserRole from '../../hooks/useUserRole';
import { useAuth } from '@clerk/clerk-react';

const AVATAR_COLORS = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#f3e8ff', color: '#6b21a8' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#dcfce7', color: '#166534' },
  { bg: '#fff7ed', color: '#9a3412' },
];

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

export default function ProjectOverview({ project, tasks }) {
  const stats = useProjectStats(project, tasks);
  const { isAdmin, canApproveReject, isProjectContributor, isProjectViewer } = useUserRole();
  const { userId } = useAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isManager = isAdmin || canApproveReject;

  // Role-based risk filtering
  const visibleRiskTasks = isManager
    ? stats.riskTasks
    : stats.riskTasks.filter(t => t.assigneeId === userId);

  // Role-based member stats — contributors/viewers only see their own row
  const visibleMemberStats = isManager
    ? stats.memberStats
    : stats.memberStats.filter(m => m.id === userId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── SECTION 1: Overall completion ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" style={{ borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }} className="text-zinc-900 dark:text-white">Overall completion</span>
          <span style={{ fontSize: 24, fontWeight: 500, color: stats.completionPct === 100 ? '#16a34a' : '#2563eb' }}>
            {stats.completionPct}%
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 6 }} className="bg-zinc-200 dark:bg-zinc-700">
          <div style={{ height: '100%', borderRadius: 5, width: `${stats.completionPct}%`, background: stats.completionPct === 100 ? '#16a34a' : '#2563eb', transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
        {stats.timeElapsedPct !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="text-zinc-400 dark:text-zinc-500">
            <span>{fmt(project?.startDate)}</span>
            <span style={{ color: stats.isOnTrack ? '#16a34a' : '#d97706', fontWeight: 500 }}>
              {stats.timeElapsedPct}% of time elapsed
              {!stats.isOnTrack && ` · ${Math.abs(stats.timeElapsedPct - stats.completionPct)}% behind`}
            </span>
            <span>{fmt(project?.endDate || project?.dueDate)}</span>
          </div>
        )}
      </div>

      {/* ── SECTION 2: Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        {[
          { label: 'Total tasks', value: stats.total, color: undefined, alertBg: false },
          { label: 'Completed', value: stats.done, color: '#16a34a', alertBg: false },
          { label: 'In progress', value: stats.inProgress, color: '#2563eb', alertBg: false },
          { label: 'Overdue', value: stats.overdue, color: '#dc2626', alertBg: true },
          { label: 'Blocked', value: stats.blocked, color: '#d97706', alertBg: true },
        ].map(({ label, value, color, alertBg }) => (
          <div
            key={label}
            className={alertBg && value > 0 ? '' : 'bg-zinc-50 dark:bg-zinc-800/50'}
            style={{
              borderRadius: 8, padding: 12,
              background: alertBg && value > 0 ? (label === 'Overdue' ? '#fff5f5' : '#fffbeb') : undefined,
            }}
          >
            <div style={{ fontSize: 11, marginBottom: 4 }} className="text-zinc-400 dark:text-zinc-500">
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: color || undefined }} className={color ? '' : 'text-zinc-900 dark:text-white'}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── SECTION 3: Timeline health + Risks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Timeline health */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" style={{ borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.05em', marginBottom: 12 }} className="text-zinc-400 dark:text-zinc-500">
            TIMELINE HEALTH
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            {[
              { label: 'Days elapsed', value: stats.elapsedDays ?? '—' },
              { label: 'Days remaining', value: stats.remainingDays ?? '—', color: stats.remainingDays !== null && stats.remainingDays <= 7 ? '#dc2626' : stats.remainingDays !== null && stats.remainingDays <= 14 ? '#d97706' : undefined },
              { label: 'Tasks left', value: stats.total - stats.done },
              { label: 'Total days', value: stats.totalDays ?? '—', muted: true },
            ].map(({ label, value, color, muted }) => (
              <div key={label}>
                <div style={{ fontSize: 11 }} className="text-zinc-400 dark:text-zinc-500">{label}</div>
                <div style={{ fontSize: 18, fontWeight: 500, color: color || undefined }} className={muted ? 'text-zinc-400 dark:text-zinc-500' : color ? '' : 'text-zinc-900 dark:text-white'}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {stats.timeElapsedPct !== null && (
            <>
              {[
                { label: 'Time elapsed', pct: stats.timeElapsedPct, color: '#d97706' },
                { label: 'Work completed', pct: stats.completionPct, color: '#2563eb' },
              ].map(({ label, pct, color }) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }} className="text-zinc-400 dark:text-zinc-500">
                    <span>{label}</span><span>{pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, overflow: 'hidden' }} className="bg-zinc-200 dark:bg-zinc-700">
                    <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </>
          )}

          {isManager && stats.projectedDelay > 0 && (
            <div style={{ background: '#fff5f5', border: '0.5px solid #fecaca', borderRadius: 8, padding: 10, fontSize: 12, color: '#dc2626', marginTop: 10 }}>
              At current pace, projected completion is <strong>{fmt(stats.projectedEndDate)}</strong> — {stats.projectedDelay} day{stats.projectedDelay !== 1 ? 's' : ''} late.
            </div>
          )}

          {stats.isOnTrack && stats.completionPct > 0 && (
            <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 8, padding: 10, fontSize: 12, color: '#166534', marginTop: 10 }}>
              Project is on track.
            </div>
          )}

          {stats.totalDays === null && (
            <div style={{ fontSize: 12, padding: '16px 0', textAlign: 'center' }} className="text-zinc-400 dark:text-zinc-500">
              Set project start &amp; end dates to see timeline health.
            </div>
          )}
        </div>

        {/* Risks & blockers */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" style={{ borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.05em', marginBottom: 12 }} className="text-zinc-400 dark:text-zinc-500">
            RISKS &amp; BLOCKERS
          </div>

          {visibleRiskTasks.length === 0 ? (
            <div style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }} className="text-zinc-400 dark:text-zinc-500">
              No active risks. All tasks on track.
            </div>
          ) : (
            visibleRiskTasks.map(task => {
              const due = task.dueDate ? new Date(task.dueDate) : null;
              const isTaskOverdue = due && due < today && task.status !== 'DONE';
              const isTaskBlocked = task.slaStatus === 'BLOCKED' || task.status === 'BLOCKED';
              const daysOverdue = isTaskOverdue ? Math.ceil((today - due) / 86400000) : 0;
              const daysLeft = due && !isTaskOverdue ? Math.ceil((due - today) / 86400000) : null;

              return (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                  borderRadius: 8, marginBottom: 6, fontSize: 12,
                  background: isTaskBlocked ? '#fffbeb' : '#fff5f5',
                  border: `0.5px solid ${isTaskBlocked ? '#fde68a' : '#fecaca'}`,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isTaskBlocked ? '#d97706' : '#dc2626', marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 500, color: isTaskBlocked ? '#d97706' : '#dc2626' }}>
                      {task.title}
                      {isTaskOverdue && ` — ${daysOverdue}d overdue`}
                      {isTaskBlocked && ' — Blocked'}
                      {daysLeft !== null && daysLeft <= 2 && !isTaskOverdue && !isTaskBlocked && ` — Due in ${daysLeft}d`}
                    </div>
                    <div className="text-zinc-400 dark:text-zinc-500" style={{ marginTop: 2 }}>
                      {task.assignee
                        ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email
                        : 'Unassigned'}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {isManager && stats.projectedDelay > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 11 }} className="text-zinc-400 dark:text-zinc-500">
              Projected delay: <span style={{ color: '#dc2626', fontWeight: 500 }}>+{stats.projectedDelay} days</span> if blockers not resolved soon.
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 4: Team member progress ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" style={{ borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.05em', marginBottom: 12 }} className="text-zinc-400 dark:text-zinc-500">
          TEAM PROGRESS
        </div>

        {visibleMemberStats.length === 0 ? (
          <div style={{ fontSize: 13 }} className="text-zinc-400 dark:text-zinc-500">
            No tasks assigned yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: visibleMemberStats.length > 2 ? '1fr 1fr' : '1fr', gap: '0 24px' }}>
            {visibleMemberStats.map((member, i) => {
              const c = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const pctColor = member.pct >= 80 ? '#16a34a' : member.pct >= 50 ? '#2563eb' : '#d97706';
              const isMe = member.id === userId;
              return (
                <div key={member.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '0.5px solid var(--color-border-tertiary, #e4e4e7)',
                  background: isMe ? 'rgba(37,99,235,.04)' : undefined,
                }}>
                  {member.imageUrl ? (
                    <img src={member.imageUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                      {member.initials}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-zinc-900 dark:text-white">
                        {member.name}{isMe && ' (you)'}
                      </span>
                      <span style={{ fontSize: 11, marginLeft: 8, flexShrink: 0 }} className="text-zinc-400 dark:text-zinc-500">
                        {member.done}/{member.total} tasks
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, overflow: 'hidden' }} className="bg-zinc-200 dark:bg-zinc-700">
                      <div style={{ height: '100%', borderRadius: 2, width: `${member.pct}%`, background: pctColor, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                    {isManager && (member.overdue > 0 || member.blocked > 0) && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        {member.overdue > 0 && (
                          <span style={{ fontSize: 10, color: '#dc2626', background: '#fee2e2', padding: '0 5px', borderRadius: 3 }}>{member.overdue} overdue</span>
                        )}
                        {member.blocked > 0 && (
                          <span style={{ fontSize: 10, color: '#d97706', background: '#fef3c7', padding: '0 5px', borderRadius: 3 }}>{member.blocked} blocked</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 500, color: pctColor,
                    background: member.pct >= 80 ? '#dcfce7' : member.pct >= 50 ? '#dbeafe' : '#fef3c7',
                    padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                  }}>
                    {member.pct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 5: Task breakdown stacked bar ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" style={{ borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.05em', marginBottom: 12 }} className="text-zinc-400 dark:text-zinc-500">
          TASK BREAKDOWN
        </div>

        {stats.total > 0 && (
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
            {stats.done > 0 && <div style={{ flex: stats.done, background: '#16a34a', borderRadius: '4px 0 0 4px' }} />}
            {stats.inProgress > 0 && <div style={{ flex: stats.inProgress, background: '#2563eb' }} />}
            {stats.overdue > 0 && <div style={{ flex: stats.overdue, background: '#dc2626' }} />}
            {stats.blocked > 0 && <div style={{ flex: stats.blocked, background: '#d97706' }} />}
            {stats.todo > 0 && <div style={{ flex: stats.todo, background: '#94a3b8', borderRadius: '0 4px 4px 0' }} />}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Done', value: stats.done, color: '#16a34a' },
            { label: 'In progress', value: stats.inProgress, color: '#2563eb' },
            { label: 'Overdue', value: stats.overdue, color: '#dc2626' },
            { label: 'Blocked', value: stats.blocked, color: '#d97706' },
            { label: 'Todo', value: stats.todo, color: '#94a3b8' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
              <span style={{ fontWeight: 500 }} className="text-zinc-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
