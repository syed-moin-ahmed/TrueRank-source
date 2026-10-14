"""
End-to-end API tests, including the 13-step viva demonstration flow.
Run:  python -m unittest discover -s tests
"""
import os
import tempfile
import unittest
from pathlib import Path

from backend.app import create_app
from backend.app.database.db import get_db
from backend.app.services import seed_service
from ml.config import TrueRankConfig

ROOT = Path(__file__).resolve().parents[1]
DEMO_CSV = ROOT / "data" / "seed" / "demo_workers.csv"
SECRET = "test-secret-key-that-is-long-enough-1234567890"


class APIFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.app = create_app(
            {"JWT_SECRET_KEY": SECRET, "DATABASE_PATH": os.path.join(cls.tmp.name, "test.db"), "TESTING": True},
            truerank_config=TrueRankConfig(),
        )
        with cls.app.app_context():
            seed_service.import_csv(get_db(), DEMO_CSV, "demo_seed")
            from backend.app.auth.security import hash_password
            from backend.app.database.db import utc_now
            now = utc_now()
            get_db().execute(
                "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                ("Admin", "admin@truerank.test", hash_password("Admin12345"), "admin", now, now),
            )
            get_db().commit()
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    # ----------------------------------------------------------- helpers
    def _register(self, name, email, role, password="Passw0rd!"):
        r = self.client.post("/api/auth/register", json={"name": name, "email": email, "password": password, "role": role, "city": "Bengaluru"})
        self.assertEqual(r.status_code, 201, r.get_json())
        return {"Authorization": f"Bearer {r.get_json()['token']}"}

    def _login(self, email, password):
        r = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(r.status_code, 200, r.get_json())
        return {"Authorization": f"Bearer {r.get_json()['token']}"}

    # ------------------------------------------------------------- tests
    def test_auth_and_roles(self):
        r = self.client.post("/api/auth/register", json={"name": "X", "email": "bad", "password": "short", "role": "admin"})
        self.assertEqual(r.status_code, 422)
        self.assertIn("fields", r.get_json())
        h = self._register("Role Tester", "role@test.com", "requester")
        self.assertEqual(self.client.post("/api/auth/register", json={"name": "Dup", "email": "ROLE@test.com", "password": "Passw0rd1", "role": "worker"}).status_code, 409)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "role@test.com", "password": "wrong"}).status_code, 401)
        self.assertEqual(self.client.get("/api/admin/stats", headers=h).status_code, 403)
        self.assertEqual(self.client.get("/api/admin/stats").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/stats", headers={"Authorization": "Bearer nonsense"}).status_code, 401)
        me = self.client.get("/api/auth/me", headers=h).get_json()["user"]
        self.assertNotIn("password_hash", me)

    def test_match_validation_and_security(self):
        h = self._register("Sec", "sec@test.com", "requester")
        self.assertEqual(self.client.post("/api/match", json={"query": "x"}, headers=h).status_code, 422)
        # lambda experiments are admin-only
        self.assertEqual(self.client.post("/api/match", json={"query": "plumber leak", "lambda_weight": 1.0}, headers=h).status_code, 403)
        # SQL-looking input is just text
        r = self.client.post("/api/match", json={"query": "plumber'; DROP TABLE users; --"}, headers=h)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "sec@test.com", "password": "Passw0rd!"}).status_code, 200)

    def test_profile_scores_match_result_card(self):
        h = self._register("Card Check", "card@test.com", "requester")
        data = self.client.post("/api/match", json={"query": "electrician to repair wiring", "top_n": 3}, headers=h).get_json()
        top = data["results"][0]
        r = self.client.get(f"/api/match/{data['match_log_id']}/workers/{top['worker_id']}", headers=h)
        self.assertEqual(r.status_code, 200)
        s = r.get_json()
        for key in ("similarity_score", "trust_score", "final_score"):
            self.assertAlmostEqual(s[key], top[key], places=9)
        profile = self.client.get(f"/api/workers/{top['worker_id']}", headers=h).get_json()["worker"]
        self.assertAlmostEqual(profile["trust_score"], top["trust_score"], places=9)
        other = self._register("Other User", "other-card@test.com", "requester")
        self.assertEqual(self.client.get(f"/api/match/{data['match_log_id']}/workers/{top['worker_id']}", headers=other).status_code, 403)

    def test_everyday_words_are_expanded(self):
        h = self._register("Synonym Check", "syn@test.com", "requester")
        data = self.client.post("/api/match", json={"query": "need a maid for my flat", "top_n": 5}, headers=h).get_json()
        self.assertTrue(data["results"])
        self.assertEqual(data["results"][0]["occupation"], "House Cleaner")
        self.assertTrue(any(x["term"] == "maid" for x in data["processing"]["expansions"]))

    def test_benchmark_existing_vs_truerank(self):
        r = self.client.get("/api/meta/benchmark")
        self.assertEqual(r.status_code, 200)
        d = r.get_json()
        self.assertEqual([m["key"] for m in d["methods"]], ["keyword", "keyword_rating", "tfidf", "truerank"])
        by = {m["key"]: m for m in d["methods"]}
        for m in d["methods"]:
            for name in ("precision5", "ndcg10", "mrr", "trade5", "risky5"):
                self.assertGreaterEqual(m[name], 0.0)
                self.assertLessEqual(m[name], 1.0)
        for key in ("keyword", "keyword_rating", "tfidf"):
            self.assertGreater(by["truerank"]["ndcg10"], by[key]["ndcg10"])
            self.assertGreater(by["truerank"]["precision5"], by[key]["precision5"])
            self.assertLess(by["truerank"]["risky5"], by[key]["risky5"])
        # request-by-request counts and per-worker reasons used by the Research page
        for key in ("keyword", "keyword_rating", "tfidf"):
            h = d["head_to_head"][key]
            self.assertEqual(h["win"] + h["tie"] + h["loss"], d["queries"])
        full = self.client.get("/api/meta/benchmark?details=1").get_json()
        for q in full["per_query"]:
            for m in q["methods"].values():
                for w in m["top5"]:
                    self.assertIn(w["reason"], ("good", "little_history", "low_trust", "wrong_trade"))
                    self.assertEqual(w["reason"] == "good", w["grade"] == 2)

    def test_viva_demo_flow(self):
        # STEP 1-2: register a worker and create a resume-free profile
        wh = self._register("Ramesh Kumar", "ramesh@test.com", "worker")
        profile = {
            "occupation": "Electrician",
            "skills": ["Wiring", "MCB repair", "Electrical maintenance", "Motor repair"],
            "experience_years": 5,
            "city": "Bengaluru",
            "languages": ["Kannada", "Hindi"],
            "profile_description": "Five years of house wiring, MCB and circuit breaker repair, and motor repair for homes and shops.",
            "work_history": [{"title": "Rewired a 3-floor house", "description": "Replaced damaged wiring and the MCB board", "year": 2025}],
        }
        r = self.client.post("/api/workers/me", json=profile, headers=wh)
        self.assertEqual(r.status_code, 201, r.get_json())
        worker = r.get_json()["profile"]
        wid = worker["id"]
        self.assertIsNone(worker["metrics"]["average_rating"])
        ar = next(c for c in worker["trust"]["components"] if c["key"] == "AR")
        self.assertFalse(ar["has_data"])
        trust_before = worker["trust_score"]
        self.assertAlmostEqual(trust_before, 0.4 * 0.5 + 0.2 * 0.5 + 0.2 * 0.0 + 0.2 * 0.5)

        # STEP 3: requester
        rh = self._register("Anita Rao", "anita@test.com", "requester")
        query = "I need an electrician to repair damaged wiring and a circuit breaker."
        sr = self.client.post("/api/service-requests", json={"query_text": query, "city": "Bengaluru"}, headers=rh)
        self.assertEqual(sr.status_code, 201)
        sr_id = sr.get_json()["service_request"]["id"]

        # STEP 4-7: run the pipeline
        r = self.client.post("/api/match", json={"query": query, "service_request_id": sr_id, "top_n": 20}, headers=rh)
        self.assertEqual(r.status_code, 200, r.get_json())
        data = r.get_json()
        self.assertGreater(data["pipeline"]["documents_indexed"], 600)
        self.assertIn("electrician", data["processing"]["terms"])
        results = data["results"]
        self.assertTrue(results)
        finals = [x["final_score"] for x in results]
        self.assertEqual(finals, sorted(finals, reverse=True))
        for x in results:
            self.assertAlmostEqual(x["final_score"], 0.7 * x["similarity_score"] + 0.3 * x["trust_score"], places=9)
            self.assertAlmostEqual(sum(t["contribution"] for t in x["matched_terms"]), x["similarity_score"], places=9)
            self.assertGreaterEqual(x["similarity_score"], 0.05)
        self.assertEqual(results[0]["occupation"], "Electrician")
        ours = next((x for x in results if x["worker_id"] == wid), None)
        self.assertIsNotNone(ours, "newly registered worker should be ranked")
        rank_before = ours["rank"]
        self.assertTrue(ours["relevant_skills"])

        # STEP 8: worker profile
        detail = self.client.get(f"/api/workers/{wid}", headers=rh).get_json()["worker"]
        self.assertEqual(detail["name"], "Ramesh Kumar")

        # STEP 9: select worker -> pending (worker has an account)
        r = self.client.post("/api/jobs", json={"service_request_id": sr_id, "worker_id": wid, "match_log_id": data["match_log_id"]}, headers=rh)
        self.assertEqual(r.status_code, 201, r.get_json())
        job = r.get_json()["job"]
        self.assertEqual(job["status"], "pending")
        self.assertEqual(job["selected_rank"], rank_before)
        self.assertIsNone(self.client.get("/api/jobs", headers=wh).get_json()["items"][0]["requester_phone"])
        # requester cannot accept on behalf of the worker; cannot complete before start
        self.assertEqual(self.client.put(f"/api/jobs/{job['id']}/accept", headers=rh).status_code, 403)
        self.assertEqual(self.client.put(f"/api/jobs/{job['id']}/complete", headers=rh).status_code, 409)
        self.assertEqual(self.client.put(f"/api/jobs/{job['id']}/accept", headers=wh).status_code, 200)
        self.assertEqual(self.client.put(f"/api/jobs/{job['id']}/start", headers=wh).status_code, 200)
        # cannot review before completion
        self.assertEqual(self.client.post("/api/reviews", json={"job_id": job["id"], "rating": 5}, headers=rh).status_code, 409)

        # STEP 10: complete
        r = self.client.put(f"/api/jobs/{job['id']}/complete", headers=rh)
        self.assertEqual(r.get_json()["job"]["status"], "completed")

        # STEP 11: rate + feedback
        r = self.client.post("/api/reviews", json={"job_id": job["id"], "rating": 5, "comment": "Fixed the circuit breaker and rewired the kitchen quickly."}, headers=rh)
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertEqual(self.client.post("/api/reviews", json={"job_id": job["id"], "rating": 4}, headers=rh).status_code, 409)

        # STEP 12: stored metrics + trust changed (real DB update)
        after = self.client.get(f"/api/workers/{wid}/trust-score", headers=rh).get_json()["trust"]
        comps = {c["key"]: c for c in after["components"]}
        self.assertEqual(comps["AR"]["value"], 1.0)
        self.assertEqual(comps["CR"]["value"], 1.0)
        self.assertEqual(comps["DA"]["value"], 1.0)
        self.assertAlmostEqual(after["score"], 0.4 + 0.2 + 0.0 + 0.2)
        self.assertGreater(after["score"], trust_before)
        history = self.client.get(f"/api/workers/{wid}/trust-history", headers=rh).get_json()["items"]
        self.assertEqual([h["trigger"] for h in history], ["profile_created", "job_complete", "review"])

        # STEP 13: rerun query -> ranking reflects new trust
        sr2 = self.client.post("/api/service-requests", json={"query_text": query}, headers=rh).get_json()["service_request"]["id"]
        data2 = self.client.post("/api/match", json={"query": query, "service_request_id": sr2, "top_n": 20}, headers=rh).get_json()
        ours2 = next(x for x in data2["results"] if x["worker_id"] == wid)
        self.assertAlmostEqual(ours2["trust_score"], 0.8)
        self.assertLessEqual(ours2["rank"], rank_before)
        self.assertGreater(ours2["final_score"], ours["final_score"])

        # dispute on second job lowers DA
        j2 = self.client.post("/api/jobs", json={"service_request_id": sr2, "worker_id": wid}, headers=rh).get_json()["job"]["id"]
        self.client.put(f"/api/jobs/{j2}/accept", headers=wh)
        self.client.put(f"/api/jobs/{j2}/start", headers=wh)
        r = self.client.post("/api/disputes", json={"job_id": j2, "reason": "Left without finishing the job"}, headers=rh)
        self.assertEqual(r.status_code, 201)
        self.assertLess(r.get_json()["trust_after"], r.get_json()["trust_before"])

        # admin dismisses -> trust restored
        ah = self._login("admin@truerank.test", "Admin12345")
        disputes = self.client.get("/api/admin/disputes", headers=ah).get_json()["items"]
        d = next(x for x in disputes if x["job_id"] == j2)
        r = self.client.put(f"/api/admin/disputes/{d['id']}", json={"status": "dismissed"}, headers=ah)
        self.assertAlmostEqual(r.get_json()["trust_score"], 0.8)

        # worker withdraws -> CR drops
        self.client.put(f"/api/jobs/{j2}/withdraw", headers=wh)
        cr = {c["key"]: c for c in self.client.get(f"/api/workers/{wid}/trust-score", headers=rh).get_json()["trust"]["components"]}["CR"]
        self.assertAlmostEqual(cr["value"], 0.5)

        # admin pages respond
        for path in ("/api/admin/stats", "/api/admin/users", "/api/admin/reviews", "/api/admin/verifications",
                     "/api/admin/trust-metrics", "/api/admin/matching", "/api/service-requests", "/api/jobs"):
            self.assertEqual(self.client.get(path, headers=ah).status_code, 200, path)
        stats = self.client.get("/api/admin/stats", headers=ah).get_json()
        self.assertEqual(sum(b["count"] for b in stats["trust_distribution"]), stats["totals"]["workers"])
        exp = self.client.post("/api/admin/lambda-experiment", json={"query": query}, headers=ah).get_json()
        self.assertEqual([run["lambda"] for run in exp["runs"]], [1.0, 0.7, 0.0])

        # dashboards
        self.assertEqual(self.client.get("/api/dashboard/requester", headers=rh).status_code, 200)
        dash = self.client.get("/api/dashboard/worker", headers=wh).get_json()
        self.assertFalse(dash["needs_profile"])

    def test_dataset_worker_auto_accept_and_endorsement(self):
        rh = self._register("Req Two", "req2@test.com", "requester")
        sr = self.client.post("/api/service-requests", json={"query_text": "Leaking pipe in bathroom needs plumber"}, headers=rh).get_json()["service_request"]["id"]
        res = self.client.post("/api/match", json={"query": "Leaking pipe in bathroom needs plumber", "service_request_id": sr}, headers=rh).get_json()
        top = res["results"][0]
        self.assertFalse(top["has_account"])
        job = self.client.post("/api/jobs", json={"service_request_id": sr, "worker_id": top["worker_id"]}, headers=rh).get_json()["job"]
        self.assertEqual(job["status"], "accepted")
        self.assertTrue(job["auto_accepted"])
        self.assertEqual(self.client.put(f"/api/jobs/{job['id']}/start", headers=rh).status_code, 200)
        self.assertEqual(self.client.post("/api/jobs", json={"service_request_id": sr, "worker_id": top["worker_id"]}, headers=rh).status_code, 409)

        # peer endorsement
        wh = self._register("Peer Worker", "peer@test.com", "worker")
        self.assertEqual(self.client.post(f"/api/workers/{top['worker_id']}/endorse", json={}, headers=wh).status_code, 400)
        self.client.post("/api/workers/me", headers=wh, json={
            "occupation": "Plumber", "skills": ["Pipe repair"], "experience_years": 2, "city": "Delhi",
            "profile_description": "Two years fixing pipes and taps for houses."})
        before = self.client.get(f"/api/workers/{top['worker_id']}", headers=wh).get_json()["worker"]
        self.assertTrue(before["can_endorse"])
        r = self.client.post(f"/api/workers/{top['worker_id']}/endorse", json={"note": "Good plumber"}, headers=wh)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post(f"/api/workers/{top['worker_id']}/endorse", json={}, headers=wh).status_code, 409)

    def test_worker_cannot_have_resume_fields_and_validation(self):
        wh = self._register("Val Worker", "val@test.com", "worker")
        r = self.client.post("/api/workers/me", headers=wh, json={
            "occupation": "Painter", "skills": [], "experience_years": 3, "city": "Delhi", "profile_description": "short"})
        self.assertEqual(r.status_code, 422)
        r = self.client.post("/api/workers/me", headers=wh, json={
            "occupation": "Painter", "skills": ["Wall putty"], "experience_years": 3, "city": "Delhi",
            "profile_description": "Three years of interior painting work.", "degree": "B.Tech"})
        self.assertEqual(r.status_code, 422)  # unknown fields rejected

    def test_filters_apply_to_every_worker(self):
        h = self._register("Filter Tester", "filter@test.com", "requester")
        q = "I need an electrician to repair damaged wiring and a circuit breaker."
        res = self.client.post("/api/match", json={"query": q, "city": "Bengaluru", "top_n": 50}, headers=h).get_json()["results"]
        self.assertTrue(res)
        self.assertTrue(all(r["city"] == "Bengaluru" for r in res), {r["city"] for r in res})
        res = self.client.post("/api/match", json={"query": q, "verified_only": True, "top_n": 50}, headers=h).get_json()["results"]
        self.assertTrue(all(r["is_verified"] for r in res))
        # an unavailable worker is never ranked
        ah = self._login("admin@truerank.test", "Admin12345")
        top = self.client.post("/api/match", json={"query": q}, headers=h).get_json()["results"][0]["worker_id"]
        self.client.put(f"/api/admin/workers/{top}", json={"is_available": False}, headers=ah)
        ids = [r["worker_id"] for r in self.client.post("/api/match", json={"query": q, "top_n": 50}, headers=h).get_json()["results"]]
        self.assertNotIn(top, ids)
        self.client.put(f"/api/admin/workers/{top}", json={"is_available": True}, headers=ah)

    def test_frontend_fallback_and_api_404(self):
        self.assertEqual(self.client.get("/api/does-not-exist").status_code, 404)
        self.assertEqual(self.client.get("/api/meta/research-results").get_json()["model_comparison"][-1]["accuracy"], 90.6)


if __name__ == "__main__":
    unittest.main()
