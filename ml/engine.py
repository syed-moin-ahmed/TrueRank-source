"""
TrueRankEngine - the full research pipeline behind one object.

    User query + worker profiles
        -> preprocessing           (ml.preprocessing.text_preprocessor)
        -> TF-IDF vectorization    (ml.matching.tfidf_index)
        -> cosine similarity       (ml.matching.tfidf_index)
        -> composite trust score   (ml.trust.trust_score, supplied per worker)
        -> score fusion & ranking  (ml.ranking.truerank)

The engine knows nothing about Flask or the database: the backend hands it plain
Python data, which keeps the research core testable on its own.
"""
from __future__ import annotations

import threading
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from ml.config import TrueRankConfig
from ml.matching.tfidf_index import TfidfIndex
from ml.preprocessing.synonyms import expansion_for
from ml.preprocessing.text_preprocessor import PreprocessResult, preprocess, preprocess_to_text
from ml.ranking.truerank import RankingSummary, rank_workers


@dataclass(frozen=True)
class MatchedTerm:
    term: str            # processed (lemmatized) term
    display: str         # word as the user typed it
    contribution: float  # share of the cosine similarity


@dataclass(frozen=True)
class MatchResultRow:
    rank: int
    worker_id: int
    similarity: float
    trust: float
    final_score: float
    similarity_part: float
    trust_part: float
    matched_terms: tuple[MatchedTerm, ...]


@dataclass(frozen=True)
class MatchOutcome:
    query: PreprocessResult
    known_terms: tuple[str, ...]
    unknown_terms: tuple[str, ...]
    expansions: tuple[tuple[str, tuple[str, ...]], ...]
    documents_indexed: int
    vocabulary_size: int
    lambda_weight: float
    min_similarity: float
    candidates_considered: int
    candidates_above_threshold: int
    results: tuple[MatchResultRow, ...] = field(default_factory=tuple)


class TrueRankEngine:
    def __init__(self, config: TrueRankConfig) -> None:
        self.config = config
        self._index = TfidfIndex(ngram_range=config.ngram_range)
        self._lock = threading.Lock()

    # ----------------------------------------------------------------- indexing
    def build(self, raw_documents: Mapping[int, str]) -> None:
        """(Re)build the TF-IDF index from {worker_id: raw profile text}."""
        worker_ids = sorted(raw_documents)
        processed = [preprocess_to_text(raw_documents[wid]) for wid in worker_ids]
        new_index = TfidfIndex(ngram_range=self.config.ngram_range).fit(worker_ids, processed)
        with self._lock:
            self._index = new_index  # atomic swap: running requests keep the old index

    @property
    def index(self) -> TfidfIndex:
        return self._index

    # ------------------------------------------------------------------ matching
    def match(
        self,
        query: str,
        trust_scores: Mapping[int, float],
        allowed_ids: Iterable[int] | None = None,
        top_n: int | None = None,
        lambda_weight: float | None = None,
    ) -> MatchOutcome:
        index = self._index
        lam = self.config.lambda_weight if lambda_weight is None else lambda_weight
        top = self.config.default_top_n if top_n is None else top_n

        processed = preprocess(query)
        unique_terms = list(dict.fromkeys(processed.terms))
        known = tuple(t for t in unique_terms if index.in_vocabulary(t))
        unknown = tuple(t for t in unique_terms if not index.in_vocabulary(t))

        # Everyday words that no profile uses (e.g. "maid", "fridge") are expanded to profile vocabulary.
        expansions = []
        extra_terms: list[str] = []
        for term in unknown:
            text = expansion_for(term)
            if text:
                added = tuple(t for t in dict.fromkeys(preprocess(text).terms) if index.in_vocabulary(t))
                if added:
                    expansions.append((term, added))
                    extra_terms.extend(added)
        query_text = processed.text if not extra_terms else f"{processed.text} {' '.join(extra_terms)}"

        query_vector = index.transform(query_text)
        similarities = index.similarities(query_vector)

        summary: RankingSummary = rank_workers(
            worker_ids=index.worker_ids,
            similarities=similarities,
            trust_scores=trust_scores,
            lambda_weight=lam,
            min_similarity=self.config.min_similarity,
            top_n=top,
            allowed_ids=allowed_ids,
        )

        rows = []
        for candidate in summary.ranked:
            contributions = index.term_contributions(query_vector, candidate.worker_id)
            matched = tuple(
                MatchedTerm(
                    term=c.term,
                    display=" ".join(processed.surface_forms.get(part, part) for part in c.term.split(" ")),
                    contribution=c.contribution,
                )
                for c in contributions
            )
            rows.append(
                MatchResultRow(
                    rank=candidate.rank,
                    worker_id=candidate.worker_id,
                    similarity=candidate.similarity,
                    trust=candidate.trust,
                    final_score=candidate.final_score,
                    similarity_part=candidate.similarity_part,
                    trust_part=candidate.trust_part,
                    matched_terms=matched,
                )
            )

        return MatchOutcome(
            query=processed,
            known_terms=known,
            unknown_terms=unknown,
            expansions=tuple(expansions),
            documents_indexed=index.document_count,
            vocabulary_size=index.vocabulary_size,
            lambda_weight=lam,
            min_similarity=self.config.min_similarity,
            candidates_considered=summary.candidates_considered,
            candidates_above_threshold=summary.candidates_above_threshold,
            results=tuple(rows),
        )

    def similarity_to_queries(self, worker_id: int, queries: list[str]) -> list[float]:
        """S(w, q) of one worker against many queries (worker 'recommended requests' page)."""
        index = self._index
        vectors = index.transform_many([preprocess_to_text(q) for q in queries])
        if vectors is None:
            return [0.0] * len(queries)
        return [float(v) for v in index.similarity_with_worker(vectors, worker_id)]
