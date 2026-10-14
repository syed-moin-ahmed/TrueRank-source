"""Flask configuration, read from environment variables (.env in development)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"


class ConfigError(RuntimeError):
    pass


def load_config(overrides: dict | None = None) -> dict:
    overrides = overrides or {}
    secret = overrides.get("JWT_SECRET_KEY") or os.getenv("JWT_SECRET_KEY")
    if not secret or len(secret) < 32:
        raise ConfigError(
            "JWT_SECRET_KEY is missing or shorter than 32 characters. "
            "Run `python scripts/init_env.py` to create a .env file with a random key."
        )

    db_path = overrides.get("DATABASE_PATH") or os.getenv("DATABASE_PATH") or str(BACKEND_DIR / "instance" / "truerank.db")
    if not Path(db_path).is_absolute():
        db_path = str((ROOT_DIR / db_path).resolve())

    origins = overrides.get("CORS_ORIGINS") or os.getenv("CORS_ORIGINS", "")
    config = {
        "JWT_SECRET_KEY": secret,
        "JWT_EXPIRES_HOURS": int(overrides.get("JWT_EXPIRES_HOURS") or os.getenv("JWT_EXPIRES_HOURS", "12")),
        "DATABASE_PATH": db_path,
        "CORS_ORIGINS": [o.strip() for o in origins.split(",") if o.strip()],
        "FRONTEND_DIST": str(overrides.get("FRONTEND_DIST") or FRONTEND_DIST),
        "MAX_CONTENT_LENGTH": 1 * 1024 * 1024,  # 1 MB request bodies
        "JSON_SORT_KEYS": False,
        "TESTING": bool(overrides.get("TESTING", False)),
    }
    return config
