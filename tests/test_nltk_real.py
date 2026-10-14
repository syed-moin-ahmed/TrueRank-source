"""
Checks the REAL NLTK preprocessing (stop words + WordNet lemmatizer).
Requires: pip install -r requirements.txt  and  python scripts/setup_nltk.py
"""
import unittest

import nltk

from ml.preprocessing.text_preprocessor import preprocess

REAL_NLTK = getattr(nltk, "__version__", "") not in ("", "shim")


@unittest.skipUnless(REAL_NLTK, "real NLTK not installed")
class RealNLTKTests(unittest.TestCase):
    def test_demo_query(self):
        result = preprocess("I need an electrician to repair damaged wiring and a circuit breaker.")
        self.assertEqual(list(result.terms), ["electrician", "repair", "damage", "wire", "circuit", "breaker"])

    def test_plural_and_verb_forms_are_lemmatized(self):
        self.assertEqual(preprocess("repairing breakers").terms, preprocess("repair breaker").terms)

    def test_nltk_stop_words_removed(self):
        terms = preprocess("the pipes are leaking in my bathroom").terms
        for stop in ("the", "are", "in", "my"):
            self.assertNotIn(stop, terms)


if __name__ == "__main__":
    unittest.main()
