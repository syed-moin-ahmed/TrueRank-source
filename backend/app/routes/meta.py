"""Public, read-only information used by the landing / research pages."""
from flask import Blueprint, jsonify, request

from ml.preprocessing.text_preprocessor import preprocess

from ..database.db import query_all, scalar
from ..services import evaluation_service, matching_service
from ..utils.errors import bad_request

bp = Blueprint("meta", __name__, url_prefix="/api/meta")

# Results from the TrueRank research paper (Table 1 and Table 2).
RESEARCH_RESULTS = {
    "label": "TrueRank research paper results.",
    "dataset": "Custom dataset of 1,500 informal worker profiles (Bengaluru, Mumbai, Delhi, Hyderabad, Chennai)",
    "model_comparison": [
        {"model": "Naïve Bayes", "accuracy": 78.4, "precision": 77.9, "recall": 76.8, "f1": 77.3},
        {"model": "Logistic Regression", "accuracy": 82.1, "precision": 81.6, "recall": 80.9, "f1": 81.2},
        {"model": "SVM", "accuracy": 85.7, "precision": 85.2, "recall": 84.6, "f1": 84.8},
        {"model": "Random Forest", "accuracy": 87.9, "precision": 87.4, "recall": 87.1, "f1": 87.2},
        {"model": "TrueRank (Proposed)", "accuracy": 90.6, "precision": 90.2, "recall": 89.8, "f1": 90.0},
    ],
    "component_isolation": [
        {"variant": "Full TrueRank Model", "accuracy": 90.6},
        {"variant": "Without Trust Score", "accuracy": 87.3},
        {"variant": "Without TF-IDF Semantic Layer", "accuracy": 84.1},
        {"variant": "Without Review Sentiment Feature", "accuracy": 86.0},
        {"variant": "Baseline (TF-IDF only)", "accuracy": 78.4},
    ],
}


@bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@bp.get("/config")
def config():
    return jsonify(matching_service.service().engine.config.describe())


@bp.get("/research-results")
def research_results():
    return jsonify(RESEARCH_RESULTS)


@bp.get("/overview")
def overview():
    """Live counts from THIS application's database (labelled with their data source)."""
    sources = {r["source"]: r["n"] for r in query_all("SELECT source, COUNT(*) AS n FROM worker_profiles GROUP BY source")}
    return jsonify({
        "worker_profiles": sum(sources.values()),
        "worker_sources": sources,
        "occupations": scalar("SELECT COUNT(DISTINCT occupation) FROM worker_profiles") or 0,
        "cities": scalar("SELECT COUNT(DISTINCT city) FROM worker_profiles") or 0,
        "occupation_names": [r[0] for r in query_all(
            "SELECT occupation FROM worker_profiles GROUP BY occupation ORDER BY COUNT(*) DESC LIMIT 24")],
        "network": _network_sample(),
    })


def _network_sample(limit: int = 420) -> dict:
    """Anonymous points for the 3D network on the landing page: occupation + trust score only (no names)."""
    rows = query_all("SELECT occupation, trust_score FROM worker_profiles ORDER BY id LIMIT ?", (limit,))
    occupations = sorted({r["occupation"] for r in rows})
    index = {o: i for i, o in enumerate(occupations)}
    return {
        "occupations": occupations,
        "points": [[index[r["occupation"]], round(r["trust_score"], 3)] for r in rows],
    }


@bp.post("/preprocess")
def preprocess_demo():
    """Public demo of Stage 2 (used on the 'How it works' page). Stateless, no database access."""
    text = ((request.get_json(silent=True) or {}).get("text") or "").strip()
    if not 1 <= len(text) <= 600:
        raise bad_request("Enter between 1 and 600 characters.")
    return jsonify(preprocess(text).as_dict())


@bp.get("/benchmark")
def benchmark():
    """Existing search methods vs TrueRank on the live database (cached until profiles or trust scores change)."""
    data = evaluation_service.run_benchmark()
    if request.args.get("details") != "1":
        data = {k: v for k, v in data.items() if k != "per_query"}
    return jsonify(data)
