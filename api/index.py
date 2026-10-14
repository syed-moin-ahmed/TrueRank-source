"""
Vercel entry point. Vercel runs this Flask app as a serverless function for every /api/... request;
the React site (frontend/dist) is served by Vercel as static files.

Vercel has no permanent disk, so on each cold start the SQLite database is created in /tmp and
filled with the synthetic demo data. Changes made on the live site last only while that instance
stays warm. The local version (START TRUERANK.command) keeps its data normally.

Environment variables to set in the Vercel project settings:
    JWT_SECRET_KEY   at least 32 random characters
    ADMIN_EMAIL      admin login for the live site (optional)
    ADMIN_PASSWORD   8+ characters with letters and numbers (optional)
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DATABASE_PATH", "/tmp/truerank.db")

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
    password = os.getenv("ADMIN_PASSWORD", "")
    if email and len(password) >= 8 and not conn.execute("SELECT 1 FROM users WHERE role = 'admin'").fetchone():
        now = utc_now()
        conn.execute(
            "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)",
            ("Administrator", email, hash_password(password), now, now),
        )
        conn.commit()
