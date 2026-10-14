"""Create a .env file with a freshly generated secret key (run once):  python scripts/init_env.py"""
import secrets
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
env_path, example = ROOT / ".env", ROOT / ".env.example"

if env_path.exists():
    sys.exit(".env already exists - leaving it unchanged.")
shutil.copy(example, env_path)
text = env_path.read_text(encoding="utf-8").replace("JWT_SECRET_KEY=", f"JWT_SECRET_KEY={secrets.token_hex(32)}", 1)
env_path.write_text(text, encoding="utf-8")
print("Created .env with a random JWT_SECRET_KEY. Never commit this file.")
