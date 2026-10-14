"""
Builds the single "worker profile text" described in the paper (Methodology B):
"we patch together the skills and the bio texts into one single string which
gives us the final worker profile vector".

Fields used (in this order):
    occupation, skills, profile description, work-history entries,
    and - if enabled - customer review text (paper, Results: Customer_Review is an NLP input).
"""
from __future__ import annotations

from collections.abc import Iterable


def build_worker_document(
    occupation: str,
    skills: Iterable[str],
    profile_description: str,
    work_history: Iterable[str] = (),
    reviews: Iterable[str] = (),
    include_reviews: bool = True,
) -> str:
    parts: list[str] = []
    if occupation:
        parts.append(occupation)
    skill_list = [s.strip() for s in skills if s and s.strip()]
    if skill_list:
        parts.append(", ".join(skill_list))
    if profile_description:
        parts.append(profile_description)
    parts.extend(h.strip() for h in work_history if h and h.strip())
    if include_reviews:
        parts.extend(r.strip() for r in reviews if r and r.strip())
    return ". ".join(parts)
