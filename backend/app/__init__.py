"""Flask application factory."""
from __future__ import annotations

import logging
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from ml.config import TrueRankConfig
from ml.engine import TrueRankEngine

from .config import load_config
from .database import db
from .services.matching_service import MatchingService
from .utils.errors import register_error_handlers


def create_app(overrides: dict | None = None, truerank_config: TrueRankConfig | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(load_config(overrides))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    cfg = truerank_config or TrueRankConfig.from_env()
    app.extensions["truerank_config"] = cfg
    app.extensions["truerank_matching"] = MatchingService(TrueRankEngine(cfg))

    db.init_app(app)
    register_error_handlers(app)

    from .routes import admin, auth, dashboard, jobs, match, meta, service_requests, workers, feedback

    for module in (auth, workers, service_requests, match, jobs, feedback, admin, meta, dashboard):
        app.register_blueprint(module.bp)

    _register_security_headers(app)
    _register_frontend(app)
    return app


def _register_security_headers(app: Flask) -> None:
    allowed = set(app.config["CORS_ORIGINS"])

    @app.after_request
    def _headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        origin = request.headers.get("Origin")
        # CORS is only needed if the frontend is served from a different origin (configured in .env).
        if origin and origin in allowed and request.path.startswith("/api/"):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    @app.route("/api/<path:_any>", methods=["OPTIONS"])
    def _preflight(_any):
        return ("", 204)


def _register_frontend(app: Flask) -> None:
    """Serve the built React app (frontend/dist) so the whole system runs on one URL."""
    dist = Path(app.config["FRONTEND_DIST"])

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def _frontend(path: str):
        if path.startswith("api/"):
            return jsonify({"error": "Not found."}), 404
        if path and (dist / path).is_file():
            return send_from_directory(dist, path)
        if (dist / "index.html").is_file():
            response = send_from_directory(dist, "index.html")
            response.headers["Cache-Control"] = "no-store"
            return response
        return (
            "<h1>TrueRank API is running</h1><p>Frontend not built yet. Run <code>npm run build</code> "
            "inside the <code>frontend</code> folder.</p>",
            200,
        )
