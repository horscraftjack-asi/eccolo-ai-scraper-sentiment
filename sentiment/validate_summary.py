#!/usr/bin/env python3
"""
validate_summary.py — check a sentiment summary.json against SYSTEM_INTEGRATION_CONTRACT §4.

The summary.json content (themes / question_clusters / pain_points / gaps) is written by the
engine as model judgement — this script does NOT generate it. It only validates that what the
engine wrote conforms to the contract shape before delivery, so a malformed side-output never
reaches the platform seam.

Usage:
  python validate_summary.py path/to/report.summary.json
Exit 0 = valid; exit 1 = problems (printed). Warnings don't fail.
"""

import json
import sys

VALID_PURPOSES = {"course-development", "content-ideation", "ip-development", "qa-mining"}
PROV_REQUIRED = {"run_id", "generated_at", "tool", "tool_version", "client_slug", "source_ids"}
PROMINENCE = {"strong", "moderate", "weak"}


def err(msgs, m):
    msgs.append(("ERROR", m))


def warn(msgs, m):
    msgs.append(("WARN", m))


def validate(doc):
    msgs = []

    prov = doc.get("provenance")
    if not isinstance(prov, dict):
        err(msgs, "missing 'provenance' block (contract §1.3)")
    else:
        missing = PROV_REQUIRED - set(prov)
        if missing:
            err(msgs, f"provenance missing keys: {sorted(missing)}")
        if prov.get("tool") != "sentiment":
            warn(msgs, f"provenance.tool is '{prov.get('tool')}', expected 'sentiment'")
        if not isinstance(prov.get("source_ids"), list):
            err(msgs, "provenance.source_ids must be a list")
        elif not prov.get("source_ids"):
            warn(msgs, "provenance.source_ids is empty")
        if prov.get("client_slug", "x") == "":
            warn(msgs, "provenance.client_slug is blank (standalone run) — acceptable, just noting")

    purpose = doc.get("purpose")
    if purpose not in VALID_PURPOSES:
        err(msgs, f"'purpose' is '{purpose}', must be one of {sorted(VALID_PURPOSES)}")

    # themes
    themes = doc.get("themes", [])
    if not isinstance(themes, list):
        err(msgs, "'themes' must be a list")
    else:
        for i, t in enumerate(themes):
            if "name" not in t:
                err(msgs, f"themes[{i}] missing 'name'")
            if t.get("prominence") not in PROMINENCE:
                err(msgs, f"themes[{i}].prominence '{t.get('prominence')}' not in {sorted(PROMINENCE)}")
            if not isinstance(t.get("source_ids", []), list):
                err(msgs, f"themes[{i}].source_ids must be a list")

    # question_clusters
    for i, q in enumerate(doc.get("question_clusters", [])):
        if "name" not in q:
            err(msgs, f"question_clusters[{i}] missing 'name'")
        if q.get("covered_in_source") not in {"fully", "partly", "not", None}:
            warn(msgs, f"question_clusters[{i}].covered_in_source '{q.get('covered_in_source')}' unexpected")

    # pain_points
    for i, p in enumerate(doc.get("pain_points", [])):
        if "name" not in p:
            err(msgs, f"pain_points[{i}] missing 'name'")
        if p.get("prominence") and p["prominence"] not in PROMINENCE:
            warn(msgs, f"pain_points[{i}].prominence '{p['prominence']}' not in {sorted(PROMINENCE)}")

    # gaps
    for i, g in enumerate(doc.get("gaps", [])):
        if "name" not in g:
            err(msgs, f"gaps[{i}] missing 'name'")

    return msgs


def main():
    if len(sys.argv) != 2:
        print("usage: python validate_summary.py <summary.json>", file=sys.stderr)
        return 1
    try:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            doc = json.load(f)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: cannot read/parse JSON: {e}", file=sys.stderr)
        return 1

    msgs = validate(doc)
    errors = [m for lvl, m in msgs if lvl == "ERROR"]
    warns = [m for lvl, m in msgs if lvl == "WARN"]
    for m in errors:
        print(f"ERROR: {m}")
    for m in warns:
        print(f"WARN:  {m}")
    if errors:
        print(f"\nINVALID — {len(errors)} error(s), {len(warns)} warning(s).")
        return 1
    print(f"VALID — conforms to contract §4 ({len(warns)} warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
