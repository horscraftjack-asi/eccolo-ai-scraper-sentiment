"""Prompt-assembly snapshot test.

prepare() with no ANTHROPIC_API_KEY returns the `not_enabled` stub carrying the fully
assembled prompt (the dark-launch path). This asserts the invariants the whole engine hangs
on: the literal contract §4 schema is embedded, the ratified nine-category taxonomy is present
by name, and the four sections appear in the ratified order (engine -> purpose -> client ->
run inputs, v1 feedback 2026-07-01). Fully verifiable with no API key.
"""
import os

from sentiment import ingest, run

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

NINE_CATEGORIES = [
    "positive", "negative", "neutral", "mixed", "question-led",
    "confusion-led", "request-led", "experience-sharing", "noise",
]


def _assembled_prompt(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    raw, headers = ingest.load_csv(os.path.join(FIXTURES, "comments_canonical.csv"))
    rows, source_ids, client_slug, flags = ingest.normalise_rows(raw, "", "")
    prep = run.prepare(
        rows=rows, source_ids=source_ids, client_slug=client_slug, diagnostics=flags,
        purpose_id="course-development", client_slug_input=None, scope="per-video",
    )
    assert prep["terminal"] is True  # no key -> not_enabled stub, prompt fully assembled
    assert prep["result"]["status"] == "not_enabled"
    return prep["result"]["assembled_prompt"]


def test_prompt_embeds_contract_section4_schema(monkeypatch):
    prompt = _assembled_prompt(monkeypatch)
    # The literal §4 schema (not just a reference to it) — the field names that a real run
    # improvised away when only referenced.
    assert "===SUMMARY_JSON===" in prompt
    assert "question_clusters" in prompt
    assert "pain_points" in prompt
    assert "covered_in_source" in prompt
    assert "course-development | content-ideation | ip-development | qa-mining" in prompt


def test_prompt_contains_nine_category_taxonomy(monkeypatch):
    prompt = _assembled_prompt(monkeypatch)
    for category in NINE_CATEGORIES:
        assert category in prompt, f"taxonomy category '{category}' missing from prompt"


def test_prompt_sections_in_ratified_order(monkeypatch):
    prompt = _assembled_prompt(monkeypatch)
    # NB: "## Run scope" also appears inside the engine core (SKILL.md has its own run-scope
    # heading), so anchor run-inputs to the unique "## Normalised comments" tail instead.
    i_engine = prompt.index("seven universal steps")   # engine core (SKILL.md)
    i_purpose = prompt.index("## Purpose config")
    i_client = prompt.index("## Client config")
    i_run = prompt.index("## Normalised comments")     # run inputs (the actual comment rows)
    assert i_engine < i_purpose < i_client < i_run


def test_client_config_resolved_and_applied(monkeypatch):
    """jameshoffmann is a real bundled client config — it must resolve and be injected."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    raw, headers = ingest.load_csv(os.path.join(FIXTURES, "comments_canonical.csv"))
    rows, source_ids, client_slug, flags = ingest.normalise_rows(raw, "", "")
    prep = run.prepare(
        rows=rows, source_ids=source_ids, client_slug=client_slug, diagnostics=flags,
        purpose_id="course-development", client_slug_input=None, scope="per-video",
    )
    assert prep["result"]["client_context_applied"] is True
    assert prep["result"]["client_slug_resolved"] == "jameshoffmann"
