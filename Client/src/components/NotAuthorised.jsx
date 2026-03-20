// FOLLO ACCESS-SEC
import { useNavigate } from 'react-router-dom';

export default function NotAuthorised({ message = "You don't have access to this resource.", showBack = true }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center', gap: '12px', minHeight: '60vh' }}>
      <div style={{ fontSize: '36px' }}>🔐</div>
      <div style={{ fontSize: '17px', fontWeight: 500, color: 'var(--color-text-primary, #18181b)' }}>Access denied</div>
      <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #52525b)', maxWidth: '340px', lineHeight: '1.6' }}>{message}</div>
      {showBack && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '8px 20px', fontSize: '13px', border: '0.5px solid #d4d4d8', borderRadius: '8px', background: 'none', color: '#52525b', cursor: 'pointer' }}>Go back</button>
          <button onClick={() => navigate('/')} style={{ padding: '8px 20px', fontSize: '13px', border: 'none', borderRadius: '8px', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Dashboard</button>
        </div>
      )}
    </div>
  );
}
