"""
Vercel entry point. Vercel runs this Flask app as a serverless function for every /api/... request;
the React site (frontend/dist) is served by Vercel as static files.

Vercel has no permanent disk, so on each cold start the SQLite database is created in /tmp and
filled with the synthetic demo data. Changes made on the live site last only while that instance
stays warm. The local version (START TRUERANK.command) keeps its data normally.

Environment variables to set in the Vercel project settings:
    JWT_SECRET_KEY   optional; a random key is generated per instance if not set
    ADMIN_EMAIL      admin login for the live site (optional)
    ADMIN_PASSWORD   8+ characters with letters and numbers (optional)
"""
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DATABASE_PATH", "/tmp/truerank.db")
# Each Vercel instance has its own fresh database, so a per-instance random signing key is
# consistent with it. Set JWT_SECRET_KEY in Vercel to override.
if len(os.getenv("JWT_SECRET_KEY", "")) < 32:
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)

from backend.app import create_app  # noqa: E402
from backend.app.auth.security import hash_password  # noqa: E402
from backend.app.database.db import get_db, utc_now  # noqa: E402
from backend.app.services import seed_service  # noqa: E402

app = create_app()

with app.app_context():
    conn = get_db()
    if conn.execute("SELECT COUNT(*) FROM worker_profiles").fetchone()[0] == 0:
        seed_service.import_csv(conn, ROOT / "data" / "seed" / "demo_workers.csv", "demo_seed")
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "").strip()
    status = "skipped (ADMIN_EMAIL or ADMIN_PASSWORD not set or shorter than 8 characters)"
    if email and len(password) >= 8:
        now = utc_now()
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            conn.execute("UPDATE users SET role = 'admin', password_hash = ?, updated_at = ? WHERE id = ?",
                         (hash_password(password), now, existing[0]))
        else:
            conn.execute(
                "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)",
                ("Administrator", email, hash_password(password), now, now),
            )
        conn.commit()
        status = "ready"
    # Diagnostic only: never logs the password itself.
    print(f"[truerank] admin account {status}: email={email or '-'} password_length={len(password)}", flush=True)
