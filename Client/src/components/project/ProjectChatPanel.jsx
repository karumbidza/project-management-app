// FOLLO PROJECT-OVERVIEW
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { io as ioClient } from 'socket.io-client';
import { Send } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function ProjectChatPanel({ projectId }) {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState('');
  const [sending, setSending] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  // Scroll to bottom
  const scrollBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load messages
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/v1/projects/${projectId}/comments?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) { if (!cancelled) setForbidden(true); return; }
        const data = await res.json();
        if (!cancelled) setMessages(data.data ?? []);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, getToken]);

  // Scroll on new messages
  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  // Socket real-time
  useEffect(() => {
    if (!projectId || forbidden) return;

    const socket = ioClient(API, { withCredentials: true });
    socketRef.current = socket;
    socket.emit('join_project', projectId);

    socket.on('project_comment_added', (comment) => {
      setMessages(prev => {
        if (prev.some(m => m.id === comment.id)) return prev;
        return [...prev, comment];
      });
    });

    socket.on('project_comment_deleted', ({ commentId }) => {
      setMessages(prev => prev.filter(m => m.id !== commentId));
    });

    return () => {
      socket.emit('leave_project', projectId);
      socket.off('project_comment_added');
      socket.off('project_comment_deleted');
      socket.disconnect();
    };
  }, [projectId, forbidden]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/v1/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (res.ok) setInput('');
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const deleteMsg = async (commentId) => {
    try {
      const token = await getToken();
      await fetch(`${API}/api/v1/projects/${projectId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  };

  if (forbidden) {
    return (
      <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--color-text-tertiary, #a1a1aa)', textAlign: 'center', lineHeight: 1.6 }}>
        Project chat is available to<br />project owners and managers only.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', textAlign: 'center', paddingTop: 12 }}>Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)', textAlign: 'center', paddingTop: 12 }}>No messages yet. Start the conversation.</div>
        )}
        {messages.map(msg => {
          const isMe = msg.userId === clerkUser?.id;
          const name = msg.user?.name || 'Unknown';
          const avatar = msg.user?.image;
          return (
            <div key={msg.id} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatar
                  ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{initials(name)}</span>
                }
              </div>
              <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-secondary, #52525b)' }}>{isMe ? 'You' : name}</span>
                  <span style={{ fontSize: 9, color: 'var(--color-text-tertiary, #a1a1aa)' }}>{timeAgo(msg.createdAt)}</span>
                </div>
                <div
                  style={{
                    padding: '6px 9px', borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                    background: isMe ? '#2563eb' : 'var(--color-background-secondary, #f4f4f5)',
                    color: isMe ? '#fff' : 'var(--color-text-primary, #18181b)',
                    fontSize: 12, lineHeight: 1.4, wordBreak: 'break-word',
                  }}
                  onDoubleClick={() => isMe && deleteMsg(msg.id)}
                  title={isMe ? 'Double-click to delete' : ''}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '0.5px solid var(--color-border-tertiary, #e4e4e7)', paddingTop: 8, display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message…"
          style={{
            flex: 1, fontSize: 12, padding: '6px 9px',
            border: '0.5px solid var(--color-border-tertiary, #e4e4e7)',
            borderRadius: 8, background: 'var(--color-background-secondary, #f4f4f5)',
            color: 'var(--color-text-primary, #18181b)', outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 8,
            background: input.trim() ? '#2563eb' : 'var(--color-border-tertiary, #e4e4e7)',
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Send size={13} color={input.trim() ? '#fff' : '#a1a1aa'} />
        </button>
      </div>
    </div>
  );
}
