"""
auth.py — Firebase Authentication for Velo API.

The frontend signs in with Firebase (e.g. signInWithEmailAndPassword) and sends
the Firebase ID token in the Authorization header. This module verifies the
token using the Firebase Admin SDK and exposes require_auth for protected routes.

No backend register/login — Firebase handles those on the client.
"""

import json
import os
import logging
from functools import wraps

from flask import request, jsonify

logger = logging.getLogger("velo.auth")

# Lazy-initialized Firebase app
_firebase_app = None


def _init_firebase():
    """Initialize Firebase Admin SDK from env. Idempotent."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    try:
        import firebase_admin
        from firebase_admin import credentials
        _firebase_app = firebase_admin.get_app()
        logger.info("Using existing Firebase app.")
        return _firebase_app
    except ValueError:
        pass
    except ImportError:
        logger.warning("firebase-admin not installed; auth will return 503.")
        return None

    # Ensure .env is loaded from this package's directory (in case app was run from another cwd)
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.isfile(_env_path):
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path=_env_path)
        except ImportError:
            pass

    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    json_str = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()

    # Default: same directory as this module (backend/)
    if not path and not json_str:
        _default_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "firebase-service-account.json",
        )
        if os.path.isfile(_default_path):
            path = _default_path

    if path and os.path.isfile(path):
        cred = credentials.Certificate(path)
    elif json_str:
        try:
            cred = credentials.Certificate(json.loads(json_str))
        except json.JSONDecodeError as e:
            logger.error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON: %s", e)
            return None
    else:
        logger.warning(
            "Firebase not configured: set FIREBASE_SERVICE_ACCOUNT_PATH or "
            "FIREBASE_SERVICE_ACCOUNT_JSON (env loaded from %s)",
            _env_path,
        )
        return None

    try:
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized.")
    except Exception as e:
        logger.exception("Firebase init failed: %s", e)
        _firebase_app = None
        return None

    return _firebase_app


def verify_firebase_token(id_token: str) -> dict | None:
    """
    Verify a Firebase ID token and return decoded claims (uid, email, etc.)
    or None if invalid/expired.
    """
    app = _init_firebase()
    if not app:
        return None

    from firebase_admin import auth as firebase_auth

    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        logger.debug("Token verification failed: %s", e)
        return None


def get_current_user() -> dict | None:
    """
    Read Authorization: Bearer <token> from the current request, verify with
    Firebase, and return a user dict { "id": uid, "email": email } or None.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    if not token:
        return None

    decoded = verify_firebase_token(token)
    if not decoded:
        return None

    uid = decoded.get("uid") or decoded.get("sub")
    email = (decoded.get("email") or "").strip() or None
    return {"id": uid, "email": email}


def require_auth(f):
    """
    Decorator: require valid Firebase ID token. Sets request.current_user and
    returns 401 if missing/invalid, or 503 if Firebase is not configured.
    """
    @wraps(f)
    def wrapped(*args, **kwargs):
        app = _init_firebase()
        if not app:
            return (
                jsonify({
                    "error": "Authentication is not configured (Firebase). "
                    "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON.",
                }),
                503,
            )
        user = get_current_user()
        if not user:
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return wrapped
