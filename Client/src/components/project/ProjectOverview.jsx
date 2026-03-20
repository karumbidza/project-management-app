// FOLLO PROJECT-OVERVIEW
import { useNavigate } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import { getProjectHealth } from '../../lib/projectHealth.js';
import { StatusBadge } from '../gantt/GanttHelpers.jsx';
import ProjectChatPanel from './ProjectChatPanel.jsx';
import ProjectActivityFeed from './ProjectActivityFeed.jsx';
import ProjectLinksPanel from './ProjectLinksPanel.jsx';

const CARD = {
  background: 'var(--color-background-primary, #fff)',
  border: '0.5px solid var(--color-border-tertiary, #e4e4e7)',
  borderRadius: 12,
};

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: 'var(--color-text-tertiary, #a1a1aa)', marginBottom: 8, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

function Avatar({ name = '', image, size = 30 }) {
  const ini = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#3b82f6', border: '2px solid var(--color-background-primary, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {image
        ? <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#fff' }}>{ini || '?'}</span>
      }
    </div>
  );
}

function Bar({ label, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', marginBottom: 3 }}>
        <span>{label}</span><span>{pct}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border-tertiary, #e4e4e7)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

function Signal({ count, label, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: count > 0 ? color : 'var(--color-text-primary, #18181b)', lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function ProjectOverview({ project }) {
  const navigate  = useNavigate();
  if (!project) return null;

  const tasks   = project.tasks   ?? [];
  const members = project.members ?? [];
  const health  = getProjectHealth(project);
  const { rag, ragLabel, ragColor, timePct, workPct, signals, finishLabel, finishSub } = health;

  // Day X of Y
  let dayInfo = null;
  if (project.startDate && project.endDate) {
    const elapsed = Math.max(0, differenceInDays(new Date(), new Date(project.startDate)));
    const total   = Math.max(1, differenceInDays(new Date(project.endDate), new Date(project.startDate)));
    dayInfo = `Day ${Math.min(elapsed, total)} of ${total}`;
  }

  const FINISH_BG     = { green: '#f0fdf4', amber: '#fffbeb', red: '#fff5f5', grey: 'var(--color-background-secondary, #f4f4f5)' };
  const FINISH_BORDER = { green: '#bbf7d0', amber: '#fde68a', red: '#fecaca', grey: 'var(--color-border-tertiary, #e4e4e7)' };

  // Avatars — active (have tasks) first
  const activeIds  = new Set(tasks.filter(t => t.assigneeId).map(t => t.assigneeId));
  const sorted     = [...members].sort((a, b) => (activeIds.has(b.userId) ? 1 : 0) - (activeIds.has(a.userId) ? 1 : 0));
  const MAX_AV     = 7;

  const trackerTasks = tasks.slice(0, 8);
  const today        = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

      {/* ─── LEFT COLUMN ─── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Health header card */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ height: 3, background: ragColor }} />
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Name + RAG + Day X/Y */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.name}
                </div>
                {dayInfo && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', marginTop: 2 }}>{dayInfo}</div>}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ragColor }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: ragColor }}>{ragLabel}</span>
              </div>
            </div>
            {/* Dual bars */}
            {rag !== 'grey' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Bar label="Time elapsed" pct={timePct} color="#d97706" />
                <Bar label="Work done"    pct={workPct}  color={ragColor} />
              </div>
            )}
            {/* Est. finish */}
            {finishLabel && (
              <div style={{ padding: '6px 10px', background: FINISH_BG[rag], border: `0.5px solid ${FINISH_BORDER[rag]}`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: ragColor }}>Est. finish: {finishLabel}</div>
                {finishSub && <div style={{ fontSize: 11, color: ragColor, marginTop: 1 }}>{finishSub}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Team + Signals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Active Team */}
          <div style={{ ...CARD, padding: '12px 14px' }}>
            <SectionLabel>Active Team</SectionLabel>
            {sorted.length === 0
              ? <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)' }}>No members yet.</div>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {sorted.slice(0, MAX_AV).map(m => (
                    <div key={m.id} title={m.user?.name ?? ''}>
                      <Avatar name={m.user?.name ?? ''} image={m.user?.image} size={32} />
                    </div>
                  ))}
                  {sorted.length > MAX_AV && (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-background-secondary, #f4f4f5)', border: '2px solid var(--color-background-primary, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--color-text-secondary, #52525b)', fontWeight: 600 }}>
                      +{sorted.length - MAX_AV}
                    </div>
                  )}
                </div>
              )
            }
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)' }}>
              {signals.active} active · {members.length} total
            </div>
          </div>

          {/* Task Signals */}
          <div style={{ ...CARD, padding: '12px 14px' }}>
            <SectionLabel>Task Signals</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Signal count={signals.active}  label="Active"   color="#2563eb" />
              <Signal count={signals.done}    label="Done"     color="#16a34a" />
              <Signal count={signals.overdue} label="Overdue"  color="#dc2626" />
              <Signal count={signals.blocked} label="Blocked"  color="#d97706" />
            </div>
          </div>
        </div>

        {/* Task Tracker */}
        <div style={{ ...CARD, padding: '12px 16px' }}>
          <SectionLabel>Task Tracker</SectionLabel>
          {tasks.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #a1a1aa)', padding: '8px 0' }}>No tasks yet.</div>
            : (
              <>
                {/* header row */}
                <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border-tertiary, #e4e4e7)', paddingBottom: 5, marginBottom: 2 }}>
                  {['Task', 'Assignee', 'Status', 'Due'].map((h, i) => (
                    <div key={h} style={{ flex: i === 0 ? 2 : 1, fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary, #a1a1aa)', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: i === 3 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {trackerTasks.map(task => {
                  const overdue = task.status !== 'DONE' && task.dueDate && new Date(task.dueDate) < today;
                  return (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/task?taskId=${task.id}&projectId=${project.id}`)}
                      style={{ display: 'flex', alignItems: 'center', padding: '6px 4px', borderBottom: '0.5px solid var(--color-border-tertiary, #e4e4e7)', cursor: 'pointer', borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary, #f4f4f5)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ flex: 2, fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{task.title}</div>
                      <div style={{ flex: 1, fontSize: 11, color: 'var(--color-text-secondary, #52525b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assignee?.name ?? '—'}</div>
                      <div style={{ flex: 1 }}><StatusBadge status={task.status} slaStatus={task.slaStatus} /></div>
                      <div style={{ flex: 1, fontSize: 11, color: overdue ? '#dc2626' : 'var(--color-text-tertiary, #a1a1aa)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {task.dueDate ? format(new Date(task.dueDate), 'd MMM') : '—'}
                      </div>
                    </div>
                  );
                })}
                {tasks.length > 8 && (
                  <button
                    onClick={() => navigate(`/projectsDetail?id=${project.id}&tab=tasks`)}
                    style={{ marginTop: 8, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}
                  >
                    View all {tasks.length} tasks →
                  </button>
                )}
              </>
            )
          }
        </div>
      </div>

      {/* ─── RIGHT COLUMN ─── */}
      <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Project Chat */}
        <div style={{ ...CARD, padding: '12px 14px', display: 'flex', flexDirection: 'column', height: 300 }}>
          <SectionLabel>Project Chat</SectionLabel>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ProjectChatPanel projectId={project.id} />
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ ...CARD, padding: '12px 14px' }}>
          <SectionLabel>Recent Activity</SectionLabel>
          <ProjectActivityFeed activity={project.recentActivity ?? []} projectId={project.id} />
        </div>

        {/* Docs & Links */}
        <div style={{ ...CARD, padding: '12px 14px' }}>
          <SectionLabel>Docs & Links</SectionLabel>
          <ProjectLinksPanel projectId={project.id} initialLinks={project.pinnedLinks ?? []} />
        </div>

      </div>
    </div>
  );
}
