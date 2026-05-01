# Wedding App — Vogue Diary Edition

PWA per il matrimonio di Serena & Ugo (14 giugno 2026).  
Gli ospiti scansionano un QR code, fotografano con filtri editorial, caricano e lasciano dediche.  
Un pannello admin consente di moderare, archiviare e scaricare le foto.

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS v4 + React Router v7 + Zustand |
| Backend | Vercel Serverless Functions (ESM) |
| Storage | Supabase Storage — bucket `photos` (pubblico) + `archive` (privato, full-res) |
| Database | Supabase (PostgreSQL + RLS) |

## Variabili d'ambiente (Vercel)

| Variabile | Descrizione | Richiesta da |
|-----------|-------------|-------------|
| `SUPABASE_URL` | URL progetto Supabase | tutte le funzioni |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service role — bypassa RLS | tutte le funzioni |
| `ADMIN_PASSWORD` | Password pannello admin | `api/admin/auth` |
| `ADMIN_TOKEN_SECRET` | 64-char hex — firma i token HMAC (TTL 8h) | `api/admin/*` |
| `CRON_SECRET` | 32-char hex — autorizza il cron Vercel | `api/cron/purge-deleted` |

> `ADMIN_TOKEN_SECRET` e `CRON_SECRET` sono già configurati su Vercel (Production + Preview).  
> Aggiungere `ADMIN_PASSWORD` nelle Vercel Environment Variables (sensibile).

## API

### Pubbliche (nessuna autenticazione)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/api/upload` | Carica foto web + archive, inserisce in DB |
| `GET` | `/api/guests` | Lista ospiti |
| `GET` | `/api/missions` | Lista missioni attive |

### Admin — richiedono `Authorization: Bearer <token>`

Ottenere il token con `POST /api/admin/auth`.  
Scadenza: 8 ore. Rate-limit login: 5 tentativi / 15 minuti per IP.

| Metodo | Endpoint | Query / Body | Descrizione |
|--------|----------|-------------|-------------|
| `POST` | `/api/admin/auth` | `{ password }` | Login → `{ token }` |
| `GET` | `/api/admin/photos` | `?page=1&limit=20&status=live\|deleted\|all` | Lista foto paginata |
| `GET` | `/api/admin/photos/stats` | — | Conteggi per stato + dimensioni bucket |
| `POST` | `/api/admin/photos/delete` | `{ ids: [...] }` | Soft-delete bulk |
| `POST` | `/api/admin/photos/restore` | `{ ids: [...] }` | Ripristino bulk |
| `POST` | `/api/admin/photos/mark-archived` | `{ ids: [...], unmark?: bool }` | Marca / de-marca come archiviata |
| `POST` | `/api/admin/photos/zip` | `{ ids: [...] }` (max 50) | Scarica ZIP originali (archive bucket se disponibile) |

### Cron (Vercel — autenticato automaticamente con `CRON_SECRET`)

| Metodo | Endpoint | Schedule | Descrizione |
|--------|----------|----------|-------------|
| `GET` | `/api/cron/purge-deleted` | `0 4 * * *` (04:00 UTC) | Hard-delete foto soft-deleted da > 30 giorni + rimuove da storage |

## Sviluppo locale

```bash
npm install        # installa dipendenze incluso archiver
npm run dev        # Vite dev server (solo frontend)
vercel dev         # funzioni serverless locali
```

Creare un file `.env.local` con le variabili sopra elencate.
