"""
Matching API service: connects the database to the TrueRank engine.

POST /api/match  ->  run_match()
    1. make sure the TF-IDF index reflects the current worker profiles
    2. engine.match(): preprocessing -> TF-IDF -> cosine -> fusion with stored trust -> ranking
    3. attach worker details + explanation
    4. log the run (match_logs / match_results)
"""
from __future__ import annotations

import threading
from collections import defaultdict

from flask import current_app

from ml.engine import MatchOutcome, TrueRankEngine
from ml.preprocessing.document_builder import build_worker_document
from ml.preprocessing.text_preprocessor import preprocess
from ml.ranking.explanation import build_explanation

from ..database.db import get_db, query_all, utc_now
from . import trust_service, worker_service

# Workers that can appear in rankings: dataset profiles, or registered workers whose account is active.
ACTIVE_WORKERS_SQL = """
    SELECT wp.* FROM worker_profiles wp
    LEFT JOIN users u ON u.id = wp.user_id
    WHERE (wp.user_id IS NULL OR u.is_active = 1)
"""


class MatchingService:
    def __init__(self, engine: TrueRankEngine) -> None:
        self.engine = engine
        self._dirty = True
        self._lock = threading.Lock()

    def mark_dirty(self) -> None:
        self._dirty = True

    def ensure_index(self) -> None:
        if not self._dirty:
            return
        with self._lock:
            if not self._dirty:
                return
            self.engine.build(self._load_documents())
            self._dirty = False

    def _load_documents(self) -> dict[int, str]:
        include_reviews = self.engine.config.include_reviews_in_document
        workers = query_all(ACTIVE_WORKERS_SQL)
        ids = [w["id"] for w in workers]
        skills = worker_service.skills_for(ids)

        history: dict[int, list[str]] = defaultdict(list)
        for r in query_all("SELECT worker_id, title, description FROM work_history"):
            history[r["worker_id"]].append(f"{r['title']}. {r['description']}")

        reviews: dict[int, list[str]] = defaultdict(list)
        if include_reviews:
            for r in query_all("SELECT worker_id, comment FROM reviews WHERE comment != ''"):
                reviews[r["worker_id"]].append(r["comment"])

        documents = {}
        for w in workers:
            worker_reviews = ([w["base_review_text"]] if w["base_review_text"] else []) + reviews[w["id"]]
            documents[w["id"]] = build_worker_document(
                occupation=w["occupation"],
                skills=skills.get(w["id"], []),
                profile_description=w["profile_description"],
                work_history=history[w["id"]],
                reviews=worker_reviews,
                include_reviews=include_reviews,
            )
        return documents


def service() -> MatchingService:
    return current_app.extensions["truerank_matching"]


def _relevant_skills(skills: list[str], matched_terms: set[str]) -> list[str]:
    relevant = []
    for skill in skills:
        if matched_terms.intersection(preprocess(skill).terms):
            relevant.append(skill)
    return relevant


def _candidate_rows(city: str | None, verified_only: bool) -> dict[int, object]:
    sql = ACTIVE_WORKERS_SQL + " AND wp.is_available = 1"
    params: list = []
    if city:
        sql += " AND wp.city = ? COLLATE NOCASE"
        params.append(city)
    if verified_only:
        sql += " AND wp.is_verified = 1"
    return {r["id"]: r for r in query_all(sql, params)}


def serialize_outcome(outcome: MatchOutcome, rows: dict[int, object]) -> list[dict]:
    result_ids = [r.worker_id for r in outcome.results]
    skills = worker_service.skills_for(result_ids)
    results = []
    for r in outcome.results:
        row = rows[r.worker_id]
        trust = trust_service.breakdown_for_row(row)
        metrics = worker_service.metrics_for_row(row)
        matched_display = [t.display for t in r.matched_terms]
        worker_skills = skills.get(r.worker_id, [])
        results.append({
            "rank": r.rank,
            "worker_id": r.worker_id,
            "name": row["name"],
            "gender": row["gender"],
            "occupation": row["occupation"],
            "city": row["city"],
            "experience_years": row["experience_years"],
            "languages": [l for l in (row["languages"] or "").split(", ") if l],
            "is_verified": bool(row["is_verified"]),
            "has_account": row["user_id"] is not None,
            "source": row["source"],
            "source_label": worker_service.SOURCE_LABELS[row["source"]],
            "similarity_score": r.similarity,
            "trust_score": r.trust,
            "final_score": r.final_score,
            "score_breakdown": {"similarity_part": r.similarity_part, "trust_part": r.trust_part},
            "matched_terms": [
                {"term": t.term, "display": t.display, "contribution": t.contribution} for t in r.matched_terms
            ],
            "relevant_skills": _relevant_skills(worker_skills, {t.term for t in r.matched_terms}),
            "skills": worker_skills,
            "metrics": metrics,
            "trust_components": trust["components"],
            "explanation": build_explanation(
                similarity=r.similarity,
                trust=r.trust,
                matched_terms=matched_display,
                trust_components=trust["components"],
                metrics=metrics,
                experience_years=row["experience_years"],
                is_verified=bool(row["is_verified"]),
            ),
        })
    return results


def run_match(
    query: str,
    requester_id: int | None,
    city: str | None = None,
    verified_only: bool = False,
    top_n: int = 10,
    lambda_weight: float | None = None,
    service_request_id: int | None = None,
    log: bool = True,
) -> dict:
    svc = service()
    svc.ensure_index()
    rows = _candidate_rows(city, verified_only)
    trust_scores = {wid: row["trust_score"] for wid, row in rows.items()}

    outcome = svc.engine.match(
        query=query,
        trust_scores=trust_scores,
        allowed_ids=rows.keys(),
        top_n=top_n,
        lambda_weight=lambda_weight,
    )
    results = serialize_outcome(outcome, rows)

    match_log_id = None
    if log:
        conn = get_db()
        cur = conn.execute(
            """INSERT INTO match_logs (requester_id, service_request_id, query_text, processed_query, lambda_used,
                   min_similarity, documents_indexed, candidates_above_threshold, results_returned, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (requester_id, service_request_id, query, outcome.query.text, outcome.lambda_weight,
             outcome.min_similarity, outcome.documents_indexed, outcome.candidates_above_threshold,
             len(results), utc_now()),
        )
        match_log_id = cur.lastrowid
        conn.executemany(
            """INSERT INTO match_results (match_log_id, worker_id, rank, similarity, trust_score, final_score)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [(match_log_id, r["worker_id"], r["rank"], r["similarity_score"], r["trust_score"], r["final_score"])
             for r in results],
        )
        conn.commit()

    cfg = svc.engine.config
    return {
        "query": query,
        "match_log_id": match_log_id,
        "processing": {
            **outcome.query.as_dict(),
            "known_terms": list(outcome.known_terms),
            "unknown_terms": list(outcome.unknown_terms),
            "expansions": [{"term": t, "added": list(a)} for t, a in outcome.expansions],
        },
        "pipeline": {
            "documents_indexed": outcome.documents_indexed,
            "vocabulary_size": outcome.vocabulary_size,
            "candidates_considered": outcome.candidates_considered,
            "candidates_above_threshold": outcome.candidates_above_threshold,
            "lambda": outcome.lambda_weight,
            "min_similarity": outcome.min_similarity,
            "trust_weights": cfg.trust_weights.as_dict(),
            "ranking_formula": f"R(w,q) = {outcome.lambda_weight:.2f}·S(w,q) + {1 - outcome.lambda_weight:.2f}·TS(w)",
            "filters": {"city": city, "verified_only": verified_only, "available_only": True},
        },
        "results": results,
    }
