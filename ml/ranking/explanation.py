"""
Stage 7 - Recommendation explanation.

Every sentence is generated from values that the pipeline actually computed.
The thresholds below only choose *words* ("strong", "high"); they never change
any score or the ranking order.
"""
from __future__ import annotations

from collections.abc import Sequence

SIMILARITY_STRONG = 0.30
SIMILARITY_MODERATE = 0.15
TRUST_HIGH = 0.75
TRUST_MODERATE = 0.55
GOOD_RATING = 4.0
LOW_RATING = 3.5
GOOD_COMPLETION = 0.90
LOW_COMPLETION = 0.75


def similarity_label(similarity: float) -> str:
    if similarity >= SIMILARITY_STRONG:
        return "strong"
    if similarity >= SIMILARITY_MODERATE:
        return "moderate"
    return "partial"


def trust_label(trust: float) -> str:
    if trust >= TRUST_HIGH:
        return "high"
    if trust >= TRUST_MODERATE:
        return "moderate"
    return "developing"


def _quote_list(words: Sequence[str], limit: int = 4) -> str:
    shown = [f"“{w}”" for w in words[:limit]]
    if len(shown) <= 1:
        return "".join(shown)
    return ", ".join(shown[:-1]) + " and " + shown[-1]


def build_explanation(
    similarity: float,
    trust: float,
    matched_terms: Sequence[str],
    trust_components: Sequence[dict],
    metrics: dict,
    experience_years: float | None,
    is_verified: bool,
) -> dict:
    reasons: list[dict] = []
    sim_word = similarity_label(similarity)
    trust_word = trust_label(trust)

    if matched_terms:
        reasons.append({
            "kind": "positive" if sim_word != "partial" else "neutral",
            "text": f"{sim_word.capitalize()} skill similarity ({similarity:.2f}) on {_quote_list(matched_terms)}",
        })

    reasons.append({
        "kind": "positive" if trust_word == "high" else ("neutral" if trust_word == "moderate" else "caution"),
        "text": f"{trust_word.capitalize()} trust score ({trust:.2f})",
    })

    avg = metrics.get("average_rating")
    count = metrics.get("rating_count") or 0
    if avg is not None:
        if avg >= GOOD_RATING:
            reasons.append({"kind": "positive", "text": f"Good customer rating: {avg:.1f} / 5 from {count} ratings"})
        elif avg < LOW_RATING:
            reasons.append({"kind": "caution", "text": f"Below-average rating: {avg:.1f} / 5 from {count} ratings"})
        else:
            reasons.append({"kind": "neutral", "text": f"Rating {avg:.1f} / 5 from {count} ratings"})

    rate = metrics.get("completion_rate")
    if rate is not None:
        if rate >= GOOD_COMPLETION:
            reasons.append({"kind": "positive", "text": f"High completion rate: {rate * 100:.0f}%"})
        elif rate < LOW_COMPLETION:
            reasons.append({"kind": "caution", "text": f"Lower completion rate: {rate * 100:.0f}%"})
        else:
            reasons.append({"kind": "neutral", "text": f"Completion rate {rate * 100:.0f}%"})

    disputes = metrics.get("disputes") or 0
    if disputes:
        reasons.append({"kind": "caution", "text": f"{disputes} dispute{'s' if disputes != 1 else ''} on record"})

    if is_verified:
        reasons.append({"kind": "positive", "text": "Verified worker"})

    if experience_years:
        years = int(experience_years) if float(experience_years).is_integer() else experience_years
        reasons.append({"kind": "neutral", "text": f"{years} year{'s' if experience_years != 1 else ''} of practical experience (shown for context, not scored)"})

    missing = [c["label"] for c in trust_components if not c.get("has_data")]
    if missing:
        reasons.append({
            "kind": "caution",
            "text": "Not enough data yet for " + ", ".join(missing) + " - a neutral value is used",
        })

    if matched_terms:
        summary = (
            f"Recommended because the profile has {sim_word} similarity with your request "
            f"({_quote_list(matched_terms, 3)}) and the worker has a {trust_word} trust score."
        )
    else:
        summary = f"Ranked on trust score ({trust_word}); the skill overlap with the request is small."

    return {"summary": summary, "reasons": reasons}
