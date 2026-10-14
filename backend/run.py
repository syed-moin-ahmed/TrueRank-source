"""
Start the TrueRank server:   python backend/run.py
Then open http://127.0.0.1:5000
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from backend.app import create_app  # noqa: E402
from backend.app.config import ConfigError  # noqa: E402

if __name__ == "__main__":
    try:
        app = create_app()
    except ConfigError as exc:
        sys.exit(f"Configuration error: {exc}")
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)
