"""
TrueRank management commands (run from the TrueRank folder):

    python backend/manage.py init-db                       create tables
    python backend/manage.py seed-demo                     import data/seed/demo_workers.csv (SYNTHETIC demo data)
    python backend/manage.py import-dataset <file.csv>     import the real research dataset
    python backend/manage.py create-admin --email a@b.com --name "Admin"   (password is asked, never stored in code)
    python backend/manage.py recompute-trust               recalculate every worker's trust score
    python backend/manage.py stats                         quick database summary
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from backend.app import create_app  # noqa: E402
from backend.app.auth.security import hash_password  # noqa: E402
from backend.app.config import ConfigError  # noqa: E402
from backend.app.database.db import get_db, utc_now  # noqa: E402
from backend.app.services import seed_service, trust_service  # noqa: E402

DEMO_CSV = ROOT / "data" / "seed" / "demo_workers.csv"


def cmd_init_db(_args) -> None:
    print("Database ready.")


def cmd_seed_demo(_args) -> None:
    if not DEMO_CSV.exists():
        sys.exit("Demo CSV not found. Run: python scripts/generate_demo_dataset.py")
    n = seed_service.import_csv(get_db(), DEMO_CSV, "demo_seed")
    print(f"Imported {n} SYNTHETIC DEMO worker profiles (source = demo_seed).")


def cmd_import_dataset(args) -> None:
    path = Path(args.csv).resolve()
    if not path.exists():
        sys.exit(f"File not found: {path}")
    try:
        n = seed_service.import_csv(get_db(), path, "research_dataset")
    except seed_service.DatasetError as exc:
        sys.exit(f"Dataset error: {exc}")
    print(f"Imported {n} worker profiles from the research dataset.")


def cmd_create_admin(args) -> None:
    conn = get_db()
    email = args.email.strip().lower()
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        sys.exit("A user with this email already exists.")
    password = args.password or getpass.getpass("Admin password (min 8 chars, letters + numbers): ")
    if len(password) < 8 or password.isalpha() or password.isdigit():
        sys.exit("Password must be at least 8 characters and contain letters and numbers.")
    now = utc_now()
    conn.execute(
        "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)",
        (args.name.strip(), email, hash_password(password), now, now),
    )
    conn.commit()
    print(f"Admin account created for {email}.")


def cmd_ensure_admin(_args) -> None:
    """Create the first admin interactively, only if no admin exists yet."""
    conn = get_db()
    if conn.execute("SELECT 1 FROM users WHERE role = 'admin'").fetchone():
        print("Admin account already exists.")
        return
    print("\nCreate the ADMIN account (used to open the admin dashboard).")
    email = input("Admin email [admin@truerank.local]: ").strip().lower() or "admin@truerank.local"
    while True:
        password = getpass.getpass("Choose admin password (8+ chars, letters and numbers; typing is hidden): ")
        if len(password) < 8 or password.isalpha() or password.isdigit():
            print("  Too weak - use at least 8 characters with letters AND numbers.")
            continue
        if getpass.getpass("Type the password again: ") != password:
            print("  Passwords did not match, try again.")
            continue
        break
    now = utc_now()
    conn.execute(
        "INSERT INTO users (name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)",
        ("Administrator", email, hash_password(password), now, now),
    )
    conn.commit()
    print(f"Admin account created: {email}")


def cmd_recompute(_args) -> None:
    conn = get_db()
    ids = [r[0] for r in conn.execute("SELECT id FROM worker_profiles").fetchall()]
    for wid in ids:
        trust_service.recompute(wid, "manual_recompute", conn)
    conn.commit()
    print(f"Recalculated trust for {len(ids)} workers.")


def cmd_stats(_args) -> None:
    conn = get_db()
    for table in ("users", "worker_profiles", "service_requests", "jobs", "reviews", "disputes", "match_logs"):
        print(f"{table:18s} {conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]}")


def main() -> None:
    parser = argparse.ArgumentParser(description="TrueRank management commands")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init-db").set_defaults(func=cmd_init_db)
    sub.add_parser("seed-demo").set_defaults(func=cmd_seed_demo)
    p = sub.add_parser("import-dataset")
    p.add_argument("csv")
    p.set_defaults(func=cmd_import_dataset)
    p = sub.add_parser("create-admin")
    p.add_argument("--email", required=True)
    p.add_argument("--name", default="Administrator")
    p.add_argument("--password", help=argparse.SUPPRESS)  # for automated tests only
    p.set_defaults(func=cmd_create_admin)
    sub.add_parser("ensure-admin").set_defaults(func=cmd_ensure_admin)
    sub.add_parser("recompute-trust").set_defaults(func=cmd_recompute)
    sub.add_parser("stats").set_defaults(func=cmd_stats)
    args = parser.parse_args()

    try:
        app = create_app()
    except ConfigError as exc:
        sys.exit(f"Configuration error: {exc}")
    with app.app_context():
        args.func(args)


if __name__ == "__main__":
    main()
