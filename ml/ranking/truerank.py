"""
Stage 6 of the TrueRank pipeline - Score Fusion and Ranking (paper, Methodology E).

    R(w, q) = lambda * S(w, q) + (1 - lambda) * TS(w)      (eq. 3), lambda = 0.70
            = 0.7 * S(w, q) + 0.3 * TS(w)

Workers are returned in decreasing order of R(w, q).

Implementation additions (documented in docs/ARCHITECTURE.md):
  * candidate filter tau: workers with S(w, q) < tau are not ranked, so that a
    highly trusted worker with no skill overlap cannot appear for an unrelated request;
  * deterministic tie-breaking: equal R is broken by higher S, then lower worker id.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

import numpy as np


def truerank_score(similarity: float, trust: float, lambda_weight: float) -> float:
    if not 0.0 <= lambda_weight <= 1.0:
        raise ValueError("lambda_weight must be between 0 and 1.")
    return lambda_weight * similarity + (1.0 - lambda_weight) * trust


@dataclass(frozen=True)
class RankedCandidate:
    rank: int
    worker_id: int
    similarity: float
    trust: float
    final_score: float
    similarity_part: float  # lambda * S
    trust_part: float       # (1 - lambda) * TS


@dataclass(frozen=True)
class RankingSummary:
    candidates_considered: int
    candidates_above_threshold: int
    ranked: tuple[RankedCandidate, ...]


def rank_workers(
    worker_ids: list[int],
    similarities: np.ndarray,
    trust_scores: Mapping[int, float],
    lambda_weight: float,
    min_similarity: float,
    top_n: int | None = None,
    allowed_ids: Iterable[int] | None = None,
) -> RankingSummary:
    if len(worker_ids) != len(similarities):
        raise ValueError("worker_ids and similarities must have the same length.")

    allowed = set(allowed_ids) if allowed_ids is not None else None
    scored: list[tuple[float, float, int, float]] = []
    considered = 0
    for worker_id, similarity in zip(worker_ids, similarities):
        if allowed is not None and worker_id not in allowed:
            continue
        if worker_id not in trust_scores:
            continue
        considered += 1
        s = float(similarity)
        if s < min_similarity or s <= 0.0:
            continue
        ts = float(trust_scores[worker_id])
        scored.append((truerank_score(s, ts, lambda_weight), s, worker_id, ts))

    # Sort: final score desc, similarity desc, worker id asc
    scored.sort(key=lambda row: (-row[0], -row[1], row[2]))
    if top_n is not None:
        selected = scored[:top_n]
    else:
        selected = scored

    ranked = tuple(
        RankedCandidate(
            rank=i + 1,
            worker_id=worker_id,
            similarity=s,
            trust=ts,
            final_score=final,
            similarity_part=lambda_weight * s,
            trust_part=(1.0 - lambda_weight) * ts,
        )
        for i, (final, s, worker_id, ts) in enumerate(selected)
    )
    return RankingSummary(
        candidates_considered=considered,
        candidates_above_threshold=len(scored),
        ranked=ranked,
    )
