# TrueRank — Architecture and Design Decisions

**TrueRank: Trust-Aware NLP Framework for Matching Informal Workers to Industry Demand**

This document separates two layers everywhere:

* **RESEARCH / ML CORE**: what the research paper describes (the `ml/` package).
* **APPLICATION / WEBSITE**: what was added to run the method as a live web system (`backend/`, `frontend/`).

---

## 1. System architecture

```
┌────────────────────────────── React frontend (frontend/) ───────────────────────────────┐
│  Public site · Service-requester portal · Worker portal · Admin portal                  │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │ REST / JSON + JWT  (same origin, served by Flask)
┌──────────────────────────────── Flask backend (backend/app) ────────────────────────────┐
│ routes/      auth · workers · service_requests · match · jobs · feedback · admin · meta │
│ services/    matching_service · trust_service · job_service · worker_service · seed     │
│ database/    schema.sql + sqlite3 (parameterised queries)                               │
└───────────────────────┬────────────────────────────────────────────┬────────────────────┘
                        │                                            │
              ┌─────────▼─────────┐                     ┌────────────▼─────────────┐
              │  SQLite database  │                     │  ml/  (research core)    │
              │  users, workers,  │                     │  preprocessing           │
              │  jobs, reviews,   │                     │  TF-IDF + cosine         │
              │  disputes, logs   │                     │  trust score · ranking   │
              └───────────────────┘                     └──────────────────────────┘
```

`ml/` never imports Flask or touches the database. The backend gives it plain Python data,
so the research core can be tested and explained on its own (`tests/test_ml_core.py`).

## 2. The TrueRank pipeline (research core)

| Stage | Paper | Code |
|---|---|---|
| 1. User query | natural-language service request | `POST /api/match` |
| 2. Text preprocessing | lowercase, strip punctuation, tokenize, stop words, lemmatize; skills + bio joined into one profile string | `ml/preprocessing/text_preprocessor.py`, `document_builder.py` |
| 3. TF-IDF vectorization | eq. (1) `TF-IDF(t,d) = TF(t,d) × IDF(t)` | `ml/matching/tfidf_index.py` |
| 4. Semantic matching | cosine similarity `S(w,q)` | `ml/matching/tfidf_index.py` |
| 5. Trust score | eq. (2) `TS = 0.40·AR + 0.20·CR + 0.20·PE + 0.20·DA` | `ml/trust/trust_score.py` |
| 6. Ranking engine | eq. (3) `R(w,q) = 0.7·S(w,q) + 0.3·TS(w)`, sorted descending | `ml/ranking/truerank.py` |
| 7. Recommended workers | top-N with explanation | `ml/ranking/explanation.py` |

All weights live in one file: `ml/config.py` (and can be overridden from `.env`).

### TF-IDF details (for the viva)
scikit-learn `TfidfVectorizer(norm="l2", smooth_idf=True, sublinear_tf=False)`:

* `IDF(t) = ln((1 + n) / (1 + df(t))) + 1`, a smoothed form of the paper's IDF that avoids division by zero.
* Each document vector is L2-normalised, so `cos(q, w) = Σ qᵢ·wᵢ`.
* That makes the **contribution of each shared term exact**. The "matched terms" shown in the UI add up to `S(w,q)` (this is tested).
* TF-IDF weights are never negative, so `S(w,q)` lies in **[0, 1]**. The paper's "−1 to +1" is the general range of cosine similarity.

## 3. Composite Trust Score: normalisation layer

The paper fixes the weights, but not how the raw data is scaled. For `TS` and `S` to be fused they must share a scale, so every component is mapped to **[0, 1]**:

| Component | Formula used | Data |
|---|---|---|
| AR, Average Rating | `average stars ÷ 5` | dataset baseline + live reviews |
| CR, Completion Rate | `completed ÷ (completed + withdrawn after accepting)` | dataset baseline + live jobs |
| PE, Peer Endorsements | `min(endorsements, PE_CAP) ÷ PE_CAP` (PE_CAP = 20) | dataset baseline + live endorsements |
| DA, Dispute Adjustment | `1 − min(1, disputes ÷ max(completed jobs, 1))` | dataset baseline + live disputes not dismissed |

**Why DA works this way.** The dataset stores a *dispute count*, and the paper uses a **+0.20** weight while also describing "an inverted weight for the dispute counter" and "points taken off for disputes". DA is therefore an *inverted* dispute rate: 1 means no disputes, and every dispute lowers it. The published formula and weights are used unchanged, and they still sum to 1.

**Cold start.** If a component has no underlying data yet (no ratings, no finished jobs, no job history), the UI shows **"Not enough data"** and the score uses a documented **neutral prior of 0.50** for that component. Zero endorsements is real data, so PE = 0. A brand-new worker therefore starts at `0.4·0.5 + 0.2·0.5 + 0.2·0 + 0.2·0.5 = 0.40`.

**Verification status** is shown as a badge and can be used as a filter. It is **not** in the formula, because the paper's equation (2) has no verification term.

## 4. Implementation additions (not claims from the paper)

| Addition | Reason |
|---|---|
| Similarity threshold τ = 0.05 | Without it, a highly trusted worker with **zero** skill overlap could outrank relevant workers (`0.3 × 0.95 = 0.285`). Workers with `S < τ` are not ranked. |
| Request filler words (`need, want, someone, please, urgent …`) added to the stop-word list | They appear in almost every request and carry no skill meaning. |
| Lemmatization as noun, then verb (`wiring → wire`, `repairs → repair`) | Lemmatization appears in the presentation's system design (it is not in the paper's text). |
| Customer review text included in the worker document | The paper lists Customer_Review as an NLP input. Configurable with `TRUERANK_INCLUDE_REVIEWS`. |
| Deterministic tie-breaking (higher S, then lower id) | Same input always gives the same order. |
| Auto-accept for dataset profiles | Dataset workers have no login, so they cannot accept jobs themselves. These jobs are flagged in the UI. |
| Dataset rating count = Jobs_Completed | The dataset stores an average rating, not a count. The number of completed jobs is used as the weight of that average when new ratings arrive. |

## 5. Things to be careful about in the viva

* **Reported vs. computed.** Accuracy 90.6% / precision 90.2% / recall 89.8% / F1 90.0% and the baseline comparison come from the paper's offline classification experiment. The website shows them on the Research page, labelled as reported results. It does **not** recompute them.
* **Lexical matching.** TF-IDF matches words, not meanings: "electrical" and "electrician" are different terms. Transformers are listed as future work in the paper.
* **Demo data.** Until the research CSV is imported, the database holds `data/seed/demo_workers.csv`, a **synthetic** dataset with the same columns. Every demo profile carries a "Demo data" badge.
* **Notation.** The presentation's system-design slide uses α for the fusion weight. The paper and this code use λ, because α is already the AR weight.

## 6. Feedback loop (application)

```
Select worker → (worker accepts) → start → requester marks complete ──► trust recalculated (CR, DA)
                                                     │
                                         rating + feedback ──► trust recalculated (AR) + review text indexed
                                         optional dispute  ──► trust recalculated (DA); admin may uphold/dismiss
```

`trust_service.recompute()` is the only function that writes trust columns. Every call also inserts a row into `trust_snapshots`, which drives the "trust history" charts.

## 7. Database schema (SQLite, `backend/app/database/schema.sql`)

`users` · `worker_profiles` · `worker_skills` · `work_history` · `service_requests` · `jobs` · `reviews` (rating + written feedback, one per job) · `peer_endorsements` · `disputes` · `verification_records` · `match_logs` · `match_results` · `trust_snapshots`

Foreign keys are enforced (`PRAGMA foreign_keys = ON`). There are CHECK constraints on every enum and rating range, UNIQUE constraints where needed, and a partial unique index that allows only one live job per request. Verification records never store ID numbers.

## 8. API summary

| Method & path | Role |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/me` | public / any |
| `GET /api/workers`, `GET /api/workers/{id}`, `PUT /api/workers/{id}` | any / owner or admin |
| `GET/POST/PUT /api/workers/me`, `GET /api/workers/me/opportunities`, `GET/POST /api/workers/me/verifications` | worker |
| `GET /api/workers/{id}/trust-score`, `/trust-history`, `/reviews`, `POST /{id}/endorse` | any / worker |
| `POST/GET /api/service-requests`, `GET /api/service-requests/{id}`, `PUT /{id}/cancel` | requester (admin read) |
| **`POST /api/match`** | requester, admin (`lambda_weight` admin-only) |
| `POST /api/jobs`, `GET /api/jobs`, `PUT /api/jobs/{id}/accept\|reject\|start\|complete\|withdraw\|cancel` | requester / worker |
| `POST/GET /api/reviews`, `POST/GET /api/disputes` | requester |
| `/api/admin/stats`, `users`, `workers/{id}`, `reviews`, `disputes/{id}`, `verifications/{id}`, `trust-metrics`, `matching`, `lambda-experiment` | admin |
| `/api/meta/config`, `research-results`, `overview`, `preprocess` | public |

## 9. Technology decisions

| Planned | Used | Why |
|---|---|---|
| Flask | **Flask** | Matches the presentation. FastAPI would add nothing needed here. |
| SQLAlchemy | **sqlite3 + schema.sql** | Every query is visible and parameterised (no SQL injection). The schema is easy to show in the viva. |
| Flask-JWT-Extended | **PyJWT** | One small module (`backend/app/auth/security.py`). |
| Vite + Tailwind | **esbuild + hand-written CSS design system** | esbuild is the bundler Vite uses internally. The CSS design system gives full control of the animated look with no build plugins. |
| pytest | **unittest** | Built into Python. pytest also runs these tests. |

## 10. Security

Passwords are hashed with scrypt (Werkzeug). Login uses JWT bearer tokens with role-based decorators (`require_auth("admin")`). Request bodies are validated with pydantic, and unknown fields are rejected (so no resume or degree fields). All SQL is parameterised. Security headers are set on every response, and CORS is opt-in through `.env`. The secret key comes only from `.env`, which `scripts/init_env.py` creates and `.gitignore` excludes. Admin accounts are created only through the command line. A requester's phone number is shared with a worker only after the job is accepted.

## Live benchmark: existing methods vs TrueRank

`GET /api/meta/benchmark` (shown on the Research page) runs 44 everyday requests (2 per trade) through four rankers
on the profiles currently in the database and scores each top-10 list:

| Method | What it represents |
|---|---|
| Keyword search | existing job portals — count of query words found in the profile, listing order |
| Keyword + rating sort | existing service marketplaces — keyword filter, highest rating first |
| TF-IDF + cosine | skill similarity only (TrueRank with λ = 1.0) |
| TrueRank | similarity fused with the Composite Trust Score (λ = 0.7) |

A recommendation is a **good hire** when the worker is in the requested trade and has a reliable record
(rating ≥ 4.0, completion ≥ 85 %, disputes ≤ 5 % of completed jobs); **risky** when the trade is wrong or the record is poor
(rating < 3.5, completion < 75 % or disputes > 8 %). Metrics: Precision@5, NDCG@10, MRR, trade accuracy@5, risky-hire rate@5.
Code: `backend/app/services/evaluation_service.py`; regression test: `tests/test_api_flow.py::test_benchmark_existing_vs_truerank`.

## Everyday-word expansion

Query terms that occur in no worker profile (e.g. "maid", "fridge") are expanded with `ml/preprocessing/synonyms.py`
to profile vocabulary before TF-IDF. Terms that already match are never changed. The expansion is shown in the pipeline inspector.
