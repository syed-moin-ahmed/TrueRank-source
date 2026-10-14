"""Download the NLTK data TrueRank needs (stop words + WordNet) into ml/nltk_data, then self-test."""
import sys
from pathlib import Path

import ssl

import nltk

try:  # python.org builds on macOS often lack root certificates -> use certifi's bundle
    import certifi

    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
except ImportError:
    pass

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "ml" / "nltk_data"
TARGET.mkdir(parents=True, exist_ok=True)

for package in ("stopwords", "wordnet", "omw-1.4"):
    if not nltk.download(package, download_dir=str(TARGET), quiet=True):
        sys.exit(f"Could not download NLTK package '{package}'. Check your internet connection.")

sys.path.insert(0, str(ROOT))
from ml.preprocessing.text_preprocessor import preprocess  # noqa: E402

sample = "I need an electrician to repair damaged wiring and a circuit breaker."
print("NLTK data installed in", TARGET)
print("Self-test:", sample)
print("  terms ->", preprocess(sample).terms)
