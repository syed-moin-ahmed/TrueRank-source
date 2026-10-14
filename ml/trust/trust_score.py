"""
Stage 5 of the TrueRank pipeline - Composite Trust Score (paper, Methodology D).

    TS = a*AR + b*CR + g*PE + d*DA          (eq. 2)
    with a = 0.40, b = 0.20, g = 0.20, d = 0.20

Normalisation layer (every component is mapped to [0, 1] so that TS is in [0, 1]
and can be fused with cosine similarity, which is also in [0, 1]):

    AR  Average Rating        = average star rating / 5
    CR  Completion Rate       = jobs completed / (jobs completed + jobs abandoned)
    PE  Peer Endorsements     = min(endorsements, PE_CAP) / PE_CAP
    DA  Dispute Adjustment    = 1 - min(1, disputes / max(jobs completed, 1))

DA is the "inverted weight for the dispute counter" described in the paper: a worker
with no disputes gets DA = 1, and every dispute lowers it. Because it is inverted,
the published +0.20 weight is used unchanged and the four weights still sum to 1.

Cold start: when a component has no underlying data (e.g. no ratings yet), the UI
shows "Not enough data" and the score uses the documented neutral prior instead.
"""
from __future__ import annotations

from dataclasses import dataclass

from ml.config import TrustWeights

RATING_SCALE_MAX = 5.0


@dataclass(frozen=True)
class TrustInputs:
    """Raw behavioural evidence for one worker."""

    rating_sum: float = 0.0
    rating_count: int = 0
    jobs_completed: int = 0
    jobs_closed: int = 0      # completed + abandoned (withdrawn after accepting)
    endorsements: int = 0
    disputes: int = 0         # disputes not dismissed by an admin

    def __post_init__(self) -> None:
        if min(self.rating_count, self.jobs_completed, self.jobs_closed, self.endorsements, self.disputes) < 0:
            raise ValueError("Trust inputs cannot be negative.")
        if self.jobs_closed < self.jobs_completed:
            raise ValueError("jobs_closed must be >= jobs_completed.")
        if self.rating_count == 0 and self.rating_sum != 0:
            raise ValueError("rating_sum must be 0 when there are no ratings.")
        if self.rating_count > 0:
            average = self.rating_sum / self.rating_count
            if not 1.0 - 1e-9 <= average <= RATING_SCALE_MAX + 1e-9:
                raise ValueError("Average rating must be between 1 and 5.")

    @property
    def average_rating(self) -> float | None:
        return None if self.rating_count == 0 else self.rating_sum / self.rating_count

    @property
    def completion_rate(self) -> float | None:
        return None if self.jobs_closed == 0 else self.jobs_completed / self.jobs_closed


@dataclass(frozen=True)
class TrustComponent:
    key: str                # AR / CR / PE / DA
    label: str
    weight: float
    value: float | None     # normalised value in [0, 1]; None = not enough data
    used_value: float       # value actually used in TS (value, or neutral prior)
    evidence: str           # human-readable explanation of the raw data

    @property
    def has_data(self) -> bool:
        return self.value is not None

    @property
    def weighted(self) -> float:
        return self.weight * self.used_value

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "weight": self.weight,
            "value": self.value,
            "used_value": self.used_value,
            "weighted": self.weighted,
            "has_data": self.has_data,
            "evidence": self.evidence,
        }


@dataclass(frozen=True)
class TrustResult:
    score: float
    components: tuple[TrustComponent, ...]

    @property
    def has_full_data(self) -> bool:
        return all(c.has_data for c in self.components)

    def component(self, key: str) -> TrustComponent:
        for c in self.components:
            if c.key == key:
                return c
        raise KeyError(key)

    def as_dict(self) -> dict:
        return {
            "score": self.score,
            "has_full_data": self.has_full_data,
            "components": [c.as_dict() for c in self.components],
        }


def compute_trust(
    inputs: TrustInputs,
    weights: TrustWeights,
    pe_cap: int,
    neutral_prior: float,
) -> TrustResult:
    if pe_cap < 1:
        raise ValueError("pe_cap must be >= 1")

    # AR - Average Rating
    if inputs.rating_count > 0:
        avg = inputs.average_rating
        ar = avg / RATING_SCALE_MAX
        ar_evidence = f"{avg:.2f} / 5 from {inputs.rating_count} rating{'s' if inputs.rating_count != 1 else ''}"
    else:
        ar, ar_evidence = None, "No ratings yet"

    # CR - Completion Rate
    if inputs.jobs_closed > 0:
        cr = inputs.jobs_completed / inputs.jobs_closed
        cr_evidence = f"{inputs.jobs_completed} of {inputs.jobs_closed} accepted jobs completed"
    else:
        cr, cr_evidence = None, "No finished jobs yet"

    # PE - Peer Endorsements (always known: zero endorsements is real data)
    pe = min(inputs.endorsements, pe_cap) / pe_cap
    pe_evidence = f"{inputs.endorsements} endorsement{'s' if inputs.endorsements != 1 else ''} (cap {pe_cap})"

    # DA - Dispute Adjustment (inverted dispute rate)
    if inputs.jobs_completed > 0 or inputs.disputes > 0:
        dispute_rate = min(1.0, inputs.disputes / max(inputs.jobs_completed, 1))
        da = 1.0 - dispute_rate
        da_evidence = (
            f"{inputs.disputes} dispute{'s' if inputs.disputes != 1 else ''} over "
            f"{inputs.jobs_completed} completed job{'s' if inputs.jobs_completed != 1 else ''}"
        )
    else:
        da, da_evidence = None, "No job history yet"

    def _component(key: str, label: str, weight: float, value: float | None, evidence: str) -> TrustComponent:
        used = neutral_prior if value is None else value
        return TrustComponent(key, label, weight, value, used, evidence)

    components = (
        _component("AR", "Average Rating", weights.alpha_ar, ar, ar_evidence),
        _component("CR", "Completion Rate", weights.beta_cr, cr, cr_evidence),
        _component("PE", "Peer Endorsements", weights.gamma_pe, pe, pe_evidence),
        _component("DA", "Dispute Adjustment", weights.delta_da, da, da_evidence),
    )
    score = sum(c.weighted for c in components)
    # Guard against floating-point drift outside [0, 1]
    score = min(1.0, max(0.0, score))
    return TrustResult(score=score, components=components)
