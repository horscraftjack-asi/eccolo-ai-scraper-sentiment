---
name: sentiment-engine
description: >
  Turns audience comments (YouTube/Meta) into a structured creator-insight report for ANY client,
  driven by a swappable "purpose" config (what the analysis is for) and a "client" config (who the
  creator is). Use whenever someone wants comments analysed for a creator by name — e.g. "run a
  sentiment analysis for James Hoffmann", "what does the audience want from the baskets video",
  "mine these comments for course ideas" — or attaches a YouTube comment CSV/JSON (especially a
  scraper export) plus a creator name and wants the usual insight report. Trigger even without the
  words "sentiment" or "skill": a comment export for a known creator plus "what came out of these"
  is the cue. Client- and purpose-agnostic — strategy lives in purposes/ and clients/, loaded by
  name. Do NOT use for the monthly Meta performance workbook; that is analytics-engine.
---

# Sentiment Engine — audience comments → creator insight (purpose- + client-configurable)

This skill turns a set of audience comments (optionally plus a video transcript) into a structured
insight report **and** a machine-readable `summary.json`. It is the sentiment half of Ziggurat's
creator flywheel (`SYSTEM_INTEGRATION_CONTRACT.md`): the scraper produces signal, this engine turns
signal into direction.

It deliberately mirrors the `analytics-engine` pattern — **stable engine core here, everything
client- or job-specific in a config file** — but with one important difference:

> Sentiment has **no mechanical half.** There is no deterministic scoring, no literal CTA detection.
> It is *all* model-driven interpretation. So "config" here doesn't mean "rules the code executes";
> it means **structured briefs that swap out what the model is trying to do and for whom.**

Two configs combine per run:

| Layer | Answers | Lives in | Example |
|---|---|---|---|
| **`purpose`** | *What is this analysis FOR? What shape is the output?* | `purposes/<purpose_id>.md` | `course-development` |
| **`client`** | *Who is this creator? Voice, audience, funnel, what they sell?* | `clients/<client_slug>.md` | `jameshoffmann` |

The only deterministic seam is **ingest + provenance**, handled by `scripts/sentiment_ingest.py`
(so the model never hand-parses a CSV or invents an ID). Everything between ingest and emit is your
judgement, governed by the two configs.

A full invocation is: **engine core + a `purpose` + a `client` + run scope (these comments, this
transcript, this scope).** See "Run scope" below.

---

## The engine core — seven universal steps (never change between runs)

Steps 1–4 and 7 are identical every run. Only **5–6** are config-driven. Do them in order.

### Step 1 — Ingest (deterministic; use the script)

Run the comments through the ingest helper first. It accepts the scraper's canonical CSV
(`SYSTEM_INTEGRATION_CONTRACT.md` §3.1), the scraper's native threaded JSON, **or** a legacy/native
CSV export with older column names — and normalises all of them to the canonical row shape, derives
a `yt:` `source_id` from the video URL when the column is missing, and assembles the provenance block.

```bash
python scripts/sentiment_ingest.py \
  --input <comments.csv|comments.json> \
  [--client-slug <slug>]      # supply when the input has none (standalone scrape) or to override
  [--source-id yt:VIDEOID]    # optional override
  --out <output-dir>
```

It writes `<stem>.normalised.csv` (canonical §3.1 columns) and `<stem>.provenance.json` (the
provenance block + ingest diagnostics). **Read those two files** — the normalised CSV is the comment
set you analyse; the provenance block is what you carry into `summary.json` at Step 7.

Do not hand-build the normalised data to route around an ingest error — that's the consistency the
script exists to protect. If the script flags missing `source_id`/`comment_id`, or the CSV looks
wrong against contract §3.1 (wrong column order, a comment with a comma/quote/newline not
round-tripping), check the input against §3.1 before proceeding — a quiet mismatch here is the one
thing that bites the handoff.

### Step 2 — Resolve configs (do this before reading a single comment)

Resolve **one purpose** and **one client**, in this order, stopping at the first hit per layer:

- **Purpose.** Take it from the request ("a *course-development* analysis", "mine these for *content
  ideas*" → `content-ideation`). Load `purposes/<purpose_id>.md`. If the request doesn't name one,
  ask which of the four purposes this run is for — don't guess. (All four are now drafted to
  maturity; `course-development` is the most battle-tested, the other three are newer and under
  active A/B refinement — pick the one whose *unit of output* matches the job.)
- **Client.** Take `client_slug` straight from the ingested provenance. Load `clients/<client_slug>.md`.
  - **Uploaded config wins.** If the person attached a `clients/*.md` or `*-sentiment-context.md`,
    use it (they're deliberately overriding).
  - If `client_slug` is **blank** (a standalone scrape) or no client config exists: **do not error.**
    Prompt for a slug, or run **client-agnostic** with a flag — the report still gets written, just
    without creator-specific colouring. Standalone never breaks; it just asks.

**Read both configs in full before writing anything.** The configs are the contract: if a config and
these instructions ever disagree on a client- or purpose-specific detail, the config wins.

### Step 3 — Classify (the universal sentiment pass)

Classify the comment set against the **ratified nine-category taxonomy**. This set is shared across
**all** purposes — purposes decide what to *do* with it, never how to classify:

1. **positive** — endorsement, praise, testimony, breakthrough ("I switched and my espresso improved").
2. **negative** — criticism, disagreement, dissatisfaction.
3. **neutral** — on-topic but no clear valence.
4. **mixed** — both positive and negative in one.
5. **question-led** — asking something directly (basic or advanced).
6. **confusion-led** — watched/read but still don't understand; may not ask directly.
7. **request-led** — asking for more, for a follow-up, for a specific thing to be made.
8. **experience-sharing** — relating their own setup, results, or community knowledge / corrections.
9. **noise** — jokes, banter, spam, off-topic (the "sweater club" comments). Acknowledge briefly; exclude from analysis.

You do **not** label every comment line by line. Work the full set, group similar comments, surface
patterns. A comment can sit in more than one category.

### Step 4 — Pattern-find

Group classified comments into **themes, question clusters, and pain points**. For each, weight by
prominence — **strong / moderate / weak** — by how repeatedly and how strongly it appears. Separate
**repeated patterns** from **isolated voices** (one dramatic comment is not a theme). `likes` is a
useful prominence signal; high-liked comments and high-liked replies carry weight.

**Do not inflate prominence, and do not invent evidence.** Label single-comment signals as isolated
voices (`weak`), never as clusters or themes. Any count you state must be defensible from the set —
prefer "recurring / several / a few / one" over invented figures. Cite evidence by **quoting real
comments verbatim**; never fabricate a "representative" comment or import specifics (model names,
products, numbers) the comments don't actually contain.

### Step 5 — Apply the purpose lens *(config-driven)*

Now the purpose config takes over. It dictates:
- the **`output_structure`** — the exact section list the Markdown report must follow,
- the **`analysis_lenses`** the purpose layers on top of the universal classification,
- the **`prioritisation_criteria`** — what makes an insight high-priority for *this* job,
- what **"so what?"** means for this purpose, and the **`anti_patterns`** the report must avoid.

Follow the purpose config's `output_structure` exactly. This is the biggest differentiator between
purposes.

### Step 6 — Apply the client context *(config-driven)*

Colour interpretation with the client config so recommendations are creator-specific, not generic:
their **voice** (how recommendations should be phrased), **audience** (sophistication, what they
respond to), **what they sell** and **funnel** (so insight connects to commercial reality),
**strategic_phase** (what matters now), and **sensitivities** (anything the analysis must respect).

The client config **must visibly shape the recommendations**. Before emitting, run this check: *if
the output could apply to any creator, the client context has not been applied — revise it* so it
references what they sell, their funnel, their phase, and respects their sensitivities.

### Step 7 — Emit both outputs

1. **The human Markdown report** — structured exactly per the active purpose's `output_structure`.
   This is the deliverable people read; it is never compromised for the machine output. Carry a few
   **verbatim** audience quotes into the report as evidence (and into the summary where used). Save as
   `Sentiment Analysis - <Video or Topic> (<purpose_id>).md`. **British English throughout.**
2. **The machine `summary.json`** — alongside the report, named `<report-stem>.summary.json`, per
   `SYSTEM_INTEGRATION_CONTRACT.md` §4. It carries the **provenance block** (from Step 1), the
   `purpose` field, and the findings made queryable: `themes`, `question_clusters`, `pain_points`,
   `gaps`, plus any `summary_json_extensions` the purpose adds. Then validate it:

   ```bash
   python scripts/validate_summary.py <report-stem>.summary.json
   ```

The Markdown is the report; the `summary.json` is the report's findings made queryable, so the
future platform can join a theme against that content's analytics performance without re-parsing prose.

---

## Run scope (per-run inputs that aren't config)

Some inputs belong to a specific run, not to either reusable config:

- **`comments_input`** — the CSV/JSON from the scraper (carries `client_slug` + `source_id`).
- **`transcript`** *(optional)* — for `course-development` and `qa-mining`, the video transcript(s).
  This is what a video's "what James covered" framing actually is: **run input, not config.** Never
  bake a specific video into a purpose config.
- **`scope`** — `per-video` (one video's comments against its transcript) or `synthesis` (combine
  several videos into one course/strategy view). This handles the per-video vs per-course grain
  distinction **without** needing separate purposes.
- **`team_notes`** *(optional)* — any human context for this run.

---

## Guardrails

- **Don't invent evidence.** When comments/transcript are thin, compress, be transparent about the
  limitation, and flag gaps — never fabricate. Still produce a useful report from what's there.
- **Don't redefine the nine-category taxonomy.** A purpose may add a *lens*; it never changes the
  classification set.
- **Don't bake a specific video into a purpose config.** Video title / "what was covered" is run input.
- **Don't break standalone use.** Missing `client_slug` → prompt or run client-agnostic; never error.
- **Match the purpose to the job.** All four purposes are drafted to maturity, but each has a
  distinct *unit of output* (course modules / a content slate / answerable questions / product
  opportunities). Running a comment set through the wrong purpose forces the wrong shape onto it —
  pick by what the audience signal actually is.
- **The Markdown report is the human deliverable** and is never degraded to serve the `summary.json`.

---

## Files in this skill

- `SKILL.md` — this engine core (the seven universal steps).
- `purposes/course-development.md` — **mature** (built from the two Hoffmann briefs; most battle-tested).
- `purposes/content-ideation.md`, `purposes/qa-mining.md`, `purposes/ip-development.md` — **mature** (drafted; under active A/B refinement).
- `clients/jameshoffmann.md` — the James Hoffmann client context (design-spec §4.2 shape).
- `scripts/sentiment_ingest.py` — deterministic ingest + provenance (canonical §3.1 / legacy CSV / native JSON).
- `scripts/validate_summary.py` — validates the emitted `summary.json` against contract §4.

---
*Engine skill v1.0 — conforms to SYSTEM_INTEGRATION_CONTRACT (shared spine §1, comments CSV §3.1, summary.json §4) and the sentiment purpose+client design spec. Agnostic core; strategy lives in the configs.*
