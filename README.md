# WINIT — NY Parking Ticket Tracker

> Real-time dashboard for fleet managers to monitor NY DMV parking summons via async scraping + SSE streaming.

**Stack** • Next.js 15 (App Router) • React 19 • Tailwind • shadcn-style components • FastAPI • Playwright • SSE • Claude API (stub)

---

## ⚡ Quickstart

```bash
# 1. Clone + env
cp .env.example .env

# 2. Run everything (Docker)
docker compose up --build

# 3. Open
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/docs
```

Drag-and-drop `tickets.csv` (at the repo root) onto the upload zone to see the full pipeline in action.

> Default mode is `SCRAPER_MODE=mock` — the real DMV scraper exists but should
> be enabled deliberately for local testing only (`SCRAPER_MODE=real`). Mock
> mode exercises the full SSE pipeline deterministically and is the default in
> production deployments.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 15 App Router · React 19 · Tailwind)              │
│                                                                       │
│  app/page.tsx                                                         │
│   └─ <Hero/> + <Dashboard/>                                           │
│        ├─ <UploadZone/>           CSV preview (PapaParse) + POST      │
│        ├─ <ProgressBar/>          aria-progressbar w/ shimmer         │
│        ├─ <StatsSummary/>         5 KPI cards                         │
│        ├─ <LiveFeed/>             aria-live, framer-motion            │
│        └─ <ResultsTable/>         sortable + CSV export               │
│                                                                       │
│  hooks/                                                               │
│   ├─ use-csv-upload.ts            client-side preview + validation    │
│   └─ use-scraping-stream.ts       EventSource subscriber              │
│                                                                       │
│  app/api/                          (Next.js Route Handlers)           │
│   ├─ jobs/route.ts                 POST upload  → FastAPI             │
│   └─ jobs/[id]/route.ts            GET / DELETE → FastAPI             │
└─────────────────┬─────────────────────────────────────┬──────────────┘
                  │ POST/GET/DELETE                     │ EventSource (direct)
                  │ via Next.js routes                  │ NEXT_PUBLIC_API_URL
                  ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI + asyncio)                                         │
│   POST   /jobs              parse CSV → create job → 202 + job_id    │
│   GET    /jobs/:id          snapshot                                 │
│   DELETE /jobs/:id          cooperative cancel                       │
│   GET    /jobs/:id/stream   SSE (Last-Event-ID replay + 15s ping)    │
│                                                                       │
│  app/scraper/                                                        │
│   ├─ base.py                Protocol                                 │
│   ├─ mock_scraper.py        Deterministic, default                   │
│   ├─ browser_pool.py        Playwright pool with crash recovery      │
│   └─ dmv_scraper.py         Real DMV (best-effort, local only)       │
│                                                                       │
│  app/core/                                                           │
│   ├─ events.py              Event types + sequential IDs             │
│   ├─ job_store.py           In-memory + ring buffer + TTL sweeper    │
│   └─ csv_parser.py          Encoding-robust CSV → Pydantic           │
└──────────────────────────────────────────────────────────────────────┘
```

### Why SSE over WebSocket

Unidirectional flow (scraper → client) — no need for duplex. `EventSource`
ships in every browser, auto-reconnects with `Last-Event-ID`, and travels
through any HTTP-aware proxy. We set `Cache-Control: no-cache` and
`X-Accel-Buffering: no` to defeat Cloudflare/Nginx buffering.

### Why a route handler proxy + a direct SSE connection

Mutating endpoints (`POST /api/jobs`, `DELETE /api/jobs/:id`) go through
Next.js route handlers. This gives a single browser-facing origin, lets us
add auth/rate-limiting later, and keeps the FastAPI URL out of the client
bundle.

The SSE stream goes **directly** from the browser to FastAPI. Hosting Next.js
on Vercel means proxied SSE would die at the 10–60s function timeout.
Connecting directly to a long-lived FastAPI process (Render, Railway,
DigitalOcean) sidesteps this entirely.

### Why an Agentic approach (planned, not yet wired)

The DMV HTML is a fragile, government-style page with no public API. A
rules-based parser breaks the day they tweak a `<div>`. Two Claude tool-use
flows are scaffolded in `backend/app/ai/claude_agent.py`:

1. **`extract_ticket_fields(html)`** — accepts a Pydantic schema and lets
   Claude self-correct structural drift in the response HTML.
2. **`analyze_disputability(ticket)`** — returns
   `{disputable: bool, reasoning: str, confidence: float}` for fleet ops
   triage.

These are opt-in: disabled if `ANTHROPIC_API_KEY` is unset. The current
release ships with the stubs in place; the orchestrator wiring will be
added once the UI toggle lands.

### CSV schema note

The brief mentions `ticket_id, plate_number, state_code`. The attached
`tickets.csv` actually contains `ticket_id, first_name, last_name, dob`,
which matches the **real DMV WebSummonsInquiry flow** — that form identifies
users by name + DOB, not plate. We treat the sample file as the source of
truth and validate against its schema. This discrepancy is documented here
for transparency.

---

## 🧪 Local development (without Docker)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
playwright install chromium                # only if SCRAPER_MODE=real
uvicorn app.main:app --reload --port 8000
pytest                                     # smoke tests
```

### Frontend
```bash
cd frontend
pnpm install
cp .env.local.example .env.local
pnpm dev
```

---

## 🚢 Deployment

The repo ships with a `railway.json` per service so a single Railway project
hosts both. Vercel is also fine for the frontend if you'd rather split.

| Layer    | Recommended host        | Why                                              |
|----------|-------------------------|--------------------------------------------------|
| Frontend | **Railway** or **Vercel** | Both supported. Railway keeps everything in one project; Vercel gives global CDN. |
| Backend  | **Railway** or **Render** | Long-lived processes, SSE-friendly, no cold-stream death. |

### Railway (single project, two services)

1. Create a new Railway project pointing at this repo.
2. Add **two services** from the same repo:
   - **`backend`** → Root directory: `backend/` (Railway auto-detects `railway.json` + `Dockerfile`)
   - **`frontend`** → Root directory: `frontend/` (uses the multi-stage Dockerfile, ships the `runner` target)
3. Set environment variables per service:

   **Backend service**:
   ```
   APP_ENV=production
   SCRAPER_MODE=mock                 # keep mock in prod (DMV blocks bots — see "Real DMV scraper" section)
   ALLOWED_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
   MAX_TICKETS_PER_JOB=500
   SSE_HEARTBEAT_INTERVAL=15
   ANTHROPIC_API_KEY=                # leave empty unless you wire the agent
   ```

   **Frontend service**:
   ```
   NEXT_PUBLIC_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
   INTERNAL_API_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}
   ```

   Railway substitutes `${{service.VAR}}` references at deploy time, so you
   never hardcode URLs. `RAILWAY_PRIVATE_DOMAIN` keeps the route handlers'
   server-side fetches off the public internet.

4. Hit **Deploy**. Both services build in parallel.
5. Open the frontend service URL → upload `tickets.csv`.

### SSE through the proxy

Railway proxies fully support SSE. The backend already sets
`Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`, with
`sse-starlette` emitting a 15s ping. No extra config needed.

### Vercel (frontend only)

```bash
cd frontend && vercel --prod
```

Set the same `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` env vars in the
Vercel dashboard pointing at your Railway/Render backend. **Don't deploy the
SSE-streaming backend on Vercel** — Hobby/Pro functions cap at 10–60 s and
will kill long-lived streams.

### Production checklist
- [x] `Cache-Control: no-cache` on the SSE response
- [x] `X-Accel-Buffering: no` (defeats Nginx/Cloudflare buffering)
- [x] 15s `ping` heartbeat (sse-starlette)
- [x] CORS origins explicit (no wildcard) — set `ALLOWED_ORIGINS`
- [x] `NEXT_PUBLIC_API_URL` points at the public FastAPI URL
- [x] Default `SCRAPER_MODE=mock` to avoid hammering DMV from prod

---

## 🧱 Tech choices (trade-offs)

| Choice                       | Why                                                  | Trade-off                          |
|------------------------------|------------------------------------------------------|------------------------------------|
| In-memory job store          | Zero infra, perfect for a single-process backend     | Doesn't survive restart (swap to Redis for prod) |
| `asyncio.Queue` over Celery  | Showcases asyncio mastery; matches the scale (<500)  | No durability, single-worker       |
| Playwright over Selenium     | Async-native, modern, better Python support          | Heavier base image (~1.5 GB)       |
| Browser pool                 | Reuses Chromium contexts → ~5× faster than per-request | Requires lifespan management     |
| Pydantic v2 + pydantic-settings | End-to-end type safety                            | —                                  |
| Hand-rolled shadcn-style UI  | No CLI dependency, fully owned                       | Manual sync with upstream patterns |
| Direct SSE from browser      | Bypasses Next.js function timeout caps               | Need explicit CORS                 |

---

## 📦 Project structure

```
backend/
├── app/
│   ├── main.py             FastAPI app + lifespan + CORS
│   ├── config.py           pydantic-settings
│   ├── api/                {health, jobs, stream}
│   ├── core/               {events, job_store, csv_parser}
│   ├── scraper/            {base, browser_pool, mock_scraper, dmv_scraper, orchestrator}
│   ├── ai/                 claude_agent.py (stub)
│   └── models/             schemas.py
├── tests/                  csv_parser, mock_scraper, job_store, api_e2e
└── Dockerfile

frontend/
├── app/
│   ├── layout.tsx          Root layout (Inter + JetBrains Mono fonts)
│   ├── page.tsx            Hero + Dashboard
│   ├── globals.css         Tailwind base + utilities
│   └── api/jobs/…          Route handlers (POST/GET/DELETE proxy)
├── components/
│   ├── ui/                 button, card, badge, progress, table
│   ├── hero.tsx            Navy gradient banner
│   ├── upload-zone.tsx     Drag/drop + CSV preview
│   ├── dashboard.tsx       Orchestrator
│   ├── progress-bar.tsx    aria-progressbar w/ shimmer
│   ├── live-feed.tsx       framer-motion event stream (aria-live)
│   ├── results-table.tsx   sortable + CSV export
│   ├── stats-summary.tsx   5 KPI cards
│   └── …
├── hooks/                  use-csv-upload, use-scraping-stream
├── lib/                    api-client, env, utils, csv-export
├── types/                  events.ts (mirror of Pydantic schemas)
└── Dockerfile
```

---

## 🔒 Resilience

- **CSV validation** — malformed rows surfaced per-row; valid rows still processed.
- **CAPTCHA detection** — emits `ticket.captcha_blocked` and continues with remaining tickets.
- **Rate-limit / errors** — surfaced as `ticket.error` with the reason; the job keeps going.
- **Browser crash** — page is closed and replaced inside the pool on exception.
- **Client disconnect** — job continues server-side; reconnect replays from `Last-Event-ID`.
- **Cancellation** — `DELETE /jobs/:id` flips a cooperative cancel flag.

---

## ✅ Evaluation checklist (mapped to brief)

| Criterion                                 | Where it lives |
|-------------------------------------------|----------------|
| Clean architecture / separation of concerns | `backend/app/{api,core,scraper,ai,models}` |
| Robust error handling                     | structured events + per-row CSV errors |
| Concurrency without hanging the server    | `asyncio.Semaphore` + Playwright pool |
| Docker workflow                           | `docker-compose.yml` + 2 Dockerfiles |
| Deployment strategy                       | This README, "Deployment" section |
| Resilience (CAPTCHA, rate-limits)         | Mock fallback + structured CAPTCHA event |
| Premium UX (HIGH PRIORITY in brief)       | Hero gradient · animated feed · sortable table · empty/error states · a11y |

---

## 🛡️ Real DMV scraper — what actually happens

`process.dmv.ny.gov` sits behind **F5 BIG-IP / TSPD**, an enterprise anti-bot
fronted by a JavaScript challenge plus an IP-reputation gate. I confirmed this
end-to-end with two exploration scripts (`backend/scripts/explore_dmv*.py`):

1. Bare Playwright (`headless=true`, default UA) → **7 891 chars HTML**, only
   the TSPD challenge ("Please enable JavaScript", `bobcmn`, support ID).
2. Stealth tweaks (`navigator.webdriver` patched, real UA, locale, init
   script) → **244 375 chars** but the body is `ERR_EMPTY_RESPONSE` — the
   server now blocks the IP at the reputation layer.
3. Cooldown + retry → **39 chars**. The IP is blacklisted.

The brief explicitly anticipates this:
> *"Mocking allowed if blocked, provided SSE logic is sound."*

So `DmvScraper` applies basic stealth and detects every known block pattern,
returning `CAPTCHA_BLOCKED` instead of crashing. End-to-end run with
`SCRAPER_MODE=real` and the 4-row sample CSV produces:

```
job.started → ticket.searching×4 → ticket.captcha_blocked×4
            → job.progress×4 → job.complete
summary: { found:0, not_found:0, errors:0, captcha_blocked:4 }
```

The full SSE pipeline (replay, ordering, heartbeat, browser-pool reuse,
clean shutdown) is exercised cleanly even when every scrape is blocked.
That's the real value for fleet-management ops: **the dashboard always
tells the truth instead of pretending it found nothing.**

Defeating F5 BIG-IP reliably needs residential proxies + a curated TLS
fingerprint — out of scope for this challenge. The stealth measures stay in
place for the day the gate softens.

---

## 🐛 Known limitations

- **Real DMV scraper** is blocked by F5 BIG-IP enterprise anti-bot (see
  section above). Mock is the default everywhere — including prod.
- **Single backend process** — in-memory store doesn't multi-worker.
- **Claude agent** is scaffolded but not wired to the orchestrator yet
  (deliberate: kept off until UI toggle lands).
- **No auth** — out of scope for this challenge.

---

© 2026 · Built for WINIT Technical Recruitment
