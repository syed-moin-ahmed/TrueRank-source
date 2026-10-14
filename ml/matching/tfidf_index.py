"""
Stages 3 and 4 of the TrueRank pipeline (paper, Methodology C).

Stage 3 - TF-IDF vectorization, eq. (1):  TF-IDF(t, d) = TF(t, d) x IDF(t)
    scikit-learn's TfidfVectorizer is used with:
      * smooth_idf=True  ->  IDF(t) = ln((1 + n) / (1 + df(t))) + 1
      * norm="l2"        ->  every document vector has length 1
      * sublinear_tf=False (raw term counts)

Stage 4 - Cosine similarity S(w, q) between the query vector and every worker vector.
    Because all vectors are L2-normalised, cos(q, w) = sum_i q_i * w_i, so the
    contribution of each shared term can be reported exactly (explainability).
    TF-IDF weights are never negative, so S(w, q) is always in [0, 1].
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass(frozen=True)
class TermContribution:
    term: str
    query_weight: float
    worker_weight: float
    contribution: float  # query_weight * worker_weight


class TfidfIndex:
    """TF-IDF matrix of all worker documents, ready for cosine-similarity search."""

    def __init__(self, ngram_range: tuple[int, int] = (1, 1)) -> None:
        self.ngram_range = ngram_range
        self.worker_ids: list[int] = []
        self._position: dict[int, int] = {}
        self._vectorizer: TfidfVectorizer | None = None
        self._matrix: csr_matrix | None = None
        self._feature_names: np.ndarray | None = None

    # ------------------------------------------------------------------ fitting
    def fit(self, worker_ids: list[int], processed_documents: list[str]) -> "TfidfIndex":
        if len(worker_ids) != len(processed_documents):
            raise ValueError("worker_ids and processed_documents must have the same length.")
        if len(set(worker_ids)) != len(worker_ids):
            raise ValueError("worker_ids must be unique.")

        self.worker_ids = list(worker_ids)
        self._position = {wid: i for i, wid in enumerate(self.worker_ids)}

        if not any(doc.strip() for doc in processed_documents):
            # Nothing to learn a vocabulary from (e.g. empty database).
            self._vectorizer = None
            self._matrix = None
            self._feature_names = np.array([], dtype=object)
            return self

        self._vectorizer = TfidfVectorizer(
            lowercase=False,          # text is already preprocessed
            token_pattern=r"\S+",     # terms are already separated by single spaces
            ngram_range=self.ngram_range,
            norm="l2",
            use_idf=True,
            smooth_idf=True,
            sublinear_tf=False,
        )
        self._matrix = self._vectorizer.fit_transform(processed_documents).tocsr()
        self._feature_names = self._vectorizer.get_feature_names_out()
        return self

    # --------------------------------------------------------------- properties
    @property
    def is_ready(self) -> bool:
        return self._vectorizer is not None and self._matrix is not None

    @property
    def document_count(self) -> int:
        return len(self.worker_ids)

    @property
    def vocabulary_size(self) -> int:
        return 0 if self._feature_names is None else len(self._feature_names)

    def in_vocabulary(self, term: str) -> bool:
        return self.is_ready and term in self._vectorizer.vocabulary_

    # ------------------------------------------------------------------ queries
    def transform(self, processed_query: str) -> csr_matrix | None:
        if not self.is_ready:
            return None
        return self._vectorizer.transform([processed_query]).tocsr()

    def similarities(self, query_vector: csr_matrix | None) -> np.ndarray:
        """S(w, q) for every indexed worker, in the order of self.worker_ids."""
        if not self.is_ready or query_vector is None or query_vector.nnz == 0:
            return np.zeros(self.document_count, dtype=float)
        return cosine_similarity(query_vector, self._matrix).ravel()

    def similarity_with_worker(self, query_vectors: csr_matrix, worker_id: int) -> np.ndarray:
        """Similarity of several query vectors against one worker (used for worker opportunities)."""
        if not self.is_ready or worker_id not in self._position:
            return np.zeros(query_vectors.shape[0] if query_vectors is not None else 0)
        row = self._matrix[self._position[worker_id]]
        return cosine_similarity(query_vectors, row).ravel()

    def transform_many(self, processed_queries: list[str]) -> csr_matrix | None:
        if not self.is_ready or not processed_queries:
            return None
        return self._vectorizer.transform(processed_queries).tocsr()

    def term_contributions(self, query_vector: csr_matrix | None, worker_id: int) -> list[TermContribution]:
        """Exact per-term decomposition of the cosine similarity (largest first)."""
        if not self.is_ready or query_vector is None or worker_id not in self._position:
            return []
        worker_row = self._matrix[self._position[worker_id]]
        product = query_vector.multiply(worker_row).tocsr()
        contributions: list[TermContribution] = []
        for column, value in zip(product.indices, product.data):
            if value <= 0:
                continue
            contributions.append(
                TermContribution(
                    term=str(self._feature_names[column]),
                    query_weight=float(query_vector[0, column]),
                    worker_weight=float(worker_row[0, column]),
                    contribution=float(value),
                )
            )
        contributions.sort(key=lambda c: c.contribution, reverse=True)
        return contributions
