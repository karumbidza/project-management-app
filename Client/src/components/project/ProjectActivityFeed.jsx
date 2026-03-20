// FOLLO PROJECT-OVERVIEW
import { useNavigate } from 'react-router-dom';

const EVENT_COLOR = {
  APPROVED:           '#16a34a',
  REJECTED:           '#dc2626',
  BLOCKER_RAISED:     '#d97706',
  BLOCKER_RESOLVED:   '#2563eb',
  EXTENSION_APPROVED: '#7c3aed',
  EXTENSION_DENIED:   '#dc2626',
  SUBMITTED:          '#6b7280',
  BREACHED:           '#dc2626',
  AT_RISK:            '#d97706',
  CLOCK_STARTED:      '#3b82f6',
};

const EVENT_LABEL = {
  APPROVED:           'approved',
  REJECTED:           'rejected',
  BLOCKER_RAISED:     'blocker raised',
  BLOCKER_RESOLVED:   'blocker resolved',
  EXTENSION_APPROVED: 'extension approved',
  EXTENSION_DENIED:   'extension denied',
  SUBMITTED:          'submitted for review',
  BREACHED:           'SLA breached',
  AT_RISK:            'marked at risk',
  CLOCK_STARTED:      'started',
  WARNING_24HR:       '24hr warning',
  WARNING_2HR:        '2hr warning',
};

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ProjectActivityFeed({ activity = [], projectId }) {
  const navigate = useNavigate();

  if (!activity.length) {
    return (
      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', padding: '8px 0' }}>
        No recent activity.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {activity.map(event => {
        const color = EVENT_COLOR[event.type] ?? '#a1a1aa';
        const label = EVENT_LABEL[event.type] ?? event.type.toLowerCase().replace(/_/g, ' ');
        return (
          <div
            key={event.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
            onClick={() => navigate(`/task?taskId=${event.task?.id}&projectId=${projectId}`)}
          >
            <div style={{ flexShrink: 0, marginTop: 4, width: 6, height: 6, borderRadius: '50%', background: color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-primary, #18181b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 500 }}>{event.task?.title ?? 'Unknown task'}</span>
                <span style={{ color: 'var(--color-text-tertiary, #a1a1aa)' }}> · </span>
                <span style={{ color }}>{label}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary, #a1a1aa)', marginTop: 1 }}>
                {timeAgo(event.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
