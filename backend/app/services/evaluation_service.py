"""
Live benchmark: existing search methods vs TrueRank, run on the profiles currently in the database.

Why this exists
    Examiners asked to see the proposed system compared with the methods people use today. This module runs
    the same benchmark queries through four rankers and scores every top-10 list with standard IR metrics.

Benchmark queries
    44 everyday requests (2 per trade), each tagged with the trade a requester actually needs.

What counts as a correct recommendation ("good hire")
    The worker belongs to the requested trade AND has a reliable track record:
        average rating >= 4.0, completion rate >= 85 %, disputes <= 5 % of completed jobs.
    A worker in the right trade without enough history is "acceptable" (graded relevance 1).
    A worker in the wrong trade, or with a poor record (rating < 3.5, completion < 75 % or disputes > 8 %),
    is a "risky hire" (relevance 0).

Methods compared
    1. Keyword search          — existing job portals: counts query words found in the profile, listing order.
    2. Keyword + rating sort   — existing service marketplaces: keyword filter, then highest rating first.
    3. TF-IDF + cosine         — skill similarity only (TrueRank with lambda = 1.0, no trust).
    4. TrueRank                — skill similarity fused with the Composite Trust Score (lambda = 0.7).

Metrics (averaged over all queries)
    Precision@5 (good hires in the top 5), NDCG@10 (graded), MRR (rank of the first good hire),
    Trade accuracy@5 (right trade in the top 5) and Risky-hire rate@5 (lower is better).
"""
from __future__ import annotations

import math
import re
import time

from ml.preprocessing.text_preprocessor import get_stop_words

from ..database.db import query_all
from . import matching_service, worker_service

BENCHMARK_QUERIES: list[tuple[str, str]] = [
    ("The split AC in my bedroom is not cooling and makes noise", "AC Technician"),
    ("Need someone to service and refill gas in two air conditioners", "AC Technician"),
    ("My washing machine stopped spinning and shows an error", "Appliance Repair Technician"),
    ("Refrigerator not cooling properly, need it repaired at home", "Appliance Repair Technician"),
    ("Install security cameras around my shop with phone viewing", "CCTV Installer"),
    ("CCTV recorder is not recording, need the DVR checked", "CCTV Installer"),
    ("Want a new wooden wardrobe made for my bedroom", "Carpenter"),
    ("Main door hinge is broken and the door does not close", "Carpenter"),
    ("Lights keep tripping, there is a problem in the wiring", "Electrician"),
    ("Need to fit new fans and switchboards in my flat", "Electrician"),
    ("Flower and balloon decoration for a birthday party at home", "Event Decorator"),
    ("Stage decoration for a wedding reception", "Event Decorator"),
    ("Need someone to maintain my terrace garden and plants", "Gardener"),
    ("Lawn mowing and hedge trimming for my house", "Gardener"),
    ("Deep cleaning of my 2BHK flat before moving in", "House Cleaner"),
    ("Kitchen and bathroom deep cleaning service", "House Cleaner"),
    ("Build a compound wall with bricks and plaster", "Mason"),
    ("Cracks in the wall need plastering and repair", "Mason"),
    ("My mattress has stains and needs sanitising", "Mattress Cleaner"),
    ("Steam cleaning for mattresses and pillows", "Mattress Cleaner"),
    ("Need fresh chicken and mutton supplied for a function", "Meat Seller"),
    ("Fish cleaning and cutting for a restaurant", "Meat Seller"),
    ("Fabricate a steel shed for my workshop", "Metal Fabricator"),
    ("Stainless steel railing for the staircase", "Metal Fabricator"),
    ("Paint the interior walls of my 3 bedroom house", "Painter"),
    ("Exterior painting and waterproof coating for my building", "Painter"),
    ("Cockroach problem in the kitchen, need pest control", "Pest Control Technician"),
    ("Termite treatment for wooden furniture", "Pest Control Technician"),
    ("Kitchen sink is leaking and the drain is blocked", "Plumber"),
    ("Install a new water tap and fix the bathroom pipe leak", "Plumber"),
    ("Roof is leaking during the rains, needs repair", "Roofer"),
    ("Replace broken roof sheets on my house", "Roofer"),
    ("Chaat and pani puri stall for a family function", "Street Food Vendor"),
    ("Need snacks counter like dosa and chaat for an event", "Street Food Vendor"),
    ("Stitch a blouse and alter two salwar suits", "Tailor"),
    ("Need trousers shortened and a shirt stitched", "Tailor"),
    ("Want a small custom tattoo on my wrist", "Tattoo Artist"),
    ("Cover up an old tattoo with a new design", "Tattoo Artist"),
    ("Bandhani dyeing for sarees and dupattas", "Tie & Dye Artisan"),
    ("Block printing on fabric for a clothing order", "Tie & Dye Artisan"),
    ("Lay new floor tiles in my living room", "Tile Installer"),
    ("Bathroom wall tiles are broken and need replacing", "Tile Installer"),
    ("Weld a new iron gate for my house", "Welder"),
    ("Repair the broken window grill by welding", "Welder"),
]

K = 10
METHODS = [
    ("keyword", "Keyword search", "Existing job portals: counts the query words found in a profile; ties keep listing order."),
    ("keyword_rating", "Keyword + rating sort", "Existing service marketplaces: keyword filter, then highest average rating first."),
    ("tfidf", "TF-IDF + cosine (skill only)", "Skill similarity without trust (TrueRank with λ = 1.0)."),
    ("truerank", "TrueRank (proposed)", "Skill similarity fused with the Composite Trust Score (λ = 0.7)."),
]

_cache: dict = {"key": None, "result": None}


# ----------------------------------------------------------------------------- relevance
def _grade(row, target: str) -> int:
    """2 = good hire, 1 = acceptable (right trade, little/average history), 0 = wrong trade or risky record."""
    if row["occupation"] != target:
        return 0
    m = worker_service.metrics_for_row(row)
    rating, completion = m["average_rating"], m["completion_rate"]
    jobs = m["jobs_completed"] or 0
    dispute_rate = (m["disputes"] or 0) / jobs if jobs else 0.0
    if (rating is not None and rating < 3.5) or (completion is not None and completion < 0.75) or dispute_rate > 0.08:
        return 0
    if rating is not None and rating >= 4.0 and completion is not None and completion >= 0.85 and dispute_rate <= 0.05:
        return 2
    return 1


def _why(row, target: str) -> dict:
    """Plain-language facts behind a grade, shown next to each worker in the per-request example."""
    m = worker_service.metrics_for_row(row)
    jobs = m["jobs_completed"] or 0
    if row["occupation"] != target:
        reason = "wrong_trade"
    else:
        g = _grade(row, target)
        reason = "good" if g == 2 else "little_history" if g == 1 else "low_trust"
    return {
        "reason": reason,
        "rating": m["average_rating"],
        "completion": m["completion_rate"],
        "dispute_rate": ((m["disputes"] or 0) / jobs) if jobs else 0.0,
        "trust": row["trust_score"],
    }


def _dcg(grades: list[int]) -> float:
    return sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(grades))


def _metrics(ranked_ids: list[int], grades: dict[int, int], ideal: list[int], target: str, rows) -> dict:
    top = ranked_ids[:K]
    g = [grades.get(w, 0) for w in top]
    ideal_dcg = _dcg(ideal[:K])
    first_good = next((i for i, x in enumerate(g) if x == 2), None)
    top5 = g[:5]
    return {
        "precision5": sum(1 for x in top5 if x == 2) / 5,
        "ndcg10": (_dcg(g) / ideal_dcg) if ideal_dcg else 0.0,
        "mrr": 1 / (first_good + 1) if first_good is not None else 0.0,
        "trade5": sum(1 for w in top[:5] if rows[w]["occupation"] == target) / 5,
        "risky5": sum(1 for x in top5 if x == 0) / 5,
    }


# ----------------------------------------------------------------------------- baselines
_word = re.compile(r"[a-z0-9]+")


def _keyword_tokens(text: str, stop: frozenset[str]) -> set[str]:
    return {t for t in _word.findall(text.lower()) if len(t) > 2 and t not in stop}


def _keyword_scores(query: str, docs: dict[int, set[str]], stop) -> dict[int, int]:
    q = _keyword_tokens(query, stop)
    scores = {}
    for wid, words in docs.items():
        n = len(q & words)
        if n:
            scores[wid] = n
    return scores


# ----------------------------------------------------------------------------- run
def run_benchmark(force: bool = False) -> dict:
    svc = matching_service.service()
    svc.ensure_index()
    rows = {r["id"]: r for r in query_all(matching_service.ACTIVE_WORKERS_SQL + " AND wp.is_available = 1")}
    cache_key = (len(rows), sum(round(r["trust_score"] * 1e6) for r in rows.values()), svc.engine.index.document_count)
    if not force and _cache["key"] == cache_key:
        return _cache["result"]

    started = time.perf_counter()
    stop = get_stop_words()
    raw_docs = svc._load_documents()
    kw_docs = {wid: _keyword_tokens(text, stop) for wid, text in raw_docs.items() if wid in rows}
    trust = {wid: r["trust_score"] for wid, r in rows.items()}

    totals = {key: {"precision5": 0.0, "ndcg10": 0.0, "mrr": 0.0, "trade5": 0.0, "risky5": 0.0} for key, _, _ in METHODS}
    per_query = []
    for query, target in BENCHMARK_QUERIES:
        grades = {wid: _grade(r, target) for wid, r in rows.items()}
        ideal = sorted(grades.values(), reverse=True)

        kw = _keyword_scores(query, kw_docs, stop)
        rankings = {
            "keyword": sorted(kw, key=lambda w: (-kw[w], w)),
            "keyword_rating": sorted(
                kw, key=lambda w: (-(rows[w]["stat_rating_avg"] or 0.0), -(rows[w]["stat_rating_count"] or 0), w)
            ),
        }
        for key, lam in (("tfidf", 1.0), ("truerank", None)):
            outcome = svc.engine.match(query=query, trust_scores=trust, allowed_ids=rows.keys(), top_n=K, lambda_weight=lam)
            rankings[key] = [r.worker_id for r in outcome.results]

        q_row = {"query": query, "trade": target, "methods": {}}
        for key, _, _ in METHODS:
            m = _metrics(rankings[key], grades, ideal, target, rows)
            for name, value in m.items():
                totals[key][name] += value
            q_row["methods"][key] = {
                "precision5": m["precision5"],
                "top5": [
                    {"id": w, "name": rows[w]["name"], "occupation": rows[w]["occupation"], "grade": grades.get(w, 0),
                     **_why(rows[w], target)}
                    for w in rankings[key][:5]
                ],
            }
        per_query.append(q_row)

    n = len(BENCHMARK_QUERIES)
    methods = []
    for key, label, description in METHODS:
        avg = {name: value / n for name, value in totals[key].items()}
        methods.append({"key": key, "label": label, "description": description, **avg})

    proposed = next(m for m in methods if m["key"] == "truerank")
    existing = [m for m in methods if m["key"] in ("keyword", "keyword_rating")]
    # Improvement over the BEST existing method on each metric (lower is better for the risky-hire rate).
    improvement = {}
    for name in ("precision5", "ndcg10", "mrr", "trade5", "risky5"):
        best = min(m[name] for m in existing) if name == "risky5" else max(m[name] for m in existing)
        improvement[name] = proposed[name] - best
    # Request-by-request comparison on Precision@5: on how many requests is TrueRank better / equal / worse?
    head_to_head = {}
    for key, _, _ in METHODS:
        if key == "truerank":
            continue
        win = tie = loss = 0
        for q in per_query:
            t, b = q["methods"]["truerank"]["precision5"], q["methods"][key]["precision5"]
            if t > b + 1e-9:
                win += 1
            elif t < b - 1e-9:
                loss += 1
            else:
                tie += 1
        head_to_head[key] = {"win": win, "tie": tie, "loss": loss}

    result = {
        "workers_evaluated": len(rows),
        "queries": n,
        "k": K,
        "criteria": {
            "good_hire": "Right trade AND rating ≥ 4.0, completion ≥ 85 %, disputes ≤ 5 % of completed jobs",
            "acceptable": "Right trade, not enough history to call it reliable or risky",
            "risky": "Wrong trade, or rating < 3.5, completion < 75 % or disputes > 8 %",
        },
        "methods": methods,
        "improvement": improvement,
        "head_to_head": head_to_head,
        "per_query": per_query,
        "runtime_ms": round((time.perf_counter() - started) * 1000),
    }
    _cache["key"] = cache_key
    _cache["result"] = result
    return result
