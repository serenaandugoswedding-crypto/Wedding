# Serena & Ugo's Wedding — Product Requirements Document

> **Versione:** 1.1 (con sistema filtri Vogue Diary)
> **Autore:** Ugo
> **Data:** Aprile 2026
> **Changelog v1.1:** integrato sistema filtri foto (sezione 5.15) come MVP — Strada A (foto filtrata su Drive, scelta una tantum prima upload)
> **Repository:** https://github.com/serenaandugoswedding-crypto/Wedding
> **Drive di destinazione:** https://drive.google.com/drive/u/5/folders/1ZuW5FlXhkDDldeVYjezHubfhGWMa-rpY
> **Codename:** Vogue Diary Edition

---

## 1. Visione & Principi guida

### 1.1 Pitch in una frase

Una web app dedicata al matrimonio di Serena e Ugo che trasforma ogni ospite in un fotografo dell'evento, con un linguaggio visivo che evoca **una rivista da collezione, non un'app**.

L'esperienza è quella di sfogliare una **issue speciale di Vogue dedicata al loro matrimonio**: cover editoriale, masthead tipografica grande, indice dei contenuti, polaroid wall, guestbook manoscritto, classifica dei "reporter del giorno".

### 1.2 Principi inviolabili

1. **Editoriale, non funzionale.** Ogni schermata sembra una pagina di rivista. Mai patinato, mai social-network.
2. **Zero attrito ospite.** Dal QR allo scatto in meno di 10 secondi. Nessun login, nessuna app da installare.
3. **Resilienza alla connessione.** La venue avrà WiFi instabile — l'app deve funzionare comunque (coda upload offline).
4. **Sicurezza non-negoziabile.** Service account credentials mai esposte al frontend.
5. **Il giorno del matrimonio è sacro.** Niente notifiche push agli sposi. Niente sorprese. Niente bug.

### 1.3 Cosa NON è questa app

- Non è Instagram (niente filtri patinati, niente scroll infinito ansiogeno)
- Non è un'app commerciale (niente push notifications, niente "engagement")
- Non è un wedding planner tool (niente RSVP, niente seating chart, niente lista regali)
- Non è un'app pubblica (è privata, accesso solo via QR)

---

## 2. Personas & Use Case

### 2.1 L'ospite (primario)

**Profilo:** invitato al matrimonio, età 18-80, smartphone in mano, livello tech variabile (anche zia anziana).

**Aspettativa:** "Mi hanno detto di scattare una foto e caricarla. Voglio farlo in 3 click."

**User journey:**
1. Inquadra il QR sul tavolo
2. Si apre la cover Vogue Diary nel browser
3. Inserisce il proprio nome (una sola volta, viene salvato)
4. Tap su "ENTRA →"
5. Sceglie azione: scatta foto / sfoglia galleria / lascia dedica
6. Se scatta: foto → opzionale dedica → upload → vede la sua polaroid apparire nel wall
7. Può mettere like alle foto altrui
8. Può vedere la classifica live dei reporter

### 2.2 Gli sposi / admin (Ugo + Serena)

**Profilo:** entrambi sposi, accesso pieno al pannello admin.

**Aspettativa:** "Voglio vedere quante foto sono state caricate, gestire le missioni, e cambiare la cover dopo il rito."

**Permessi:**
- ✅ Cambio cover (pre-rito → post-rito)
- ✅ Moderazione foto (eliminare contenuti inappropriati)
- ✅ Gestione missioni (CRUD completo)
- ✅ Visualizzazione audit log
- ✅ Export dati finale (post-evento, fase 2)

### 2.3 I testimoni (4 admin con permessi limitati)

**Profilo:** quattro testimoni del matrimonio, fidati ma con poteri ristretti.

**Aspettativa:** "Aiuto ad animare l'evento creando missioni divertenti per gli ospiti."

**Permessi:**
- ✅ Gestione missioni (CRUD completo)
- ❌ Moderazione foto
- ❌ Cambio cover
- ❌ Export dati

### 2.4 La TV della venue (read-only)

**Profilo:** schermo grande in venue (TV / proiettore) collegato a un dispositivo qualsiasi che mostra lo slideshow.

**Modalità:** apre URL `/slideshow` direttamente, full-screen, nessuna interazione richiesta. Auto-aggiornamento ogni 5 secondi con foto nuove.

### 2.5 Riassunto user journey end-to-end

```
QR scan → Cover animata → Nome (1ª volta) → Home con 3 azioni
                                                 │
        ┌────────────────────────────────────────┼────────────────────────┐
        │                                        │                        │
   📸 Scatta                              🖼 Galleria                  ✍ Guestbook
        │                                        │                        │
   Camera + dedica                         Polaroid wall               Lascia dedica
        │                                        │                        │
   Upload Drive                            Like + Editor's              Firma in Caveat
        │                                        │                        │
   Polaroid appare ←──── Realtime Supabase ──────┘
```

---

## 3. Identità visiva — Design System

### 3.1 Palette Vogue Diary

| Nome | Hex | Uso |
|---|---|---|
| Panna avorio | `#F8F5F0` | Background principale, "carta della rivista" |
| Ink | `#0E0E0E` | Testi principali, masthead |
| Soft ink | `#2A2A2A` | Testi secondari, labels |
| Lacca | `#8B1A1A` | Accent editoriale (numerazione, "&", folii) |
| Cipria bloom | `#E8C4C4` | Fascia citazione, stati attivi soft |
| Bordeaux | `#4B1528` | Testo manoscritto su cipria |

**Regola d'oro:** mai colori fuori da questa palette. Niente neon, niente gradient, niente shadow drammatici.

### 3.2 Tipografia

| Font | Uso | Note |
|---|---|---|
| **Bodoni Moda** | Display, masthead, titoli grandi | Importare da Google Fonts |
| **Georgia** | Labels editoriali, ToC, footer, body lungo | System font |
| **Caveat** | Citazioni manoscritte, firme ospiti, dediche | Importare da Google Fonts |

**Scale tipografica:**
- Masthead: 56px Bodoni Moda 500
- H1: 32px Bodoni Moda 500
- H2: 22px Bodoni Moda 400
- Body: 14px Georgia regular
- Label uppercase: 10-11px Georgia, letter-spacing 0.22em-0.32em
- Caveat: 18-30px in base al contesto

### 3.3 Tone of voice editoriale

- Numerazione editoriale ovunque: `VOL. I`, `ISSUE 01`, `№ 02`, `p. 12`
- Letter-spacing largo sui label uppercase
- Italiano e inglese mescolati (`THE WEDDING ISSUE` / `DENTRO QUESTO NUMERO`)
- Mai punti esclamativi, mai emoji, mai testo informale
- CTA sempre con doppia spaziatura: `ENTRA  →`, `SCATTA  ·  CARICA  ·  CONDIVIDI`
- Citazioni con caporali `« »` non con `" "`

### 3.4 Iconografia

- ✶ stellina serif per Editor's Pick
- · middle dots come separatori
- → arrow per CTA
- Niente emoji standard
- SVG line art se servono icone (camera, gallery, etc.) — stile minimal a 1px

### 3.5 Micro-animazioni

- **Cover lettering:** "SERENA" e "UGO" si compongono lettera per lettera (stagger 80ms) all'apertura. Una sola volta per sessione.
- **Polaroid drop-in:** quando una nuova foto viene caricata, polaroid cade dall'alto con leggera rotazione e ombra.
- **Like animato:** stellina che cresce/decresce con piccola micro-bounce (max 200ms).
- **Page transitions:** fade morbido tra schermate (max 250ms). Niente swipe, niente parallax.

### 3.6 Anti-pattern (cosa evitare per non sembrare Instagram)

- ❌ Cuoricini rossi pop
- ❌ Filtri saturi/grain pesanti
- ❌ Stories verticali full-screen
- ❌ Counter "Mi piace" stile social
- ❌ Bottoni grandi colorati con gradient
- ❌ Toast/snackbar moderne
- ❌ Loading spinner generici (usare testo "caricando…" in Caveat)

---

## 4. Architettura informativa

### 4.1 Sitemap delle schermate

```
/                       Cover animata + onboarding nome
/home                   Hub con 3 azioni principali
/camera                 Scatta foto + dedica facoltativa
/gallery                Polaroid wall con ranking
/gallery/:photoId       Foto singola full-screen + dedica + like
/guestbook              Pagina guestbook (firme + dediche)
/missions               Lista missioni attive + progresso personale
/leaderboard            Classifica reporter live
/slideshow              Modalità TV (full-screen, auto-rotate)
/admin                  Login admin (password)
/admin/dashboard        Pannello admin (con sub-routes basate su ruolo)
```

### 4.2 Stati dell'evento

L'app conosce 3 stati controllabili da admin:

1. **`pre_rito`** — cover originale Vogue Diary, citazione di Serena
2. **`post_rito`** — cover sostituita con foto degli sposi appena sposati, citazione cambia
3. **`archive`** — modalità sola lettura, upload disabilitato (post-evento, mantiene il sito accessibile come ricordo)

---

## 5. Feature list dettagliata (MVP — Scenario A completo)

### 5.1 Cover animata

- Layout: masthead "SERENA & UGO" Bodoni 56px, lettering progressivo lettera per lettera
- Header editoriale: `VOL. I · ISSUE 01` a sinistra, `JUNE 2026` a destra (lacca)
- Sotto la masthead: data del matrimonio in Georgia
- Fascia cipria con citazione di Serena in Caveat
- Indice "DENTRO QUESTO NUMERO" con voci linkate alle sezioni
- CTA `ENTRA  →` su nero
- Footer con "A ONE-DAY MAGAZINE"
- Prima volta: chiede il nome dell'ospite (campo singolo, font Caveat per immersione)

### 5.2 Identità ospite ibrida

- Alla prima apertura: campo "Il tuo nome" (es. "Maria Rossi")
- Generato UUID v4 e salvato in `localStorage` con chiave `wedding_guest_uuid`
- Nome salvato in `localStorage` con chiave `wedding_guest_name`
- Inserito in tabella Supabase `guests(uuid, display_name, total_points, photos_count, likes_received, created_at)`
- Tutte le azioni successive (foto, like, dedica) sono associate a questo UUID
- Il nome appare nelle didascalie polaroid e nel guestbook

### 5.3 Camera + upload diretto Drive

**Frontend:**
- Apre `getUserMedia({ video: { facingMode: 'environment' }})`
- Mostra preview live + bottone scatto grande in panna su nero
- Dopo scatto: anteprima statica + **striscia filtri Vogue Diary** (vedi 5.15) + campo dedica facoltativa (Caveat 18px) + selettore missione facoltativo
- L'ospite seleziona un filtro (default `originale`) — la scelta è **una tantum, irreversibile** (Strada A)
- Bottone `PUBBLICA` invia POST a `/api/upload` con la foto **già filtrata** via Canvas

**Backend (Vercel Function):**
- Riceve foto base64 (filtro già applicato lato client) + metadata (guest_uuid, dedica, mission_id?, filter_used)
- Autentica con service account
- Upload sul Drive nella cartella di Serena
- Genera thumbnail 600px lato server
- Salva metadata in Supabase tabella `photos`
- Aggiorna contatori in `guests` (photos_count++, total_points++)
- Risponde con drive_file_id + thumbnail_url
- Se offline: la foto entra in coda IndexedDB e si carica appena torna la rete

### 5.4 Polaroid wall con ranking dinamico

- Layout absolute positioning, polaroid sparse con rotazione random ±8°
- Dimensione polaroid proporzionale al numero di like ricevuti:
  - 0-2 like: dimensione base (180px)
  - 3-9 like: +20% (216px)
  - 10+ like: +40% (252px) + sigillo `★ EDITOR'S PICK` in alto a destra
- Tap sulla polaroid → fullscreen con dedica completa, autore in Caveat, contatore like, bottone like
- Realtime: nuove foto appaiono con drop-in animation (Supabase realtime channel)
- Z-index: foto più recenti sopra le più vecchie
- Pull-to-refresh disabilitato (è già realtime)

### 5.5 Sistema like editoriale

- 1 like a foto per ospite (vincolato da UUID device)
- Tabella `photo_likes(photo_id, guest_uuid, created_at)` con UNIQUE constraint su `(photo_id, guest_uuid)`
- UI: stellina ✶ in lacca quando attivata, outline quando inattiva
- Conteggio sotto la polaroid: `· 12 ·` (con middle-dots)
- Soglia "Editor's Pick" configurabile (default 10 like) → sigillo automatico
- Realtime: like si aggiornano live tra dispositivi

### 5.6 Sistema punti + missioni con bonus

**Punti automatici:**
- 1 punto per ogni foto caricata
- 1 punto per ogni like ricevuto sulle proprie foto
- Punti bonus per missione completata (configurabili da admin)

**Missioni:**
- Tabella `missions(id, title, description, bonus_points, active, created_by, created_at)`
- Esempi: "Foto col bacio degli sposi" (5pt), "Foto al taglio della torta" (3pt), "Foto con tutti i tavoli" (10pt)
- Validazione missione: l'ospite tagga manualmente la foto come "questa è per la missione X" al momento del caricamento (validazione "honor system" — è un matrimonio, non una gara olimpica)
- Admin può modificare/disattivare missioni in tempo reale

### 5.7 Classifica reporter live

- Pagina `/leaderboard` con lista ospiti ordinati per `total_points DESC`
- Layout: tabella editoriale stile rivista
- Header: `IL PHOTO TEAM DEL GIORNO`
- Per ogni ospite: nome in Caveat 22px, sotto "X scatti pubblicati · Y editor's picks · Z punti totali"
- Top 3 marcati con `№ 01`, `№ 02`, `№ 03` in lacca
- Realtime: aggiornamento live ad ogni nuova foto/like

### 5.8 Guestbook digitale

- Pagina `/guestbook` con dediche scritte in Caveat 22px
- Ogni dedica: messaggio sopra, firma "— Nome ospite" sotto
- Layout: due colonne stile pagina di libro
- Sfondo panna avorio con sottile texture "carta"
- Tabella `guestbook_entries(id, guest_uuid, message, created_at)`
- Limite messaggio: 280 caratteri (forza concisione poetica)
- Realtime: nuove dediche si aggiungono con fade-in

### 5.9 Slideshow per TV venue

- Pagina `/slideshow` ottimizzata per schermo 16:9 grande
- Full-screen all'apertura (`requestFullscreen()`)
- Foto in rotazione automatica ogni 8 secondi
- Algoritmo di selezione: 70% foto recenti (ultimi 30 min) + 30% Editor's Picks
- Layout: foto grande centrata + autore in Caveat sotto + dedica se presente
- Transizioni: crossfade morbido (1.5s)
- Nessuna interazione richiesta — set-and-forget
- Tap nascosto in alto a destra: pausa/play (per emergenze)

### 5.10 Pannello admin

**Login (`/admin`):**
- Campo password (PIN 6 cifre o frase) — UNICA password condivisa tra i 6 admin
- Dopo OK: scelta utente da lista (Ugo / Serena / Testimone 1 / Testimone 2 / Testimone 3 / Testimone 4)
- L'utente selezionato viene salvato in `sessionStorage` (non persistente)
- L'identità scelta determina i permessi visibili nella dashboard

**Dashboard (`/admin/dashboard`):**
- Header con stats live: foto totali, ospiti attivi, like totali, dediche
- Tab navigation differenziati per ruolo:

| Tab | Sposi | Testimoni |
|---|---|---|
| Live (feed foto + delete) | ✅ | ❌ |
| Missioni (CRUD) | ✅ | ✅ |
| Cover (upload post-rito) | ✅ | ❌ |
| Audit Log | ✅ | ❌ |
| Export | ✅ (fase 2) | ❌ |

### 5.11 Cambio cover post-rito

- Solo sposi
- Upload foto degli sposi appena sposati
- Tipicamente: foto col velo / dopo il "sì" / sul sagrato
- Citazione cambia automaticamente da "Benvenuti…" a una nuova (configurabile)
- Stato evento passa da `pre_rito` a `post_rito`
- Tutti gli ospiti che riaprono l'app vedono la nuova cover

### 5.12 Gestione missioni

- Form CRUD: titolo (text), descrizione (textarea), punti bonus (number), attiva (toggle)
- Lista missioni esistenti con stato e numero completamenti
- Tutti gli admin (sposi + 4 testimoni) possono creare/modificare/cancellare
- Audit log per modifiche critiche (eliminazione missione)

### 5.13 Modalità low-bandwidth (coda upload offline)

- Service Worker registra cache base (font, CSS, JS)
- Quando upload fallisce per offline: foto salvata in IndexedDB con metadata
- Background sync API quando torna la connessione
- Indicatore UI: `· 3 foto in attesa ·` in alto se ci sono upload pendenti
- Limite coda: 20 foto per dispositivo (per non saturare storage browser)

### 5.14 Audit log

- Tabella `admin_actions(id, admin_user, action_type, target_id, details, created_at)`
- Azioni tracciate (solo critiche, come deciso):
  - `delete_photo` — admin elimina foto
  - `update_mission` — modifica missione esistente
  - `delete_mission` — elimina missione
  - `change_cover` — cambio cover post-rito
  - `change_event_phase` — passaggio pre/post rito
- Visibile solo agli sposi nel pannello admin
- Visualizzazione: lista cronologica con `[timestamp] · admin_name · azione · target`

### 5.15 Sistema filtri Vogue Diary

**Decisione architetturale (Strada A):** la foto viene filtrata lato client tramite Canvas API prima dell'upload. Il file su Drive è **già filtrato**, l'originale non viene mantenuto. Scelta una tantum irreversibile per l'ospite.

**Trade-off accettato:** archivio Drive contiene foto post-filtro. Per l'album fisico futuro Serena dovrà accettare le scelte cromatiche degli ospiti.

**UI selezione filtri:**

Dopo lo scatto, sotto l'anteprima della foto compare una **striscia orizzontale scrollabile** con 7 mini-anteprime quadrate (60×60px), ognuna mostra la stessa foto con il filtro applicato. Sotto ogni anteprima il nome in Georgia uppercase letter-spacing 0.2em. Tap → la preview grande sopra applica il filtro selezionato. Il bottone `PUBBLICA` mostra a piè di pagina il filtro scelto (`Pubblicato con filtro · BLOOM CIPRIA` in Caveat).

**I 7 filtri (con valori CSS esatti):**

| # | Nome | Label UI | CSS filter chain | Overlay aggiuntivo |
|---|---|---|---|---|
| 1 | Originale | `ORIGINALE` | nessuno | nessuno |
| 2 | Bianco & Nero Drammatico | `B&N` | `grayscale(100%) contrast(1.25) brightness(0.95)` | nessuno |
| 3 | Sepia Editoriale | `SEPIA` | `sepia(60%) contrast(1.1) saturate(0.7) brightness(1.05)` | nessuno |
| 4 | Bloom Cipria | `BLOOM` | `saturate(0.85) contrast(1.05) brightness(1.05) hue-rotate(-5deg)` | `rgba(232,196,196,0.12)` blend-mode `soft-light` |
| 5 | Vintage Polaroid | `VINTAGE` | `contrast(0.95) saturate(0.85) brightness(1.05) sepia(15%)` | radial-gradient vignettatura |
| 6 | Inchiostro | `INCHIOSTRO` | `grayscale(100%) brightness(1.15) contrast(1.4)` | nessuno |
| 7 | Notte di Festa | `NOTTE` | `saturate(1.1) brightness(0.95) contrast(1.1) hue-rotate(8deg)` | `rgba(255,180,100,0.08)` blend-mode `multiply` |

**Implementazione tecnica:**

```javascript
// Pseudo-code: applicazione filtro via Canvas prima upload
function applyFilter(imageElement, filterName) {
  const canvas = document.createElement('canvas');
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
  const ctx = canvas.getContext('2d');

  // Step 1: applica CSS filter chain
  ctx.filter = FILTER_CHAINS[filterName];
  ctx.drawImage(imageElement, 0, 0);

  // Step 2: applica overlay se previsto
  if (FILTER_OVERLAYS[filterName]) {
    ctx.filter = 'none';
    ctx.globalCompositeOperation = FILTER_OVERLAYS[filterName].blendMode;
    ctx.fillStyle = FILTER_OVERLAYS[filterName].color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Step 3: applica vignettatura se Vintage
  if (filterName === 'vintage') {
    applyVignette(ctx, canvas.width, canvas.height);
  }

  // Esporta come base64 JPEG quality 0.92
  return canvas.toDataURL('image/jpeg', 0.92);
}
```

**Performance considerazioni:**

- Tutti i filtri sono client-side, nessun overhead server
- Su iPhone meno recenti (iPhone 8 e precedenti) i filtri 4, 5, 7 con overlay possono richiedere 1-2 secondi su foto 12MP
- Il bottone `PUBBLICA` mostra spinner Caveat "*applico il filtro…*" durante il rendering Canvas
- Anteprima striscia filtri 60×60px è velocissima (ridimensionamento massivo)

**Slideshow TV:**

Le foto nello slideshow `/slideshow` mostrano già il filtro scelto (è bakkato nel JPEG). Nessun overhead aggiuntivo per il rendering grande schermo.

---

## 6. Architettura tecnica

### 6.1 Stack tecnologico

| Layer | Tecnologia | Note |
|---|---|---|
| Frontend | React 18 + Vite | PWA installabile, già stack noto da Munly |
| Styling | Tailwind CSS + custom CSS | Per font/animazioni custom |
| Routing | React Router v6 | |
| State | Zustand | Più leggero di Redux per questo scope |
| Backend | Vercel Serverless Functions (Node.js 20) | API routes in `/api` |
| Database | Supabase (Postgres + Realtime) | **Progetto NUOVO dedicato**, non riusare Munly |
| Storage binari | Google Drive (cartella Serena) | Via service account |
| Deploy | Vercel auto-deploy da GitHub `main` | URL `wedding-serena-ugo.vercel.app` |
| QR | Generato statico, stampato fisicamente | |

### 6.2 Struttura repository

```
Wedding/
├── api/                          # Vercel Serverless Functions
│   ├── upload.js                 # POST: foto → Drive + Supabase
│   ├── photos.js                 # GET: lista foto paginata
│   ├── like.js                   # POST: toggle like
│   ├── guestbook.js              # POST: nuova dedica
│   ├── missions.js               # CRUD missioni (admin)
│   ├── admin/
│   │   ├── auth.js               # POST: verifica password admin
│   │   ├── delete-photo.js       # DELETE: rimuove foto (sposi)
│   │   ├── change-cover.js       # POST: cambia cover post-rito
│   │   └── audit-log.js          # GET: storico azioni
│   └── _lib/
│       ├── drive-client.js       # Service account auth + upload
│       ├── supabase-admin.js     # Supabase client server-side
│       └── audit.js              # Helper per loggare azioni
├── public/
│   ├── fonts/                    # Bodoni Moda, Caveat (locali per affidabilità)
│   ├── manifest.json             # PWA manifest
│   └── icons/                    # PWA icons
├── src/
│   ├── pages/
│   │   ├── Cover.jsx             # /
│   │   ├── Home.jsx              # /home
│   │   ├── Camera.jsx            # /camera
│   │   ├── Gallery.jsx           # /gallery
│   │   ├── PhotoDetail.jsx       # /gallery/:id
│   │   ├── Guestbook.jsx         # /guestbook
│   │   ├── Missions.jsx          # /missions
│   │   ├── Leaderboard.jsx       # /leaderboard
│   │   ├── Slideshow.jsx         # /slideshow
│   │   └── admin/
│   │       ├── Login.jsx         # /admin
│   │       └── Dashboard.jsx     # /admin/dashboard
│   ├── components/
│   │   ├── Polaroid.jsx
│   │   ├── EditorialLabel.jsx
│   │   ├── CaveatHandwriting.jsx
│   │   ├── EditorsPickBadge.jsx
│   │   └── …
│   ├── hooks/
│   │   ├── useGuestIdentity.js
│   │   ├── useUploadQueue.js
│   │   ├── useRealtimePhotos.js
│   │   └── …
│   ├── lib/
│   │   ├── supabase-client.js    # Solo public anon key
│   │   └── design-tokens.js      # Palette + font come costanti
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── .env.local                    # NEVER COMMIT
├── .env.example                  # Template
├── vercel.json                   # Config Vercel
├── package.json
└── PRD.md                        # Questo documento
```

### 6.3 Schema database Supabase

```sql
-- Ospiti (identità ibrida)
CREATE TABLE guests (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  total_points INTEGER DEFAULT 0,
  photos_count INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missioni (definite prima per FK)
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  bonus_points INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foto caricate (metadata + ranking)
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_uuid UUID REFERENCES guests(uuid),
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  thumbnail_url TEXT,
  dedication TEXT,
  mission_id UUID REFERENCES missions(id) NULL,
  filter_used TEXT DEFAULT 'originale' CHECK (filter_used IN ('originale','bn_drama','sepia_editorial','bloom_cipria','vintage_polaroid','inchiostro','notte_party')),
  rotation_deg DECIMAL DEFAULT 0,
  position_x DECIMAL DEFAULT 0,
  position_y DECIMAL DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Like sulle foto
CREATE TABLE photo_likes (
  photo_id UUID REFERENCES photos(id),
  guest_uuid UUID REFERENCES guests(uuid),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (photo_id, guest_uuid)
);

-- Guestbook (dediche separate dalle foto)
CREATE TABLE guestbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_uuid UUID REFERENCES guests(uuid),
  message TEXT NOT NULL CHECK (length(message) <= 280),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings dell'evento (riga singola)
CREATE TABLE event_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phase TEXT DEFAULT 'pre_rito' CHECK (phase IN ('pre_rito', 'post_rito', 'archive')),
  cover_image_url TEXT,
  cover_quote TEXT,
  editors_pick_threshold INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (azioni critiche admin)
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- `guests`, `photos`, `photo_likes`, `guestbook_entries`, `missions`: SELECT pubblico (anon)
- INSERT su `guests`, `photo_likes`, `guestbook_entries`: pubblico (con rate limit lato API)
- INSERT/UPDATE/DELETE su `photos`, `missions`, `event_settings`, `admin_actions`: solo via service_role key (mai dal frontend)

### 6.4 Contratti API

| Endpoint | Method | Body | Response | Auth |
|---|---|---|---|---|
| `/api/upload` | POST | `{photo_base64, guest_uuid, dedication?, mission_id?, filter_used}` | `{photo_id, drive_url}` | guest_uuid |
| `/api/photos` | GET | `?cursor=...&limit=20` | `{photos[], next_cursor}` | public |
| `/api/like` | POST | `{photo_id, guest_uuid}` | `{liked, new_count}` | guest_uuid |
| `/api/guestbook` | POST | `{guest_uuid, message}` | `{entry}` | guest_uuid |
| `/api/missions` | GET | — | `{missions[]}` | public |
| `/api/missions` | POST | `{title, description, bonus_points}` | `{mission}` | admin token |
| `/api/admin/auth` | POST | `{password, admin_user}` | `{token}` | password match |
| `/api/admin/delete-photo` | DELETE | `{photo_id}` | `{ok}` | admin token + sposi only |
| `/api/admin/change-cover` | POST | `{cover_image_base64, new_quote}` | `{ok}` | admin token + sposi only |
| `/api/admin/audit-log` | GET | — | `{actions[]}` | admin token + sposi only |

### 6.5 Flusso autenticazione service account

```
[Browser]                [Vercel Function]              [Google Drive API]
   │                            │                                │
   │ POST /api/upload (foto)    │                                │
   ├──────────────────────────► │                                │
   │                            │ Carica GOOGLE_SERVICE_ACCOUNT  │
   │                            │ JSON da env var                │
   │                            │ Genera JWT                     │
   │                            │ Scambia con access_token       │
   │                            ├──────────────────────────────► │
   │                            │ ◄──── access_token ────────────┤
   │                            │                                │
   │                            │ Upload su Drive cartella Serena│
   │                            ├──────────────────────────────► │
   │                            │ ◄──── drive_file_id ───────────┤
   │                            │                                │
   │                            │ Insert in Supabase photos      │
   │                            │ (server-side service_role)     │
   │                            │                                │
   │ ◄────── {photo_id, url} ───┤                                │
```

**Critical:** la chiave service account JSON è in `process.env.GOOGLE_SERVICE_ACCOUNT_JSON` su Vercel, mai nel codice frontend.

### 6.6 Realtime subscription map

| Schermata | Subscription | Trigger |
|---|---|---|
| Gallery | `photos` table changes (INSERT) | Nuova polaroid drop-in animation |
| PhotoDetail | `photo_likes` table changes (INSERT/DELETE) | Update contatore like live |
| Guestbook | `guestbook_entries` (INSERT) | Fade-in nuova dedica |
| Leaderboard | `guests` (UPDATE su total_points) | Re-sort classifica |
| Slideshow | `photos` (INSERT) | Aggiunge foto al pool rotazione |
| Admin Live | `photos`, `photo_likes`, `guestbook_entries` (INSERT) | Update stats counters |

### 6.7 Storage strategy

- **Foto originali:** Google Drive (alta qualità, archivio permanente per gli sposi)
- **Thumbnail:** generati lato server con `sharp` (Vercel function), 600px max, salvati su Drive
- **URL pubblici:** Drive `webContentLink` per fullscreen, `thumbnailLink` per preview
- **Supabase non storage binario:** Supabase mantiene SOLO metadati, non file (per evitare costi e doppia gestione)

---

## 7. Sicurezza & Privacy

### 7.1 Service account credentials management

- File JSON service account NON committato (in `.gitignore`)
- Caricato come singola env var Vercel: `GOOGLE_SERVICE_ACCOUNT_JSON` (stringa JSON minified)
- Letto solo da Vercel functions (server-side)
- Rotation: nessuna prevista per evento single-shot, ma post-evento rimuovere il permesso del service account dalla cartella

### 7.2 Anti-spam

- **Rate limit per endpoint** (Vercel KV o Upstash):
  - `/api/upload`: max 60 foto/ora per `guest_uuid`
  - `/api/like`: max 200 like/ora per `guest_uuid`
  - `/api/guestbook`: max 5 dediche totali per `guest_uuid`
- **Validation lato server:**
  - Foto base64 max 8MB
  - Messaggi max 280 caratteri (DB constraint)
  - Foto MIME type whitelist: jpeg, png, heic
- **UUID device** non rinnovabile per sessione (rigenerare = perdita totale punti, deterrente naturale)

### 7.3 Moderazione contenuti

- Solo sposi possono eliminare foto via pannello admin
- Soft delete: `deleted_at` timestamp, mai hard delete (recupero possibile)
- Polaroid eliminate scompaiono dal wall ma restano su Drive per archivio
- Audit log tracking su ogni delete

### 7.4 GDPR / Privacy

- **Decisione confermata:** evento privato → no informativa GDPR esplicita
- **Però:** alla richiesta nome iniziale, microcopy in Caveat sotto al campo: *"Il tuo nome appare nelle foto e nel guestbook."* (trasparenza minima)
- Diritti ospiti: se un ospite vuole rimuovere le proprie foto, contatta gli sposi (canale informale, è un matrimonio)
- Post-evento: dati Supabase mantenuti come archivio, foto su Drive permanenti

### 7.5 Backup strategy

- **Foto:** doppia copia: Drive (permanente) + Supabase metadata
- **Database Supabase:** backup automatico Pro plan se attivato, altrimenti export manuale settimanale tramite SQL dump
- **Audit log:** export CSV post-evento per archivio personale sposi

---

## 8. Deployment & DevOps

### 8.1 Setup Vercel + GitHub

1. Repo `serenaandugoswedding-crypto/Wedding` collegato a Vercel
2. Auto-deploy su push a `main`
3. Branch `develop` per testing → preview deployments
4. Build command: `npm run build` (Vite)
5. Output: `dist/`

### 8.2 Variabili d'ambiente (lista completa)

```env
# Supabase (NUOVO progetto dedicato)
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...                    # Frontend safe
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # Backend only

# Google Drive (service account già configurato)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"...",...}
GOOGLE_DRIVE_FOLDER_ID=1ZuW5FlXhkDDldeVYjezHubfhGWMa-rpY

# Admin
ADMIN_PASSWORD=<password_condivisa_6_admin>

# App config
EVENT_DATE=2026-06-14
PUBLIC_BASE_URL=https://wedding-serena-ugo.vercel.app
```

### 8.3 Dominio

- **MVP:** `wedding-serena-ugo.vercel.app` (gratis, immediato)
- **Eventuale upgrade:** se decidi di comprare dominio (es. `serenaeugo.it` ~10€/anno) lo aggiungiamo in Vercel in 5 minuti

### 8.4 Monitoring

- **Vercel Analytics** (gratuito) per traffico
- **Vercel Functions logs** per errori upload
- **Supabase Dashboard** per query lente / errori DB
- **Quota Drive:** check manuale su account Serena (assicurarsi >50GB liberi)

### 8.5 Piano B se WiFi venue cade

1. Ogni dispositivo ospite continua a funzionare via 4G/5G personale (l'app è leggera ~500KB)
2. Coda offline IndexedDB sincronizza appena torna rete
3. La TV slideshow continua a mostrare le foto già caricate (cache locale)
4. Cartello fisico in venue: "Se il sito è lento, usa i tuoi dati mobili"

---

## 9. Roadmap & Milestone (8 settimane)

### M1 — Foundations (settimana 1-2)
- [ ] Setup repo Vite + React + Tailwind
- [ ] Setup nuovo progetto Supabase + schema completo + RLS
- [ ] Setup Vercel + env vars + deploy "hello world"
- [ ] Service account test: upload manuale di una foto su Drive da Vercel function
- [ ] Cover statica live con design Vogue Diary
- **Deliverable:** URL pubblico con cover funzionante

### M2 — Core capture (settimana 3-4)
- [ ] Onboarding nome ospite + UUID localStorage
- [ ] Pagina Home con 3 azioni
- [ ] Camera component con `getUserMedia`
- [ ] Upload flow completo (browser → API → Drive → DB)
- [ ] Polaroid wall base (no ranking, no like)
- **Deliverable:** un ospite può scattare e vedere la propria foto nel wall

### M3 — Social & ranking (settimana 5-6)
- [ ] Sistema like + Editor's Pick
- [ ] Polaroid ranking dinamico (size/posizione)
- [ ] Guestbook con dediche Caveat
- [ ] Realtime subscriptions su tutte le pagine
- [ ] Slideshow per TV
- [ ] **Sistema filtri Vogue Diary (7 filtri client-side via Canvas)**
- **Deliverable:** evento simulabile con più ospiti contemporanei + filtri funzionanti

### M4 — Gamification (settimana 7)
- [ ] Tabella missioni + CRUD admin
- [ ] Sistema punti automatico
- [ ] Pagina classifica reporter
- [ ] Pannello admin completo (login + dashboard + permessi differenziati)
- [ ] Audit log
- **Deliverable:** funzionalità complete, demo end-to-end con 4 dispositivi

### M5 — Polish & dress rehearsal (settimana 8)
- [ ] Cover animation lettering
- [ ] Modalità low-bandwidth + service worker
- [ ] Cambio cover post-rito (sposi)
- [ ] Stress test con 50+ foto simultanee
- [ ] QR code generato e stampato
- [ ] **Dress rehearsal:** prova completa con 5-10 amici fidati
- [ ] Bug fixing finale + freeze codice 3 giorni prima del matrimonio
- **Deliverable:** app pronta in produzione

---

## 10. Fase 2 (post-matrimonio)

Idee documentate per implementazione successiva, non in MVP:

1. **Export PDF album** — generazione automatica album fotografico stile Vogue dalle foto caricate, con dediche e didascalie. Stampabile.
2. **Export ZIP organizzato** — archivio strutturato per momento della giornata (rito / aperitivo / cena / dopo cena), nominato e ordinato.
3. **Time capsule** — video-messaggi ospiti che gli sposi vedono solo al ritorno dalla luna di miele.
4. **Audio messaggi** — alternativa al video per dediche vocali brevi.
5. **"Foto della rivista"** — algoritmo (like + tempo + Editor's Pick) sceglie 12 foto al giorno per "issue" finale.
6. **Stampa fotografica** — integrazione con servizio stampa per album fisico.
7. **Filtri aggiuntivi** — espansione palette filtri se nascono richieste ricorrenti.

---

## 11. Appendici

### 11.1 Glossario terminologia editoriale

| Termine app | Significato |
|---|---|
| Cover | Schermata di benvenuto stile copertina rivista |
| Issue | L'intero matrimonio = una "issue" di Vogue Diary |
| Editor's Pick | Foto con molti like (sopra soglia) |
| Reporter | Ogni ospite che scatta foto |
| Photo team | L'insieme dei reporter |
| Diario | Sezione guestbook |
| Provino | Anteprima foto in galleria |
| Masthead | Il logo "SERENA & UGO" Bodoni grande |
| Folio | Numerazione pagine (`p. 02`) |
| Filter chain | Catena di filtri CSS applicati in sequenza |
| Bloom | Effetto bloom cipria, palette del matrimonio |
| Inchiostro | Filtro B&N alto-luminanza stile illustrazione |

### 11.2 Checklist giorno-evento

**1 settimana prima:**
- [ ] Test completo da 5+ dispositivi diversi (iPhone, Android, vari browser)
- [ ] Verifica quota Google Drive Serena (almeno 30GB liberi)
- [ ] Stampa QR code (almeno 30 copie sparpagliate ai tavoli)
- [ ] Test slideshow su TV venue (chiamare venue per verificare HDMI/WiFi)
- [ ] Backup credenziali admin in posto sicuro (smartphone Ugo + email)

**Giorno -1:**
- [ ] Freeze codice (no deploy)
- [ ] Test smoke finale
- [ ] Carica cover post-rito già pronta (foto vecchia placeholder, sostituibile dopo)
- [ ] Verifica WiFi venue → se assente, comunicare agli ospiti di usare 4G/5G

**Giorno evento:**
- [ ] Setup TV / proiettore con `/slideshow` aperto
- [ ] Distribuire QR su tutti i tavoli + entrata + bagni
- [ ] Ugo o testimone dedicato monitora pannello admin durante il rito
- [ ] Cambio cover entro 30 min post-rito (foto fresca degli sposi)
- [ ] Goditi il matrimonio (no dev)

**Giorno +1:**
- [ ] Backup foto Drive (download zip)
- [ ] Disable upload (modalità `archive`)
- [ ] Mantieni sito accessibile come ricordo

### 11.3 Materiali fisici

- **QR code:** generato dal link `wedding-serena-ugo.vercel.app`, stampato su cartoncino panna avorio formato 10x10cm, posizionato ai tavoli e all'entrata
- **Totem entrata:** pannello A3 con istruzioni stile editoriale: "INQUADRA IL CODE / SCATTA / CONDIVIDI", grafica Bodoni
- **Cartello WiFi backup:** se WiFi venue assente, "Usa i tuoi dati mobili — il sito è leggero"

### 11.4 Comunicazioni agli ospiti

**Testo invito digitale (WhatsApp / messaggio pre-matrimonio):**

> *Per immortalare insieme il nostro giorno, abbiamo creato un piccolo diario digitale.*
>
> *Ai tavoli troverete un QR code: inquadratelo, lasciate il vostro nome, e ogni vostra foto entrerà nel nostro album personale.*
>
> *Niente login, niente download. Solo voi e il momento.*
>
> *— Serena & Ugo*

**Microcopy in venue (cartello A4 al photobooth):**

> **DENTRO QUESTO MATRIMONIO**
> 01 — Inquadra il QR
> 02 — Firma il diario
> 03 — Scatta a piacere
>
> *Aiutateci a ricordare ogni dettaglio.*

**Microcopy slideshow TV (footer):**

> *Le foto degli ospiti, in tempo reale.*

---

**Fine documento.**

*Vogue Diary Edition — versione 1.1 — pronto per Claude Code.*
