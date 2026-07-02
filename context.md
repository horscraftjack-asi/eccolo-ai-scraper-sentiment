# context.md — eccolo-ai-scraper-sentiment

> Ground truth for architectural review and handoff. Written 2026-07-02 by direct code read, not
> from memory of past sessions. Honest about rough edges; uncertainties flagged rather than guessed.

## What this repo is

Two of the three Eccolo flywheel tools in one repo, two Railway services:

1. **Comment Scraper** — paste a YouTube URL, fetch all comments + replies + video metadata via
   the YouTube Data API v3, get threaded JSON (plus a canonical CSV export).
2. **Sentiment Analyzer** — turn those comments into a structured creator-insight report
   (Markdown + machine-readable `summary.json`), driven by swappable purpose + client configs,
   via a live Claude API call.

In the Eccolo pipeline (edit performance → source video → comment scrape → sentiment → insight),
this repo is stages 2–4. The analytics engine (`eccolo-ai-data-engine`, separate repo/deploy)
is stage 1 and links here via query-param hops — see "Unification" below.

## Architecture

- **`app.py`** (backend service, Flask, gunicorn `--timeout 900`, **no `--workers` flag = 1 worker,
  which is load-bearing** — see jobs.py). Routes:
  - `POST /scrape` — YouTube fetch; returns threaded JSON with a contract-§1.3 `provenance` block,
    `source_id` (`yt:<id>`), optional `client_slug` passthrough.
  - `GET /sentiment/options` — self-populating purpose/client dropdown data + `analyzer_enabled`
    (true iff `ANTHROPIC_API_KEY` set).
  - `POST /analyze` — multipart: purpose_id, client_slug, scope, optional transcript/team notes,
    and EITHER an uploaded comments file (CSV/JSON) OR `scrape_result` JSON (the in-app flywheel
    path, no re-upload). Ingest + config resolution + prompt assembly run inline (sub-second).
    Then: no API key → returns the `not_enabled` stub **synchronously** (503 + the fully assembled
    prompt + diagnostics); key present → starts the Claude call on a background thread and returns
    `202 {job_id}`.
  - `GET /analyze/status/<job_id>` — poll; returns running / error / the final result.
  - `GET /health`.
- **`sentiment/`** — the analyzer, vendored from the sentiment-engine skill:
  - `ingest.py` — deterministic ingest, **verbatim from the skill (don't fork)**. Accepts canonical
    §3.1 CSV, legacy CSV (header aliases), or the scraper's native threaded JSON; normalises to the
    canonical row shape; derives `yt:` source_ids from URLs; builds provenance. Also still runnable
    as a CLI (`main()` writes `.normalised.csv` + `.provenance.json`) — that's the skill-era path.
  - `validate_summary.py` — contract-§4 validator, verbatim from the skill.
  - `config.py` — PyYAML frontmatter + fenced-yaml parsing of `engine/purposes/*.md` and
    `engine/clients/*.md`. Uploaded config wins over bundled (mirrors analytics precedent).
  - `prompt.py` — the ONLY place the prompt is assembled: engine core (SKILL.md) → run-context
    override → purpose config body → client config body (+ explicit "apply it" instruction) →
    scope/transcript/team notes → provenance → normalised comment rows as JSON. Section order is
    ratified v1 feedback (2026-07-01): client context sits immediately before run inputs because
    v1's first live run ignored the client config entirely. The literal §4 `summary.json` schema
    is embedded because a real run improvised a nonconforming shape when it was only referenced.
  - `run.py` — orchestration split into `prepare()` (fast, in-request) and `run_model()` (slow,
    on the job thread). Model: `SENTIMENT_MODEL` env, default **`claude-sonnet-5`** (1M context —
    the previous 200K default overflowed on large comment sets), streaming, **thinking disabled**
    (deliberate: matches the tuned v2 output), `SENTIMENT_MAX_TOKENS` default 32000. Splits the
    response on `===SUMMARY_JSON===`, validates the JSON half in-app, flags (never stitches)
    truncation.
  - `jobs.py` — in-memory job store + daemon threads + 30-min TTL. **Deliberately in-memory and
    only correct with a single gunicorn worker** (documented loudly in the module docstring).
    Redeploy mid-analysis loses in-flight jobs; user re-runs.
  - `engine/SKILL.md` — the engine core injected verbatim into every prompt (see migration notes).
  - `engine/purposes/` — course-development, content-ideation, ip-development, qa-mining. **All
    four are `status: mature`** as of commit `b0a71db` (project docs saying "three stubbed" are
    stale). course-development is the battle-tested one; the other three are newer, under A/B
    refinement.
  - `engine/clients/` — `jameshoffmann.md`, `ninjon.md`. The Hoffmann config carries an explicit
    **slug-mismatch flag** (see below).
- **`frontend/`** (second Railway service): Vite + React + TS. `App.tsx` switches
  CommentScraper ⇄ Analyzer views; "Send to Analyzer" passes the scrape result in memory.
  `VITE_BACKEND_URL` and `VITE_ANALYTICS_URL` are baked at **build** time (the well-documented
  Railway gotcha: redeploy reuses the old build; a real rebuild is needed). CSV export in
  `CommentScraper.tsx` conforms to contract §3.1 exactly (column names, order, quoting, reply
  flattening). Analyzer polls `/analyze/status/<id>` every 3s. Recent scrapes kept in
  localStorage only.

## The sentiment migration: in-Claude skill → in-app API call

This is a real architectural shift and it is **mostly clean**, because the skill was built with a
deterministic seam (ingest + validate) that the app reuses verbatim rather than reimplementing.
What changed:

- The model call moved from "Jack runs the skill in a Claude session" to
  `run.py::_call_model()` — Anthropic SDK, streaming, in-app, gated dark until
  `ANTHROPIC_API_KEY` exists.
- Ingest/validate did NOT change — same files, imported. Prompt assembly is new (`prompt.py`) and
  is the single combination point, so what the UI shows as `assembled_prompt` is exactly what is
  sent.
- The Railway ~300s edge timeout forced the async job+poll split (`prepare`/`run_model`,
  `jobs.py`) — commit trail: sync → raise gunicorn timeout → async. The sibling analytics repo
  still runs its Claude call synchronously; this repo is the more evolved pattern.

**Where the old in-Claude path still shows through:**

- `engine/SKILL.md` is injected **verbatim** and still contains skill-era instructions: "run
  `python scripts/sentiment_ingest.py …`" (a `scripts/` path that doesn't even exist in this
  vendored copy — the files are at `sentiment/ingest.py`), "read those two files", "save as
  `Sentiment Analysis - ….md`", "then validate it: `python scripts/validate_summary.py …`".
  `prompt.py` then **countermands** these in the run-context section ("Ingest has already run…
  do not re-run `sentiment_ingest.py`… this is a single API response, not a Claude Code session
  with file-writing tools — emit both outputs in this one message"). Contradiction-by-override:
  it works, but the prompt spends tokens instructing and then cancelling, and it depends on the
  model reliably preferring the override.
- The `not_enabled` stub (no API key) returns the assembled prompt so it can be pasted into a
  Claude session manually — the old path kept alive **by design** as the dark-launch fallback,
  not a remnant.
- `ingest.py`'s CLI `main()` and `validate_summary.py`'s CLI are skill-era entry points, unused
  by the app but harmless (and still used by the skill distribution, if that's live).

**Uncertainty flagged:** whether the sentiment-engine *skill* (Cowork/Claude-skill distribution)
is still a live artifact that must keep `SKILL.md` byte-identical here. The README's "vendored
from the skill — don't fork" note suggests yes. Any cleanup of the in-Claude remnants must decide
this first: edit SKILL.md directly (if the skill is retired) vs. derive an API-mode core alongside
an untouched SKILL.md (if not).

## Contract conformance

`SYSTEM_INTEGRATION_CONTRACT.md` is referenced by section number throughout (§1.3, §3.1, §4) but
**the file is not in this repo** — it lives in Jack's AI OS vault
(`The Second Layer/projects/eccolo-ai/data-tools/`). Conformance status per its §7 checklist:
scraper — all four items done (client_slug input, source_id + raw id, provenance, §3.1 CSV
export). Sentiment — all four done (one engine + purpose configs, CSV/JSON input, report
unchanged, summary.json emitted + validated).

**The known spine break:** this repo keys Hoffmann as `jameshoffmann` (matching the contract's
§1.1 examples and its multi-word naming rule), the analytics registry — which the contract names
as the canonical slug source — currently holds `hoffmann`. The Hoffmann client config here carries
a deliberate "flag for Jack" note about it (surfaced, not silently picked). Concrete symptom: the
"View performance analytics →" hop passes `?client=jameshoffmann`, which the analytics page
doesn't recognise, so preselection silently fails for this creator.

## Known rough edges

- **No access gate on `/analyze`.** With the key set, anyone who can reach the backend spends API
  money. README explicitly defers this ("add a shared access-code gate before exposing beyond the
  team — not yet built"). CORS defaults to `*` when `FRONTEND_ORIGIN` unset.
- **No tests.** Zero test files. Ingest, prompt assembly, and the §3.1 CSV export have no
  automated verification.
- The Analyzer poll has no client-side timeout/backoff — a stuck job polls forever every 3s until
  the 30-min server TTL makes it a 404 (surfaced as "Unknown or expired job_id").
- `sentiment-analyzer-BUILD-HANDOFF.md` is referenced (README, run.py comments) but not in the
  repo — also lives in the AI OS vault.
- Analytics hop asymmetry: the analytics→here hop prefills `?url=` but never sends
  `?client_slug=` even though this app reads it (that's an analytics-side gap; noted here because
  it breaks client continuity into the scrape provenance).
- Scraper has no pagination cap — a viral video with hundreds of thousands of comments will churn
  quota and RAM until done. Fine for the roster's scale; unbounded in principle.

## Deliberate tradeoffs (do NOT "fix" these)

- **In-memory, single-worker job store** — documented loudly in `jobs.py` as scale-appropriate;
  the fix (Redis) is named for when it's ever needed. Do not add workers without moving the store.
- **Thinking disabled on the sentiment call** — output quality was tuned with no thinking;
  enabling it is a separate experiment, not a bug fix.
- **No assistant-prefill continuation on truncation** — 400s on current models; 32K budget +
  flag-not-stitch is the ratified behaviour.
- **`ingest.py` / `validate_summary.py` vendored verbatim** — consistency with the skill is the
  point; don't fork.
- **Two Railway services, one repo** (backend + static frontend); separate from the analytics
  repo entirely — ratified, links not merges.
- **`not_enabled` stub returns the full assembled prompt** — dark-launch by design.
- **All four purposes marked mature** — a deliberate promotion (commit `b0a71db`), with
  course-development still acknowledged as the most battle-tested.
- Recent-scrapes history in localStorage, not a backend table — deliberate scope hold.

## Uncertainties (flagged, not guessed)

- Live Railway state (is `ANTHROPIC_API_KEY` set in prod? `FRONTEND_ORIGIN` locked down? which
  URLs?) is not visible from the repo.
- Whether the sentiment-engine skill distribution is still live (drives the SKILL.md question).
- Whether `SENTIMENT_MAX_TOKENS`/`SENTIMENT_MODEL` are overridden in prod.
