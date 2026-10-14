"""Ratings + written feedback (one 'review' per completed job) and disputes."""
from flask import Blueprint, jsonify, request

from ..auth.security import current_user, require_auth
from ..database.db import get_db, query_all, query_one, utc_now
from ..schemas import DisputeIn, ReviewIn
from ..services import job_service, matching_service, trust_service
from ..utils.errors import conflict, forbidden

bp = Blueprint("feedback", __name__, url_prefix="/api")


@bp.post("/reviews")
@require_auth("requester")
def create_review():
    body = ReviewIn.model_validate(request.get_json(silent=True) or {})
    user = current_user()
    job = job_service.get_job(body.job_id)
    if job["requester_id"] != user["id"]:
        raise forbidden("You can only review your own jobs.")
    if job["status"] != "completed":
        raise conflict("You can rate a worker only after the job is marked as completed.")
    if query_one("SELECT 1 FROM reviews WHERE job_id = ?", (body.job_id,)):
        raise conflict("You have already rated this job.")

    conn = get_db()
    before = query_one("SELECT trust_score FROM worker_profiles WHERE id = ?", (job["worker_id"],))["trust_score"]
    conn.execute(
        "INSERT INTO reviews (job_id, worker_id, requester_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (body.job_id, job["worker_id"], user["id"], body.rating, body.comment, utc_now()),
    )
    result = trust_service.recompute(job["worker_id"], "review", conn)
    conn.commit()
    if body.comment:
        matching_service.service().mark_dirty()  # review text is part of the worker document
    return jsonify({
        "ok": True,
        "trust_before": before,
        "trust_after": result.score,
        "trust": result.as_dict(),
    }), 201


@bp.get("/reviews")
@require_auth("requester")
def my_reviews():
    rows = query_all(
        """SELECT r.*, wp.name AS worker_name, wp.occupation AS worker_occupation, sr.query_text
           FROM reviews r JOIN worker_profiles wp ON wp.id = r.worker_id
           JOIN jobs j ON j.id = r.job_id JOIN service_requests sr ON sr.id = j.service_request_id
           WHERE r.requester_id = ? ORDER BY r.id DESC""",
        (current_user()["id"],),
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.post("/disputes")
@require_auth("requester")
def create_dispute():
    body = DisputeIn.model_validate(request.get_json(silent=True) or {})
    user = current_user()
    job = job_service.get_job(body.job_id)
    if job["requester_id"] != user["id"]:
        raise forbidden("You can only report disputes on your own jobs.")
    if job["status"] not in ("in_progress", "completed"):
        raise conflict("Disputes can be reported for jobs in progress or completed.")
    if query_one("SELECT 1 FROM disputes WHERE job_id = ?", (body.job_id,)):
        raise conflict("A dispute has already been reported for this job.")
    conn = get_db()
    before = query_one("SELECT trust_score FROM worker_profiles WHERE id = ?", (job["worker_id"],))["trust_score"]
    conn.execute(
        "INSERT INTO disputes (job_id, worker_id, raised_by, reason, created_at) VALUES (?, ?, ?, ?, ?)",
        (body.job_id, job["worker_id"], user["id"], body.reason, utc_now()),
    )
    result = trust_service.recompute(job["worker_id"], "dispute_reported", conn)
    conn.commit()
    return jsonify({"ok": True, "trust_before": before, "trust_after": result.score}), 201


@bp.get("/disputes")
@require_auth("requester")
def my_disputes():
    rows = query_all(
        """SELECT d.*, wp.name AS worker_name, sr.query_text FROM disputes d
           JOIN worker_profiles wp ON wp.id = d.worker_id JOIN jobs j ON j.id = d.job_id
           JOIN service_requests sr ON sr.id = j.service_request_id
           WHERE d.raised_by = ? ORDER BY d.id DESC""",
        (current_user()["id"],),
    )
    return jsonify({"items": [dict(r) for r in rows]})
