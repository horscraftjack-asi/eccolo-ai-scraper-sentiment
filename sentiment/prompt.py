"""
prompt.py — assembles the full analysis prompt from the engine core, the chosen
purpose, the chosen client, and this run's inputs. This is the only place the
four pieces are combined, so the assembled prompt returned to the UI/API call
is always exactly what gets sent.
"""

from . import config

# The literal contract §4 shape. Referencing "contract §4" in prose isn't enough — the model
# needs the exact schema in front of it, including the field name ("name", not "theme"/"gap"/etc)
# on every array item, or it will improvise a plausible-but-nonconforming shape (observed in
# testing: a real run produced valid-looking JSON that used "gap"/"pain_point"/"theme" instead of
# "name" and dropped the nested "provenance" object entirely).
SUMMARY_JSON_SCHEMA = """```json
{
  "provenance": { "run_id": "...", "generated_at": "...", "tool": "sentiment", "tool_version": "...", "client_slug": "... or null", "source_ids": ["yt:..."] },
  "purpose": "course-development | content-ideation | ip-development | qa-mining",
  "themes": [
    { "name": "Grind consistency", "prominence": "strong|moderate|weak", "source_ids": ["yt:..."] }
  ],
  "question_clusters": [
    { "name": "What basket for my machine?", "covered_in_source": "fully|partly|not", "course_relevance": "module|section|demo" }
  ],
  "pain_points": [
    { "name": "Flow rate changed unexplained", "prominence": "strong|moderate|weak", "course_response": "demonstration" }
  ],
  "gaps": [
    { "name": "Pressurised baskets barely covered", "opportunity": "course-only content" }
  ]
}
```"""


def build_prompt(purpose_cfg, client_cfg, normalised_rows, provenance, scope,
                  transcript=None, team_notes=None):
    """
    purpose_cfg / client_cfg: dicts from config.load_purpose / config.load_client (or None).
    normalised_rows: list of dicts in the canonical §3.1 row shape (from sentiment/ingest.py).
    provenance: the provenance block dict for this run.
    scope: "per-video" | "synthesis".
    """
    sections = [config.load_engine_core()]

    sections.append(
        "\n---\n\n"
        "## Run context — this invocation\n\n"
        "Ingest has already run (deterministically, outside this prompt). The comments below "
        "are already normalised to the canonical §3.1 row shape and the provenance block is "
        "already assembled — do not re-run `sentiment_ingest.py` or re-derive `source_id` / "
        "`client_slug`; use the values given here verbatim in the `summary.json` you emit.\n\n"
        "This is a single API response, not a Claude Code session with file-writing tools — "
        "emit both Step 7 outputs in this one message: first the full Markdown report, then a "
        "line containing only `===SUMMARY_JSON===`, then a fenced ```json code block containing "
        "the `summary.json` object. Match this shape **exactly** — every array item's identifying "
        "field is named `name` (not `theme`/`gap`/`pain_point`/etc), and `provenance` is a nested "
        "object copied verbatim from the block given below, not flattened into top-level keys:\n\n"
        f"{SUMMARY_JSON_SCHEMA}\n\n"
        "A purpose config may define `summary_json_extensions` — add those as additional keys "
        "alongside the ones above, never in place of them. Nothing after the closing code fence."
    )

    if purpose_cfg:
        sections.append("\n---\n\n## Purpose config\n\n" + purpose_cfg["body"])
    else:
        sections.append(
            "\n---\n\n## Purpose config\n\nNo purpose was resolved for this run — ask which of "
            "the four purposes this run is for rather than guessing."
        )

    if client_cfg:
        sections.append("\n---\n\n## Client config\n\n" + client_cfg["body"])
    else:
        sections.append(
            "\n---\n\n## Client config\n\nNo client_slug was available for this run (standalone "
            "scrape). Run client-agnostic per the engine core's guardrails — do not error, do not "
            "invent a client."
        )

    sections.append(f"\n---\n\n## Run scope\n\n`scope`: {scope}")
    if transcript:
        sections.append(f"\n### Transcript\n\n{transcript}")
    if team_notes:
        sections.append(f"\n### Team notes\n\n{team_notes}")

    sections.append(
        f"\n---\n\n## Provenance (carry verbatim into summary.json)\n\n"
        f"```json\n{_json_dump(provenance)}\n```"
    )

    sections.append(
        f"\n---\n\n## Normalised comments ({len(normalised_rows)} rows, canonical §3.1 shape)\n\n"
        f"```json\n{_json_dump(normalised_rows)}\n```"
    )

    return "\n".join(sections)


def _json_dump(obj):
    import json
    return json.dumps(obj, indent=2, ensure_ascii=False)
