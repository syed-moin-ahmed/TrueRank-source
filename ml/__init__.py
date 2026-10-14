"""TrueRank research core: preprocessing, TF-IDF, cosine similarity, trust score and ranking."""
from pathlib import Path

# Use the NLTK data downloaded by scripts/setup_nltk.py (kept inside the project, so it works offline).
_NLTK_DATA = Path(__file__).resolve().parent / "nltk_data"
try:
    import nltk

    if str(_NLTK_DATA) not in nltk.data.path:
        nltk.data.path.insert(0, str(_NLTK_DATA))
except ImportError:  # reported clearly by ml.preprocessing when first used
    pass
