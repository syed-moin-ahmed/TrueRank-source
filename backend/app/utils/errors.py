from __future__ import annotations

import logging

from flask import Flask, jsonify, request
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

log = logging.getLogger("truerank")


class APIError(Exception):
    def __init__(self, status: int, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.details = details or {}


def not_found(what: str = "Resource") -> APIError:
    return APIError(404, f"{what} not found.")


def forbidden(message: str = "You do not have permission to do this.") -> APIError:
    return APIError(403, message)


def conflict(message: str) -> APIError:
    return APIError(409, message)


def bad_request(message: str) -> APIError:
    return APIError(400, message)


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(APIError)
    def _api_error(err: APIError):
        body = {"error": err.message}
        if err.details:
            body["details"] = err.details
        return jsonify(body), err.status

    @app.errorhandler(ValidationError)
    def _validation_error(err: ValidationError):
        fields = {}
        for item in err.errors():
            location = ".".join(str(p) for p in item.get("loc", ())) or "body"
            message = item.get("msg", "Invalid value")
            fields[location] = message.removeprefix("Value error, ")
        return jsonify({"error": "Please check the highlighted fields.", "fields": fields}), 422

    @app.errorhandler(HTTPException)
    def _http_error(err: HTTPException):
        if request.path.startswith("/api/"):
            return jsonify({"error": err.description or err.name}), err.code
        return err

    @app.errorhandler(Exception)
    def _unexpected(err: Exception):  # pragma: no cover - safety net
        log.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify({"error": "Something went wrong on the server."}), 500
