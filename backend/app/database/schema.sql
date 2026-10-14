-- TrueRank relational schema (SQLite).
-- Foreign keys are enforced per connection with PRAGMA foreign_keys = ON (see db.py).
-- Timestamps are stored as ISO-8601 UTC text.

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL CHECK (length(trim(name)) > 0),
    email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT    NOT NULL,
    role            TEXT    NOT NULL CHECK (role IN ('requester', 'worker', 'admin')),
    phone           TEXT,
    city            TEXT,
    gender          TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'unspecified')),
    is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

-- One row per informal worker. Dataset/demo workers have no login (user_id IS NULL).
CREATE TABLE IF NOT EXISTS worker_profiles (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    source                TEXT    NOT NULL CHECK (source IN ('research_dataset', 'demo_seed', 'registered')),
    external_id           TEXT    UNIQUE,
    name                  TEXT    NOT NULL,
    gender                TEXT    CHECK (gender IS NULL OR gender IN ('male', 'female', 'unspecified')),
    occupation            TEXT    NOT NULL CHECK (length(trim(occupation)) > 0),
    experience_years      REAL    NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    city                  TEXT    NOT NULL,
    languages             TEXT    NOT NULL DEFAULT '',
    profile_description   TEXT    NOT NULL DEFAULT '',
    is_verified           INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
    is_available          INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),

    -- Baseline evidence imported from a dataset (all zero for workers who register on the site)
    base_rating_sum       REAL    NOT NULL DEFAULT 0 CHECK (base_rating_sum >= 0),
    base_rating_count     INTEGER NOT NULL DEFAULT 0 CHECK (base_rating_count >= 0),
    base_jobs_completed   INTEGER NOT NULL DEFAULT 0 CHECK (base_jobs_completed >= 0),
    base_jobs_closed      INTEGER NOT NULL DEFAULT 0 CHECK (base_jobs_closed >= base_jobs_completed),
    base_endorsements     INTEGER NOT NULL DEFAULT 0 CHECK (base_endorsements >= 0),
    base_disputes         INTEGER NOT NULL DEFAULT 0 CHECK (base_disputes >= 0),
    base_review_text      TEXT    NOT NULL DEFAULT '',
    base_review_sentiment TEXT,

    -- Cached aggregates = baseline + live platform data (written only by trust_service)
    stat_rating_count     INTEGER NOT NULL DEFAULT 0,
    stat_rating_avg       REAL,
    stat_jobs_completed   INTEGER NOT NULL DEFAULT 0,
    stat_jobs_closed      INTEGER NOT NULL DEFAULT 0,
    stat_endorsements     INTEGER NOT NULL DEFAULT 0,
    stat_disputes         INTEGER NOT NULL DEFAULT 0,

    -- Cached Composite Trust Score; NULL component = not enough data
    trust_ar              REAL,
    trust_cr              REAL,
    trust_pe              REAL,
    trust_da              REAL,
    trust_score           REAL    NOT NULL DEFAULT 0,
    trust_updated_at      TEXT,

    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worker_occupation ON worker_profiles(occupation);
CREATE INDEX IF NOT EXISTS idx_worker_city ON worker_profiles(city);

CREATE TABLE IF NOT EXISTS worker_skills (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id   INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    skill       TEXT    NOT NULL CHECK (length(trim(skill)) > 0),
    UNIQUE (worker_id, skill COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS work_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id   INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT    NOT NULL DEFAULT '',
    year        INTEGER CHECK (year IS NULL OR (year BETWEEN 1950 AND 2100)),
    created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS service_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text    TEXT    NOT NULL CHECK (length(trim(query_text)) > 0),
    city          TEXT,
    status        TEXT    NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON service_requests(requester_id);

-- A job = a worker selected for a service request.
CREATE TABLE IF NOT EXISTS jobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id  INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    worker_id           INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    requester_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT    NOT NULL
                        CHECK (status IN ('pending', 'accepted', 'rejected', 'in_progress',
                                          'completed', 'withdrawn', 'cancelled')),
    auto_accepted       INTEGER NOT NULL DEFAULT 0 CHECK (auto_accepted IN (0, 1)),
    match_log_id        INTEGER REFERENCES match_logs(id) ON DELETE SET NULL,
    selected_rank       INTEGER,
    selected_similarity REAL,
    selected_trust      REAL,
    selected_final      REAL,
    created_at          TEXT    NOT NULL,
    accepted_at         TEXT,
    started_at          TEXT,
    completed_at        TEXT,
    closed_at           TEXT,
    updated_at          TEXT    NOT NULL
);
-- At most one live (non-terminal-failure) job per request.
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_one_active_per_request
    ON jobs(service_request_id) WHERE status IN ('pending', 'accepted', 'in_progress', 'completed');
CREATE INDEX IF NOT EXISTS idx_jobs_worker ON jobs(worker_id);

-- Rating + written feedback for a completed job (one per job).
CREATE TABLE IF NOT EXISTS reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id        INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id     INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    requester_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_worker ON reviews(worker_id);

CREATE TABLE IF NOT EXISTS peer_endorsements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    endorser_worker_id  INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    endorsed_worker_id  INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    note                TEXT    NOT NULL DEFAULT '',
    created_at          TEXT    NOT NULL,
    UNIQUE (endorser_worker_id, endorsed_worker_id),
    CHECK (endorser_worker_id <> endorsed_worker_id)
);

CREATE TABLE IF NOT EXISTS disputes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id       INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id    INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    raised_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       TEXT    NOT NULL CHECK (length(trim(reason)) > 0),
    status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
    admin_note   TEXT    NOT NULL DEFAULT '',
    resolved_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at  TEXT,
    created_at   TEXT    NOT NULL
);

-- Verification never stores ID numbers: only the method and a free-text note.
CREATE TABLE IF NOT EXISTS verification_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id       INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    method          TEXT    NOT NULL CHECK (method IN ('phone', 'government_id', 'employer_reference', 'community_reference')),
    reference_note  TEXT    NOT NULL DEFAULT '',
    status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TEXT,
    created_at      TEXT    NOT NULL
);

-- Every execution of the matching pipeline.
CREATE TABLE IF NOT EXISTS match_logs (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,
    service_request_id          INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
    query_text                  TEXT    NOT NULL,
    processed_query             TEXT    NOT NULL,
    lambda_used                 REAL    NOT NULL,
    min_similarity              REAL    NOT NULL,
    documents_indexed           INTEGER NOT NULL,
    candidates_above_threshold  INTEGER NOT NULL,
    results_returned            INTEGER NOT NULL,
    created_at                  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS match_results (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    match_log_id  INTEGER NOT NULL REFERENCES match_logs(id) ON DELETE CASCADE,
    worker_id     INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    rank          INTEGER NOT NULL CHECK (rank >= 1),
    similarity    REAL    NOT NULL,
    trust_score   REAL    NOT NULL,
    final_score   REAL    NOT NULL,
    UNIQUE (match_log_id, worker_id)
);

-- History of every trust recalculation (shows the feedback loop working).
CREATE TABLE IF NOT EXISTS trust_snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id    INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
    ar           REAL,
    cr           REAL,
    pe           REAL,
    da           REAL,
    trust_score  REAL    NOT NULL,
    trigger      TEXT    NOT NULL,
    created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_worker ON trust_snapshots(worker_id);
