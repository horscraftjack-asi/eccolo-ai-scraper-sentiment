"""
run.py — orchestrates one sentiment analysis run: ingest -> resolve configs ->
assemble prompt -> [model call, gated] -> validate -> package.

Reuses sentiment/ingest.py and sentiment/validate_summary.py verbatim (imported,
not reimplemented) — this module is only the glue between them and the API call.
"""

import json
import os
import re
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

    # Debugging aid for the v1 issue where a client config existed but was never actually
    # injected into the prompt — surfaced explicitly rather than left to prompt inspection.
    # ingest_diagnostics travels via run_metadata so both the "not_enabled" stub and a real
    # model response carry it identically (the result UI shows a real comment count either way).
    run_metadata = {
        "client_slug_resolved": effective_client_slug,
        "client_context_applied": client_cfg is not None,
        "ingest_diagnostics": diagnostics,
    }

    api_key = os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        return {
            "status": "not_enabled",
            "reason": "no ANTHROPIC_API_KEY",
            "assembled_prompt": assembled_prompt,
            "provenance": provenance,
            "purpose_resolved": purpose_cfg["fields"] if purpose_cfg else None,
            "client_resolved": client_cfg["fields"] if client_cfg else None,
            **run_metadata,
        }

    return _call_model(assembled_prompt, provenance, purpose_id, run_metadata)


def _split_report_and_summary(raw_text):
    """Splits the model's single response on the ===SUMMARY_JSON=== marker (see prompt.py)
    and pulls the summary.json object out of its fenced code block."""
    marker = "===SUMMARY_JSON==="
    if marker not in raw_text:
        return raw_text.strip(), None
    report, _, rest = raw_text.partition(marker)
    m = re.search(r"```(?:json)?\s*(.*?)```", rest, re.DOTALL)
    if not m:
        return report.strip(), None
    try:
        return report.strip(), json.loads(m.group(1))
    except json.JSONDecodeError:
        return report.strip(), None


MAX_CONTINUATIONS = 3


def _generate_with_continuation(client, model, max_tokens, prompt_text):
    """
    Calls the model, and if it stops on max_tokens (a real course-dev report can run long),
    continues via assistant-prefill — resending the partial output as the trailing assistant
    turn so the model picks up exactly where it left off — and stitches the pieces together.
    Never silently returns a truncated report; if continuations run out, callers get a
    `truncated=True` flag instead of a silent cut-off.
    """
    messages = [{"role": "user", "content": prompt_text}]
    full_text = ""
    continuations = 0

    while True:
        response = client.messages.create(model=model, max_tokens=max_tokens, messages=messages)
        piece = "".join(block.text for block in response.content if hasattr(block, "text"))
        full_text += piece

        if response.stop_reason != "max_tokens" or continuations >= MAX_CONTINUATIONS:
            return full_text, response.stop_reason == "max_tokens", continuations

        continuations += 1
        messages = [
            {"role": "user", "content": prompt_text},
            {"role": "assistant", "content": full_text},
        ]


def _call_model(assembled_prompt, provenance, purpose_id, run_metadata):
    """The live path — dark until ANTHROPIC_API_KEY exists. Mirrors the analytics /insights stub."""
    import anthropic

    model = os.environ.get("SENTIMENT_MODEL", "claude-sonnet-4-5")
    max_tokens = int(os.environ.get("SENTIMENT_MAX_TOKENS", "16000"))

    client = anthropic.Anthropic()
    raw_text, truncated, continuations = _generate_with_continuation(
        client, model, max_tokens, assembled_prompt
    )
    report_markdown, summary_json = _split_report_and_summary(raw_text)

    result = {
        "status": "ok",
        "report_markdown": report_markdown,
        "provenance": provenance,
        "purpose": purpose_id,
        "summary_json": summary_json,
        "truncated": truncated,
        "continuations": continuations,
        **run_metadata,
    }
    if summary_json is not None:
        result["validation"] = validate(summary_json)
    return result


def validate(summary_json_doc):
    msgs = validate_summary.validate(summary_json_doc)
    errors = [m for lvl, m in msgs if lvl == "ERROR"]
    warnings = [m for lvl, m in msgs if lvl == "WARN"]
    return {"valid": not errors, "errors": errors, "warnings": warnings}
