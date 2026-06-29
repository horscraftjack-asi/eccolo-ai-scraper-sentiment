# YouTube Comment Scraper

Two deployable services in one repo:

```
.
├── app.py             # Flask backend (the scraper API)
├── requirements.txt   # backend deps
├── Procfile           # backend start command (gunicorn)
└── frontend/          # Vite + React + TypeScript UI
    ├── src/
    ├── package.json
    └── Procfile        # frontend start command (serve)
```

## Deploying on Railway (two services)

Create **two separate services** in the same Railway project, both pointing at this repo.

### 1. Backend service
- **Root Directory:** `/` (repo root — leave default)
- **Variables:** `YOUTUBE_API_KEY = <your key>`
- Railway auto-detects Python via `requirements.txt` and starts it with the `Procfile`:
  `gunicorn app:app --bind 0.0.0.0:$PORT`
- After deploy, note the public URL, e.g. `https://yt-backend.up.railway.app`
- Health check: `GET /health` → `{"status":"ok","key_loaded":true}`

### 2. Frontend service
- **Root Directory:** `frontend`
- **Variables:** `VITE_BACKEND_URL = https://<your-backend-url>` (no trailing slash)
  - ⚠️ This is read at **build time** — set it before the build, and redeploy if it changes.
- Railway auto-detects Node via `package.json`, runs `npm run build`, then serves
  the static `dist/` with `serve` (see `frontend/Procfile`).

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
