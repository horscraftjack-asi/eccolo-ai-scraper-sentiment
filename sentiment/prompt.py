"""
prompt.py — assembles the full analysis prompt from the engine core, the chosen
purpose, the chosen client, and this run's inputs. This is the only place the
four pieces are combined, so the assembled prompt returned to the UI/API call
is always exactly what gets sent.
"""

from . import config


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
        "`client_slug`; use the values given here verbatim in the `summary.json` you emit."
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
