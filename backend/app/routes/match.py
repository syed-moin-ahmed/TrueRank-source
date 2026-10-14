from flask import Blueprint, jsonify, request

from ..auth.security import current_user, require_auth
from ..database.db import query_all, query_one
from ..schemas import MatchIn
from ..services import matching_service
from ..utils.errors import forbidden, not_found

bp = Blueprint("match", __name__, url_prefix="/api/match")


@bp.post("")
@require_auth("requester", "admin")
def match():
    """Runs the full TrueRank pipeline for a natural-language service query."""
    body = MatchIn.model_validate(request.get_json(silent=True) or {})
    user = current_user()

    if body.lambda_weight is not None and user["role"] != "admin":
        raise forbidden("Only administrators can change lambda (used for the lambda experiment).")
    if body.service_request_id is not None:
        owner = query_one("SELECT requester_id FROM service_requests WHERE id = ?", (body.service_request_id,))
        if owner is None:
            raise not_found("Service request")
        if owner["requester_id"] != user["id"]:
            raise forbidden("This is not your service request.")

    result = matching_service.run_match(
        query=body.query,
        requester_id=user["id"],
        city=body.city,
        verified_only=body.verified_only,
        top_n=body.top_n,
        lambda_weight=body.lambda_weight,
        service_request_id=body.service_request_id,
    )
    return jsonify(result)


@bp.get("/history")
@require_auth("requester")
def history():
    rows = query_all(
        """SELECT id, query_text, results_returned, candidates_above_threshold, created_at, service_request_id
           FROM match_logs WHERE requester_id = ? ORDER BY id DESC LIMIT 20""",
        (current_user()["id"],),
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.get("/<int:log_id>/workers/<int:worker_id>")
@require_auth("requester", "admin")
def match_result_for_worker(log_id: int, worker_id: int):
    """The exact scores a worker received in one search, so the profile page can show the same numbers as the result card."""
    log = query_one("SELECT id, requester_id, query_text, lambda_used, created_at FROM match_logs WHERE id = ?", (log_id,))
    if log is None:
        raise not_found("Search")
    user = current_user()
    if user["role"] != "admin" and log["requester_id"] != user["id"]:
        raise forbidden("This search belongs to another account.")
    row = query_one(
        "SELECT rank, similarity, trust_score, final_score FROM match_results WHERE match_log_id = ? AND worker_id = ?",
        (log_id, worker_id),
    )
    if row is None:
        raise not_found("This worker in that search")
    return jsonify({
        "match_log_id": log["id"],
        "query_text": log["query_text"],
        "lambda": log["lambda_used"],
        "searched_at": log["created_at"],
        "rank": row["rank"],
        "similarity_score": row["similarity"],
        "trust_score": row["trust_score"],
        "final_score": row["final_score"],
    })
