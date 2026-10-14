"""
Trust Score Engine (backend side).

Collects the behavioural evidence for a worker from the database
(dataset baseline + live ratings, jobs, endorsements and disputes),
calls ml.trust.compute_trust, and stores the result + a history snapshot.

This is the ONLY place that writes trust columns, so the feedback loop is:
    review / dispute / endorsement / job outcome  ->  recompute()  ->  new TS  ->  new ranking
"""
from __future__ import annotations

import sqlite3

from flask import current_app

from ml.trust.trust_score import TrustInputs, TrustResult, compute_trust

from ..database.db import get_db, utc_now


def _config():
    return current_app.extensions["truerank_config"]


def gather_inputs(worker_id: int, conn: sqlite3.Connection | None = None) -> TrustInputs:
    conn = conn or get_db()
    base = conn.execute(
        """SELECT base_rating_sum, base_rating_count, base_jobs_completed, base_jobs_closed,
                  base_endorsements, base_disputes
           FROM worker_profiles WHERE id = ?""",
        (worker_id,),
    ).fetchone()
    if base is None:
        raise LookupError(f"worker {worker_id} not found")

    rating_sum, rating_count = conn.execute(
        "SELECT COALESCE(SUM(rating), 0), COUNT(*) FROM reviews WHERE worker_id = ?", (worker_id,)
    ).fetchone()
    completed, withdrawn = conn.execute(
        """SELECT COALESCE(SUM(status = 'completed'), 0), COALESCE(SUM(status = 'withdrawn'), 0)
           FROM jobs WHERE worker_id = ?""",
        (worker_id,),
    ).fetchone()
    endorsements = conn.execute(
        "SELECT COUNT(*) FROM peer_endorsements WHERE endorsed_worker_id = ?", (worker_id,)
    ).fetchone()[0]
    disputes = conn.execute(
        "SELECT COUNT(*) FROM disputes WHERE worker_id = ? AND status != 'dismissed'", (worker_id,)
    ).fetchone()[0]

    jobs_completed = base["base_jobs_completed"] + completed
    return TrustInputs(
        rating_sum=float(base["base_rating_sum"] + rating_sum),
        rating_count=int(base["base_rating_count"] + rating_count),
        jobs_completed=int(jobs_completed),
        jobs_closed=int(base["base_jobs_closed"] + completed + withdrawn),
        endorsements=int(base["base_endorsements"] + endorsements),
        disputes=int(base["base_disputes"] + disputes),
    )


def compute_for_inputs(inputs: TrustInputs) -> TrustResult:
    cfg = _config()
    return compute_trust(inputs, cfg.trust_weights, cfg.pe_cap, cfg.neutral_prior)


def recompute(worker_id: int, trigger: str, conn: sqlite3.Connection | None = None) -> TrustResult:
    """Recalculate and store the Composite Trust Score. Caller commits the transaction."""
    conn = conn or get_db()
    inputs = gather_inputs(worker_id, conn)
    result = compute_for_inputs(inputs)
    ar, cr, pe, da = (result.component(k).value for k in ("AR", "CR", "PE", "DA"))
    now = utc_now()
    conn.execute(
        """UPDATE worker_profiles SET
               stat_rating_count = ?, stat_rating_avg = ?, stat_jobs_completed = ?, stat_jobs_closed = ?,
               stat_endorsements = ?, stat_disputes = ?,
               trust_ar = ?, trust_cr = ?, trust_pe = ?, trust_da = ?, trust_score = ?, trust_updated_at = ?
           WHERE id = ?""",
        (
            inputs.rating_count, inputs.average_rating, inputs.jobs_completed, inputs.jobs_closed,
            inputs.endorsements, inputs.disputes,
            ar, cr, pe, da, result.score, now, worker_id,
        ),
    )
    conn.execute(
        """INSERT INTO trust_snapshots (worker_id, ar, cr, pe, da, trust_score, trigger, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (worker_id, ar, cr, pe, da, result.score, trigger, now),
    )
    return result


def inputs_from_cached_row(row) -> TrustInputs:
    """Rebuild TrustInputs from the cached stat_* columns (used to explain a stored score)."""
    count = row["stat_rating_count"] or 0
    avg = row["stat_rating_avg"]
    return TrustInputs(
        rating_sum=float(avg * count) if (avg is not None and count) else 0.0,
        rating_count=int(count),
        jobs_completed=int(row["stat_jobs_completed"] or 0),
        jobs_closed=int(row["stat_jobs_closed"] or 0),
        endorsements=int(row["stat_endorsements"] or 0),
        disputes=int(row["stat_disputes"] or 0),
    )


def breakdown_for_row(row) -> dict:
    """Trust breakdown for API responses (same function as the stored score -> always consistent)."""
    result = compute_for_inputs(inputs_from_cached_row(row))
    cfg = _config()
    data = result.as_dict()
    data["formula"] = cfg.describe()["trust_formula"]
    data["neutral_prior"] = cfg.neutral_prior
    data["updated_at"] = row["trust_updated_at"]
    return data
