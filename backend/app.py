"""
app.py — Velo CI/CD Healing Agent
Flask entry-point: sets up the server, CORS, and the single trigger endpoint.

AUTONOMOUS DESIGN NOTE:
  Once POST /api/analyze is called, the entire healing pipeline (test → analyse →
  fix → commit → push) runs to completion with ZERO human intervention.
  There are no input() prompts, no manual confirmation steps, and no blocking
  callbacks that require a human response anywhere in this file or agent.py.
"""

import os
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env before importing agent so GEMINI_API_KEY is available at module level
load_dotenv()

from agent import run_healing_agent  # noqa: E402 — intentional post-dotenv import

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = Flask(__name__)

# CORS — allow every origin for local/hackathon use.
# In production, replace "*" with your specific frontend domain(s).
CORS(app, resources={r"/api/*": {"origins": os.getenv("ALLOWED_ORIGINS", "*")}})

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("velo.app")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health_check():
    """Simple liveness probe — useful for Docker / k8s readiness checks."""
    return jsonify({
        "status": "ok",
        "service": "Velo CI/CD Healing Agent",
        "version": "1.0.0",
    }), 200


# ---------------------------------------------------------------------------
# Primary trigger endpoint
# ---------------------------------------------------------------------------
@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Trigger the autonomous healing pipeline.

    Expected JSON body:
    ┌─────────────────────────────────────────────────────────────┐
    │ {                                                           │
    │   "repo_path":   "/absolute/path/to/local/git/repo",       │
    │   "branch_name": "Vakratund Tejas Kumar Punyap"            │
    │ }                                                           │
    └─────────────────────────────────────────────────────────────┘

    The branch_name is the raw, human-readable name supplied by the
    frontend.  agent.py will auto-format it to ALLCAPS_UNDERSCORE_AI_Fix.

    Returns:
        200 — full healing succeeded (tests fixed, branch pushed)
        207 — partial success (e.g., tests already passing or push failed)
        400 — bad request (missing / invalid fields)
        500 — unhandled internal error
    """
    # -- Parse and validate request body ----------------------------------
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    repo_path   = data.get("repo_path", "").strip()
    branch_name = data.get("branch_name", "").strip()

    if not repo_path:
        return jsonify({"error": "Missing required field: repo_path"}), 400

    if not branch_name:
        return jsonify({"error": "Missing required field: branch_name"}), 400

    if not os.path.isdir(repo_path):
        return jsonify({
            "error": f"repo_path does not point to an existing directory: {repo_path}"
        }), 400

    # -- Fire the autonomous pipeline ------------------------------------
    logger.info("Healing request received — repo=%s  raw_branch=%s", repo_path, branch_name)

    try:
        # run_healing_agent is fully autonomous: no human steps inside.
        results = run_healing_agent(repo_path=repo_path, raw_branch_name=branch_name)

        http_status = 200 if results.get("status") == "SUCCESS" else 207
        return jsonify(results), http_status

    except Exception as exc:
        logger.exception("Unhandled error during healing pipeline.")
        return jsonify({
            "error": str(exc),
            "status": "FATAL_ERROR",
        }), 500


# ---------------------------------------------------------------------------
# Dev server entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"

    logger.info("Starting Velo on port %d  (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
