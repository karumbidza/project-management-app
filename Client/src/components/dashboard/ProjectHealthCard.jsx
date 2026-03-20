// FOLLO HEALTH
import { getProjectHealth } from '../../lib/projectHealth.js';
import { useNavigate } from 'react-router-dom';

const FINISH_BG     = { green: '#f0fdf4', amber: '#fffbeb', red: '#fff5f5', grey: 'var(--color-background-secondary, #f4f4f5)' };
const FINISH_BORDER = { green: '#bbf7d0', amber: '#fde68a', red: '#fecaca', grey: 'var(--color-border-tertiary, #e4e4e7)' };

export default function ProjectHealthCard({ project }) {
  const navigate = useNavigate();
  const { rag, ragLabel, ragColor, timePct, workPct, signals, finishLabel, finishSub } = getProjectHealth(project);

  const finishBg     = FINISH_BG[rag];
  const finishBorder = FINISH_BORDER[rag];

  return (
    <div
      onClick={() => navigate(`/projectsDetail?id=${project.id}&tab=overview`)}
      style={{
        background: 'var(--color-background-primary, #fff)',
        border: '0.5px solid var(--color-border-tertiary, #e4e4e7)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color .15s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = ragColor}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-tertiary, #e4e4e7)'}
    >
      {/* Top RAG strip */}
      <div style={{ height: 3, background: ragColor, flexShrink: 0 }} />

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>

        {/* Header: name + due + RAG badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', marginTop: 1 }}>
              {project.endDate
                ? `Due ${new Date(project.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'No deadline set'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: ragColor }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: ragColor }}>{ragLabel}</span>
          </div>
        </div>

        {/* Dual progress bars — only when we have enough data */}
        {rag !== 'grey' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Time elapsed */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', marginBottom: 3 }}>
                <span>Time elapsed</span>
                <span>{timePct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border-tertiary, #e4e4e7)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: '#d97706', width: `${timePct}%`, transition: 'width .6s ease' }} />
              </div>
            </div>
            {/* Work done */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', marginBottom: 3 }}>
                <span>Work done</span>
                <span>{workPct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border-tertiary, #e4e4e7)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: ragColor, width: `${workPct}%`, transition: 'width .6s ease' }} />
              </div>
            </div>
          </div>
        )}

        {/* Projected finish box */}
        <div style={{ padding: '7px 10px', background: finishBg, border: `0.5px solid ${finishBorder}`, borderRadius: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: ragColor }}>
            Est. finish: {finishLabel}
          </div>
          {finishSub && (
            <div style={{ fontSize: 10, color: ragColor, marginTop: 1 }}>{finishSub}</div>
          )}
        </div>

        {/* Signal indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <SignalRow
            isIssue={signals.active === 0}
            ragColor={ragColor}
            label={signals.active > 0 ? `${signals.active} task${signals.active !== 1 ? 's' : ''} active` : 'No active tasks'}
            issueColor={signals.active === 0 ? '#a1a1aa' : '#16a34a'}
          />
          <SignalRow
            isIssue={signals.blocked > 0}
            ragColor={ragColor}
            label={signals.blocked > 0 ? `${signals.blocked} blocker${signals.blocked !== 1 ? 's' : ''} active` : 'No blockers'}
          />
          <SignalRow
            isIssue={signals.overdue > 0}
            ragColor={ragColor}
            label={signals.overdue > 0 ? `${signals.overdue} task${signals.overdue !== 1 ? 's' : ''} overdue` : '0 overdue'}
          />
          {signals.extensions > 0 && (
            <SignalRow
              isIssue
              ragColor="#d97706"
              label={`${signals.extensions} extension${signals.extensions !== 1 ? 's' : ''} pending`}
            />
          )}
        </div>

      </div>
    </div>
  );
}

function SignalRow({ isIssue, ragColor, label, issueColor }) {
  const dotColor = isIssue ? (issueColor ?? ragColor) : '#16a34a';
  const textColor = isIssue ? (issueColor ?? ragColor) : 'var(--color-text-secondary, #52525b)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ color: textColor }}>{label}</span>
    </div>
  );
}
