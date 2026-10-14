"""
Import worker profiles from a CSV that uses the research dataset's column names.

Required columns:  Worker_ID, Name, Occupation, Skills, City
Optional columns:  Experience_Years, Languages, Jobs_Completed, Completion_Rate, Average_Rating,
                   Peer_Endorsements, Dispute_Count, Verification_Status, Profile_Description,
                   Customer_Review, Review_Sentiment

Mapping into the trust evidence (documented assumption, see docs/ARCHITECTURE.md):
    base_rating_count  = Jobs_Completed   (the dataset stores an average, not a count;
                                           if Jobs_Completed = 0 the rating is ignored)
    base_rating_sum    = Average_Rating x base_rating_count
    base_jobs_closed   = round(Jobs_Completed / Completion_Rate)   (Completion_Rate may be 0-1 or 0-100)
    base_disputes      = Dispute_Count
"""
from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

from ..database.db import utc_now
from ..utils.names import guess_gender
from . import trust_service

REQUIRED = ("Worker_ID", "Name", "Occupation", "Skills", "City")
TRUE_VALUES = {"verified", "true", "yes", "1", "y"}


class DatasetError(ValueError):
    pass


def _float(value: str, field: str, row_no: int) -> float | None:
    value = (value or "").strip()
    if value == "":
        return None
    try:
        return float(value)
    except ValueError as exc:
        raise DatasetError(f"Row {row_no}: '{field}' must be a number (got {value!r}).") from exc


def _int(value: str, field: str, row_no: int) -> int:
    number = _float(value, field, row_no)
    if number is None:
        return 0
    if number < 0:
        raise DatasetError(f"Row {row_no}: '{field}' cannot be negative.")
    return int(round(number))


def parse_row(raw: dict, row_no: int) -> dict:
    for column in REQUIRED:
        if not (raw.get(column) or "").strip():
            raise DatasetError(f"Row {row_no}: required column '{column}' is empty.")

    jobs = _int(raw.get("Jobs_Completed", ""), "Jobs_Completed", row_no)
    rate = _float(raw.get("Completion_Rate", ""), "Completion_Rate", row_no)
    if rate is not None and rate > 1:
        rate = rate / 100.0
    if rate is not None and not 0 <= rate <= 1:
        raise DatasetError(f"Row {row_no}: Completion_Rate must be between 0 and 1 (or 0-100).")
    rating = _float(raw.get("Average_Rating", ""), "Average_Rating", row_no)
    if rating is not None and not 1 <= rating <= 5:
        raise DatasetError(f"Row {row_no}: Average_Rating must be between 1 and 5.")

    if jobs > 0 and rate:
        closed = max(jobs, int(round(jobs / rate)))
    else:
        closed = jobs
    rating_count = jobs if (rating is not None and jobs > 0) else 0

    skills = []
    for s in (raw.get("Skills") or "").replace(";", ",").split(","):
        s = s.strip()
        if s and s.lower() not in {x.lower() for x in skills}:
            skills.append(s[:60])

    return {
        "external_id": raw["Worker_ID"].strip(),
        "name": raw["Name"].strip(),
        "gender": (raw.get("Gender") or "").strip().lower() if (raw.get("Gender") or "").strip().lower() in ("male", "female") else guess_gender(raw["Name"]),
        "occupation": raw["Occupation"].strip(),
        "skills": skills,
        "experience_years": _float(raw.get("Experience_Years", ""), "Experience_Years", row_no) or 0.0,
        "city": raw["City"].strip(),
        "languages": ", ".join(l.strip() for l in (raw.get("Languages") or "").split(",") if l.strip()),
        "profile_description": (raw.get("Profile_Description") or "").strip(),
        "is_verified": int((raw.get("Verification_Status") or "").strip().lower() in TRUE_VALUES),
        "base_rating_sum": (rating or 0.0) * rating_count,
        "base_rating_count": rating_count,
        "base_jobs_completed": jobs,
        "base_jobs_closed": closed,
        "base_endorsements": _int(raw.get("Peer_Endorsements", ""), "Peer_Endorsements", row_no),
        "base_disputes": _int(raw.get("Dispute_Count", ""), "Dispute_Count", row_no),
        "base_review_text": (raw.get("Customer_Review") or "").strip(),
        "base_review_sentiment": (raw.get("Review_Sentiment") or "").strip() or None,
    }


def import_csv(conn: sqlite3.Connection, csv_path: Path, source: str) -> int:
    if source not in ("research_dataset", "demo_seed"):
        raise DatasetError("source must be 'research_dataset' or 'demo_seed'")
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in REQUIRED if c not in (reader.fieldnames or [])]
        if missing:
            raise DatasetError(f"CSV is missing required columns: {', '.join(missing)}")
        parsed = [parse_row(raw, i + 2) for i, raw in enumerate(reader)]

    now = utc_now()
    imported = 0
    try:
        for p in parsed:
            existing = conn.execute("SELECT id FROM worker_profiles WHERE external_id = ?", (p["external_id"],)).fetchone()
            if existing:
                continue  # importing twice is safe
            cur = conn.execute(
                """INSERT INTO worker_profiles
                       (source, external_id, name, gender, occupation, experience_years, city, languages, profile_description,
                        is_verified, base_rating_sum, base_rating_count, base_jobs_completed, base_jobs_closed,
                        base_endorsements, base_disputes, base_review_text, base_review_sentiment, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (source, p["external_id"], p["name"], p["gender"], p["occupation"], p["experience_years"], p["city"], p["languages"],
                 p["profile_description"], p["is_verified"], p["base_rating_sum"], p["base_rating_count"],
                 p["base_jobs_completed"], p["base_jobs_closed"], p["base_endorsements"], p["base_disputes"],
                 p["base_review_text"], p["base_review_sentiment"], now, now),
            )
            worker_id = cur.lastrowid
            conn.executemany("INSERT INTO worker_skills (worker_id, skill) VALUES (?, ?)",
                             [(worker_id, s) for s in p["skills"]])
            trust_service.recompute(worker_id, "dataset_import", conn)
            imported += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return imported
