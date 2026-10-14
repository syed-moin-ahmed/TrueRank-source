from flask import Blueprint, jsonify

from ..auth.security import current_user, require_auth
from ..database.db import query_all, query_one, scalar
from ..services import worker_service

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@bp.get("/requester")
@require_auth("requester")
def requester_dashboard():
    uid = current_user()["id"]
    status_counts = {r["status"]: r["n"] for r in query_all(
        "SELECT status, COUNT(*) AS n FROM service_requests WHERE requester_id = ? GROUP BY status", (uid,))}
    recent_requests = query_all(
        """SELECT sr.*, (SELECT wp.name FROM jobs j JOIN worker_profiles wp ON wp.id = j.worker_id
                         WHERE j.service_request_id = sr.id ORDER BY j.id DESC LIMIT 1) AS worker_name,
                        (SELECT j.status FROM jobs j WHERE j.service_request_id = sr.id ORDER BY j.id DESC LIMIT 1) AS job_status
           FROM service_requests sr WHERE sr.requester_id = ? ORDER BY sr.id DESC LIMIT 6""",
        (uid,),
    )
    recent_matches = query_all(
        """SELECT ml.id, ml.query_text, ml.results_returned, ml.created_at,
                  (SELECT wp.name FROM match_results mr JOIN worker_profiles wp ON wp.id = mr.worker_id
                   WHERE mr.match_log_id = ml.id AND mr.rank = 1) AS top_worker,
                  (SELECT mr.final_score FROM match_results mr WHERE mr.match_log_id = ml.id AND mr.rank = 1) AS top_score
           FROM match_logs ml WHERE ml.requester_id = ? ORDER BY ml.id DESC LIMIT 5""",
        (uid,),
    )
    recent_workers = query_all(
        """SELECT DISTINCT wp.id, wp.name, wp.gender, wp.occupation, wp.city, wp.trust_score, wp.is_verified, j.status AS job_status
           FROM jobs j JOIN worker_profiles wp ON wp.id = j.worker_id WHERE j.requester_id = ?
           ORDER BY j.id DESC LIMIT 6""",
        (uid,),
    )
    return jsonify({
        "counts": {
            "active_requests": sum(status_counts.get(s, 0) for s in ("open", "assigned", "in_progress")),
            "completed_jobs": scalar("SELECT COUNT(*) FROM jobs WHERE requester_id = ? AND status = 'completed'", (uid,)),
            "reviews_given": scalar("SELECT COUNT(*) FROM reviews WHERE requester_id = ?", (uid,)),
            "matches_run": scalar("SELECT COUNT(*) FROM match_logs WHERE requester_id = ?", (uid,)),
        },
        "request_status": status_counts,
        "recent_requests": [dict(r) for r in recent_requests],
        "recent_matches": [dict(r) for r in recent_matches],
        "recent_workers": [dict(r) for r in recent_workers],
    })


@bp.get("/worker")
@require_auth("worker")
def worker_dashboard():
    row = worker_service.get_row_for_user(current_user()["id"])
    if row is None:
        return jsonify({"needs_profile": True})
    wid = row["id"]
    job_counts = {r["status"]: r["n"] for r in query_all(
        "SELECT status, COUNT(*) AS n FROM jobs WHERE worker_id = ? GROUP BY status", (wid,))}
    history = query_all(
        "SELECT trust_score, trigger, created_at FROM trust_snapshots WHERE worker_id = ? ORDER BY id", (wid,))
    times_ranked = query_one(
        "SELECT COUNT(*) AS n, MIN(rank) AS best_rank, AVG(rank) AS avg_rank FROM match_results WHERE worker_id = ?", (wid,))
    return jsonify({
        "needs_profile": False,
        "profile": worker_service.serialize(row, detail=True),
        "completeness": worker_service.profile_completeness(row),
        "job_counts": job_counts,
        "pending_requests": job_counts.get("pending", 0),
        "active_jobs": job_counts.get("accepted", 0) + job_counts.get("in_progress", 0),
        "trust_history": [dict(r) for r in history],
        "appearances": dict(times_ranked),
    })
