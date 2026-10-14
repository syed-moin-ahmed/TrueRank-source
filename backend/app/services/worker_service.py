"""Worker profile reads/writes and JSON serialisation."""
from __future__ import annotations

import sqlite3
from collections import defaultdict

from ..database.db import get_db, query_all, query_one, utc_now
from ..utils.names import guess_gender
from . import trust_service

SOURCE_LABELS = {
    "research_dataset": "Imported dataset",
    "demo_seed": "Demo data (synthetic)",
    "registered": "Registered on TrueRank",
}

PROFILE_FIELDS = ("occupation", "skills", "experience_years", "city", "languages", "profile_description", "work_history")


def skills_for(worker_ids: list[int]) -> dict[int, list[str]]:
    if not worker_ids:
        return {}
    marks = ",".join("?" * len(worker_ids))
    rows = query_all(f"SELECT worker_id, skill FROM worker_skills WHERE worker_id IN ({marks}) ORDER BY id", worker_ids)
    grouped: dict[int, list[str]] = defaultdict(list)
    for r in rows:
        grouped[r["worker_id"]].append(r["skill"])
    return grouped


def history_for(worker_id: int) -> list[dict]:
    rows = query_all(
        "SELECT id, title, description, year FROM work_history WHERE worker_id = ? ORDER BY COALESCE(year, 0) DESC, id DESC",
        (worker_id,),
    )
    return [dict(r) for r in rows]


def metrics_for_row(row) -> dict:
    closed = row["stat_jobs_closed"] or 0
    return {
        "average_rating": row["stat_rating_avg"],
        "rating_count": row["stat_rating_count"],
        "jobs_completed": row["stat_jobs_completed"],
        "completion_rate": (row["stat_jobs_completed"] / closed) if closed else None,
        "endorsements": row["stat_endorsements"],
        "disputes": row["stat_disputes"],
    }


def serialize(row, skills: list[str] | None = None, detail: bool = False) -> dict:
    data = {
        "id": row["id"],
        "name": row["name"],
        "gender": row["gender"],
        "occupation": row["occupation"],
        "city": row["city"],
        "experience_years": row["experience_years"],
        "languages": [l for l in (row["languages"] or "").split(", ") if l],
        "skills": skills if skills is not None else skills_for([row["id"]]).get(row["id"], []),
        "is_verified": bool(row["is_verified"]),
        "is_available": bool(row["is_available"]),
        "source": row["source"],
        "source_label": SOURCE_LABELS[row["source"]],
        "external_id": row["external_id"],
        "has_account": row["user_id"] is not None,
        "trust_score": row["trust_score"],
        "metrics": metrics_for_row(row),
    }
    if detail:
        data["profile_description"] = row["profile_description"]
        data["work_history"] = history_for(row["id"])
        data["trust"] = trust_service.breakdown_for_row(row)
        data["base_review_text"] = row["base_review_text"] or None
        data["base_review_sentiment"] = row["base_review_sentiment"]
        data["created_at"] = row["created_at"]
    return data


def get_row(worker_id: int):
    return query_one("SELECT * FROM worker_profiles WHERE id = ?", (worker_id,))


def get_row_for_user(user_id: int):
    return query_one("SELECT * FROM worker_profiles WHERE user_id = ?", (user_id,))


def _write_skills_and_history(conn: sqlite3.Connection, worker_id: int, skills: list[str], history: list[dict]) -> None:
    conn.execute("DELETE FROM worker_skills WHERE worker_id = ?", (worker_id,))
    conn.executemany("INSERT INTO worker_skills (worker_id, skill) VALUES (?, ?)", [(worker_id, s) for s in skills])
    conn.execute("DELETE FROM work_history WHERE worker_id = ?", (worker_id,))
    now = utc_now()
    conn.executemany(
        "INSERT INTO work_history (worker_id, title, description, year, created_at) VALUES (?, ?, ?, ?, ?)",
        [(worker_id, h["title"], h.get("description", ""), h.get("year"), now) for h in history],
    )


def create_profile(user: dict, payload: dict) -> int:
    conn = get_db()
    now = utc_now()
    cur = conn.execute(
        """INSERT INTO worker_profiles
               (user_id, source, name, gender, occupation, experience_years, city, languages, profile_description,
                is_available, created_at, updated_at)
           VALUES (?, 'registered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            user["id"], user["name"], user.get("gender") or guess_gender(user["name"]), payload["occupation"], payload["experience_years"], payload["city"],
            ", ".join(payload["languages"]), payload["profile_description"], int(payload["is_available"]), now, now,
        ),
    )
    worker_id = cur.lastrowid
    _write_skills_and_history(conn, worker_id, payload["skills"], payload["work_history"])
    trust_service.recompute(worker_id, "profile_created", conn)
    return worker_id


def update_profile(worker_id: int, payload: dict) -> None:
    conn = get_db()
    conn.execute(
        """UPDATE worker_profiles SET occupation = ?, experience_years = ?, city = ?, languages = ?,
               profile_description = ?, is_available = ?, updated_at = ?
           WHERE id = ?""",
        (
            payload["occupation"], payload["experience_years"], payload["city"], ", ".join(payload["languages"]),
            payload["profile_description"], int(payload["is_available"]), utc_now(), worker_id,
        ),
    )
    _write_skills_and_history(conn, worker_id, payload["skills"], payload["work_history"])


def profile_completeness(row) -> dict:
    checks = {
        "Occupation": bool(row["occupation"]),
        "At least 3 skills": len(skills_for([row["id"]]).get(row["id"], [])) >= 3,
        "Experience": (row["experience_years"] or 0) > 0,
        "City": bool(row["city"]),
        "Languages": bool(row["languages"]),
        "Description (80+ characters)": len(row["profile_description"] or "") >= 80,
        "Work history entry": bool(query_one("SELECT 1 FROM work_history WHERE worker_id = ? LIMIT 1", (row["id"],))),
        "Verification": bool(row["is_verified"]),
    }
    done = sum(checks.values())
    return {"percent": round(100 * done / len(checks)), "checks": [{"label": k, "done": v} for k, v in checks.items()]}
