from flask import Blueprint, jsonify, request

from ..auth.security import current_user, require_auth
from ..database.db import get_db, query_all, query_one, scalar, utc_now
from ..schemas import (DisputeResolveIn, LambdaExperimentIn, UserStatusIn, VerificationReviewIn,
                       WorkerAdminUpdateIn)
from ..services import matching_service, trust_service, worker_service
from ..utils.errors import bad_request, conflict, not_found

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

TRUST_BINS = 20  # same bin count as the paper's trust histogram (Fig. 5)


def _histogram(values: list[float], bins: int = TRUST_BINS) -> list[dict]:
    counts = [0] * bins
    for v in values:
        idx = min(bins - 1, max(0, int(v * bins)))
        counts[idx] += 1
    return [{"from": i / bins, "to": (i + 1) / bins, "count": c} for i, c in enumerate(counts)]


@bp.get("/stats")
@require_auth("admin")
def stats():
    sources = {r["source"]: r["n"] for r in query_all("SELECT source, COUNT(*) AS n FROM worker_profiles GROUP BY source")}
    job_status = {r["status"]: r["n"] for r in query_all("SELECT status, COUNT(*) AS n FROM jobs GROUP BY status")}
    trust_values = [r[0] for r in query_all("SELECT trust_score FROM worker_profiles")]
    activity = query_all(
        """SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM match_logs
           WHERE created_at >= date('now', '-13 days') GROUP BY day ORDER BY day"""
    )
    occupations = query_all(
        "SELECT occupation, COUNT(*) AS n FROM worker_profiles GROUP BY occupation ORDER BY n DESC, occupation LIMIT 10"
    )
    return jsonify({
        "totals": {
            "workers": sum(sources.values()),
            "registered_workers": sources.get("registered", 0),
            "service_requesters": scalar("SELECT COUNT(*) FROM users WHERE role = 'requester'"),
            "service_requests": scalar("SELECT COUNT(*) FROM service_requests"),
            "completed_jobs": job_status.get("completed", 0),
            "matches_run": scalar("SELECT COUNT(*) FROM match_logs"),
            "average_worker_rating": scalar("SELECT AVG(stat_rating_avg) FROM worker_profiles WHERE stat_rating_avg IS NOT NULL"),
            "average_trust_score": scalar("SELECT AVG(trust_score) FROM worker_profiles"),
            "open_disputes": scalar("SELECT COUNT(*) FROM disputes WHERE status = 'open'"),
            "pending_verifications": scalar("SELECT COUNT(*) FROM verification_records WHERE status = 'pending'"),
        },
        "worker_sources": sources,
        "job_status": job_status,
        "trust_distribution": _histogram(trust_values),
        "matching_activity": [dict(r) for r in activity],
        "top_occupations": [dict(r) for r in occupations],
    })


# ------------------------------------------------------------------ users
@bp.get("/users")
@require_auth("admin")
def users():
    where, params = [], []
    role = request.args.get("role")
    if role:
        where.append("role = ?")
        params.append(role)
    search = (request.args.get("search") or "").strip()
    if search:
        where.append("(name LIKE ? OR email LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]
    sql = "SELECT id, name, email, role, city, phone, gender, is_active, created_at FROM users"
    if where:
        sql += " WHERE " + " AND ".join(where)
    rows = query_all(sql + " ORDER BY id DESC LIMIT 500", params)
    return jsonify({"items": [dict(r) for r in rows]})


@bp.put("/users/<int:user_id>/status")
@require_auth("admin")
def set_user_status(user_id: int):
    body = UserStatusIn.model_validate(request.get_json(silent=True) or {})
    if user_id == current_user()["id"]:
        raise bad_request("You cannot deactivate your own admin account.")
    if query_one("SELECT 1 FROM users WHERE id = ?", (user_id,)) is None:
        raise not_found("User")
    conn = get_db()
    conn.execute("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?", (int(body.is_active), utc_now(), user_id))
    conn.commit()
    matching_service.service().mark_dirty()  # deactivated workers leave the index
    return jsonify({"ok": True})


@bp.put("/workers/<int:worker_id>")
@require_auth("admin")
def update_worker_flags(worker_id: int):
    body = WorkerAdminUpdateIn.model_validate(request.get_json(silent=True) or {})
    if worker_service.get_row(worker_id) is None:
        raise not_found("Worker")
    conn = get_db()
    if body.is_available is not None:
        conn.execute("UPDATE worker_profiles SET is_available = ?, updated_at = ? WHERE id = ?",
                     (int(body.is_available), utc_now(), worker_id))
    if body.is_verified is not None:
        conn.execute("UPDATE worker_profiles SET is_verified = ?, updated_at = ? WHERE id = ?",
                     (int(body.is_verified), utc_now(), worker_id))
    conn.commit()
    return jsonify({"worker": worker_service.serialize(worker_service.get_row(worker_id))})


# -------------------------------------------------------- reviews/disputes
@bp.get("/reviews")
@require_auth("admin")
def all_reviews():
    rows = query_all(
        """SELECT r.*, wp.name AS worker_name, wp.occupation AS worker_occupation, u.name AS requester_name
           FROM reviews r JOIN worker_profiles wp ON wp.id = r.worker_id JOIN users u ON u.id = r.requester_id
           ORDER BY r.id DESC LIMIT 500"""
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.get("/disputes")
@require_auth("admin")
def all_disputes():
    rows = query_all(
        """SELECT d.*, wp.name AS worker_name, wp.occupation AS worker_occupation, u.name AS raised_by_name,
                  sr.query_text, wp.trust_score AS worker_trust_score
           FROM disputes d JOIN worker_profiles wp ON wp.id = d.worker_id JOIN users u ON u.id = d.raised_by
           JOIN jobs j ON j.id = d.job_id JOIN service_requests sr ON sr.id = j.service_request_id
           ORDER BY (d.status = 'open') DESC, d.id DESC LIMIT 500"""
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.put("/disputes/<int:dispute_id>")
@require_auth("admin")
def resolve_dispute(dispute_id: int):
    body = DisputeResolveIn.model_validate(request.get_json(silent=True) or {})
    dispute = query_one("SELECT * FROM disputes WHERE id = ?", (dispute_id,))
    if dispute is None:
        raise not_found("Dispute")
    if dispute["status"] != "open":
        raise conflict("This dispute has already been resolved.")
    conn = get_db()
    now = utc_now()
    conn.execute(
        "UPDATE disputes SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?",
        (body.status, body.admin_note, current_user()["id"], now, dispute_id),
    )
    result = trust_service.recompute(dispute["worker_id"], f"dispute_{body.status}", conn)
    conn.commit()
    return jsonify({"ok": True, "trust_score": result.score})


# ----------------------------------------------------------- verification
@bp.get("/verifications")
@require_auth("admin")
def verifications():
    rows = query_all(
        """SELECT v.*, wp.name AS worker_name, wp.occupation AS worker_occupation, wp.city AS worker_city
           FROM verification_records v JOIN worker_profiles wp ON wp.id = v.worker_id
           ORDER BY (v.status = 'pending') DESC, v.id DESC LIMIT 500"""
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.put("/verifications/<int:record_id>")
@require_auth("admin")
def review_verification(record_id: int):
    body = VerificationReviewIn.model_validate(request.get_json(silent=True) or {})
    record = query_one("SELECT * FROM verification_records WHERE id = ?", (record_id,))
    if record is None:
        raise not_found("Verification request")
    if record["status"] != "pending":
        raise conflict("This request has already been reviewed.")
    conn = get_db()
    now = utc_now()
    conn.execute("UPDATE verification_records SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
                 (body.status, current_user()["id"], now, record_id))
    if body.status == "verified":
        conn.execute("UPDATE worker_profiles SET is_verified = 1, updated_at = ? WHERE id = ?", (now, record["worker_id"]))
    conn.commit()
    return jsonify({"ok": True})


# ------------------------------------------------------- trust / matching
@bp.get("/trust-metrics")
@require_auth("admin")
def trust_metrics():
    averages = query_one(
        """SELECT AVG(trust_ar) AS ar, AVG(trust_cr) AS cr, AVG(trust_pe) AS pe, AVG(trust_da) AS da,
                  AVG(trust_score) AS ts,
                  SUM(trust_ar IS NULL) AS ar_missing, SUM(trust_cr IS NULL) AS cr_missing,
                  SUM(trust_da IS NULL) AS da_missing, COUNT(*) AS workers
           FROM worker_profiles"""
    )
    cols = "id, name, occupation, city, trust_score, trust_ar, trust_cr, trust_pe, trust_da, source"
    top = query_all(f"SELECT {cols} FROM worker_profiles ORDER BY trust_score DESC, id LIMIT 10")
    bottom = query_all(f"SELECT {cols} FROM worker_profiles ORDER BY trust_score ASC, id LIMIT 10")
    by_occupation = query_all(
        """SELECT occupation, COUNT(*) AS workers, AVG(trust_score) AS avg_trust
           FROM worker_profiles GROUP BY occupation ORDER BY avg_trust DESC"""
    )
    recent = query_all(
        """SELECT ts.*, wp.name AS worker_name FROM trust_snapshots ts JOIN worker_profiles wp ON wp.id = ts.worker_id
           WHERE ts.trigger NOT IN ('dataset_import') ORDER BY ts.id DESC LIMIT 20"""
    )
    return jsonify({
        "averages": dict(averages),
        "config": matching_service.service().engine.config.describe(),
        "top": [dict(r) for r in top],
        "bottom": [dict(r) for r in bottom],
        "by_occupation": [dict(r) for r in by_occupation],
        "recent_updates": [dict(r) for r in recent],
        "distribution": _histogram([r[0] for r in query_all("SELECT trust_score FROM worker_profiles")]),
    })


@bp.get("/matching")
@require_auth("admin")
def matching_stats():
    summary = query_one(
        """SELECT COUNT(*) AS runs, AVG(results_returned) AS avg_results,
                  AVG(candidates_above_threshold) AS avg_candidates,
                  SUM(results_returned = 0) AS zero_result_runs
           FROM match_logs"""
    )
    top1 = query_one(
        """SELECT AVG(similarity) AS avg_similarity, AVG(trust_score) AS avg_trust, AVG(final_score) AS avg_final
           FROM match_results WHERE rank = 1"""
    )
    logs = query_all(
        """SELECT ml.*, u.name AS requester_name,
                  (SELECT wp.name FROM match_results mr JOIN worker_profiles wp ON wp.id = mr.worker_id
                   WHERE mr.match_log_id = ml.id AND mr.rank = 1) AS top_worker,
                  (SELECT mr.final_score FROM match_results mr WHERE mr.match_log_id = ml.id AND mr.rank = 1) AS top_score
           FROM match_logs ml LEFT JOIN users u ON u.id = ml.requester_id ORDER BY ml.id DESC LIMIT 50"""
    )
    selections = query_one(
        "SELECT COUNT(*) AS n, AVG(selected_rank) AS avg_rank FROM jobs WHERE selected_rank IS NOT NULL"
    )
    return jsonify({
        "summary": {**dict(summary), **dict(top1)},
        "selections": dict(selections),
        "logs": [dict(r) for r in logs],
    })


@bp.post("/lambda-experiment")
@require_auth("admin")
def lambda_experiment():
    """Same query ranked with different lambda values (not logged). Shows the effect of eq. (3)."""
    body = LambdaExperimentIn.model_validate(request.get_json(silent=True) or {})
    runs = []
    for lam in body.lambdas:
        result = matching_service.run_match(body.query, requester_id=None, top_n=body.top_n,
                                            lambda_weight=lam, log=False)
        runs.append({
            "lambda": lam,
            "formula": result["pipeline"]["ranking_formula"],
            "results": [
                {k: r[k] for k in ("rank", "worker_id", "name", "occupation", "similarity_score", "trust_score", "final_score")}
                for r in result["results"]
            ],
        })
    return jsonify({"query": body.query, "runs": runs})
