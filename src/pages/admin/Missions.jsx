import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const getAdminToken = () => sessionStorage.getItem('admin_token');

export default function AdminMissions() {
  const navigate = useNavigate();

  const [missions,  setMissions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [formOpen,  setFormOpen]  = useState(false);
  const [editing,   setEditing]   = useState(null); // mission object or null
  const [form,      setForm]      = useState({ title: '', description: '', bonus_points: '' });
  const [formError, setFormError] = useState('');

  function handle401() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin', { state: { expired: true } });
  }

  async function apiFetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAdminToken()}`,
        ...(opts.headers ?? {}),
      },
    });
    if (res.status === 401) { handle401(); throw new Error('401'); }
    return res;
  }

  async function loadMissions() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/missions');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setMissions(d.missions ?? []);
    } catch (e) {
      if (e.message !== '401') setError('Errore nel caricamento.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMissions(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', description: '', bonus_points: '' });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({ title: m.title, description: m.description ?? '', bonus_points: String(m.bonus_points) });
    setFormError('');
    setFormOpen(true);
  }

  async function saveForm() {
    if (!form.title.trim()) { setFormError('Titolo obbligatorio.'); return; }
    const pts = parseInt(form.bonus_points);
    if (!pts || pts < 1) { setFormError('Punti bonus obbligatori (> 0).'); return; }
    setBusy(true);
    setFormError('');
    try {
      const action = editing ? 'update' : 'create';
      const body = editing
        ? { id: editing.id, title: form.title.trim(), description: form.description.trim() || null, bonus_points: pts }
        : { title: form.title.trim(), description: form.description.trim() || null, bonus_points: pts };
      const res = await apiFetch(`/api/admin/missions?action=${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) { setFormError('Errore salvataggio.'); return; }
      setFormOpen(false);
      await loadMissions();
    } catch (e) {
      if (e.message !== '401') setFormError('Errore salvataggio.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m) {
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/missions?action=toggle', {
        method: 'POST',
        body: JSON.stringify({ id: m.id, active: !m.active }),
      });
      if (res.ok) await loadMissions();
    } catch { /* 401 handled */ } finally { setBusy(false); }
  }

  async function deleteMission(m) {
    if (!confirm(`Elimina missione "${m.title}"? Le foto associate perderanno il mission_id.`)) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/admin/missions?action=delete', {
        method: 'POST',
        body: JSON.stringify({ id: m.id }),
      });
      if (res.ok) await loadMissions();
    } catch { /* 401 handled */ } finally { setBusy(false); }
  }

  function logout() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => navigate('/admin/dashboard')} style={S.backLink}>← DASHBOARD</button>
          <span style={S.headerSub}>ADMIN &middot; MISSIONI</span>
          <span style={S.headerTitle}>Gestione missioni</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <button onClick={openCreate} style={S.newBtn}>+ NUOVA</button>
          <button onClick={logout} style={S.exitBtn}>ESCI</button>
        </div>
      </div>

      {loading ? (
        <div style={S.center}><p style={S.caveat}>caricando…</p></div>
      ) : error ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#8B1A1A', marginBottom: 12 }}>{error}</p>
          <button onClick={loadMissions} style={S.ghostBtn}>RIPROVA</button>
        </div>
      ) : missions.length === 0 ? (
        <div style={S.center}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#666' }}>Nessuna missione ancora.</p>
        </div>
      ) : (
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {missions.map(m => (
            <div key={m.id} style={S.row}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={S.missionTitle}>{m.title}</span>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A' }}>+{m.bonus_points} pt</span>
                  <span style={{ ...S.badge, ...(m.active ? S.badgeGreen : S.badgeGrey) }}>
                    {m.active ? 'ATTIVA' : 'INATTIVA'}
                  </span>
                </div>
                {m.description && (
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#666', lineHeight: 1.4 }}>{m.description}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-start' }}>
                <button disabled={busy} onClick={() => toggle(m)} style={S.ghostBtn}>
                  {m.active ? 'DISATTIVA' : 'ATTIVA'}
                </button>
                <button disabled={busy} onClick={() => openEdit(m)} style={S.ghostBtn}>MODIFICA</button>
                <button disabled={busy} onClick={() => deleteMission(m)} style={{ ...S.ghostBtn, color: '#8B1A1A', borderColor: 'rgba(139,26,26,0.4)' }}>ELIMINA</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div onClick={() => setFormOpen(false)} style={S.overlay}>
          <div onClick={e => e.stopPropagation()} style={S.modal}>
            <p style={S.modalTitle}>{editing ? 'MODIFICA MISSIONE' : 'NUOVA MISSIONE'}</p>
            <label style={S.label}>Titolo</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={S.input}
              placeholder="Es. Foto di gruppo con sposi"
            />
            <label style={S.label}>Descrizione</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ ...S.input, height: 72, resize: 'vertical' }}
              placeholder="Facoltativa"
            />
            <label style={S.label}>Punti bonus</label>
            <input
              type="number"
              value={form.bonus_points}
              onChange={e => setForm(f => ({ ...f, bonus_points: e.target.value }))}
              style={S.input}
              placeholder="Es. 100"
              min="1"
            />
            {formError && <p style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#8B1A1A', marginTop: 8 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setFormOpen(false)} style={S.ghostBtn}>ANNULLA</button>
              <button disabled={busy} onClick={saveForm} style={S.saveBtn}>SALVA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page:        { minHeight: '100dvh', background: '#F8F5F0', fontFamily: 'Georgia, serif', maxWidth: 800, margin: '0 auto', paddingBottom: 60 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '0.5px solid rgba(14,14,14,0.12)' },
  backLink:    { background: 'transparent', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', color: '#8B1A1A', textTransform: 'uppercase', cursor: 'pointer', padding: 0 },
  headerSub:   { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.28em', color: '#2A2A2A', textTransform: 'uppercase' },
  headerTitle: { fontFamily: "'Bodoni Moda', Georgia, serif", fontSize: 28, fontWeight: 500, color: '#0E0E0E', marginTop: 4 },
  newBtn:      { background: '#0E0E0E', color: '#F8F5F0', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '7px 14px' },
  exitBtn:     { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.3)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 14px', color: '#0E0E0E' },
  row:         { display: 'flex', gap: 16, padding: '16px 20px', background: '#FFFFFF', border: '0.5px solid rgba(14,14,14,0.1)', borderRadius: 2, alignItems: 'flex-start', flexWrap: 'wrap' },
  missionTitle:{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 'bold', color: '#0E0E0E' },
  badge:       { fontFamily: 'Georgia, serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 1 },
  badgeGreen:  { color: '#1A6B2A', background: 'rgba(26,107,42,0.08)' },
  badgeGrey:   { color: '#888', background: 'rgba(14,14,14,0.06)' },
  ghostBtn:    { background: 'transparent', border: '0.5px solid rgba(14,14,14,0.3)', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', padding: '5px 12px', color: '#0E0E0E' },
  center:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' },
  caveat:      { fontFamily: "'Caveat', cursive", fontSize: 20, color: '#2A2A2A', fontStyle: 'italic' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, cursor: 'pointer' },
  modal:       { background: '#F8F5F0', padding: '28px 24px', maxWidth: 440, width: '90vw', cursor: 'default', display: 'flex', flexDirection: 'column', gap: 6 },
  modalTitle:  { fontFamily: 'Georgia, serif', fontSize: 11, letterSpacing: '0.28em', color: '#2A2A2A', textTransform: 'uppercase', marginBottom: 8 },
  label:       { fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#666', marginTop: 6 },
  input:       { width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(14,14,14,0.3)', outline: 'none', fontFamily: 'Georgia, serif', fontSize: 14, color: '#0E0E0E', padding: '6px 0 8px' },
  saveBtn:     { background: '#0E0E0E', color: '#F8F5F0', border: 'none', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer', padding: '8px 20px' },
};
