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

    Section order is deliberate (v1 feedback, 2026-07-01): engine core -> purpose brief ->
    client context -> run inputs. Client context sits immediately before the run inputs, with
    an explicit apply-it instruction, because v1's first live run produced a generic report
    that never referenced the client config at all despite one being loaded.
    """
    sections = [config.load_engine_core()]

    # The engine core (CORE.md) now carries the ingest-already-ran and emit-both-outputs
    # instructions. This section keeps only what the core can't: the literal §4 schema in front of
    # the model (a real run improvised a nonconforming shape when it was only referenced), plus the
    # single-API-response framing tying it to this run.
    sections.append(
        "\n---\n\n"
        "## summary.json — exact §4 schema for this run\n\n"
        "Single API response: emit the Markdown report, then a line containing only "
        "`===SUMMARY_JSON===`, then one fenced ```json block matching this shape **exactly** — "
        "every array item's identifying field is named `name` (not `theme`/`gap`/`pain_point`/etc), "
        "and `provenance` is a nested object copied verbatim from the block given below, not "
        "flattened into top-level keys. Nothing after the closing code fence:\n\n"
        f"{SUMMARY_JSON_SCHEMA}\n\n"
        "A purpose config may define `summary_json_extensions` — add those as additional keys "
        "alongside the ones above, never in place of them."
    )

    if purpose_cfg:
        sections.append("\n---\n\n## Purpose config\n\n" + purpose_cfg["body"])
    else:
        sections.append(
            "\n---\n\n## Purpose config\n\nNo purpose was resolved for this run — ask which of "
            "the four purposes this run is for rather than guessing."
        )

    if client_cfg:
        sections.append(
            "\n---\n\n## Client config\n\n" + client_cfg["body"] +
            "\n\n**Apply the client context above to every recommendation.** If a recommendation "
            "could apply to any creator, it has not used the client context — revise it before "
            "emitting. Reference what this client sells, their funnel, their strategic phase, and "
            "respect their sensitivities, by name, in the report."
        )
    else:
        sections.append(
            "\n---\n\n## Client config\n\nNo client_slug was available for this run (standalone "
            "scrape). Run client-agnostic per the engine core's guardrails — do not error, do not "
            "invent a client."
        )

    transcript_note = (
        f"A transcript was provided for this run — use it for §8 (transcript-to-content mapping)."
        if transcript else
        "No transcript was provided for this run. Do not skip §8 silently — state plainly that it "
        "could not be produced without a transcript and why, per the engine core's guidance."
    )
    sections.append(f"\n---\n\n## Run scope\n\n`scope`: {scope}\n\n{transcript_note}")
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
