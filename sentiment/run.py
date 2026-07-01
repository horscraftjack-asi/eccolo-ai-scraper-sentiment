"""
run.py — orchestrates one sentiment analysis run: ingest -> resolve configs ->
assemble prompt -> [model call, gated] -> validate -> package.

Reuses sentiment/ingest.py and sentiment/validate_summary.py verbatim (imported,
not reimplemented) — this module is only the glue between them and the API call.
"""

import json
import os
import tempfile
from datetime import datetime, timezone

from . import config as cfgmod
from . import ingest
from . import prompt as promptmod
from . import validate_summary

TOOL_VERSION = "1.0.0"


class AnalysisInputError(Exception):
    pass


def _run_ingest(input_path, client_slug_override, source_id_override):
    """Runs the vendored ingest logic on a file path, returns (rows, source_ids, client_slug, diagnostics)."""
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".json":
        raw_rows, _prov = ingest.load_json(input_path)
        fmt = "native-json"
    else:
        raw_rows, headers = ingest.load_csv(input_path)
        fmt = "canonical-csv (§3.1)" if ingest.looks_canonical(headers) else "legacy-csv (mapped)"

    rows, source_ids, client_slug, flags = ingest.normalise_rows(
        raw_rows, client_slug_override or "", source_id_override or ""
    )
    diagnostics = {
        "input_format_detected": fmt,
        "rows_total": len(rows),
        "replies": sum(1 for r in rows if r["is_reply"] == "true"),
        "top_level": sum(1 for r in rows if r["is_reply"] == "false"),
        **flags,
        "standalone": client_slug == "",
    }
    return rows, source_ids, client_slug, diagnostics


def ingest_from_upload(file_storage, client_slug_override=None, source_id_override=None):
    """Ingest an uploaded §3.1 CSV or native JSON (werkzeug FileStorage)."""
    suffix = os.path.splitext(file_storage.filename or "")[1] or ".csv"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        file_storage.save(tmp.name)
        tmp_path = tmp.name
    try:
        return _run_ingest(tmp_path, client_slug_override, source_id_override)
    finally:
        os.unlink(tmp_path)


def ingest_from_scrape_result(scrape_result, client_slug_override=None, source_id_override=None):
    """Ingest an in-app scrape result (the flywheel path) — same normaliser, no re-upload."""
    with tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False, encoding="utf-8") as tmp:
        json.dump(scrape_result, tmp)
        tmp_path = tmp.name
    try:
        return _run_ingest(tmp_path, client_slug_override, source_id_override)
    finally:
        os.unlink(tmp_path)


def build_provenance(client_slug, source_ids, run_id=None):
    return {
        "run_id": run_id or f"sentiment-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tool": "sentiment",
        "tool_version": TOOL_VERSION,
        "client_slug": client_slug or None,
        "source_ids": source_ids,
    }


def analyze(*, rows, source_ids, client_slug, diagnostics, purpose_id, client_slug_input,
            scope, transcript=None, team_notes=None, uploaded_purpose_path=None,
            uploaded_client_path=None):
    """
    Runs configs resolution + prompt assembly, then either calls the model (if
    ANTHROPIC_API_KEY is set) or returns the "not enabled" stub. Always returns a
    dict describing what happened — the caller (Flask route) decides the HTTP status.
    """
    purpose_cfg = cfgmod.load_purpose(purpose_id, uploaded_path=uploaded_purpose_path)
    # client_slug from ingested data wins unless the caller explicitly supplied one.
    effective_client_slug = client_slug or client_slug_input or None
    client_cfg = cfgmod.load_client(effective_client_slug, uploaded_path=uploaded_client_path)

    provenance = build_provenance(effective_client_slug, source_ids)

    assembled_prompt = promptmod.build_prompt(
        purpose_cfg, client_cfg, rows, provenance, scope,
        transcript=transcript, team_notes=team_notes,
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        return {
            "status": "not_enabled",
            "reason": "no ANTHROPIC_API_KEY",
            "assembled_prompt": assembled_prompt,
            "ingest_diagnostics": diagnostics,
            "provenance": provenance,
            "purpose_resolved": purpose_cfg["fields"] if purpose_cfg else None,
            "client_resolved": client_cfg["fields"] if client_cfg else None,
        }

    return _call_model(assembled_prompt, provenance, purpose_id)


def _call_model(assembled_prompt, provenance, purpose_id):
    """The live path — dark until ANTHROPIC_API_KEY exists. Mirrors the analytics /insights stub."""
    import anthropic

    model = os.environ.get("SENTIMENT_MODEL", "claude-sonnet-4-5")
    max_tokens = int(os.environ.get("SENTIMENT_MAX_TOKENS", "8192"))

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": assembled_prompt}],
    )
    # Expected: the model returns the Markdown report and a fenced ```json summary.json
    # block. Parsing/validation of that shape is TODO for when the key lands and a real
    # response can be inspected — left unimplemented rather than guessed at.
    raw_text = "".join(block.text for block in response.content if hasattr(block, "text"))

    return {
        "status": "ok",
        "report_markdown": raw_text,
        "provenance": provenance,
        "purpose": purpose_id,
    }


def validate(summary_json_doc):
    msgs = validate_summary.validate(summary_json_doc)
    errors = [m for lvl, m in msgs if lvl == "ERROR"]
    warnings = [m for lvl, m in msgs if lvl == "WARN"]
    return {"valid": not errors, "errors": errors, "warnings": warnings}
