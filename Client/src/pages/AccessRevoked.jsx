// FOLLO ACCESS-SEC
import { useNavigate } from 'react-router-dom';

export default function AccessRevoked() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '40px',
      textAlign: 'center', gap: '16px',
      background: 'var(--color-background-primary, #fff)',
    }}>
      <div style={{ fontSize: '40px' }}>🔒</div>
      <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary, #18181b)' }}>
        Access removed
      </div>
      <div style={{ fontSize: '14px', color: 'var(--color-text-secondary, #52525b)', maxWidth: '360px', lineHeight: '1.6' }}>
        You no longer have access to this workspace. Contact your workspace administrator if you believe this is an error.
      </div>
      <button
        onClick={() => navigate('/')}
        style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 500, border: 'none', borderRadius: '8px', background: '#2563eb', color: '#fff', cursor: 'pointer', marginTop: '8px' }}
      >
        Back to home
      </button>
    </div>
  );
}
