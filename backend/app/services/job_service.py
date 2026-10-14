"""
Job life-cycle (the application side of the feedback loop).

    pending --accept--> accepted --start--> in_progress --complete--> completed
       |                   |                     |
     reject             withdraw / cancel     withdraw / cancel
       v                   v                     v
    rejected        withdrawn (counts against CR) / cancelled (requester, not counted)

Dataset/demo workers have no login, so a job sent to them is auto-accepted
(flagged auto_accepted = 1 and shown in the UI).
"""
from __future__ import annotations

from ..database.db import get_db, query_one, utc_now
from ..utils.errors import APIError, bad_request, conflict, forbidden, not_found
from . import trust_service

ACTIVE = ("pending", "accepted", "in_progress")


def get_job(job_id: int):
    job = query_one("SELECT * FROM jobs WHERE id = ?", (job_id,))
    if job is None:
        raise not_found("Job")
    return job


def _worker_user_id(worker_id: int) -> int | None:
    row = query_one("SELECT user_id FROM worker_profiles WHERE id = ?", (worker_id,))
    return None if row is None else row["user_id"]


def create_job(requester: dict, service_request_id: int, worker_id: int, match_log_id: int | None) -> int:
    conn = get_db()
    request_row = query_one("SELECT * FROM service_requests WHERE id = ?", (service_request_id,))
    if request_row is None:
        raise not_found("Service request")
    if request_row["requester_id"] != requester["id"]:
        raise forbidden("This is not your service request.")
    if request_row["status"] != "open":
        raise conflict("A worker has already been selected for this request.")

    worker = query_one(
        """SELECT wp.id, wp.user_id, wp.is_available, u.is_active FROM worker_profiles wp
           LEFT JOIN users u ON u.id = wp.user_id WHERE wp.id = ?""",
        (worker_id,),
    )
    if worker is None:
        raise not_found("Worker")
    if not worker["is_available"] or (worker["user_id"] is not None and not worker["is_active"]):
        raise conflict("This worker is not available right now.")
    if worker["user_id"] == requester["id"]:
        raise bad_request("You cannot hire yourself.")

    snapshot = None
    if match_log_id is not None:
        snapshot = query_one(
            """SELECT mr.rank, mr.similarity, mr.trust_score, mr.final_score FROM match_results mr
               JOIN match_logs ml ON ml.id = mr.match_log_id
               WHERE mr.match_log_id = ? AND mr.worker_id = ? AND ml.requester_id = ?""",
            (match_log_id, worker_id, requester["id"]),
        )
        if snapshot is None:
            match_log_id = None

    auto = worker["user_id"] is None
    now = utc_now()
    cur = conn.execute(
        """INSERT INTO jobs (service_request_id, worker_id, requester_id, status, auto_accepted, match_log_id,
               selected_rank, selected_similarity, selected_trust, selected_final, created_at, accepted_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            service_request_id, worker_id, requester["id"], "accepted" if auto else "pending", int(auto), match_log_id,
            snapshot["rank"] if snapshot else None, snapshot["similarity"] if snapshot else None,
            snapshot["trust_score"] if snapshot else None, snapshot["final_score"] if snapshot else None,
            now, now if auto else None, now,
        ),
    )
    conn.execute("UPDATE service_requests SET status = 'assigned', updated_at = ? WHERE id = ?", (now, service_request_id))
    conn.commit()
    return cur.lastrowid


def _set_request_status(request_id: int, status: str) -> None:
    get_db().execute("UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?", (status, utc_now(), request_id))


def transition(job_id: int, action: str, user: dict) -> None:
    job = get_job(job_id)
    status = job["status"]
    worker_user = _worker_user_id(job["worker_id"])
    is_requester = user["id"] == job["requester_id"]
    is_worker = worker_user is not None and user["id"] == worker_user
    conn = get_db()
    now = utc_now()
    recompute = False

    if action == "accept":
        if not is_worker:
            raise forbidden()
        if status != "pending":
            raise conflict("Only pending requests can be accepted.")
        conn.execute("UPDATE jobs SET status='accepted', accepted_at=?, updated_at=? WHERE id=?", (now, now, job_id))

    elif action == "reject":
        if not is_worker:
            raise forbidden()
        if status != "pending":
            raise conflict("Only pending requests can be rejected.")
        conn.execute("UPDATE jobs SET status='rejected', closed_at=?, updated_at=? WHERE id=?", (now, now, job_id))
        _set_request_status(job["service_request_id"], "open")

    elif action == "start":
        allowed = is_worker or (is_requester and job["auto_accepted"])
        if not allowed:
            raise forbidden()
        if status != "accepted":
            raise conflict("Only accepted jobs can be started.")
        conn.execute("UPDATE jobs SET status='in_progress', started_at=?, updated_at=? WHERE id=?", (now, now, job_id))
        _set_request_status(job["service_request_id"], "in_progress")

    elif action == "complete":
        if not is_requester:
            raise forbidden("Only the service requester can mark the job as completed.")
        if status != "in_progress":
            raise conflict("Only jobs in progress can be marked as completed.")
        conn.execute("UPDATE jobs SET status='completed', completed_at=?, closed_at=?, updated_at=? WHERE id=?",
                     (now, now, now, job_id))
        _set_request_status(job["service_request_id"], "completed")
        recompute = True

    elif action == "withdraw":
        if not is_worker:
            raise forbidden()
        if status not in ("accepted", "in_progress"):
            raise conflict("You can only withdraw from an accepted or running job.")
        conn.execute("UPDATE jobs SET status='withdrawn', closed_at=?, updated_at=? WHERE id=?", (now, now, job_id))
        _set_request_status(job["service_request_id"], "open")
        recompute = True  # abandoned job lowers the Completion Rate

    elif action == "cancel":
        if not is_requester:
            raise forbidden()
        if status not in ACTIVE:
            raise conflict("This job can no longer be cancelled.")
        conn.execute("UPDATE jobs SET status='cancelled', closed_at=?, updated_at=? WHERE id=?", (now, now, job_id))
        _set_request_status(job["service_request_id"], "open")

    else:
        raise APIError(404, "Unknown action.")

    if recompute:
        trust_service.recompute(job["worker_id"], f"job_{action}", conn)
    conn.commit()


def serialize(job, extra: dict | None = None) -> dict:
    data = {k: job[k] for k in job.keys()}
    data["auto_accepted"] = bool(job["auto_accepted"])
    if extra:
        data.update(extra)
    return data
