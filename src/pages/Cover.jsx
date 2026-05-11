import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuestIdentity } from '../hooks/useGuestIdentity';

const SERENA = 'SERENA';
const UGO = 'UGO';
const STAGGER_MS = 80;

function AnimatedWord({ word, startDelay }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = [];
    word.split('').forEach((_, i) => {
      timers.push(
        setTimeout(() => setVisibleCount((n) => n + 1), startDelay + i * STAGGER_MS)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [word, startDelay]);

  return (
    <span aria-label={word} style={{ display: 'inline-block' }}>
      {word.split('').map((letter, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: i < visibleCount ? 1 : 0,
            transform: i < visibleCount ? 'none' : 'translateY(6px)',
            transition: 'opacity 120ms ease, transform 120ms ease',
          }}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

const TOC_ITEMS = [
  { num: '01', title: 'Scatta una foto',       page: 'p. 02', path: '/camera' },
  { num: '02', title: 'Il provino del giorno', page: 'p. 12', path: '/gallery' },
];

export default function Cover() {
  const { isIdentified, identify } = useGuestIdentity();
  const navigate = useNavigate();

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // After animation (~1.4s), decide whether to show name prompt or let them proceed
  useEffect(() => {
    if (!isIdentified) {
      const t = setTimeout(() => setShowOnboarding(true), 1600);
      return () => clearTimeout(t);
    }
  }, [isIdentified]);

  useEffect(() => {
    if (showOnboarding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showOnboarding]);

  function handleEntra() {
    if (!isIdentified) {
      setShowOnboarding(true);
      return;
    }
    navigate('/home');
  }

  async function handleNameSubmit(e) {
    e.preventDefault();
    const trimmed = inputName.trim();
    if (!trimmed) {
      setError('Inserisci il tuo nome per continuare.');
      return;
    }
    try {
      await identify(trimmed);
      navigate('/home');
    } catch (err) {
      console.error('[Cover] identify error:', err.message);
      setError(err.message);
    }
  }

  const ugoDelay = SERENA.length * STAGGER_MS + 300;

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
        <span className="type-label" style={{ letterSpacing: '0.18em', fontSize: 10 }}>
          VOL. I &middot; ISSUE 01
        </span>
        <span
          className="type-label"
          style={{ letterSpacing: '0.18em', fontSize: 10, color: '#8B1A1A' }}
        >
          AUGUST 2026
        </span>
      </header>

      {/* ── Masthead ── */}
      <div
        style={{
          padding: '28px 20px 20px',
          textAlign: 'center',
          background: '#F8F5F0',
          flexShrink: 0,
        }}
      >
        <p className="type-label" style={{ letterSpacing: '0.32em', marginBottom: 18 }}>
          THE WEDDING ISSUE
        </p>

        <div
          style={{
            fontFamily: "'Bodoni Moda', Georgia, serif",
            fontSize: 56,
            lineHeight: 0.92,
            fontWeight: 500,
            color: '#0E0E0E',
            letterSpacing: '-0.02em',
          }}
        >
          <AnimatedWord word={SERENA} startDelay={200} />
        </div>

        <div
          style={{
            fontFamily: "'Bodoni Moda', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 22,
            color: '#8B1A1A',
            margin: '4px 0 2px',
            fontWeight: 400,
          }}
        >
          &amp;
        </div>

        <div
          style={{
            fontFamily: "'Bodoni Moda', Georgia, serif",
            fontSize: 56,
            lineHeight: 0.92,
            fontWeight: 500,
            color: '#0E0E0E',
            letterSpacing: '-0.02em',
          }}
        >
          <AnimatedWord word={UGO} startDelay={200 + ugoDelay} />
        </div>

        <div
          style={{
            margin: '22px auto 0',
            width: '80%',
            height: '0.5px',
            background: '#0E0E0E',
          }}
        />
        <p
          className="type-label-lg"
          style={{ marginTop: 14, letterSpacing: '0.22em', color: '#2A2A2A' }}
        >
          29 &middot; AGOSTO &middot; 2026
        </p>
      </div>

      {/* ── Cipria quote band ── */}
      <div
        style={{
          background: '#E8C4C4',
          padding: '18px 22px',
          borderTop: '0.5px solid rgba(14,14,14,0.08)',
          borderBottom: '0.5px solid rgba(14,14,14,0.08)',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <p className="type-caveat" style={{ margin: 0 }}>
          «Benvenuti nel nostro giorno.<br />
          Aiutateci a ricordarlo,<br />
          una foto alla volta.»
        </p>
      </div>

      {/* ── ToC: DENTRO QUESTO NUMERO ── */}
      <div
        style={{
          padding: '18px 20px 8px',
          background: '#F8F5F0',
          flexShrink: 0,
        }}
      >
        <p className="type-label" style={{ marginBottom: 10, letterSpacing: '0.28em' }}>
          DENTRO QUESTO NUMERO
        </p>
        {TOC_ITEMS.map((item, i) => (
          <div
            key={item.num}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '6px 0',
              borderBottom:
                i < TOC_ITEMS.length - 1
                  ? '0.5px dotted rgba(14,14,14,0.22)'
                  : 'none',
            }}
          >
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#0E0E0E' }}>
              <span style={{ color: '#8B1A1A' }}>{item.num}</span>
              &nbsp;&nbsp;
              {item.title}
            </span>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#2A2A2A' }}>
              {item.page}
            </span>
          </div>
        ))}
      </div>

      {/* ── Name onboarding (appears after animation) ── */}
      {showOnboarding && !isIdentified && (
        <div
          style={{
            padding: '16px 20px 8px',
            background: '#F8F5F0',
            animation: 'pageFadeIn 300ms ease forwards',
          }}
        >
          <div
            style={{
              borderTop: '0.5px solid rgba(14,14,14,0.1)',
              paddingTop: 16,
            }}
          >
            <p className="type-label" style={{ marginBottom: 10, letterSpacing: '0.22em' }}>
              IL TUO NOME
            </p>
            <form onSubmit={handleNameSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={inputName}
                onChange={(e) => { setInputName(e.target.value); setError(''); }}
                placeholder="Maria Rossi"
                maxLength={60}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '0.5px solid rgba(14,14,14,0.35)',
                  outline: 'none',
                  fontFamily: "'Caveat', cursive",
                  fontSize: 22,
                  color: '#0E0E0E',
                  padding: '4px 0 6px',
                  caretColor: '#8B1A1A',
                }}
              />
              {error && (
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A', marginTop: 6 }}>
                  {error}
                </p>
              )}
              <p
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 13,
                  color: '#2A2A2A',
                  marginTop: 8,
                  fontStyle: 'italic',
                }}
              >
                Il tuo nome appare nelle foto che pubblichi.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* ── ENTRA CTA ── */}
      <div style={{ padding: '14px 20px 24px', textAlign: 'center', background: '#F8F5F0', marginTop: 'auto' }}>
        <button
          onClick={showOnboarding && !isIdentified ? handleNameSubmit : handleEntra}
          style={{
            display: 'inline-block',
            padding: '12px 36px',
            background: '#0E0E0E',
            color: '#F8F5F0',
            fontFamily: 'Georgia, serif',
            fontSize: 11,
            letterSpacing: '0.32em',
            border: 'none',
            borderRadius: 2,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          ENTRA &nbsp;&rarr;
        </button>
      </div>

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
          flexShrink: 0,
        }}
      >
        SERENA AND UGO&apos;S WEDDING &middot; A ONE-DAY MAGAZINE
      </footer>
    </div>
  );
}
