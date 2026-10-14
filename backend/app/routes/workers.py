from flask import Blueprint, jsonify, request

from ..auth.security import current_user, require_auth
from ..database.db import get_db, query_all, query_one, scalar, utc_now
from ..schemas import EndorseIn, VerificationIn, WorkerProfileIn
from ..services import matching_service, trust_service, worker_service
from ..utils.errors import APIError, bad_request, conflict, forbidden, not_found

bp = Blueprint("workers", __name__, url_prefix="/api/workers")

SORTS = {
    "trust": "wp.trust_score DESC, wp.id ASC",
    "rating": "COALESCE(wp.stat_rating_avg, 0) DESC, wp.id ASC",
    "experience": "wp.experience_years DESC, wp.id ASC",
    "name": "wp.name COLLATE NOCASE ASC",
    "recent": "wp.id DESC",
}


def _page_args() -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", 1)))
        size = min(100, max(1, int(request.args.get("page_size", 20))))
    except ValueError as exc:
        raise bad_request("page and page_size must be numbers.") from exc
    return page, size


@bp.get("")
@require_auth()
def list_workers():
    page, size = _page_args()
    where, params = ["(wp.user_id IS NULL OR u.is_active = 1)"], []
    search = (request.args.get("search") or "").strip()
    if search:
        where.append("(wp.name LIKE ? OR wp.occupation LIKE ? OR EXISTS (SELECT 1 FROM worker_skills s WHERE s.worker_id = wp.id AND s.skill LIKE ?))")
        like = f"%{search}%"
        params += [like, like, like]
    for arg, column in (("occupation", "wp.occupation"), ("city", "wp.city"), ("source", "wp.source")):
        value = (request.args.get(arg) or "").strip()
        if value:
            where.append(f"{column} = ? COLLATE NOCASE")
            params.append(value)
    if request.args.get("verified") == "1":
        where.append("wp.is_verified = 1")
    sort = SORTS.get(request.args.get("sort", "trust"), SORTS["trust"])
    base = f"FROM worker_profiles wp LEFT JOIN users u ON u.id = wp.user_id WHERE {' AND '.join(where)}"
    total = scalar(f"SELECT COUNT(*) {base}", params)
    rows = query_all(f"SELECT wp.* {base} ORDER BY {sort} LIMIT ? OFFSET ?", params + [size, (page - 1) * size])
    skills = worker_service.skills_for([r["id"] for r in rows])
    return jsonify({
        "items": [worker_service.serialize(r, skills.get(r["id"], [])) for r in rows],
        "total": total, "page": page, "page_size": size,
    })


@bp.get("/filters")
@require_auth()
def filters():
    occupations = [r[0] for r in query_all("SELECT DISTINCT occupation FROM worker_profiles ORDER BY occupation")]
    cities = [r[0] for r in query_all("SELECT DISTINCT city FROM worker_profiles ORDER BY city")]
    return jsonify({"occupations": occupations, "cities": cities})


# ------------------------------------------------------------- own profile
@bp.get("/me")
@require_auth("worker")
def my_profile():
    row = worker_service.get_row_for_user(current_user()["id"])
    if row is None:
        return jsonify({"profile": None, "needs_profile": True})
    data = worker_service.serialize(row, detail=True)
    data["completeness"] = worker_service.profile_completeness(row)
    return jsonify({"profile": data, "needs_profile": False})


@bp.post("/me")
@require_auth("worker")
def create_my_profile():
    user = current_user()
    if worker_service.get_row_for_user(user["id"]):
        raise conflict("You already have a worker profile. Use edit instead.")
    body = WorkerProfileIn.model_validate(request.get_json(silent=True) or {})
    worker_id = worker_service.create_profile(user, body.model_dump())
    get_db().commit()
    matching_service.service().mark_dirty()
    return jsonify({"profile": worker_service.serialize(worker_service.get_row(worker_id), detail=True)}), 201


def _update(worker_id: int):
    body = WorkerProfileIn.model_validate(request.get_json(silent=True) or {})
    worker_service.update_profile(worker_id, body.model_dump())
    get_db().commit()
    matching_service.service().mark_dirty()
    return jsonify({"profile": worker_service.serialize(worker_service.get_row(worker_id), detail=True)})


@bp.put("/me")
@require_auth("worker")
def update_my_profile():
    row = worker_service.get_row_for_user(current_user()["id"])
    if row is None:
        raise not_found("Worker profile")
    return _update(row["id"])


@bp.put("/<int:worker_id>")
@require_auth("worker", "admin")
def update_worker(worker_id: int):
    row = worker_service.get_row(worker_id)
    if row is None:
        raise not_found("Worker")
    user = current_user()
    if user["role"] != "admin" and row["user_id"] != user["id"]:
        raise forbidden("You can only edit your own profile.")
    return _update(worker_id)


@bp.get("/me/opportunities")
@require_auth("worker")
def my_opportunities():
    """Open service requests ranked by S(w, q) against this worker's profile (same TF-IDF space)."""
    row = worker_service.get_row_for_user(current_user()["id"])
    if row is None:
        return jsonify({"items": [], "needs_profile": True})
    requests_rows = query_all(
        """SELECT sr.id, sr.query_text, sr.city, sr.created_at, u.name AS requester_name
           FROM service_requests sr JOIN users u ON u.id = sr.requester_id
           WHERE sr.status = 'open' AND sr.requester_id != ? ORDER BY sr.id DESC LIMIT 200""",
        (current_user()["id"],),
    )
    svc = matching_service.service()
    svc.ensure_index()
    sims = svc.engine.similarity_to_queries(row["id"], [r["query_text"] for r in requests_rows])
    threshold = svc.engine.config.min_similarity
    items = [
        {**dict(r), "similarity_score": s, "same_city": (r["city"] or "").lower() == row["city"].lower()}
        for r, s in zip(requests_rows, sims) if s >= threshold
    ]
    items.sort(key=lambda x: (-x["similarity_score"], -x["id"]))
    return jsonify({"items": items[:30], "threshold": threshold})


@bp.get("/me/verifications")
@require_auth("worker")
def my_verifications():
    row = worker_service.get_row_for_user(current_user()["id"])
    if row is None:
        return jsonify({"items": []})
    rows = query_all("SELECT * FROM verification_records WHERE worker_id = ? ORDER BY id DESC", (row["id"],))
    return jsonify({"items": [dict(r) for r in rows]})


@bp.post("/me/verifications")
@require_auth("worker")
def request_verification():
    row = worker_service.get_row_for_user(current_user()["id"])
    if row is None:
        raise bad_request("Create your profile first.")
    body = VerificationIn.model_validate(request.get_json(silent=True) or {})
    if query_one("SELECT 1 FROM verification_records WHERE worker_id = ? AND status = 'pending'", (row["id"],)):
        raise conflict("You already have a pending verification request.")
    conn = get_db()
    conn.execute(
        "INSERT INTO verification_records (worker_id, method, reference_note, created_at) VALUES (?, ?, ?, ?)",
        (row["id"], body.method, body.reference_note, utc_now()),
    )
    conn.commit()
    return jsonify({"ok": True}), 201


# ----------------------------------------------------------- any worker
def _require_worker_row(worker_id: int):
    row = worker_service.get_row(worker_id)
    if row is None:
        raise not_found("Worker")
    return row


@bp.get("/<int:worker_id>")
@require_auth()
def get_worker(worker_id: int):
    row = _require_worker_row(worker_id)
    data = worker_service.serialize(row, detail=True)
    user = current_user()
    data["reviews"] = [dict(r) for r in query_all(
        """SELECT r.rating, r.comment, r.created_at, u.name AS requester_name FROM reviews r
           JOIN users u ON u.id = r.requester_id WHERE r.worker_id = ? ORDER BY r.id DESC LIMIT 10""",
        (worker_id,),
    )]
    data["endorsements"] = [dict(r) for r in query_all(
        """SELECT pe.note, pe.created_at, wp.name AS endorser_name, wp.occupation AS endorser_occupation
           FROM peer_endorsements pe JOIN worker_profiles wp ON wp.id = pe.endorser_worker_id
           WHERE pe.endorsed_worker_id = ? ORDER BY pe.id DESC LIMIT 10""",
        (worker_id,),
    )]
    data["can_endorse"] = False
    if user["role"] == "worker":
        mine = worker_service.get_row_for_user(user["id"])
        if mine and mine["id"] != worker_id:
            data["can_endorse"] = not query_one(
                "SELECT 1 FROM peer_endorsements WHERE endorser_worker_id = ? AND endorsed_worker_id = ?",
                (mine["id"], worker_id),
            )
    return jsonify({"worker": data})


@bp.get("/<int:worker_id>/trust-score")
@require_auth()
def trust_score(worker_id: int):
    row = _require_worker_row(worker_id)
    return jsonify({"worker_id": worker_id, "trust": trust_service.breakdown_for_row(row)})


@bp.get("/<int:worker_id>/trust-history")
@require_auth()
def trust_history(worker_id: int):
    _require_worker_row(worker_id)
    rows = query_all(
        "SELECT ar, cr, pe, da, trust_score, trigger, created_at FROM trust_snapshots WHERE worker_id = ? ORDER BY id",
        (worker_id,),
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.get("/<int:worker_id>/reviews")
@require_auth()
def worker_reviews(worker_id: int):
    _require_worker_row(worker_id)
    rows = query_all(
        """SELECT r.id, r.rating, r.comment, r.created_at, u.name AS requester_name, sr.query_text
           FROM reviews r JOIN users u ON u.id = r.requester_id
           JOIN jobs j ON j.id = r.job_id JOIN service_requests sr ON sr.id = j.service_request_id
           WHERE r.worker_id = ? ORDER BY r.id DESC""",
        (worker_id,),
    )
    return jsonify({"items": [dict(r) for r in rows]})


@bp.post("/<int:worker_id>/endorse")
@require_auth("worker")
def endorse(worker_id: int):
    _require_worker_row(worker_id)
    mine = worker_service.get_row_for_user(current_user()["id"])
    if mine is None:
        raise bad_request("Create your worker profile before endorsing others.")
    if mine["id"] == worker_id:
        raise bad_request("You cannot endorse yourself.")
    body = EndorseIn.model_validate(request.get_json(silent=True) or {})
    if query_one("SELECT 1 FROM peer_endorsements WHERE endorser_worker_id = ? AND endorsed_worker_id = ?",
                 (mine["id"], worker_id)):
        raise conflict("You have already endorsed this worker.")
    conn = get_db()
    conn.execute(
        "INSERT INTO peer_endorsements (endorser_worker_id, endorsed_worker_id, note, created_at) VALUES (?, ?, ?, ?)",
        (mine["id"], worker_id, body.note, utc_now()),
    )
    result = trust_service.recompute(worker_id, "peer_endorsement", conn)
    conn.commit()
    return jsonify({"ok": True, "trust_score": result.score}), 201
