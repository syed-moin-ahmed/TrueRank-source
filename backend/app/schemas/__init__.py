"""Request-body validation (pydantic). Invalid input -> HTTP 422 with per-field messages."""
from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ------------------------------------------------------------------- auth
class RegisterIn(_Base):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["requester", "worker"]
    gender: Optional[Literal["male", "female", "unspecified"]] = None
    city: Optional[str] = Field(default=None, max_length=60)
    phone: Optional[str] = Field(default=None, max_length=20)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.lower()
        if not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must contain letters and numbers")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.fullmatch(r"[+\d][\d\s-]{6,18}", v):
            raise ValueError("Enter a valid phone number")
        return v or None


class LoginIn(_Base):
    email: str = Field(max_length=120)
    password: str = Field(min_length=1, max_length=128)


class AccountUpdateIn(_Base):
    name: str = Field(min_length=2, max_length=80)
    gender: Optional[Literal["male", "female", "unspecified"]] = None
    city: Optional[str] = Field(default=None, max_length=60)
    phone: Optional[str] = Field(default=None, max_length=20)


# ----------------------------------------------------------------- worker
class WorkHistoryIn(_Base):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=600)
    year: Optional[int] = Field(default=None, ge=1950, le=2100)


class WorkerProfileIn(_Base):
    """No resume, degree or certificate fields - by design (TrueRank problem statement)."""

    occupation: str = Field(min_length=2, max_length=60)
    skills: list[str] = Field(min_length=1, max_length=25)
    experience_years: float = Field(ge=0, le=60)
    city: str = Field(min_length=2, max_length=60)
    languages: list[str] = Field(default_factory=list, max_length=10)
    profile_description: str = Field(min_length=20, max_length=2000)
    work_history: list[WorkHistoryIn] = Field(default_factory=list, max_length=20)
    is_available: bool = True

    @field_validator("skills")
    @classmethod
    def _skills(cls, values: list[str]) -> list[str]:
        cleaned, seen = [], set()
        for v in values:
            v = _clean(v)
            if not v:
                continue
            if len(v) > 60:
                raise ValueError("Each skill must be at most 60 characters")
            if v.lower() not in seen:
                seen.add(v.lower())
                cleaned.append(v)
        if not cleaned:
            raise ValueError("Add at least one skill")
        return cleaned

    @field_validator("languages")
    @classmethod
    def _languages(cls, values: list[str]) -> list[str]:
        return [_clean(v)[:30] for v in values if _clean(v)]


class EndorseIn(_Base):
    note: str = Field(default="", max_length=300)


class VerificationIn(_Base):
    method: Literal["phone", "government_id", "employer_reference", "community_reference"]
    reference_note: str = Field(default="", max_length=300)


# --------------------------------------------------------------- requests
class ServiceRequestIn(_Base):
    query_text: str = Field(min_length=5, max_length=600)
    city: Optional[str] = Field(default=None, max_length=60)


class MatchIn(_Base):
    query: str = Field(min_length=3, max_length=600)
    city: Optional[str] = Field(default=None, max_length=60)
    verified_only: bool = False
    top_n: int = Field(default=10, ge=1, le=50)
    service_request_id: Optional[int] = None
    lambda_weight: Optional[float] = Field(default=None, ge=0, le=1)  # admin-only experiment


class JobCreateIn(_Base):
    service_request_id: int
    worker_id: int
    match_log_id: Optional[int] = None


class ReviewIn(_Base):
    job_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class DisputeIn(_Base):
    job_id: int
    reason: str = Field(min_length=10, max_length=1000)


# ------------------------------------------------------------------ admin
class DisputeResolveIn(_Base):
    status: Literal["upheld", "dismissed"]
    admin_note: str = Field(default="", max_length=500)


class VerificationReviewIn(_Base):
    status: Literal["verified", "rejected"]


class UserStatusIn(_Base):
    is_active: bool


class WorkerAdminUpdateIn(_Base):
    is_available: Optional[bool] = None
    is_verified: Optional[bool] = None


class LambdaExperimentIn(_Base):
    query: str = Field(min_length=3, max_length=600)
    lambdas: list[float] = Field(default_factory=lambda: [1.0, 0.7, 0.0], min_length=1, max_length=5)
    top_n: int = Field(default=5, ge=1, le=20)

    @field_validator("lambdas")
    @classmethod
    def _lambdas(cls, values: list[float]) -> list[float]:
        for v in values:
            if not 0 <= v <= 1:
                raise ValueError("Each lambda must be between 0 and 1")
        return values
