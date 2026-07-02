"""Pass/fail tests for the contract §4 validator (sentiment/validate_summary.py, vendored verbatim).

The validator is the gate that stops a malformed summary.json reaching the platform seam.
These pin both directions: a conforming doc validates clean, and a broken one surfaces the
specific §4 violations as errors (warnings never fail).
"""
import json
import os

from sentiment import validate_summary

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def _load(name):
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return json.load(f)


def _errors(doc):
    return [m for lvl, m in validate_summary.validate(doc) if lvl == "ERROR"]


def test_valid_summary_has_no_errors():
    assert _errors(_load("summary_valid.json")) == []


def test_invalid_summary_reports_each_violation():
    errors = _errors(_load("summary_invalid.json"))
    joined = " | ".join(errors)
    # missing provenance block (§1.3)
    assert "provenance" in joined
    # purpose not one of the four valid ids
    assert "purpose" in joined
    # theme missing its required 'name'
    assert any("themes[0]" in e and "name" in e for e in errors)
    # theme prominence not in {strong, moderate, weak}
    assert any("prominence" in e for e in errors)
