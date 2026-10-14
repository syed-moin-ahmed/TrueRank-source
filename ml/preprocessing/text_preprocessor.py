"""
Stage 2 of the TrueRank pipeline - Text Preprocessing (paper, Methodology B).

    raw text
      -> lowercase
      -> remove punctuation / digits / noise
      -> tokenization
      -> stop-word removal          (NLTK English stop-word list + request filler words)
      -> lemmatization              (NLTK WordNet lemmatizer, noun then verb form)
      -> processed terms

Exactly the same function is applied to worker profiles and to user queries,
so both end up in the same vocabulary for TF-IDF.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

# Anything that is not a lowercase letter or whitespace becomes a space.
# Replacing with a space (not deleting) keeps "don't" -> "don t" so both parts
# are caught by the stop-word list, and "AC/fan" -> "ac fan".
_NON_LETTER = re.compile(r"[^a-z\s]+")
_WHITESPACE = re.compile(r"\s+")

MIN_TOKEN_LENGTH = 2

# Words that appear in almost every service request but carry no skill meaning.
# This list is an implementation addition (documented in docs/ARCHITECTURE.md).
REQUEST_FILLER_WORDS: frozenset[str] = frozenset(
    {
        "need", "needs", "needed", "want", "wants", "wanted", "looking", "someone", "somebody",
        "anyone", "anybody", "please", "kindly", "urgent", "urgently", "asap", "require",
        "requires", "required", "requirement", "hire", "hiring", "person", "guy", "help",
        "get", "got", "also", "would", "like", "could",
    }
)


class NLTKResourceMissing(RuntimeError):
    """Raised when NLTK or its data packages are not installed."""


_SETUP_HINT = (
    "NLTK data is missing. From the TrueRank folder run:  python scripts/setup_nltk.py"
)


@lru_cache(maxsize=1)
def get_stop_words() -> frozenset[str]:
    try:
        from nltk.corpus import stopwords
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise NLTKResourceMissing("NLTK is not installed. Run: pip install -r requirements.txt") from exc
    try:
        words = stopwords.words("english")
    except LookupError as exc:  # pragma: no cover
        raise NLTKResourceMissing(_SETUP_HINT) from exc
    return frozenset(words) | REQUEST_FILLER_WORDS


@lru_cache(maxsize=1)
def _get_lemmatizer():
    try:
        from nltk.stem import WordNetLemmatizer
    except ImportError as exc:  # pragma: no cover
        raise NLTKResourceMissing("NLTK is not installed. Run: pip install -r requirements.txt") from exc
    lemmatizer = WordNetLemmatizer()
    try:
        lemmatizer.lemmatize("tests")  # forces WordNet to load now, not mid-request
    except LookupError as exc:  # pragma: no cover
        raise NLTKResourceMissing(_SETUP_HINT) from exc
    return lemmatizer


@lru_cache(maxsize=50_000)
def lemmatize(token: str) -> str:
    """Noun form first ("repairs" -> "repair"), then verb form ("wiring" -> "wire")."""
    lemmatizer = _get_lemmatizer()
    return lemmatizer.lemmatize(lemmatizer.lemmatize(token, pos="n"), pos="v")


def clean_text(text: str) -> str:
    """Lowercase and strip punctuation, digits and extra whitespace."""
    if not text:
        return ""
    lowered = text.lower()
    no_noise = _NON_LETTER.sub(" ", lowered)
    return _WHITESPACE.sub(" ", no_noise).strip()


def tokenize(cleaned_text: str) -> list[str]:
    return [tok for tok in cleaned_text.split(" ") if len(tok) >= MIN_TOKEN_LENGTH]


@dataclass(frozen=True)
class PreprocessResult:
    original: str
    cleaned: str
    tokens: tuple[str, ...]
    removed_stop_words: tuple[str, ...]
    terms: tuple[str, ...]                       # final lemmatized terms
    surface_forms: dict[str, str] = field(default_factory=dict)  # lemma -> first original word

    @property
    def text(self) -> str:
        """Space-joined terms - this is what TF-IDF receives."""
        return " ".join(self.terms)

    def as_dict(self) -> dict:
        return {
            "original": self.original,
            "cleaned": self.cleaned,
            "tokens": list(self.tokens),
            "removed_stop_words": list(self.removed_stop_words),
            "terms": list(self.terms),
        }


def preprocess(text: str) -> PreprocessResult:
    stop_words = get_stop_words()
    cleaned = clean_text(text or "")
    tokens = tokenize(cleaned)

    removed: list[str] = []
    terms: list[str] = []
    surface: dict[str, str] = {}
    for token in tokens:
        if token in stop_words:
            removed.append(token)
            continue
        lemma = lemmatize(token)
        if len(lemma) < MIN_TOKEN_LENGTH or lemma in stop_words:
            removed.append(token)
            continue
        terms.append(lemma)
        surface.setdefault(lemma, token)

    return PreprocessResult(
        original=text or "",
        cleaned=cleaned,
        tokens=tuple(tokens),
        removed_stop_words=tuple(removed),
        terms=tuple(terms),
        surface_forms=surface,
    )


def preprocess_to_text(text: str) -> str:
    return preprocess(text).text
