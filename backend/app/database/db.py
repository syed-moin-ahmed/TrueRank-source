"""SQLite access layer. Every query uses '?' placeholders (no string formatting) -> no SQL injection."""
from __future__ import annotations

import sqlite3
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, current_app, g

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect(database_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(database_path, detect_types=0, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect(current_app.config["DATABASE_PATH"])
    return g.db


def close_db(_exc: BaseException | None = None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    migrate(conn)
    conn.commit()


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def migrate(conn: sqlite3.Connection) -> None:
    """Small, safe upgrades for databases created by earlier versions (data is kept)."""
    from ..utils.names import guess_gender

    for table in ("users", "worker_profiles"):
        if "gender" not in _columns(conn, table):
            conn.execute(f"ALTER TABLE {table} ADD COLUMN gender TEXT")
    # Fill gender where it is still unknown: registered workers take their account's value, others are guessed from the first name.
    conn.execute(
        """UPDATE worker_profiles SET gender = (SELECT u.gender FROM users u WHERE u.id = worker_profiles.user_id)
           WHERE gender IS NULL AND user_id IS NOT NULL"""
    )
    for row in conn.execute("SELECT id, name FROM worker_profiles WHERE gender IS NULL").fetchall():
        conn.execute("UPDATE worker_profiles SET gender = ? WHERE id = ?", (guess_gender(row[1]), row[0]))


def init_app(app: Flask) -> None:
    Path(app.config["DATABASE_PATH"]).parent.mkdir(parents=True, exist_ok=True)
    conn = connect(app.config["DATABASE_PATH"])
    try:
        init_schema(conn)
    finally:
        conn.close()
    app.teardown_appcontext(close_db)


def query_one(sql: str, params: Iterable = ()) -> sqlite3.Row | None:
    return get_db().execute(sql, tuple(params)).fetchone()


def query_all(sql: str, params: Iterable = ()) -> list[sqlite3.Row]:
    return get_db().execute(sql, tuple(params)).fetchall()


def scalar(sql: str, params: Iterable = ()):
    row = get_db().execute(sql, tuple(params)).fetchone()
    return None if row is None else row[0]


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """Commit on success, roll back on any error."""
    conn = get_db()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
