# OG Clan Engines — CODM Tournament Engine

A tournament management tool for Call of Duty Mobile (CODM) clan events. Organizers don't register teams or players ahead of time — they just upload screenshots of the in-game results screen, and the system reads placements, team rosters, and kills straight out of the image via OCR. Teams and players are discovered automatically and reconciled by the organizer during a quick review step, not typed in by hand beforehand.

**Live app**: https://codm-eval-engine.vercel.app
**API**: https://codm-eval-engine.onrender.com

## Table of contents

- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Repo layout](#repo-layout)
- [Local development](#local-development)
- [Testing, linting, type-checking](#testing-linting-type-checking)
- [Database migrations](#database-migrations)
- [Deployment](#deployment)
- [API overview](#api-overview)
- [Known limitations](#known-limitations)

## How it works

1. **Create a tournament** — name, event date, and a scoring config: points per kill, and points per placement (1st through 10th), fully customizable since every tournament pays out differently.
2. **Open a match** — pick a match number, an optional round name ("Grand Finals"), and a **scoring mode**: `placement only`, `kills only`, or `both`. Different lobbies in the same tournament can score differently — a placement-only lobby earns zero kill points regardless of kills, and vice versa. Player kill totals always count for MVP purposes regardless of a match's mode.
3. **Upload a screenshot** — CODM's post-match "RANK" tab shows a scrollable grid of up to 9 teams per screen (rank badge, team label, 2–4 players with kill counts each). A full lobby usually takes several screenshots to capture; the system tolerates uploading overlapping screenshots of the same match (e.g. the pinned top-3 teams appearing in every screenshot as you scroll) without creating duplicate results.
4. **OCR extraction** — [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) reads the screenshot, and a custom grid-parsing algorithm (`app/ocr/codm_parser.py`) groups the raw text into per-team blocks. Ranks 1–3 are identified by their fixed medal badge color (gold/silver/bronze) rather than relying solely on OCR'ing the small digit inside the medal graphic, which is where misreads concentrate. Player names are fuzzy-matched (`rapidfuzz`) against players already known in the tournament; a new name becomes a new player, and a block of players who already belong to one team suggests that team automatically.
5. **Review & confirm** — the organizer sees one editable card per detected team (fix any misread name, confirm/rename the team, fill in a placement if OCR couldn't read a badge) and confirms every team on the screenshot in a single batch.
6. **Results & leaderboard** — each match shows a breakdown per team: placement points, kill points, total, and a short auto-generated performance note. The tournament leaderboard aggregates across all confirmed matches, respecting each match's scoring mode, with MVP/Best Team/Most Kills awards and a downloadable PDF report.

## Tech stack

**Backend** (`apps/api`)
- FastAPI + Pydantic v2
- Supabase (Postgres, Auth, Storage) via `supabase-py`, accessed with the service-role key — the API layer is the trust boundary and enforces organizer scoping itself
- PaddleOCR (PP-OCRv3, English) for screenshot text extraction
- `rapidfuzz` for fuzzy player-name matching
- WeasyPrint + Jinja2 + Matplotlib for PDF tournament reports
- PyJWT (`PyJWKClient`) for verifying Supabase Auth JWTs, supporting both legacy HS256 and current asymmetric (ES256) signing keys

**Frontend** (`apps/web`)
- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- shadcn/ui (`base-nova` style, built on [Base UI](https://base-ui.com) primitives — not Radix)
- Tailwind v4
- TanStack Query v5
- Recharts (leaderboard charts)
- Supabase Auth (`@supabase/ssr`) for session management

**Infrastructure**
- Postgres schema, RLS policies, and view-based leaderboard aggregation live in `supabase/migrations/`
- Frontend deployed on Vercel, backend deployed on Render (Docker)

## Repo layout

```
apps/
  api/                    FastAPI backend
    app/
      api/routes/         HTTP route handlers, one file per resource
      core/                config, auth (JWT verification), Supabase client, logging
      models/schemas.py   Pydantic request/response models
      ocr/                PaddleOCR wrapper + the CODM grid parser
      repositories/       Supabase table access, one class per resource
      scoring/            leaderboard/points calculation helpers
      services/           orchestration (upload pipeline, OCR pipeline, PDF reports)
    tests/
    Dockerfile
  web/                    Next.js frontend
    src/
      app/                App Router pages ((auth) and (app) route groups)
      components/         shared React components + shadcn/ui primitives (components/ui)
      lib/
        queries/          TanStack Query hooks, one file per resource
        supabase/         browser/server/middleware Supabase clients
        types.ts          TypeScript types mirroring the backend's Pydantic schemas
supabase/
  migrations/             numbered, sequential SQL migrations (schema, RLS, views)
```

## Local development

### Prerequisites
- Python 3.11 (PaddleOCR's dependencies don't yet support newer versions)
- Node.js 20+
- A Supabase project (free tier is fine) — see [supabase.com](https://supabase.com)

### Backend

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt -r requirements-dev.txt

cp .env.example .env            # then fill in your Supabase project's values
uvicorn app.main:app --reload --port 8000
```

Required `.env` values (see `.env.example`):

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase project settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase project settings → API (service_role key — never expose this to the frontend) |
| `SUPABASE_JWT_SECRET` | Supabase project settings → API (only used as a fallback for legacy HS256-signed tokens; current projects sign with an asymmetric key fetched automatically from the project's JWKS endpoint) |
| `SUPABASE_STORAGE_BUCKET` | Name of the storage bucket for screenshots (`screenshots` by default — created by `supabase/migrations/0002_storage.sql`) |
| `ALLOWED_ORIGINS` | Comma-separated list of frontend origins allowed to call the API (CORS) |
| `FUZZY_MATCH_MIN_SCORE` | Minimum similarity score (0–100) for an OCR'd name to auto-match an existing player |

**Windows only**: WeasyPrint (PDF generation) needs the GTK3 runtime's DLLs on `PATH`. Install the [GTK3 runtime for Windows](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer) and set `GTK3_RUNTIME_BIN` to its `bin` directory before starting the server. This is a no-op on Linux/Docker, where the required libraries are installed via `apt-get` in the Dockerfile instead.

### Frontend

```bash
cd apps/web
npm install
cp .env.local.example .env.local   # fill in your Supabase project's values + API URL
npm run dev
```

Required `.env.local` values:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project URL as the backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API (anon/public key — safe to expose, protected by RLS) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` for local dev |

Frontend runs at `http://localhost:3000`.

## Testing, linting, type-checking

```bash
# Backend, from apps/api (with venv active)
pytest
ruff check .
mypy app

# Frontend, from apps/web
npm run build     # includes a full TypeScript check
npm run lint
```

The OCR grid parser (`tests/test_codm_parser.py`) is tested against a real captured token dump from an actual CODM screenshot (`tests/fixtures/rank_tab_tokens.json`) rather than synthetic cases — the image itself isn't committed, only the OCR output it produces.

## Database migrations

Migrations in `supabase/migrations/` are numbered and applied in order. There's no automated migration runner wired up yet — apply each new migration's SQL via the Supabase project's SQL Editor (Dashboard → SQL Editor → paste → Run) in numeric order.

| Migration | What it does |
|---|---|
| `0001_init.sql` | Initial schema: tournaments, clans/teams/players, matches, screenshots, match_results, player_match_stats, leaderboard views, RLS policies |
| `0002_storage.sql` | Screenshot storage bucket + policies |
| `0003_remove_clans.sql` | Removes clan pre-registration — teams/players become tournament-scoped and are discovered from OCR instead |
| `0004_drop_screenshot_team.sql` | Drops `screenshots.team_id` — a screenshot can contain many teams (the RANK-tab grid), so it never belonged to just one |
| `0005_match_scoring_mode.sql` | Adds `matches.match_type` / `matches.label`; rewrites `team_leaderboard_view` to respect each match's scoring mode |

## Deployment

**Frontend (Vercel)**: connect the repo, set the project root to `apps/web`, add the three `NEXT_PUBLIC_*` env vars from the table above (with `NEXT_PUBLIC_API_URL` pointing at the deployed backend), deploy.

**Backend (Render)**: create a Docker-based Web Service pointed at `apps/api` (Dockerfile at `apps/api/Dockerfile`), add the backend env vars from the table above, plus `ENV=production`. Set `ALLOWED_ORIGINS` to the deployed frontend's URL once it exists.

### A note on Render's free tier

PaddleOCR (and the paddlepaddle deep learning framework underneath it) has real baseline memory usage — often 300–500MB+ just from loading, before the rest of the app. Render's free instance type (512MB RAM, 0.1 shared CPU) is tight for this workload:
- The **first** OCR request after a cold start also downloads PaddleOCR's model weights over the network, which is slow on a CPU-constrained free instance.
- If a screenshot upload gets stuck indefinitely at `ocr_status: "ocr"` and never resolves to `completed` or `failed`, that's very likely the container being OOM-killed mid-request — the process dies before its own error handling can write a `failed` status. Render's dashboard (Metrics tab, or an event in the Logs) will typically show an explicit out-of-memory event when this happens.
- The fix is a paid instance type with more RAM (no code changes needed) — Render lets you change this in the dashboard at any time.

## API overview

All routes except `/health` require a Supabase Auth bearer token and are scoped to tournaments owned by the authenticated organizer.

| Prefix | Resource |
|---|---|
| `POST/GET /tournaments` | Create/list tournaments |
| `GET/PATCH /tournaments/{id}` | Single tournament |
| `.../teams`, `.../teams/{id}/players` | Teams and players discovered within a tournament |
| `.../players` | All players across a tournament (cross-team) |
| `.../matches` | Matches, including scoring mode/label |
| `.../matches/{id}/results` | Per-team results breakdown for one match (placement points, kill points, performance note) |
| `.../matches/{id}/screenshots` | Upload a screenshot, poll OCR status, confirm reviewed results |
| `.../leaderboard` | Aggregated team/player leaderboards + awards |
| `.../reports/pdf` | Downloadable PDF tournament report |

Interactive API docs (Swagger UI) are available at `/docs` on a running backend instance.

## Known limitations

- The OCR grid parser is tuned against CODM's current RANK-tab layout at the aspect ratios/resolutions tested so far; a UI change on Activision's end or a very different screen resolution may need recalibration (see the tuning constants and comments at the top of `app/ocr/codm_parser.py`).
- Supabase's default email service (used for signup confirmation) is rate-limited and meant for early development, not production volume — see `apps/web/src/app/(auth)/signup/page.tsx`. For production use, either disable email confirmation (Supabase Dashboard → Authentication → Sign In / Providers → Email) or configure a real SMTP provider (Supabase Dashboard → Authentication → Settings → SMTP Settings).
- No automated migration runner — schema changes are applied manually via the Supabase SQL Editor (see [Database migrations](#database-migrations)).
