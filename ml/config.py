"""
Central configuration for the TrueRank research core.

Every number used by the pipeline lives here so that it can be shown,
explained and changed in one place.

RESEARCH VALUES (from the paper, do not change without a reason):
    Trust weights   alpha=0.40 (AR), beta=0.20 (CR), gamma=0.20 (PE), delta=0.20 (DA)   -> eq. (2)
    Fusion weight   lambda=0.70                                                         -> eq. (3)

IMPLEMENTATION VALUES (added for the web application, documented in docs/ARCHITECTURE.md):
    pe_cap          endorsements needed for PE = 1.0
    neutral_prior   value used for a trust component that has no data yet (cold start)
    min_similarity  candidate filter tau: workers with S(w,q) below this are not ranked
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

_EPSILON = 1e-9


@dataclass(frozen=True)
class TrustWeights:
    """Weights of the Composite Trust Score, TS = aAR + bCR + gPE + dDA (paper eq. 2)."""

    alpha_ar: float = 0.40  # Average Rating
    beta_cr: float = 0.20   # Completion Rate
    gamma_pe: float = 0.20  # Peer Endorsements
    delta_da: float = 0.20  # Dispute Adjustment

    def __post_init__(self) -> None:
        values = (self.alpha_ar, self.beta_cr, self.gamma_pe, self.delta_da)
        if any(v < 0 for v in values):
            raise ValueError("Trust weights must be non-negative.")
        if abs(sum(values) - 1.0) > _EPSILON:
            raise ValueError(f"Trust weights must sum to 1.0 (got {sum(values):.4f}).")

    def as_dict(self) -> dict[str, float]:
        return {"AR": self.alpha_ar, "CR": self.beta_cr, "PE": self.gamma_pe, "DA": self.delta_da}


@dataclass(frozen=True)
class TrueRankConfig:
    trust_weights: TrustWeights = field(default_factory=TrustWeights)
    lambda_weight: float = 0.70          # R(w,q) = lambda*S + (1-lambda)*TS
    min_similarity: float = 0.05         # tau, candidate filter (implementation addition)
    pe_cap: int = 20                     # endorsements that give PE = 1.0
    neutral_prior: float = 0.50          # cold-start value for a component with no data
    include_reviews_in_document: bool = True
    ngram_max: int = 1                   # 1 = unigrams (paper); 2 = unigrams + bigrams
    default_top_n: int = 10

    def __post_init__(self) -> None:
        if not 0.0 <= self.lambda_weight <= 1.0:
            raise ValueError("lambda_weight must be between 0 and 1.")
        if not 0.0 <= self.min_similarity < 1.0:
            raise ValueError("min_similarity must be in [0, 1).")
        if self.pe_cap < 1:
            raise ValueError("pe_cap must be at least 1.")
        if not 0.0 <= self.neutral_prior <= 1.0:
            raise ValueError("neutral_prior must be between 0 and 1.")
        if self.ngram_max not in (1, 2):
            raise ValueError("ngram_max must be 1 or 2.")
        if self.default_top_n < 1:
            raise ValueError("default_top_n must be at least 1.")

    @property
    def ngram_range(self) -> tuple[int, int]:
        return (1, self.ngram_max)

    @classmethod
    def from_env(cls) -> "TrueRankConfig":
        """Build the configuration from TRUERANK_* environment variables (all optional)."""

        def _float(name: str, default: float) -> float:
            raw = os.getenv(name)
            return default if raw in (None, "") else float(raw)

        def _int(name: str, default: int) -> int:
            raw = os.getenv(name)
            return default if raw in (None, "") else int(raw)

        def _bool(name: str, default: bool) -> bool:
            raw = os.getenv(name)
            return default if raw in (None, "") else raw.strip().lower() in {"1", "true", "yes"}

        base = cls()
        weights = TrustWeights(
            alpha_ar=_float("TRUERANK_WEIGHT_AR", base.trust_weights.alpha_ar),
            beta_cr=_float("TRUERANK_WEIGHT_CR", base.trust_weights.beta_cr),
            gamma_pe=_float("TRUERANK_WEIGHT_PE", base.trust_weights.gamma_pe),
            delta_da=_float("TRUERANK_WEIGHT_DA", base.trust_weights.delta_da),
        )
        return cls(
            trust_weights=weights,
            lambda_weight=_float("TRUERANK_LAMBDA", base.lambda_weight),
            min_similarity=_float("TRUERANK_MIN_SIMILARITY", base.min_similarity),
            pe_cap=_int("TRUERANK_PE_CAP", base.pe_cap),
            neutral_prior=_float("TRUERANK_NEUTRAL_PRIOR", base.neutral_prior),
            include_reviews_in_document=_bool("TRUERANK_INCLUDE_REVIEWS", base.include_reviews_in_document),
            ngram_max=_int("TRUERANK_NGRAM_MAX", base.ngram_max),
            default_top_n=_int("TRUERANK_TOP_N", base.default_top_n),
        )

    def describe(self) -> dict:
        """JSON-friendly description used by the API and the UI."""
        w = self.trust_weights
        return {
            "trust_weights": w.as_dict(),
            "trust_formula": (
                f"TS = {w.alpha_ar:.2f}·AR + {w.beta_cr:.2f}·CR + {w.gamma_pe:.2f}·PE + {w.delta_da:.2f}·DA"
            ),
            "lambda": self.lambda_weight,
            "ranking_formula": (
                f"R(w,q) = {self.lambda_weight:.2f}·S(w,q) + {1 - self.lambda_weight:.2f}·TS(w)"
            ),
            "min_similarity": self.min_similarity,
            "pe_cap": self.pe_cap,
            "neutral_prior": self.neutral_prior,
            "include_reviews_in_document": self.include_reviews_in_document,
            "ngram_range": list(self.ngram_range),
        }
