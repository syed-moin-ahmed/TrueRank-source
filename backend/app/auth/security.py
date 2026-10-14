"""Password hashing, JWT tokens and role-based access control."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..database.db import query_one
from ..utils.errors import APIError

ROLES = ("requester", "worker", "admin")
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return generate_password_hash(password, method="scrypt")


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def create_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm=_ALGORITHM)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise APIError(401, "Your session has expired. Please log in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise APIError(401, "Invalid authentication token.") from exc


def _load_current_user() -> dict:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise APIError(401, "Please log in to continue.")
    payload = _decode(header.removeprefix("Bearer ").strip())
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise APIError(401, "Invalid authentication token.") from exc

    row = query_one("SELECT id, name, email, role, city, phone, gender, is_active FROM users WHERE id = ?", (user_id,))
    if row is None or not row["is_active"]:
        raise APIError(401, "This account is not active.")
    return dict(row)


def require_auth(*roles: str):
    """Decorator: the request must carry a valid token and (optionally) one of the given roles."""
    for role in roles:
        if role not in ROLES:
            raise ValueError(f"Unknown role {role}")

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = _load_current_user()
            if roles and user["role"] not in roles:
                raise APIError(403, "Your account role cannot access this page.")
            g.user = user
            return view(*args, **kwargs)

        return wrapper

    return decorator


def current_user() -> dict:
    return g.user
