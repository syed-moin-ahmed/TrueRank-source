from flask import Blueprint, jsonify, request

from ..auth.security import current_user, require_auth
from ..database.db import get_db, query_all, query_one, utc_now
from ..schemas import ServiceRequestIn
from ..utils.errors import conflict, forbidden, not_found

bp = Blueprint("service_requests", __name__, url_prefix="/api/service-requests")

JOB_SUMMARY_SQL = """
    SELECT j.*, wp.name AS worker_name, wp.occupation AS worker_occupation, wp.city AS worker_city,
           wp.trust_score AS worker_trust_score, wp.user_id AS worker_user_id,
           (SELECT rating FROM reviews r WHERE r.job_id = j.id) AS review_rating,
           (SELECT comment FROM reviews r WHERE r.job_id = j.id) AS review_comment,
           (SELECT status FROM disputes d WHERE d.job_id = j.id) AS dispute_status
    FROM jobs j JOIN worker_profiles wp ON wp.id = j.worker_id
"""


def _job_dict(row) -> dict:
    data = dict(row)
    data["auto_accepted"] = bool(data["auto_accepted"])
    data["worker_has_account"] = data.pop("worker_user_id") is not None
    return data


def _get_owned(request_id: int):
    row = query_one("SELECT * FROM service_requests WHERE id = ?", (request_id,))
    if row is None:
        raise not_found("Service request")
    user = current_user()
    if user["role"] != "admin" and row["requester_id"] != user["id"]:
        raise forbidden("This is not your service request.")
    return row


@bp.post("")
@require_auth("requester")
def create_request():
    body = ServiceRequestIn.model_validate(request.get_json(silent=True) or {})
    now = utc_now()
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO service_requests (requester_id, query_text, city, status, created_at, updated_at) VALUES (?, ?, ?, 'open', ?, ?)",
        (current_user()["id"], body.query_text, body.city, now, now),
    )
    conn.commit()
    return jsonify({"service_request": dict(query_one("SELECT * FROM service_requests WHERE id = ?", (cur.lastrowid,)))}), 201


@bp.get("")
@require_auth("requester", "admin")
def list_requests():
    user = current_user()
    params: list = []
    where = []
    if user["role"] == "requester":
        where.append("sr.requester_id = ?")
        params.append(user["id"])
    status = request.args.get("status")
    if status:
        where.append("sr.status = ?")
        params.append(status)
    sql = """SELECT sr.*, u.name AS requester_name FROM service_requests sr JOIN users u ON u.id = sr.requester_id"""
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY sr.id DESC LIMIT 300"
    rows = query_all(sql, params)

    ids = [r["id"] for r in rows]
    current_jobs: dict[int, dict] = {}
    if ids:
        marks = ",".join("?" * len(ids))
        for j in query_all(JOB_SUMMARY_SQL + f" WHERE j.service_request_id IN ({marks}) ORDER BY j.id", ids):
            current_jobs[j["service_request_id"]] = _job_dict(j)  # latest job wins
    items = [{**dict(r), "current_job": current_jobs.get(r["id"])} for r in rows]
    return jsonify({"items": items})


@bp.get("/<int:request_id>")
@require_auth("requester", "admin")
def get_request(request_id: int):
    row = _get_owned(request_id)
    jobs = [_job_dict(j) for j in query_all(JOB_SUMMARY_SQL + " WHERE j.service_request_id = ? ORDER BY j.id DESC", (request_id,))]
    last_match = query_one(
        "SELECT * FROM match_logs WHERE service_request_id = ? ORDER BY id DESC LIMIT 1", (request_id,)
    )
    return jsonify({
        "service_request": dict(row),
        "jobs": jobs,
        "last_match": dict(last_match) if last_match else None,
    })


@bp.put("/<int:request_id>/cancel")
@require_auth("requester")
def cancel_request(request_id: int):
    row = _get_owned(request_id)
    if row["status"] != "open":
        raise conflict("Only open requests (with no active worker) can be cancelled.")
    conn = get_db()
    conn.execute("UPDATE service_requests SET status = 'cancelled', updated_at = ? WHERE id = ?", (utc_now(), request_id))
    conn.commit()
    return jsonify({"ok": True})
