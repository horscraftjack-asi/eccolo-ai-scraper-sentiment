#!/usr/bin/env python3
"""
sentiment_ingest.py — the deterministic ingest seam for the sentiment engine.

The sentiment engine itself is model-driven (there is no mechanical scoring half,
unlike the analytics engine). But *getting comments into a clean, predictable shape*
and *assembling the provenance block* are deterministic, error-prone, and worth doing
in code so the model never hand-parses a CSV or invents an ID.

This script:
  1. Accepts the scraper's canonical comments CSV (SYSTEM_INTEGRATION_CONTRACT §3.1),
     OR the scraper's native threaded JSON, OR a legacy/native CSV export
     (older column names like comment_text/author_name/like_count).
  2. Normalises every input to the canonical §3.1 row shape.
  3. Derives a `yt:` source_id from a video URL when the column is absent.
  4. Assembles the provenance block (contract §1.3).
  5. Falls back gracefully for standalone scrapes (blank client_slug) — it never errors out,
     it flags what is missing so the engine can prompt.

Outputs (into --out dir):
  - <stem>.normalised.csv   canonical §3.1 columns, UTF-8, quoted, header row
  - <stem>.provenance.json  the provenance block + ingest diagnostics

Usage:
  python sentiment_ingest.py --input comments.csv \
      [--client-slug jameshoffmann] [--source-id yt:3oFV88PzEFE] \
      [--tool-version 1.0.0] [--out ./out]

Exit code is always 0 unless the input is unreadable; missing client_slug is a flag, not an error.
"""

import argparse
import csv
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone

# Canonical column order — SYSTEM_INTEGRATION_CONTRACT §3.1. Do not reorder.
CANONICAL_COLUMNS = [
    "client_slug",
    "source_id",
    "comment_id",
    "parent_id",
    "author",
    "text",
    "likes",
    "published_at",
    "is_reply",
]

# Alternate header names we tolerate from legacy / native scraper CSV exports.
# Maps a canonical column -> list of accepted source headers (first match wins).
ALIASES = {
    "comment_id": ["comment_id", "id"],
    "parent_id": ["parent_id", "parent_comment_id", "parent"],
    "author": ["author", "author_name", "username", "user"],
    "text": ["text", "comment_text", "comment", "body"],
    "likes": ["likes", "like_count", "likeCount"],
    "published_at": ["published_at", "published_time", "publishedAt", "time", "timestamp"],
    "is_reply": ["is_reply", "isReply"],
    "client_slug": ["client_slug", "clientSlug"],
    "source_id": ["source_id", "sourceId"],
}

# Columns from which we can derive a source_id if it's absent.
URL_COLUMNS = ["source_id", "video_url", "videoUrl", "comment_url", "commentUrl", "url"]

YT_ID_RE = re.compile(r"(?:v=|youtu\.be/|/watch\?[^ ]*v=)([A-Za-z0-9_-]{11})")
YT_LC_RE = re.compile(r"[?&]lc=([^&\s]+)")  # comment id lives in the lc= param of comment_url


def derive_yt_source_id(*candidates):
    """Return yt:<11charid> from the first candidate string that contains a YouTube id."""
    for c in candidates:
        if not c:
            continue
        if isinstance(c, str) and c.startswith("yt:") and len(c) == 14:
            return c
        m = YT_ID_RE.search(c or "")
        if m:
            return f"yt:{m.group(1)}"
    return ""


def derive_comment_id_from_url(url):
    """The native YouTube comment id is the lc= param of the comment_url."""
    if not url:
        return ""
    m = YT_LC_RE.search(url)
    return m.group(1) if m else ""


def pick(row, names):
    """Return the first present, non-None value among the given header names."""
    for n in names:
        if n in row and row[n] is not None:
            return row[n]
    return ""


def normalise_bool(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    s = str(v).strip().lower()
    if s in ("true", "1", "yes", "y"):
        return "true"
    if s in ("false", "0", "no", "n", ""):
        return "false"
    return "false"


def looks_canonical(headers):
    h = set(headers)
    return {"client_slug", "source_id", "text"}.issubset(h) or {"source_id", "text"}.issubset(h)


def load_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader), (reader.fieldnames or [])


def load_json(path):
    """Accept the scraper's native threaded JSON: comments[].replies[]."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = []
    prov = {}
    vid_source_id = ""
    vid_url = ""
    if isinstance(data, dict):
        prov = data.get("provenance", {}) or {}
        comments = data.get("comments", data.get("data", []))
        # The scraper's native JSON carries a top-level `video` block — derive source_id from it.
        vid = data.get("video", {}) or {}
        _vid_id = vid.get("video_id") or vid.get("id") or ""
        if _vid_id:
            vid_source_id = str(_vid_id) if str(_vid_id).startswith("yt:") else f"yt:{_vid_id}"
        vid_url = vid.get("video_url") or vid.get("url") or ""
    else:
        comments = data
    for c in comments or []:
        top_id = c.get("comment_id") or c.get("id") or ""
        rows.append({
            "comment_id": top_id,
            "parent_id": "",
            "author": c.get("author") or c.get("author_name") or "",
            "text": c.get("text") or c.get("comment_text") or "",
            "likes": c.get("likes", c.get("like_count", "")),
            "published_at": c.get("published_at") or c.get("published_time") or "",
            "is_reply": False,
            "source_id": c.get("source_id") or vid_source_id or "",
            "video_url": c.get("video_url") or vid_url or "",
            "client_slug": c.get("client_slug") or prov.get("client_slug") or "",
        })
        for r in c.get("replies", []) or []:
            rows.append({
                "comment_id": r.get("comment_id") or r.get("id") or "",
                "parent_id": top_id,
                "author": r.get("author") or r.get("author_name") or "",
                "text": r.get("text") or r.get("comment_text") or "",
                "likes": r.get("likes", r.get("like_count", "")),
                "published_at": r.get("published_at") or r.get("published_time") or "",
                "is_reply": True,
                "source_id": r.get("source_id") or vid_source_id or "",
                "video_url": r.get("video_url") or vid_url or "",
                "client_slug": r.get("client_slug") or prov.get("client_slug") or "",
            })
    return rows, prov


def normalise_rows(raw_rows, cli_client_slug, cli_source_id):
    out = []
    flags = {
        "rows_missing_source_id": 0,
        "rows_missing_comment_id": 0,
        "source_id_derived_from_url": False,
        "client_slug_source": None,
    }
    # Determine a run-level source_id if the input is single-video and lacks the column.
    run_source_id = cli_source_id or ""
    if not run_source_id:
        for r in raw_rows:
            run_source_id = derive_yt_source_id(*(r.get(c) for c in URL_COLUMNS))
            if run_source_id:
                flags["source_id_derived_from_url"] = True
                break

    # Determine client_slug precedence: CLI override > value in data > blank (standalone).
    data_client_slug = ""
    for r in raw_rows:
        v = pick(r, ALIASES["client_slug"])
        if v:
            data_client_slug = v.strip()
            break
    if cli_client_slug:
        client_slug = cli_client_slug.strip().lower()
        flags["client_slug_source"] = "cli"
    elif data_client_slug:
        client_slug = data_client_slug.lower()
        flags["client_slug_source"] = "input"
    else:
        client_slug = ""
        flags["client_slug_source"] = "missing (standalone)"

    for r in raw_rows:
        source_id = pick(r, ALIASES["source_id"]) or derive_yt_source_id(
            *(r.get(c) for c in URL_COLUMNS)
        ) or run_source_id
        if not source_id:
            flags["rows_missing_source_id"] += 1

        comment_id = pick(r, ALIASES["comment_id"])
        if not comment_id:
            comment_id = derive_comment_id_from_url(pick(r, ["comment_url", "commentUrl", "url"]))
        if not comment_id:
            flags["rows_missing_comment_id"] += 1

        parent_id = pick(r, ALIASES["parent_id"])
        is_reply_raw = pick(r, ALIASES["is_reply"])
        is_reply = normalise_bool(is_reply_raw) if is_reply_raw != "" else (
            "true" if parent_id else "false"
        )

        out.append({
            "client_slug": client_slug,
            "source_id": source_id,
            "comment_id": comment_id,
            "parent_id": parent_id,
            "author": pick(r, ALIASES["author"]),
            "text": (pick(r, ALIASES["text"]) or "").replace("\r\n", "\n"),
            "likes": pick(r, ALIASES["likes"]),
            "published_at": pick(r, ALIASES["published_at"]),
            "is_reply": is_reply,
        })

    # Collect the distinct source_ids actually present (an artifact may span several videos).
    source_ids = sorted({row["source_id"] for row in out if row["source_id"]})
    return out, source_ids, client_slug, flags


def main():
    ap = argparse.ArgumentParser(description="Normalise scraper comments + build provenance.")
    ap.add_argument("--input", required=True, help="comments CSV (canonical or legacy) or native JSON")
    ap.add_argument("--client-slug", default="", help="override / supply when input lacks one")
    ap.add_argument("--source-id", default="", help="override, e.g. yt:VIDEOID")
    ap.add_argument("--tool-version", default="1.0.0")
    ap.add_argument("--run-id", default="", help="defaults to sentiment-<UTC timestamp>")
    ap.add_argument("--out", default=".", help="output directory")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 2

    ext = os.path.splitext(args.input)[1].lower()
    try:
        if ext == ".json":
            raw_rows, _prov = load_json(args.input)
            fmt = "native-json"
        else:
            raw_rows, headers = load_csv(args.input)
            fmt = "canonical-csv (§3.1)" if looks_canonical(headers) else "legacy-csv (mapped)"
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: could not read input: {e}", file=sys.stderr)
        return 2

    rows, source_ids, client_slug, flags = normalise_rows(
        raw_rows, args.client_slug, args.source_id
    )

    os.makedirs(args.out, exist_ok=True)
    stem = os.path.splitext(os.path.basename(args.input))[0]
    norm_path = os.path.join(args.out, f"{stem}.normalised.csv")
    prov_path = os.path.join(args.out, f"{stem}.provenance.json")

    with open(norm_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CANONICAL_COLUMNS, quoting=csv.QUOTE_ALL)
        w.writeheader()
        for row in rows:
            w.writerow(row)

    run_id = args.run_id or f"sentiment-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    provenance = {
        "run_id": run_id,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tool": "sentiment",
        "tool_version": args.tool_version,
        "client_slug": client_slug,
        "source_ids": source_ids,
    }
    diagnostics = {
        "input_format_detected": fmt,
        "rows_total": len(rows),
        "replies": sum(1 for r in rows if r["is_reply"] == "true"),
        "top_level": sum(1 for r in rows if r["is_reply"] == "false"),
        **flags,
        "standalone": client_slug == "",
    }
    with open(prov_path, "w", encoding="utf-8") as f:
        json.dump({"provenance": provenance, "ingest_diagnostics": diagnostics}, f, indent=2)

    # Human-readable run summary to stdout.
    print(f"input format     : {fmt}")
    print(f"rows normalised  : {len(rows)}  ({diagnostics['top_level']} top-level, {diagnostics['replies']} replies)")
    print(f"client_slug      : {client_slug or '(MISSING — standalone; engine must prompt or run client-agnostic)'}")
    print(f"source_ids       : {', '.join(source_ids) if source_ids else '(none derived)'}")
    if flags["rows_missing_source_id"]:
        print(f"  ! {flags['rows_missing_source_id']} rows had no source_id")
    if flags["rows_missing_comment_id"]:
        print(f"  ! {flags['rows_missing_comment_id']} rows had no comment_id")
    print(f"normalised CSV   : {norm_path}")
    print(f"provenance JSON  : {prov_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
