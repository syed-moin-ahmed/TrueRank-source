<div align="center">

# TrueRank

### Trust-Aware NLP Framework for Matching Informal Workers to Industry Demand

Ranks electricians, plumbers, carpenters and other informal workers for a plain-English service request by combining **skill relevance** (TF-IDF + cosine similarity) with a **composite trust score** built from their real track record.

[**🔗 Live demo**](https://truerank-teal.vercel.app) · [📄 Research paper & results](https://github.com/syed-moin-ahmed/TrueRank#research-publication) · [Architecture](docs/ARCHITECTURE.md)

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-TF--IDF-F7931E?logo=scikitlearn&logoColor=white)
![NLTK](https://img.shields.io/badge/NLTK-lemmatization-154F5B)
![Flask](https://img.shields.io/badge/Flask-REST%20API-000000?logo=flask&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Tests](https://img.shields.io/badge/tests-40-2EA44F)
![Paper](https://img.shields.io/badge/Paper-Scopus%20%C2%B7%20Taylor%20%26%20Francis-0A5EB0)

</div>

> © 2026 Syed Moin Ahmed. All rights reserved. The code is published for viewing only; see [LICENSE](LICENSE).

## How it works

```
query → preprocessing → TF-IDF → cosine similarity S(w,q)
                                         ↘
             Composite Trust Score  TS = 0.40·AR + 0.20·CR + 0.20·PE + 0.20·DA
                                         ↘
                 R(w,q) = 0.7·S(w,q) + 0.3·TS(w)  →  ranked, explained recommendations
```

Ratings, completed jobs, endorsements and disputes update the trust score in the database, so the next search ranks differently. That is the feedback loop.

**Highlights**
- **Research core separated from the web layer.** `ml/` never imports Flask or touches the database, so the algorithm is tested on its own.
- **Explainable ranking.** The matched terms add up exactly to the similarity score (tested), and every trust component is shown.
- **90.6 % accuracy** in the paper's evaluation, ahead of Naïve Bayes, Logistic Regression, SVM and Random Forest.
- **Full-stack:** Flask REST API (JWT, roles, Pydantic validation, parameterised SQL), React 19 frontend with four portals, SQLite with 13 constrained tables.
- **40 automated tests**, including a complete end-to-end API flow.
- **Deployed on Vercel:** static React site plus Python serverless API.

## Where to look in the code

| Path | What it does |
|---|---|
| [`ml/preprocessing/`](ml/preprocessing) | tokenising, stop words, lemmatisation, worker document builder |
| [`ml/matching/tfidf_index.py`](ml/matching/tfidf_index.py) | TF-IDF index, cosine similarity, per-term contributions |
| [`ml/trust/trust_score.py`](ml/trust/trust_score.py) | Composite Trust Score with cold-start priors |
| [`ml/ranking/`](ml/ranking) | score fusion, ranking and explanations |
| [`backend/app/`](backend/app) | Flask routes, services, auth, schema |
| [`frontend/src/`](frontend/src) | React app: public, requester, worker and admin portals |
| [`tests/`](tests) | unit and end-to-end tests |

More detail: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** · demo walkthrough: **[docs/VIVA_DEMO.md](docs/VIVA_DEMO.md)**

---

# Running it locally

## 1. Requirements

* **Python 3.10 or newer**: `python3 --version`
* **Node.js 18 or newer** (only to build the frontend): `node --version`
* An internet connection for the first install (pip, npm, NLTK data)

## 2. Setup (macOS / Linux, one time)

Run from inside the `TrueRank` folder:

```bash
# Python environment
python3 -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# NLTK stop words + WordNet (downloaded into ml/nltk_data, works offline afterwards)
python scripts/setup_nltk.py

# Secret key (.env)
python scripts/init_env.py

# Database + demo data + admin account
python backend/manage.py init-db
python backend/manage.py seed-demo
python backend/manage.py create-admin --email admin@truerank.local --name "Admin"   # asks for a password

# Frontend
cd frontend
npm install
npm run build
cd ..
```

## 3. Run

```bash
source .venv/bin/activate
python backend/run.py
```

Open **http://127.0.0.1:5000**. Flask serves both the API and the website.

During frontend development, run `npm run dev` in `frontend/` (it rebuilds on save) and refresh the browser.

## 4. Tests

```bash
python -m unittest discover -s tests -t .
```

* `test_ml_core.py`: preprocessing, TF-IDF (checked against the smoothed IDF formula), cosine similarity, trust formula checked by hand, ranking, explanations.
* `test_api_flow.py`: auth, roles, validation, filters, and the **complete 13-step viva flow** through the API (trust 0.40 → 0.80 and the rank change).
* `test_nltk_real.py`: checks the real NLTK lemmatizer and stop words.

## 5. Data

| File | What it is |
|---|---|
| `data/seed/demo_workers.csv` | **Synthetic demo data** (600 profiles) using the research dataset's column names. **Not** the research dataset. Regenerate with `python scripts/generate_demo_dataset.py`. |
| `data/dataset/` | Put the real 1,500-profile research CSV here, then run `python backend/manage.py import-dataset data/dataset/<file>.csv`. |

Imported profiles are labelled "Research dataset" in the UI. Demo profiles are labelled "Demo data".

## 6. Configuration (`.env`)

The paper's values are the defaults: `TRUERANK_WEIGHT_AR=0.40`, `CR=0.20`, `PE=0.20`, `DA=0.20`, `TRUERANK_LAMBDA=0.70`.
Implementation parameters: `TRUERANK_MIN_SIMILARITY` (τ), `TRUERANK_PE_CAP`, `TRUERANK_NEUTRAL_PRIOR`, `TRUERANK_INCLUDE_REVIEWS`, `TRUERANK_NGRAM_MAX`.
Never commit `.env`. It is already listed in `.gitignore`.

## 7. Project structure

```
TrueRank/
├── ml/                     research core (no web code)
│   ├── config.py           all weights and parameters
│   ├── preprocessing/      text cleaning, stop words, lemmatization, worker document
│   ├── matching/           TF-IDF index + cosine similarity + term contributions
│   ├── trust/              Composite Trust Score
│   ├── ranking/            score fusion, ranking, explanations
│   └── engine.py           TrueRankEngine (whole pipeline)
├── backend/
│   ├── app/                Flask: routes, services, schemas, auth, database (schema.sql)
│   ├── run.py              start the server
│   └── manage.py           init-db, seed-demo, import-dataset, create-admin, recompute-trust
├── frontend/               React app (src/pages: public, requester, worker, admin, shared)
├── data/                   seed (demo) + dataset (research CSV goes here)
├── scripts/                demo-data generator, NLTK setup, .env creator
├── tests/
└── docs/
```

## 8. Troubleshooting

* **"NLTK data is missing"**: run `python scripts/setup_nltk.py`.
* **"JWT_SECRET_KEY is missing"**: run `python scripts/init_env.py`.
* **The page says "Frontend not built yet"**: run `npm install && npm run build` inside `frontend/`.
* **Port 5000 is busy on macOS** (AirPlay Receiver): set `PORT=5050` in `.env` and open http://127.0.0.1:5050.

## 9. Deployment (Vercel)

`vercel.json` builds the React site as static files and runs the Flask API (`api/index.py`) as a Python serverless function. Set these environment variables in the Vercel project: `JWT_SECRET_KEY` (32+ random characters), and optionally `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The live database is created in `/tmp` and seeded with the demo data on every cold start.

---

**Author:** Syed Moin Ahmed ([syedmoin1907@gmail.com](mailto:syedmoin1907@gmail.com)) · © 2026 All rights reserved.
