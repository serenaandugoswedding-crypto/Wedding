# PROMPT — M5: Missioni completo

## Contesto
Stack: React 18 + Vite, Tailwind v4, React Router v6, Zustand, Vercel Functions, Supabase.
Design: "Vogue Pure" — bianco/nero/fumé, lacca `#8B1A1A`, Bodoni Moda display, Caveat manoscritto, Georgia UI.
Branch: `m3-bis`. Test solo su preview deploy Vercel.

## Schema attuale rilevante
```sql
guests   — uuid (PK), display_name, total_points, photos_count, likes_received
photos   — id, guest_uuid, mission_id (FK missions), like_count, deleted_at, ...
missions — id, title, description, bonus_points, active
```

## Logica punteggio missioni
- Foto con missione NON validata → 25% di `missions.bonus_points` (arrotondato per eccesso)
- Foto con missione validata → `photos.mission_score` (valore esplicito scelto da admin: 25/50/75/100% di bonus_points)
- `mission_score NULL` = non ancora validata = usa 25% automatico
- Formula leaderboard aggiornata:
  ```
  score = (foto × 10) + (like × 2) + SUM(COALESCE(mission_score, CEIL(bonus_points * 0.25)))
  ```

---

## FASE A — Migration DB

Crea `supabase/migrations/006_mission_score.sql`:

```sql
-- Aggiunge mission_score a photos
ALTER TABLE photos ADD COLUMN IF NOT EXISTS mission_score INTEGER DEFAULT NULL;

-- Aggiorna RPC get_leaderboard con nuova formula
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  guest_uuid    UUID,
  display_name  TEXT,
  photo_count   BIGINT,
  total_likes   BIGINT,
  mission_bonus BIGINT,
  score         BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    g.uuid,
    g.display_name,
    COUNT(p.id)                                                        AS photo_count,
    COALESCE(SUM(p.like_count), 0)                                     AS total_likes,
    COALESCE(SUM(
      CASE
        WHEN p.mission_id IS NULL THEN 0
        WHEN p.mission_score IS NOT NULL THEN p.mission_score
        ELSE CEIL(m.bonus_points * 0.25)
      END
    ), 0)                                                              AS mission_bonus,
    COUNT(p.id) * 10
      + COALESCE(SUM(p.like_count), 0) * 2
      + COALESCE(SUM(
          CASE
            WHEN p.mission_id IS NULL THEN 0
            WHEN p.mission_score IS NOT NULL THEN p.mission_score
            ELSE CEIL(m.bonus_points * 0.25)
          END
        ), 0)                                                          AS score
  FROM guests g
  LEFT JOIN photos p
    ON p.guest_uuid = g.uuid
    AND p.deleted_at IS NULL
  LEFT JOIN missions m
    ON m.id = p.mission_id
  GROUP BY g.uuid, g.display_name
  ORDER BY score DESC
  LIMIT 50;
$$;
```

**Istruzione:** stampa migration e di' a Ugo di eseguirla su Supabase SQL Editor.

---

## FASE B — Backend: CRUD missioni in admin

Aggiungi a `api/admin/photos/actions.js` il routing per missioni admin.

Crea **nuovo file** `api/admin/missions.js`:

```js
// GET  /api/admin/missions           → lista tutte le missioni
// POST /api/admin/missions?action=create  → crea missione
// POST /api/admin/missions?action=update  → aggiorna missione
// POST /api/admin/missions?action=toggle  → attiva/disattiva
// POST /api/admin/missions?action=delete  → elimina
// POST /api/admin/missions?action=validate → valida foto missione (assegna mission_score)
```

⚠️ Questo aggiunge 1 function → totale 10/12. OK.

Implementazione:

```js
import { getSupabaseAdmin } from '../_lib/supabase-admin.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const supabase = getSupabaseAdmin();
  const { action } = req.query;

  // GET → lista missioni
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('missions')
      .select('id, title, description, bonus_points, active, created_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ missions: data });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!action) return res.status(400).json({ error: 'action required' });

  // CREATE
  if (action === 'create') {
    const { title, description, bonus_points } = req.body ?? {};
    if (!title || !bonus_points) return res.status(400).json({ error: 'title e bonus_points richiesti' });
    const { data, error } = await supabase
      .from('missions')
      .insert({ title, description, bonus_points: parseInt(bonus_points), active: true })
      .select().single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(201).json({ mission: data });
  }

  // UPDATE
  if (action === 'update') {
    const { id, title, description, bonus_points } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id richiesto' });
    const { data, error } = await supabase
      .from('missions')
      .update({ title, description, bonus_points: parseInt(bonus_points) })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ mission: data });
  }

  // TOGGLE active
  if (action === 'toggle') {
    const { id, active } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id richiesto' });
    const { data, error } = await supabase
      .from('missions')
      .update({ active: !!active })
      .eq('id', id)
      .select().single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ mission: data });
  }

  // DELETE
  if (action === 'delete') {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id richiesto' });
    // Rimuovi mission_id dalle foto associate prima di eliminare
    await supabase.from('photos').update({ mission_id: null, mission_score: null }).eq('mission_id', id);
    const { error } = await supabase.from('missions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ deleted: true });
  }

  // VALIDATE — assegna mission_score a una foto
  if (action === 'validate') {
    const { photo_id, percent } = req.body ?? {};
    if (!photo_id || ![25, 50, 75, 100].includes(percent)) {
      return res.status(400).json({ error: 'photo_id e percent (25/50/75/100) richiesti' });
    }
    // Recupera bonus_points della missione associata
    const { data: photo, error: pErr } = await supabase
      .from('photos')
      .select('mission_id, missions(bonus_points)')
      .eq('id', photo_id)
      .single();
    if (pErr || !photo?.mission_id) return res.status(404).json({ error: 'Foto o missione non trovata' });

    const bonus = photo.missions?.bonus_points ?? 0;
    const mission_score = Math.ceil(bonus * percent / 100);

    const { error } = await supabase
      .from('photos')
      .update({ mission_score })
      .eq('id', photo_id);
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(200).json({ mission_score, percent });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
```

---

## FASE C — Frontend: selezione missione in Camera

**File:** `src/pages/Camera.jsx`

### Flusso
1. Ospite apre Camera
2. Prima della selezione foto: mostra lista missioni attive (opzionale — può skippare)
3. Ospite tappa missione → evidenziata
4. Ospite seleziona foto → upload include `mission_id`
5. Se nessuna missione selezionata → upload normale senza mission_id

### UI selezione missione
Aggiungi sezione sopra il pulsante "SCEGLI FOTO":

```
MISSIONI DEL GIORNO        [Georgia 10px uppercase, #8B1A1A]
─────────────────────────
[card missione 1]          ← tap per selezionare
[card missione 2]
[card missione 3]
[Nessuna missione]         ← opzione per skippare
```

Card missione:
- Titolo: Georgia 14px bold
- Descrizione: Georgia 12px #666
- Punti: `+XX pt` Georgia 11px #8B1A1A, top right
- Selezionata: bordo `2px solid #8B1A1A`, background `rgba(139,26,26,0.04)`
- Non selezionata: bordo `1px solid rgba(14,14,14,0.1)`

### Upload con mission_id
Nel body della chiamata a `/api/upload`, aggiungi `mission_id` se selezionato:
```js
formData.append('mission_id', selectedMissionId); // solo se != null
```

Aggiorna `api/upload.js` per leggere e salvare `mission_id`:
```js
const mission_id = req.body?.mission_id || null;
// nell'INSERT su photos:
{ ..., mission_id }
```

---

## FASE D — Tag missione in galleria

**File:** `src/pages/Gallery.jsx` e `src/pages/PhotoDetail.jsx`

### Galleria (card polaroid)
Se `photo.mission_id` presente, aggiungi tag sotto il nome ospite:
```
[🎯 NOME MISSIONE]
```
Stile: Georgia 10px uppercase, colore #8B1A1A, background `rgba(139,26,26,0.06)`, padding 2px 6px, border-radius 2px.

API `GET /api/photos` deve restituire anche `mission_id` e nome missione.
Aggiorna query in `api/photos/index.js`:
```js
.select('..., mission_id, missions(title)', ...)
// con hint FK se necessario: missions!photos_mission_id_fkey(title)
```

Normalizza output:
```js
mission_name: row.missions?.title ?? null,
```

### PhotoDetail (modal)
Se foto ha missione, mostra:
```
🎯 MISSIONE: [NOME MISSIONE]
[XX pt — validazione in corso]   ← se mission_score NULL
[XX pt assegnati]                ← se mission_score valorizzato
```

---

## FASE E — Admin: gestione missioni + validazione

**File:** `src/pages/admin/Missions.jsx` (nuovo)
**File:** `src/pages/admin/Photos.jsx` (aggiornamento)
**File:** `src/App.jsx` (nuova route protetta)

### Pagina /admin/missions
```
← DASHBOARD
ADMIN · MISSIONI
Gestione missioni          [Bodoni Moda 28px]
[+ NUOVA MISSIONE]         [pulsante top right]

[lista missioni]
```

Ogni riga missione:
```
NOME MISSIONE              +100 pt   [ATTIVA/DISATTIVA]  [MODIFICA]  [ELIMINA]
Descrizione missione
```

Form creazione/modifica (inline o modal):
```
Titolo:        [input]
Descrizione:   [textarea]
Punti bonus:   [input number]
[SALVA]  [ANNULLA]
```

### Validazione in Photos.jsx
Nel modal foto singola admin, se la foto ha `mission_id`:
```
MISSIONE: [NOME]
Validazione: [25%] [50%] [75%] [100%]   ← pulsanti
```
- Click pulsante → `POST /api/admin/missions?action=validate` con `{ photo_id, percent }`
- Dopo validazione: aggiorna UI mostrando punteggio assegnato
- Se già validata: mostra punteggio + pulsante "CAMBIA"

### Route App.jsx
```jsx
<Route path="/admin/missions" element={
  <ProtectedRoute><AdminMissions /></ProtectedRoute>
} />
```

Link da Dashboard e da Photos header.

---

## FASE F — Commit e test

### File da non toccare
- `api/cron/*`
- Schema esistente (solo aggiunta colonna)
- Pagine pubbliche non correlate

### Commit
```
feat(missions): M5 — missioni CRUD admin, selezione in camera, tag galleria, validazione punteggio
```

### Checklist test
- [ ] Migration 006 eseguita su Supabase
- [ ] `GET /api/admin/missions` restituisce lista (con token)
- [ ] Crea missione da admin → appare in lista
- [ ] Attiva/disattiva missione → stato aggiornato
- [ ] Camera mostra missioni attive
- [ ] Selezione missione → upload con mission_id
- [ ] Foto appare in galleria con tag missione
- [ ] Admin modal foto → pulsanti validazione 25/50/75/100%
- [ ] Dopo validazione → leaderboard aggiorna punteggio
- [ ] Foto senza missione → nessun tag, leaderboard invariato
- [ ] Elimina missione → foto associate perdono mission_id senza errori
