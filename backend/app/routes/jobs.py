from flask import Blueprint, jsonify, request

from ..auth.security import current_user, require_auth
from ..database.db import query_all, query_one
from ..schemas import JobCreateIn
from ..services import job_service, worker_service
from ..utils.errors import forbidden

bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

JOB_LIST_SQL = """
    SELECT j.*, sr.query_text, sr.city AS request_city, sr.status AS request_status,
           wp.name AS worker_name, wp.occupation AS worker_occupation, wp.user_id AS worker_user_id,
           u.name AS requester_name, u.phone AS requester_phone,
           (SELECT rating FROM reviews r WHERE r.job_id = j.id) AS review_rating,
           (SELECT comment FROM reviews r WHERE r.job_id = j.id) AS review_comment,
           (SELECT status FROM disputes d WHERE d.job_id = j.id) AS dispute_status
    FROM jobs j
    JOIN service_requests sr ON sr.id = j.service_request_id
    JOIN worker_profiles wp ON wp.id = j.worker_id
    JOIN users u ON u.id = j.requester_id
"""


def _row(row, viewer_role: str) -> dict:
    data = dict(row)
    data["auto_accepted"] = bool(data["auto_accepted"])
    data["worker_has_account"] = data.pop("worker_user_id") is not None
    # A requester's phone is only shared with the worker once the job is accepted.
    if viewer_role == "worker" and data["status"] not in ("accepted", "in_progress", "completed"):
        data["requester_phone"] = None
    return data


@bp.post("")
@require_auth("requester")
def create_job():
    body = JobCreateIn.model_validate(request.get_json(silent=True) or {})
    job_id = job_service.create_job(current_user(), body.service_request_id, body.worker_id, body.match_log_id)
    row = query_one(JOB_LIST_SQL + " WHERE j.id = ?", (job_id,))
    return jsonify({"job": _row(row, "requester")}), 201


@bp.get("")
@require_auth()
def list_jobs():
    user = current_user()
    params: list = []
    if user["role"] == "requester":
        where = "j.requester_id = ?"
        params.append(user["id"])
    elif user["role"] == "worker":
        profile = worker_service.get_row_for_user(user["id"])
        if profile is None:
            return jsonify({"items": []})
        where = "j.worker_id = ?"
        params.append(profile["id"])
    else:
        where = "1 = 1"
    status = request.args.get("status")
    if status:
        statuses = [s for s in status.split(",") if s]
        where += f" AND j.status IN ({','.join('?' * len(statuses))})"
        params += statuses
    rows = query_all(JOB_LIST_SQL + f" WHERE {where} ORDER BY j.id DESC LIMIT 300", params)
    return jsonify({"items": [_row(r, user["role"]) for r in rows]})


@bp.get("/<int:job_id>")
@require_auth()
def get_job(job_id: int):
    user = current_user()
    row = query_one(JOB_LIST_SQL + " WHERE j.id = ?", (job_id,))
    if row is None:
        job_service.get_job(job_id)  # raises 404
    profile = worker_service.get_row_for_user(user["id"]) if user["role"] == "worker" else None
    allowed = (
        user["role"] == "admin"
        or row["requester_id"] == user["id"]
        or (profile is not None and profile["id"] == row["worker_id"])
    )
    if not allowed:
        raise forbidden()
    return jsonify({"job": _row(row, user["role"])})


@bp.put("/<int:job_id>/<action>")
@require_auth("requester", "worker")
def job_action(job_id: int, action: str):
    job_service.transition(job_id, action, current_user())
    row = query_one(JOB_LIST_SQL + " WHERE j.id = ?", (job_id,))
    return jsonify({"job": _row(row, current_user()["role"])})
