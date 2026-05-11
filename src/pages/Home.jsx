import { useNavigate } from 'react-router-dom';
import { useGuestIdentity } from '../hooks/useGuestIdentity';

const ACTIONS = [
  {
    num:   '01',
    label: 'SCATTA',
    title: 'Scatta una foto',
    sub:   'Inquadra il momento. Scegli il filtro. Pubblica.',
    path:  '/camera',
    page:  'p. 02',
  },
  {
    num:   '02',
    label: 'GALLERIA',
    title: 'Il provino del giorno',
    sub:   'Tutte le foto degli ospiti in tempo reale.',
    path:  '/gallery',
    page:  'p. 12',
  },
  {
    num:   '03',
    label: 'CLASSIFICA',
    title: 'La classifica',
    sub:   'Chi ha scattato di più. Chi ha vinto il cuore degli ospiti.',
    path:  '/leaderboard',
    page:  'p. 36',
  },
  {
    num:   '04',
    label: 'MISSIONI',
    title: 'Le missioni',
    sub:   'Sfide fotografiche da completare durante il giorno.',
    path:  '/missions',
    page:  'p. 48',
  },
  {
    num:   '05',
    label: 'PROFILO',
    title: 'Il mio numero',
    sub:   'Le tue foto, il tuo punteggio, le tue missioni.',
    path:  '/profilo',
    page:  'p. 60',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { name } = useGuestIdentity();

  return (
    <div
      className="page-enter"
      style={{
        minHeight: '100dvh',
        background: '#F8F5F0',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* ── Editorial header ── */}
      <header
        style={{
          padding: '14px 20px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '0.5px solid rgba(14,14,14,0.1)',
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 10,
            letterSpacing: '0.18em',
            color: '#0E0E0E',
            textTransform: 'uppercase',
          }}
        >
          VOL. I &middot; ISSUE 01
        </span>
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 10,
            letterSpacing: '0.18em',
            color: '#8B1A1A',
            textTransform: 'uppercase',
          }}
        >
          AUGUST 2026
        </span>
      </header>

      {/* ── Masthead mini ── */}
      <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 10,
            letterSpacing: '0.32em',
            color: '#2A2A2A',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          THE WEDDING ISSUE
        </p>
        <div
          style={{
            fontFamily: "'Bodoni Moda', Georgia, serif",
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.05,
            letterSpacing: '-0.01em',
            color: '#0E0E0E',
          }}
        >
          SERENA &amp; UGO
        </div>
        <div
          style={{
            margin: '14px auto 0',
            width: '60%',
            height: '0.5px',
            background: '#0E0E0E',
          }}
        />
      </div>

      {/* ── Welcome line ── */}
      {name && (
        <div style={{ padding: '14px 20px 0', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 20,
              color: '#4B1528',
              margin: 0,
            }}
          >
            Benvenuto, {name}.
          </p>
        </div>
      )}

      {/* ── Section label ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 10,
            letterSpacing: '0.28em',
            color: '#2A2A2A',
            textTransform: 'uppercase',
            marginBottom: 0,
          }}
        >
          DENTRO QUESTO NUMERO
        </p>
      </div>

      {/* ── 3 Action cards ── */}
      <main style={{ padding: '0 20px 32px', flex: 1 }}>
        {ACTIONS.map((action, i) => (
          <button
            key={action.num}
            onClick={() => navigate(action.path)}
            style={{
              display: 'block',
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom:
                i < ACTIONS.length - 1
                  ? '0.5px solid rgba(14,14,14,0.12)'
                  : 'none',
              borderTop: i === 0 ? '0.5px solid rgba(14,14,14,0.12)' : 'none',
              padding: '20px 0',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span
                    style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: 10,
                      letterSpacing: '0.22em',
                      color: '#8B1A1A',
                      textTransform: 'uppercase',
                    }}
                  >
                    {action.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      color: '#2A2A2A',
                    }}
                  >
                    &middot; {action.num}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'Bodoni Moda', Georgia, serif",
                    fontSize: 22,
                    fontWeight: 400,
                    color: '#0E0E0E',
                    lineHeight: 1.15,
                    marginBottom: 6,
                  }}
                >
                  {action.title}
                </div>
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: 13,
                    color: '#2A2A2A',
                    lineHeight: 1.5,
                  }}
                >
                  {action.sub}
                </div>
              </div>

              {/* Page number + arrow */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 4,
                  marginLeft: 16,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: 11,
                    color: '#2A2A2A',
                    letterSpacing: '0.1em',
                  }}
                >
                  {action.page}
                </span>
                <span
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: 16,
                    color: '#0E0E0E',
                  }}
                >
                  &rarr;
                </span>
              </div>
            </div>
          </button>
        ))}

      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: '10px 20px',
          background: '#0E0E0E',
          color: '#F8F5F0',
          fontFamily: 'Georgia, serif',
          fontSize: 9,
          letterSpacing: '0.25em',
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      >
        SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
      </footer>
    </div>
  );
}
