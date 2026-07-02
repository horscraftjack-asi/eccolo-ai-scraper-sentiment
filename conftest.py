"""Put the repo root on sys.path so tests can `from sentiment import ...`.

The sentiment modules use package-relative imports (`from . import config`), so they must be
imported as `sentiment.<module>` — exactly as app.py imports them. Placing the repo root on
sys.path lets the tests exercise the same package the app runs.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
