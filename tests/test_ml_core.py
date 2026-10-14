"""Unit tests for the TrueRank research core (ml/). Run:  python -m unittest discover -s tests"""
import math
import unittest

import numpy as np

from ml.config import TrueRankConfig, TrustWeights
from ml.engine import TrueRankEngine
from ml.matching.tfidf_index import TfidfIndex
from ml.preprocessing.document_builder import build_worker_document
from ml.preprocessing.text_preprocessor import clean_text, preprocess
from ml.ranking.explanation import build_explanation
from ml.ranking.truerank import rank_workers, truerank_score
from ml.trust.trust_score import TrustInputs, compute_trust


class PreprocessingTests(unittest.TestCase):
    def test_clean_text_lowercases_and_strips_noise(self):
        self.assertEqual(clean_text("  Fix MY A/C!!! 2 units, ASAP. "), "fix my a c units asap")

    def test_stop_words_and_fillers_removed(self):
        result = preprocess("I need an electrician to repair the wiring")
        self.assertNotIn("need", result.terms)
        self.assertNotIn("the", result.terms)
        self.assertIn("electrician", result.terms)
        self.assertIn("need", result.removed_stop_words)

    def test_same_function_for_query_and_document(self):
        self.assertEqual(preprocess("Wiring repairs").terms, preprocess("wiring REPAIRS!").terms)

    def test_empty_input(self):
        result = preprocess("")
        self.assertEqual(result.terms, ())
        self.assertEqual(result.text, "")

    def test_document_builder_combines_fields(self):
        doc = build_worker_document("Plumber", ["Pipe repair", "Tap fitting"], "Ten years of work",
                                    ["Fixed hostel pipes"], ["Good job"], include_reviews=False)
        self.assertIn("Plumber", doc)
        self.assertIn("Pipe repair, Tap fitting", doc)
        self.assertIn("Fixed hostel pipes", doc)
        self.assertNotIn("Good job", doc)


class TfidfCosineTests(unittest.TestCase):
    def setUp(self):
        self.index = TfidfIndex().fit([1, 2, 3], ["electrician wire breaker", "plumber pipe leak", "electrician fan"])

    def test_vectors_are_l2_normalised(self):
        norms = np.sqrt(self.index._matrix.multiply(self.index._matrix).sum(axis=1)).A1
        for n in norms:
            self.assertAlmostEqual(n, 1.0, places=9)

    def test_identical_text_has_similarity_one(self):
        sims = self.index.similarities(self.index.transform("plumber pipe leak"))
        self.assertAlmostEqual(sims[1], 1.0, places=9)

    def test_similarity_in_unit_interval_and_zero_without_overlap(self):
        sims = self.index.similarities(self.index.transform("wire breaker"))
        self.assertTrue(np.all(sims >= 0) and np.all(sims <= 1 + 1e-12))
        self.assertEqual(sims[1], 0.0)
        self.assertGreater(sims[0], sims[2])

    def test_term_contributions_sum_to_cosine(self):
        q = self.index.transform("electrician wire")
        sims = self.index.similarities(q)
        contributions = self.index.term_contributions(q, 1)
        self.assertAlmostEqual(sum(c.contribution for c in contributions), sims[0], places=9)
        self.assertEqual({c.term for c in contributions}, {"electrician", "wire"})

    def test_unknown_query_gives_zero(self):
        sims = self.index.similarities(self.index.transform("tattoo"))
        self.assertTrue(np.all(sims == 0))

    def test_idf_matches_smoothed_formula(self):
        n, df = 3, 2  # "electrician" appears in 2 of 3 documents
        expected = math.log((1 + n) / (1 + df)) + 1
        vocab = self.index._vectorizer.vocabulary_
        self.assertAlmostEqual(self.index._vectorizer.idf_[vocab["electrician"]], expected, places=12)

    def test_empty_corpus(self):
        empty = TfidfIndex().fit([], [])
        self.assertFalse(empty.is_ready)
        self.assertEqual(len(empty.similarities(empty.transform("x"))), 0)


class TrustScoreTests(unittest.TestCase):
    weights = TrustWeights()

    def test_paper_weights(self):
        self.assertEqual(self.weights.as_dict(), {"AR": 0.40, "CR": 0.20, "PE": 0.20, "DA": 0.20})

    def test_weights_must_sum_to_one(self):
        with self.assertRaises(ValueError):
            TrustWeights(0.4, 0.3, 0.2, -0.1)
        with self.assertRaises(ValueError):
            TrustWeights(0.4, 0.3, 0.2, 0.2)

    def test_formula_by_hand(self):
        # 4.5/5 rating, 45 of 50 jobs completed, 10 of 20 endorsements, 2 disputes on 45 jobs
        inputs = TrustInputs(rating_sum=4.5 * 40, rating_count=40, jobs_completed=45, jobs_closed=50,
                             endorsements=10, disputes=2)
        result = compute_trust(inputs, self.weights, pe_cap=20, neutral_prior=0.5)
        ar, cr, pe, da = 0.9, 0.9, 0.5, 1 - 2 / 45
        self.assertAlmostEqual(result.score, 0.40 * ar + 0.20 * cr + 0.20 * pe + 0.20 * da, places=12)
        self.assertTrue(result.has_full_data)

    def test_disputes_lower_the_score(self):
        base = dict(rating_sum=200, rating_count=50, jobs_completed=50, jobs_closed=50, endorsements=5)
        clean = compute_trust(TrustInputs(**base, disputes=0), self.weights, 20, 0.5).score
        disputed = compute_trust(TrustInputs(**base, disputes=10), self.weights, 20, 0.5).score
        self.assertGreater(clean, disputed)

    def test_cold_start_uses_neutral_prior_and_flags_missing(self):
        result = compute_trust(TrustInputs(), self.weights, pe_cap=20, neutral_prior=0.5)
        self.assertIsNone(result.component("AR").value)
        self.assertIsNone(result.component("CR").value)
        self.assertIsNone(result.component("DA").value)
        self.assertEqual(result.component("PE").value, 0.0)
        self.assertAlmostEqual(result.score, 0.4 * 0.5 + 0.2 * 0.5 + 0.2 * 0.0 + 0.2 * 0.5)
        self.assertFalse(result.has_full_data)

    def test_pe_capped(self):
        result = compute_trust(TrustInputs(endorsements=99), self.weights, pe_cap=20, neutral_prior=0.5)
        self.assertEqual(result.component("PE").value, 1.0)

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            TrustInputs(jobs_completed=5, jobs_closed=3)
        with self.assertRaises(ValueError):
            TrustInputs(rating_sum=30, rating_count=5)  # average 6 > 5


class RankingTests(unittest.TestCase):
    def test_fusion_formula(self):
        self.assertAlmostEqual(truerank_score(0.8, 0.6, 0.7), 0.7 * 0.8 + 0.3 * 0.6)
        with self.assertRaises(ValueError):
            truerank_score(0.5, 0.5, 1.5)

    def test_sorted_descending_and_threshold_applied(self):
        summary = rank_workers(
            worker_ids=[1, 2, 3, 4],
            similarities=np.array([0.5, 0.3, 0.0, 0.02]),
            trust_scores={1: 0.2, 2: 0.95, 3: 1.0, 4: 1.0},
            lambda_weight=0.7, min_similarity=0.05,
        )
        # R1 = 0.7*0.5 + 0.3*0.2 = 0.41 ; R2 = 0.7*0.3 + 0.3*0.95 = 0.495
        # Workers 3 (S=0) and 4 (S=0.02 < tau) are filtered out despite perfect trust.
        self.assertEqual([r.worker_id for r in summary.ranked], [2, 1])
        self.assertAlmostEqual(summary.ranked[0].final_score, 0.495)
        self.assertAlmostEqual(summary.ranked[1].final_score, 0.41)
        self.assertEqual(summary.candidates_above_threshold, 2)

    def test_trust_can_reorder_similar_candidates(self):
        summary = rank_workers([1, 2], np.array([0.40, 0.36]), {1: 0.30, 2: 0.90}, 0.7, 0.05)
        # R1 = 0.28 + 0.09 = 0.37 ; R2 = 0.252 + 0.27 = 0.522
        self.assertEqual([r.worker_id for r in summary.ranked], [2, 1])
        self.assertAlmostEqual(summary.ranked[0].final_score, 0.522)
        self.assertAlmostEqual(summary.ranked[0].similarity_part + summary.ranked[0].trust_part,
                               summary.ranked[0].final_score)

    def test_lambda_one_is_pure_similarity(self):
        summary = rank_workers([1, 2], np.array([0.40, 0.36]), {1: 0.30, 2: 0.90}, 1.0, 0.05)
        self.assertEqual([r.worker_id for r in summary.ranked], [1, 2])

    def test_allowed_ids_and_top_n(self):
        summary = rank_workers([1, 2, 3], np.array([0.4, 0.5, 0.6]), {1: .5, 2: .5, 3: .5}, 0.7, 0.05,
                               top_n=1, allowed_ids=[1, 2])
        self.assertEqual([r.worker_id for r in summary.ranked], [2])
        self.assertEqual(summary.candidates_considered, 2)


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = TrueRankEngine(TrueRankConfig())
        self.engine.build({
            1: build_worker_document("Electrician", ["House wiring", "MCB repair", "Circuit breaker replacement"],
                                     "Fixing tripped breakers and damaged wiring"),
            2: build_worker_document("Plumber", ["Pipe leakage repair", "Tap installation"], "Fixing leaking pipes"),
            3: build_worker_document("Electrician", ["Fan installation"], "Installing fans and lights"),
        })

    def test_demo_query_ranks_relevant_electrician_first(self):
        outcome = self.engine.match("I need an electrician to repair damaged wiring and a circuit breaker.",
                                    trust_scores={1: 0.6, 2: 0.99, 3: 0.6})
        self.assertEqual(outcome.results[0].worker_id, 1)
        self.assertNotIn(2, [r.worker_id for r in outcome.results[:1]])
        top = outcome.results[0]
        self.assertAlmostEqual(top.final_score, 0.7 * top.similarity + 0.3 * top.trust)
        self.assertAlmostEqual(sum(t.contribution for t in top.matched_terms), top.similarity, places=9)
        self.assertEqual(outcome.documents_indexed, 3)
        self.assertGreater(outcome.vocabulary_size, 5)

    def test_unknown_words_reported(self):
        outcome = self.engine.match("tattoo electrician", trust_scores={1: .5, 2: .5, 3: .5})
        self.assertIn("tattoo", outcome.unknown_terms)
        self.assertIn("electrician", outcome.known_terms)

    def test_explanation_uses_real_values(self):
        explanation = build_explanation(
            similarity=0.42, trust=0.81, matched_terms=["wiring", "breaker"],
            trust_components=[{"label": "Average Rating", "has_data": True}],
            metrics={"average_rating": 4.6, "rating_count": 12, "completion_rate": 0.95, "disputes": 0},
            experience_years=5, is_verified=True,
        )
        text = " ".join(r["text"] for r in explanation["reasons"])
        self.assertIn("0.42", text)
        self.assertIn("0.81", text)
        self.assertIn("4.6", text)
        self.assertIn("95%", text)


if __name__ == "__main__":
    unittest.main()
