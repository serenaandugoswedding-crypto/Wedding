# CLAUDE.md — Wedding PWA "Serena & Ugo"

## Stile risposte
- Italiano sempre
- Caveman style: parole minime, zero fronzoli
- No spiegazioni ovvie, no recap inutili
- Conferme brevi: "fatto", "ok", "errore: [causa]"

## Token efficiency
- No riscrivere file interi se cambia 1 riga → usa patch/diff
- No ripetere contesto già noto
- Se task > 5 file → chiedi conferma prima
- Prefer small commits atomici

## Progetto
- Stack: React 18 + Vite, Tailwind v4, React Router v6, Zustand, Vercel Functions, Supabase
- Branch attivo: `m3-bis`
- Design: "Vogue Pure" — #8B1A1A lacca, Bodoni Moda, Caveat, Georgia
- Test: solo su preview deploy Vercel (no `vercel dev`, env sensitive assenti in local)

## Convenzioni
- Commit: inglese, semantic (feat/fix/chore)
- LF→CRLF warning Windows: ignora
- Review diff prima di accettare sempre
- No automazioni che bypassano decisioni esplicite

## Architettura storage
- `photos` bucket: web 1600px, pubblico
- `archive` bucket: full-res, privato, service-role only
- Sync Drive: manuale post-evento

## Prossimo task attivo
M4 — leaderboard, guestbook, slideshow

## Milestone completate
- M1: schema, routing, cover, home
- M2: upload core
- M3-bis F1-3: schema admin, dual-bucket upload, filtri pixel-level, backend admin endpoints
- Camera refactor: upload-only + filter strip
- M3.1: Gallery polaroid wall + PhotoDetail (polaroid 2 col, polling 30s badge, paginazione, metadati editoriali)
- M3-bis F4: admin UI completa — login, /admin/photos griglia, selezione bulk, ZIP, modal, stats
- M3-bis chiuso: 9 Vercel Functions (da 14), filtro deleted_at verificato, debug log rimossi
