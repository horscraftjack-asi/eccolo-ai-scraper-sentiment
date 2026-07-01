# YouTube Comment Scraper + Sentiment Analyzer

One flywheel app, two deployable services in one repo:

```
.
├── app.py             # Flask backend — /scrape, /analyze, /sentiment/options, /health
├── requirements.txt   # backend deps
├── Procfile           # backend start command (gunicorn)
├── sentiment/         # the Sentiment Analyzer — vendored from the sentiment-engine skill
│   ├── ingest.py          # deterministic ingest (verbatim from the skill — don't fork)
│   ├── validate_summary.py # summary.json validator (verbatim from the skill)
│   ├── config.py          # loads purpose/client configs, self-populates dropdowns
│   ├── prompt.py           # assembles engine core + purpose + client + run inputs
│   ├── run.py              # orchestrates ingest -> prompt -> [model call] -> validate
│   └── engine/
│       ├── SKILL.md            # engine core (the seven universal steps)
│       ├── purposes/*.md       # course-development, content-ideation, ip-development, qa-mining — all mature
│       └── clients/*.md        # jameshoffmann, ninjon
└── frontend/          # Vite + React + TypeScript UI
    ├── src/
    │   ├── CommentScraper.tsx  # scrape view + "Send to Analyzer"
    │   ├── Analyzer.tsx        # analyzer view
    │   └── App.tsx             # switches between the two
    ├── package.json
    └── Procfile        # frontend start command (serve)
```

## The Sentiment Analyzer

After a scrape, "Send to Analyzer" carries the result straight into `/analyze` in memory — no
re-upload. Manual upload of a §3.1 comments CSV or the scraper's native JSON also works
standalone (via "Or analyze an existing comments export"). Either path: pick a purpose + a
client, run, get a Markdown report + `summary.json` back.

**Adding a purpose or client is drop-a-file + redeploy** — no code change:
- New purpose: add `sentiment/engine/purposes/<purpose_id>.md` (see an existing one for the
  frontmatter + fenced ```yaml block shape). Mark `status: stub` until it's proven.
- New client: add `sentiment/engine/clients/<client_slug>.md` the same way.
- Both dropdowns self-populate from these folders (`GET /sentiment/options`).

**Going live (the model call is currently gated dark):**
1. Add `ANTHROPIC_API_KEY` to the backend service's Railway variables (and confirm
   `SENTIMENT_MODEL` / `SENTIMENT_MAX_TOKENS` if you want non-defaults).
2. That's it — `sentiment/run.py::analyze()` checks `os.environ.get("ANTHROPIC_API_KEY")` and
   switches from the `not_enabled` stub to the real call automatically. No code change needed.
3. **Before exposing this to anyone outside the team:** the live endpoint spends API money per
   run — add a shared access-code gate in front of `/analyze` first (not yet built; see
   `sentiment-analyzer-BUILD-HANDOFF.md` §12).

## Deploying on Railway (two services)

Create **two separate services** in the same Railway project, both pointing at this repo.

### 1. Backend service
- **Root Directory:** `/` (repo root — leave default)
- **Variables:** `YOUTUBE_API_KEY = <your key>` (required); `ANTHROPIC_API_KEY` /
  `SENTIMENT_MODEL` / `SENTIMENT_MAX_TOKENS` (optional — analyzer stays stubbed until
  `ANTHROPIC_API_KEY` is set)
- Railway auto-detects Python via `requirements.txt` and starts it with the `Procfile`:
  `gunicorn app:app --bind 0.0.0.0:$PORT`
- After deploy, note the public URL, e.g. `https://yt-backend.up.railway.app`
- Health check: `GET /health` → `{"status":"ok","key_loaded":true}`

### 2. Frontend service
- **Root Directory:** `frontend`
- **Variables:** `VITE_BACKEND_URL = https://<your-backend-url>` (no trailing slash);
  `VITE_ANALYTICS_URL = https://<analytics-engine-url>` (optional — see below)
  - ⚠️ Both are read at **build time** — set them before the build, and redeploy if they change.
- Railway auto-detects Node via `package.json`, runs `npm run build`, then serves
  the static `dist/` with `serve` (see `frontend/Procfile`).

## The flywheel cross-link to Analytics

This app and `eccolo-ai-data-engine` are **separate repos, separate Railway deploys, separate
URLs** — deliberately not merged (a bug in one shouldn't take the other down). They're tied together
at the UI layer with plain links carrying context via query params, not a shared frontend:

- **Permanent nav:** an "Analytics ↗" link sits in the header on both the Scraper and Analyzer
  views at all times (once `VITE_ANALYTICS_URL` is set) — not tied to any run, just a plain jump
  to `<analytics-url>/`.
- **Contextual hop, this app → Analytics:** after a scrape or a sentiment run, "View performance
  analytics →" opens `<analytics-url>/?client=<slug>` in a new tab, preselecting that client's
  dropdown there (silently falls back to no preselection if the slug isn't recognised).
- **Contextual hop, Analytics → this app:** built on the analytics-engine side (`SCRAPER_URL` env
  var) — its "Scrape top video →" button only appears when the top-ranked post in that run is
  specifically a YouTube post, and opens `<this-app-url>/?url=<video-url>`. This app reads `?url=`
  (and `?client_slug=`) on load and prefills the scrape form accordingly.

Neither hop is required — unset either env var and that link just doesn't appear. Standalone use of
either app is never broken by the other being down or unconfigured.

## Local development

```bash
# Terminal 1 — backend
export YOUTUBE_API_KEY=your_key
pip install -r requirements.txt
python app.py                      # http://localhost:5000

# Terminal 2 — frontend
cd frontend
cp .env.example .env               # VITE_BACKEND_URL defaults to localhost:5000
npm install
npm run dev                        # http://localhost:5173
```
