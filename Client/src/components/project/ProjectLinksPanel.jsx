// FOLLO PROJECT-OVERVIEW
import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Plus, X, Link } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function linkIcon(url = '') {
  if (url.endsWith('.pdf')) return '📄';
  if (url.includes('figma'))  return '🎨';
  if (url.includes('docs.google') || url.includes('notion')) return '📝';
  return '🔗';
}

export default function ProjectLinksPanel({ projectId, initialLinks = [] }) {
  const { getToken } = useAuth();
  const [links, setLinks]         = useState(initialLinks);
  const [showForm, setShowForm]   = useState(false);
  const [label, setLabel]         = useState('');
  const [url, setUrl]             = useState('');
  const [saving, setSaving]       = useState(false);

  const pin = async () => {
    if (!label.trim() || !url.trim() || saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/v1/projects/${projectId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: label.trim(), url: url.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(prev => [...prev, data.data ?? data]);
        setLabel(''); setUrl(''); setShowForm(false);
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const remove = async (linkId) => {
    setLinks(prev => prev.filter(l => l.id !== linkId)); // optimistic
    try {
      const token = await getToken();
      await fetch(`${API}/api/v1/projects/${projectId}/links/${linkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // re-fetch on failure is overkill here; optimistic is fine
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {links.length === 0 && !showForm && (
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #a1a1aa)' }}>No pinned links yet.</div>
      )}

      {links.map(link => (
        <div
          key={link.id}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0' }}
        >
          <span style={{ fontSize: 13, flexShrink: 0 }}>{linkIcon(link.url)}</span>
          <span
            onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
            style={{ flex: 1, fontSize: 12, color: '#2563eb', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            {link.label}
          </span>
          <button
            onClick={() => remove(link.id)}
            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-tertiary, #a1a1aa)', lineHeight: 1 }}
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '6px 0' }}>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label"
            style={{ fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--color-border-tertiary, #e4e4e7)', borderRadius: 7, background: 'var(--color-background-secondary, #f4f4f5)', color: 'var(--color-text-primary, #18181b)', outline: 'none' }}
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pin()}
            placeholder="https://…"
            style={{ fontSize: 12, padding: '5px 8px', border: '0.5px solid var(--color-border-tertiary, #e4e4e7)', borderRadius: 7, background: 'var(--color-background-secondary, #f4f4f5)', color: 'var(--color-text-primary, #18181b)', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={pin}
              disabled={!label.trim() || !url.trim() || saving}
              style={{ flex: 1, fontSize: 11, fontWeight: 500, padding: '5px 0', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: (!label.trim() || !url.trim()) ? 0.5 : 1 }}
            >
              {saving ? 'Pinning…' : 'Pin link'}
            </button>
            <button
              onClick={() => { setShowForm(false); setLabel(''); setUrl(''); }}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, border: '0.5px solid var(--color-border-tertiary, #e4e4e7)', background: 'none', color: 'var(--color-text-secondary, #52525b)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontWeight: 500 }}
        >
          <Plus size={12} /> Pin link
        </button>
      )}
    </div>
  );
}
