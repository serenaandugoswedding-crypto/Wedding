# PROMPT — Like system galleria

## Contesto
Stack: React 18 + Vite, Tailwind v4, React Router v6, Supabase, Vercel Functions.
Design: "Vogue Pure" — lacca `#8B1A1A`, Georgia UI, Caveat manoscritto.
Branch: `m3-bis`. Test solo su preview deploy Vercel.

## Logica
- 1 like per foto per ospite, tracciato via localStorage
- Key localStorage: `wedding_likes` → JSON array di photo IDs già likati
- Like ottimistico: aggiorna UI immediatamente, poi chiama API
- Top 15% foto per like_count → card polaroid più grande in galleria
- Cuore + contatore visibile su ogni polaroid

---

## FASE A — Backend: endpoint like

`api/photos/[id].js` gestisce già GET foto singola.
Aggiungi branch POST per like:

```js
// POST /api/photos/:id → incrementa like_count
if (req.method === 'POST') {
  const { id } = req.query;
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase.rpc('increment_like', { photo_id: id });
  if (error) return res.status(500).json({ error: 'Database error' });
  return res.status(200).json({ like_count: data });
}
```

Crea migration `007_like_rpc.sql`:
```sql
CREATE OR REPLACE FUNCTION increment_like(photo_id UUID)
RETURNS INTEGER
LANGUAGE sql
AS $$
  UPDATE photos
  SET like_count = like_count + 1
  WHERE id = photo_id
    AND deleted_at IS NULL
  RETURNING like_count;
$$;
```

**Istruzione:** stampa migration e di' a Ugo di eseguirla su Supabase SQL Editor.

---

## FASE B — Frontend: like su polaroid in Gallery.jsx

### Stato like
```js
// Carica likes già dati dall'ospite
const [likedIds, setLikedIds] = useState(() => {
  try { return JSON.parse(localStorage.getItem('wedding_likes') ?? '[]'); }
  catch { return []; }
});

// Aggiorna like_count locale nelle foto
const [photos, setPhotos] = useState([]);
```

### Funzione handleLike
```js
async function handleLike(photoId) {
  if (likedIds.includes(photoId)) return; // già likato

  // Ottimistico: aggiorna UI subito
  const newLikedIds = [...likedIds, photoId];
  setLikedIds(newLikedIds);
  localStorage.setItem('wedding_likes', JSON.stringify(newLikedIds));
  setPhotos(prev => prev.map(p =>
    p.id === photoId ? { ...p, like_count: (p.like_count ?? 0) + 1 } : p
  ));

  // API call
  try {
    await fetch(`/api/photos/${photoId}`, { method: 'POST' });
  } catch {
    // rollback silenzioso — non critico
  }
}
```

### UI cuore su polaroid card
Aggiungi in basso a destra sulla card polaroid, sopra il bordo bianco inferiore:

```
[♡ 12]   ← cuore + contatore
```

Stile:
- Cuore: `♥` se likato (colore `#8B1A1A`), `♡` se non likato (colore `#999`)
- Contatore: Georgia 11px, colore `#999`
- Pulsante: background trasparente, no bordo, cursor pointer
- Posizione: bottom-right nella card, padding 4px 8px
- Animazione like: breve scale 1.3 → 1 su click (200ms)
- Stoppa propagazione click per non aprire il modal

### Sizing dinamico top 15%
Dopo ogni fetch/aggiornamento foto, calcola soglia:

```js
function getTopLikeThreshold(photos) {
  if (photos.length === 0) return Infinity;
  const sorted = [...photos].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
  const topCount = Math.max(1, Math.ceil(photos.length * 0.15));
  const threshold = sorted[topCount - 1]?.like_count ?? 0;
  return threshold > 0 ? threshold : Infinity; // no scaling se tutti a 0
}
```

Applica alla card:
```js
const isTop = (photo.like_count ?? 0) >= threshold && threshold !== Infinity;
// Se isTop: transform scale(1.08), z-index 1, transizione 300ms
// La card occupa più spazio visivamente ma non rompe il grid
// Usa: transform: isTop ? 'scale(1.08)' : 'scale(1)'
```

**Nota:** scale su CSS transform non rompe il grid layout — le card vicine non si spostano. Il leggero overlap è intenzionale e dà effetto editoriale.

---

## FASE C — Like nel modal PhotoDetail

In `src/pages/PhotoDetail.jsx`, aggiungi pulsante like:

```js
const likedIds = JSON.parse(localStorage.getItem('wedding_likes') ?? '[]');
const isLiked = likedIds.includes(photo.id);
```

UI sotto la foto nel modal:
```
[♥ 12]  MI PIACE
```
- Stesso comportamento handleLike
- Sincronizza con Gallery (entrambi leggono/scrivono stesso localStorage key)

---

## FASE D — Commit e test

### File da modificare
- `api/photos/[id].js` — aggiungi POST branch
- `src/pages/Gallery.jsx` — like button, sizing dinamico
- `src/pages/PhotoDetail.jsx` — like button nel modal

### File da NON toccare
- Tutto admin
- Schema (solo migration RPC)

### Commit
```
feat(likes): like system — cuore polaroid, top 15% sizing, localStorage anti-doppio, RPC increment
```

### Checklist test
- [ ] Migration 007 eseguita su Supabase
- [ ] Click cuore → diventa ♥ rosso immediatamente
- [ ] Contatore incrementa
- [ ] Secondo click sulla stessa foto → nessun effetto
- [ ] Ricarica pagina → cuore resta rosso (localStorage)
- [ ] Foto con più like appare leggermente più grande
- [ ] Like da modal PhotoDetail → aggiornato anche in galleria al ritorno
- [ ] like_count aggiornato nel DB (verifica su Supabase)
