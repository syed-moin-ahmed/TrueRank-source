from flask import Blueprint, jsonify, request

from ..auth.security import create_token, current_user, hash_password, require_auth, verify_password
from ..database.db import get_db, query_one, utc_now
from ..schemas import AccountUpdateIn, LoginIn, RegisterIn
from ..services import worker_service
from ..utils.errors import APIError, conflict

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _user_payload(user: dict) -> dict:
    data = {k: user.get(k) for k in ("id", "name", "email", "role", "city", "phone", "gender")}
    if user["role"] == "worker":
        profile = worker_service.get_row_for_user(user["id"])
        data["worker_profile_id"] = profile["id"] if profile else None
    return data


@bp.post("/register")
def register():
    body = RegisterIn.model_validate(request.get_json(silent=True) or {})
    if query_one("SELECT 1 FROM users WHERE email = ?", (body.email,)):
        raise conflict("An account with this email already exists.")
    now = utc_now()
    conn = get_db()
    cur = conn.execute(
        """INSERT INTO users (name, email, password_hash, role, city, phone, gender, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (body.name, body.email, hash_password(body.password), body.role, body.city, body.phone, body.gender, now, now),
    )
    conn.commit()
    user = dict(query_one("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)))
    return jsonify({"token": create_token(user["id"], user["role"]), "user": _user_payload(user)}), 201


@bp.post("/login")
def login():
    body = LoginIn.model_validate(request.get_json(silent=True) or {})
    row = query_one("SELECT * FROM users WHERE email = ?", (body.email.lower(),))
    if row is None or not verify_password(row["password_hash"], body.password):
        raise APIError(401, "Incorrect email or password.")
    if not row["is_active"]:
        raise APIError(403, "This account has been deactivated by an administrator.")
    user = dict(row)
    return jsonify({"token": create_token(user["id"], user["role"]), "user": _user_payload(user)})


@bp.get("/me")
@require_auth()
def me():
    return jsonify({"user": _user_payload(current_user())})


@bp.put("/me")
@require_auth()
def update_me():
    body = AccountUpdateIn.model_validate(request.get_json(silent=True) or {})
    user = current_user()
    conn = get_db()
    conn.execute("UPDATE users SET name = ?, city = ?, phone = ?, gender = ?, updated_at = ? WHERE id = ?",
                 (body.name, body.city, body.phone, body.gender, utc_now(), user["id"]))
    if user["role"] == "worker":
        conn.execute("UPDATE worker_profiles SET name = ?, gender = ? WHERE user_id = ?", (body.name, body.gender, user["id"]))
    conn.commit()
    fresh = dict(query_one("SELECT id, name, email, role, city, phone, gender FROM users WHERE id = ?", (user["id"],)))
    return jsonify({"user": _user_payload(fresh)})
