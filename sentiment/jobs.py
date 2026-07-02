"""
jobs.py — a tiny in-memory job store for long-running analyses.

Why this exists: Railway's edge proxy kills any single HTTP request at ~300s.
A real sentiment analysis (large comment set + a 12-section report + possible
continuation round-trips) runs well past that. So /analyze can't do the model
call inline — it starts a background thread, returns a job_id immediately, and
the frontend polls /analyze/status/<id>. Every HTTP request stays sub-second;
the slow work happens off-request where no proxy timeout can reach it.

⚠️  DELIBERATELY in-memory, and that is ONLY correct because the app runs with a
    SINGLE gunicorn worker (see Procfile — no --workers flag). With 2+ workers or
    2+ instances, a poll could land on a process that never ran the job and would
    see it as "not found". If this ever scales past one worker, this store must
    move to Redis or the database. This is an intentional scale-appropriate
    shortcut, not an oversight.

Also note: jobs live only in RAM, so a redeploy mid-analysis loses any in-flight
job. Acceptable at this scale; the user just re-runs.
"""

import threading
import time
import uuid

_JOBS = {}
_LOCK = threading.Lock()

# Finished jobs older than this are pruned so the dict can't grow without bound.
_TTL_SECONDS = 30 * 60


def _prune(now):
    """Drop jobs whose last update is older than the TTL. Caller holds _LOCK."""
    stale = [jid for jid, j in _JOBS.items() if now - j["updated_at"] > _TTL_SECONDS]
    for jid in stale:
        del _JOBS[jid]


def create_job(now):
    """Register a new running job and return its id. `now` is passed in because
    Date/time helpers are injected rather than called at import (keeps this testable)."""
    job_id = uuid.uuid4().hex
    with _LOCK:
        _prune(now)
        _JOBS[job_id] = {"status": "running", "result": None, "error": None,
                         "created_at": now, "updated_at": now}
    return job_id


def get_job(job_id):
    """Return a shallow copy of the job record, or None if unknown/pruned."""
    with _LOCK:
        job = _JOBS.get(job_id)
        return dict(job) if job else None


def _finish(job_id, *, result=None, error=None, now):
    with _LOCK:
        job = _JOBS.get(job_id)
        if job is None:
            return  # pruned or never existed; nothing to record
        job["status"] = "error" if error else "done"
        job["result"] = result
        job["error"] = error
        job["updated_at"] = now


def run_in_thread(job_id, fn, now_fn):
    """Run fn() on a daemon thread; store its return value as the job result, or any
    raised exception as the job error. now_fn() supplies the completion timestamp."""
    def _worker():
        try:
            result = fn()
            _finish(job_id, result=result, now=now_fn())
        except Exception as e:  # noqa: BLE001 — any failure becomes a readable job error
            _finish(job_id, error=str(e), now=now_fn())

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    return t
