"""
config.py — loads purpose and client configs for the sentiment engine.

Each config is a Markdown file with YAML frontmatter (status, ids) and a fenced
```yaml block carrying the fields the dropdowns/prompt need. Parsing is just
enough to self-populate the UI and resolve a config by id/slug — the body text
after the yaml block is the actual brief injected into the prompt verbatim.
"""

import glob
import os
import re

import yaml

ENGINE_DIR = os.path.join(os.path.dirname(__file__), "engine")
PURPOSES_DIR = os.path.join(ENGINE_DIR, "purposes")
CLIENTS_DIR = os.path.join(ENGINE_DIR, "clients")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
YAML_BLOCK_RE = re.compile(r"```yaml\n(.*?)\n```", re.DOTALL)


def _parse_config_file(path):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    frontmatter = {}
    m = FRONTMATTER_RE.match(text)
    if m:
        frontmatter = yaml.safe_load(m.group(1)) or {}

    fields = {}
    m = YAML_BLOCK_RE.search(text)
    if m:
        fields = yaml.safe_load(m.group(1)) or {}

    return {"path": path, "frontmatter": frontmatter, "fields": fields, "body": text}


def available_purposes():
    """List bundled purposes for the dropdown, ordered mature-first then alphabetically."""
    purposes = []
    for path in sorted(glob.glob(os.path.join(PURPOSES_DIR, "*.md"))):
        cfg = _parse_config_file(path)
        purposes.append({
            "purpose_id": cfg["fields"].get("purpose_id") or cfg["frontmatter"].get("purpose_id"),
            "display_name": cfg["fields"].get("display_name"),
            "one_line": cfg["fields"].get("one_line"),
            "status": cfg["frontmatter"].get("status", "stub"),
            "path": path,
        })
    purposes.sort(key=lambda p: (p["status"] != "mature", p["display_name"] or ""))
    return purposes


def available_clients():
    """List bundled clients for the dropdown, so adding one is drop-a-file + redeploy."""
    clients = []
    for path in sorted(glob.glob(os.path.join(CLIENTS_DIR, "*.md"))):
        cfg = _parse_config_file(path)
        clients.append({
            "client_slug": cfg["fields"].get("client_slug"),
            "client_name": cfg["fields"].get("client_name"),
            "path": path,
        })
    return clients


def load_purpose(purpose_id, uploaded_path=None):
    """Uploaded config wins over bundled, mirroring the analytics/skill precedent."""
    if uploaded_path:
        return _parse_config_file(uploaded_path)
    for p in available_purposes():
        if p["purpose_id"] == purpose_id:
            return _parse_config_file(p["path"])
    return None


def load_client(client_slug, uploaded_path=None):
    if uploaded_path:
        return _parse_config_file(uploaded_path)
    if not client_slug:
        return None
    for c in available_clients():
        if c["client_slug"] == client_slug:
            return _parse_config_file(c["path"])
    return None


def load_engine_core():
    with open(os.path.join(ENGINE_DIR, "SKILL.md"), "r", encoding="utf-8") as f:
        return f.read()
