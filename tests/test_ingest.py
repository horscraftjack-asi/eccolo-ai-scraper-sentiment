"""Golden-row tests for the deterministic ingest seam (sentiment/ingest.py, vendored verbatim).

The ingest normaliser is the one place a CSV/JSON becomes the canonical §3.1 row shape and
where source_id / client_slug are derived. All three accepted input formats — canonical §3.1
CSV, legacy CSV (aliased headers), and the scraper's native threaded JSON — must land on the
exact same row shape, so these assert the full normalised output row-by-row.
"""
import os

from sentiment import ingest

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _normalise_csv(name):
    raw, headers = ingest.load_csv(os.path.join(FIXTURES, name))
    rows, source_ids, client_slug, flags = ingest.normalise_rows(raw, "", "")
    return rows, source_ids, client_slug, headers


def test_canonical_csv_golden_rows():
    rows, source_ids, client_slug, headers = _normalise_csv("comments_canonical.csv")
    assert ingest.looks_canonical(headers) is True
    assert client_slug == "jameshoffmann"
    assert source_ids == ["yt:abc123DEF45"]
    assert rows == [
        {"client_slug": "jameshoffmann", "source_id": "yt:abc123DEF45", "comment_id": "c1",
         "parent_id": "", "author": "Alice", "text": "Great video", "likes": "5",
         "published_at": "2026-05-01T10:00:00Z", "is_reply": "false"},
        {"client_slug": "jameshoffmann", "source_id": "yt:abc123DEF45", "comment_id": "c2",
         "parent_id": "c1", "author": "Bob", "text": "Agreed with this", "likes": "2",
         "published_at": "2026-05-01T11:00:00Z", "is_reply": "true"},
    ]


def test_legacy_csv_golden_rows():
    """Aliased headers (id/parent/author_name/comment_text/like_count/published_time) map to
    canonical; source_id is derived from the video_url; no client_slug -> standalone (blank)."""
    rows, source_ids, client_slug, headers = _normalise_csv("comments_legacy.csv")
    assert ingest.looks_canonical(headers) is False
    assert client_slug == ""  # standalone: never errors, just blank
    assert source_ids == ["yt:ZZZ9988abcd"]
    assert rows == [
        {"client_slug": "", "source_id": "yt:ZZZ9988abcd", "comment_id": "x1",
         "parent_id": "", "author": "Carol", "text": "Nice one", "likes": "7",
         "published_at": "2026-06-01T09:00:00Z", "is_reply": "false"},
        {"client_slug": "", "source_id": "yt:ZZZ9988abcd", "comment_id": "x2",
         "parent_id": "x1", "author": "Dave", "text": "Thanks Carol", "likes": "1",
         "published_at": "2026-06-01T09:30:00Z", "is_reply": "true"},
    ]


def test_native_json_golden_rows():
    """Threaded JSON (comments[].replies[]) flattens losslessly: reply gets parent_id = the
    top-level comment_id and is_reply=true; source_id + client_slug come from the video/provenance."""
    raw_rows, prov = ingest.load_json(os.path.join(FIXTURES, "comments_native.json"))
    rows, source_ids, client_slug, flags = ingest.normalise_rows(raw_rows, "", "")
    assert client_slug == "ninjon"
    assert source_ids == ["yt:JSONvid1234"]
    assert rows == [
        {"client_slug": "ninjon", "source_id": "yt:JSONvid1234", "comment_id": "j1",
         "parent_id": "", "author": "Eve", "text": "Top tier", "likes": 9,
         "published_at": "2026-07-01T08:00:00Z", "is_reply": "false"},
        {"client_slug": "ninjon", "source_id": "yt:JSONvid1234", "comment_id": "j2",
         "parent_id": "j1", "author": "Frank", "text": "For sure", "likes": 0,
         "published_at": "2026-07-01T08:15:00Z", "is_reply": "true"},
    ]


def test_all_formats_share_canonical_column_set():
    """Whatever the input, every emitted row has exactly the canonical §3.1 keys."""
    canonical_keys = set(ingest.CANONICAL_COLUMNS)
    for name in ("comments_canonical.csv", "comments_legacy.csv"):
        rows, *_ = _normalise_csv(name)
        for row in rows:
            assert set(row) == canonical_keys
