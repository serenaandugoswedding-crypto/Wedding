import { useNavigate } from 'react-router-dom';

export default function Leaderboard() {
  const navigate = useNavigate();
  return (
    <div className="page-enter" style={{ padding: '40px 24px', fontFamily: "Georgia, serif", color: '#0E0E0E' }}>
      <button
        onClick={() => navigate('/')}
        style={{ background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: '0 0 16px', display: 'block' }}
      >
        &larr; HOME
      </button>
      <p style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#2A2A2A' }}>
        VOL. I &middot; ISSUE 01
      </p>
      <h1 style={{ fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 32, fontWeight: 500, marginTop: 8 }}>
        Leaderboard
      </h1>
      <p style={{ color: '#2A2A2A', marginTop: 12 }}>In costruzione.</p>
    </div>
  );
}
