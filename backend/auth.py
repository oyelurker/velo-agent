"""
auth.py — GitHub OAuth handled by the backend.

Flow:
  GET /api/auth/github     → redirect to GitHub
  GET /api/auth/github/callback?code=...&state=... → exchange code, issue JWT, redirect to frontend with ?token=...
Protected routes expect: Authorization: Bearer <jwt>
"""

import os
import secrets
import logging
import time
from functools import wraps
from urllib.parse import urlencode

import requests
from flask import request, jsonify, redirect

logger = logging.getLogger("velo.auth")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
FRONTEND_URL = (os.getenv("FRONTEND_URL", "").strip() or "http://localhost:5173").rstrip("/")
JWT_SECRET = os.getenv("JWT_SECRET", "").strip() or "velo-dev-secret-change-in-production"
JWT_EXPIRY_SECONDS = int(os.getenv("JWT_EXPIRY_SECONDS", "86400"))  # 24h

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


def _load_jwt():
    try:
        import jwt as pyjwt
        return pyjwt
    except ImportError:
        return None


def _issue_jwt(user: dict) -> str:
    """Build JWT with user id, login, email."""
    jwt_mod = _load_jwt()
    if not jwt_mod:
        raise RuntimeError("PyJWT not installed")
    payload = {
        "sub": str(user.get("id", "")),
        "login": user.get("login", ""),
        "email": user.get("email") or "",
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt_mod.encode(payload, JWT_SECRET, algorithm="HS256")


def _verify_jwt(token: str) -> dict | None:
    """Verify JWT and return payload or None."""
    jwt_mod = _load_jwt()
    if not jwt_mod or not token:
        return None
    try:
        return jwt_mod.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def get_current_user() -> dict | None:
    """Read Authorization: Bearer <jwt> and return user dict or None."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    payload = _verify_jwt(token)
    if not payload:
        return None
    return {
        "id": payload.get("sub"),
        "login": payload.get("login"),
        "email": (payload.get("email") or "").strip() or None,
    }


def require_auth(f):
    """Decorator: require valid JWT. Sets request.current_user; 401 if missing/invalid."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Missing or invalid authorization token"}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return wrapped


def github_oauth_start():
    """Redirect to GitHub OAuth. Call from GET /api/auth/github."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return redirect(FRONTEND_URL + "/auth?error=not_configured", code=302)
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": request.url_root.rstrip("/") + "/api/auth/github/callback",
        "scope": "repo user:email",
        "state": state,
        "prompt": "login",  # Force GitHub login screen so logout feels complete
    }
    url = GITHUB_AUTHORIZE_URL + "?" + urlencode(params)
    resp = redirect(url, code=302)
    resp.set_cookie("oauth_state", state, max_age=600, httponly=True, samesite="Lax")
    return resp


def github_oauth_callback():
    """Exchange code for token, fetch user, issue JWT, redirect to frontend. Call from GET /api/auth/github/callback."""
    state = request.args.get("state")
    code = request.args.get("code")
    if not state or not code:
        return redirect(FRONTEND_URL + "/auth?error=missing_params", code=302)
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or not secrets.compare_digest(state, cookie_state):
        return redirect(FRONTEND_URL + "/auth?error=invalid_state", code=302)

    # Exchange code for access_token
    token_resp = requests.post(
        GITHUB_TOKEN_URL,
        headers={"Accept": "application/json"},
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": request.url_root.rstrip("/") + "/api/auth/github/callback",
            "state": state,
        },
        timeout=15,
    )
    token_resp.raise_for_status()
    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        logger.warning("GitHub token response: no access_token")
        return redirect(FRONTEND_URL + "/auth?error=no_token", code=302)

    # Fetch GitHub user
    user_resp = requests.get(
        GITHUB_USER_URL,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"},
        timeout=10,
    )
    user_resp.raise_for_status()
    gh_user = user_resp.json()
    user = {
        "id": gh_user.get("id"),
        "login": gh_user.get("login", ""),
        "email": (gh_user.get("email") or "").strip(),
        "avatar_url": gh_user.get("avatar_url"),
    }
    if not user["email"]:
        # Try emails API
        try:
            em_resp = requests.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"},
                timeout=5,
            )
            if em_resp.ok:
                for e in em_resp.json():
                    if e.get("primary"):
                        user["email"] = (e.get("email") or "").strip()
                        break
        except Exception:
            pass

    try:
        jwt_token = _issue_jwt(user)
    except Exception as e:
        logger.exception("JWT issue failed: %s", e)
        return redirect(FRONTEND_URL + "/auth?error=server_error", code=302)

    redirect_url = FRONTEND_URL + "/?token=" + jwt_token
    resp = redirect(redirect_url, code=302)
    resp.delete_cookie("oauth_state")
    return resp
