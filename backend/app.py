"""
app.py — Velo CI/CD Healing Agent
Flask entry-point: clones the target repo, runs the healing pipeline with
configurable retries, and returns a fully-shaped response to the React dashboard.

AUTONOMOUS DESIGN NOTE:
  Once POST /api/analyze is called, the entire healing pipeline (clone → test →
  analyse → fix → commit → push) runs to completion with ZERO human intervention.
  There are no input() prompts, no manual confirmation steps, and no blocking
  callbacks that require a human response anywhere in this file or agent.py.
"""

import os
import logging
import re
import shutil
import tempfile
import time
from datetime import datetime, timezone

import git
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env before importing agent so GEMINI_API_KEY is available at module level
load_dotenv()

from agent import run_healing_agent, format_branch_name  # noqa: E402

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

# Configurable retry limit — override via MAX_RETRIES env var (default 5)
MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", 5))

# Matches the canonical bug-report lines emitted by agent.py Node 2
_BUG_PATTERN = re.compile(
    r"\[(\w+)\] error in (.+?) line (\d+) \u2192 Fix: (.+)"
)


def _parse_bug_report(line: str) -> dict | None:
    """Parse a canonical bug-report line into a structured dict for the frontend."""
    m = _BUG_PATTERN.match(line.strip())
    if m:
        return {
            "bug_type":        m.group(1),
            "file":            m.group(2).strip(),
            "line_number":     int(m.group(3)),
            "fix_description": m.group(4).strip(),
        }
    return None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health_check():
    """Simple liveness probe — useful for Docker / k8s readiness checks."""
    return jsonify({
        "status":  "ok",
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
    ┌───────────────────────────────────────────────────────────┐
    │ {                                                         │
    │   "repo_url":    "https://github.com/org/repo",          │
    │   "team_name":   "Vakratund",                            │
    │   "leader_name": "Tejas Kumar Punyap"                    │
    │ }                                                         │
    └───────────────────────────────────────────────────────────┘

    Flow:
      1. Validate input fields.
      2. Clone the GitHub repo into a secure temp directory.
      3. Build the branch name: format_branch_name("{team_name} {leader_name}")
         → VAKRATUND_TEJAS_KUMAR_PUNYAP_AI_Fix
      4. Run the healing agent in a retry loop (up to MAX_RETRIES iterations).
         Each iteration: sandbox_tester → llm_solver → gitops
         Stop early when tests pass or no more bugs are found.
      5. Shape the aggregated results into the React dashboard format.
      6. Clean up temp directory unconditionally.

    Returns:
        200 — all tests passing after healing
        207 — partial success (fixes applied but tests still failing)
        400 — bad request (missing / invalid fields, clone failure)
        500 — unhandled internal error
    """
    # -- Validate request body ------------------------------------------
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    repo_url    = data.get("repo_url", "").strip()
    team_name   = data.get("team_name", "").strip()
    leader_name = data.get("leader_name", "").strip()

    if not repo_url:
        return jsonify({"error": "Missing required field: repo_url"}), 400
    if not team_name:
        return jsonify({"error": "Missing required field: team_name"}), 400
    if not leader_name:
        return jsonify({"error": "Missing required field: leader_name"}), 400

    # Branch name = TEAM_NAME + LEADER_NAME per hackathon spec
    raw_branch_name  = f"{team_name} {leader_name}"
    formatted_branch = format_branch_name(raw_branch_name)

    logger.info(
        "Analysis request — repo=%s  team=%s  leader=%s  branch=%s",
        repo_url, team_name, leader_name, formatted_branch,
    )

    start_time = time.time()
    tmp_dir    = None

    try:
        # -- Clone repository -------------------------------------------
        tmp_dir = tempfile.mkdtemp(prefix="velo_")
        logger.info("Cloning %s → %s", repo_url, tmp_dir)

        try:
            git.Repo.clone_from(repo_url, tmp_dir)
            logger.info("Clone complete.")
        except git.GitCommandError as exc:
            return jsonify({"error": f"Failed to clone repository: {exc}"}), 400

        # -- Retry healing loop -----------------------------------------
        timeline:            list = []
        all_fixes:           list = []
        total_failures:      int  = 0
        total_fixes_applied: int  = 0
        commit_count:        int  = 0
        final_status:        str  = "FAILED"
        seen_bug_lines:      set  = set()    # dedup fixes across retries

        for attempt in range(1, MAX_RETRIES + 1):
            logger.info("Healing attempt %d / %d", attempt, MAX_RETRIES)

            results      = run_healing_agent(
                repo_path=tmp_dir,
                raw_branch_name=raw_branch_name,
            )
            attempt_ts   = datetime.now(timezone.utc).strftime("%H:%M:%S")
            tests_passed = results.get("tests_passed", False)
            bug_reports  = results.get("bug_reports", [])
            files_fixed  = results.get("files_fixed", [])

            if results.get("branch_pushed"):
                commit_count += 1

            failures_this_run   = len(bug_reports)
            fixes_this_run      = len(files_fixed)
            total_failures      = max(total_failures, failures_this_run)
            total_fixes_applied += fixes_this_run

            timeline.append({
                "status":          "PASSED" if tests_passed else "FAILED",
                "timestamp":       attempt_ts,
                "message": (
                    "All tests passing — pipeline green"
                    if tests_passed
                    else f"{failures_this_run} failure(s) detected, {fixes_this_run} fix(es) applied"
                ),
                "failures_in_run": failures_this_run,
                "fixes_in_run":    fixes_this_run,
            })

            # Collect structured fixes (deduplicated across retries)
            for br in bug_reports:
                parsed = _parse_bug_report(br)
                if parsed and br not in seen_bug_lines:
                    seen_bug_lines.add(br)
                    all_fixes.append({
                        "file":           parsed["file"],
                        "bug_type":       parsed["bug_type"],
                        "line_number":    parsed["line_number"],
                        "commit_message": f"[AI-AGENT] Fix: {parsed['fix_description']}",
                        "status":         "fixed" if parsed["file"] in files_fixed else "failed",
                    })

            if tests_passed:
                final_status = "PASSED"
                logger.info("Tests passing after attempt %d — stopping retries.", attempt)
                break

            if not bug_reports:
                logger.info(
                    "No bugs reported after attempt %d — nothing left to fix.", attempt
                )
                break

        # -- Score calculation ------------------------------------------
        elapsed            = time.time() - start_time
        minutes, secs      = divmod(int(elapsed), 60)
        execution_time     = f"{minutes}m {secs}s"
        speed_bonus        = 10 if elapsed < 300 else 0
        efficiency_penalty = max(0, (commit_count - 20) * 2)
        final_score        = 100 + speed_bonus - efficiency_penalty

        response = {
            "repo_url":        repo_url,
            "team_name":       team_name,
            "leader_name":     leader_name,
            "branch_name":     formatted_branch,
            "total_failures":  total_failures,
            "total_fixes":     total_fixes_applied,
            "ci_status":       final_status,
            "execution_time":  execution_time,
            "iterations_used": len(timeline),
            "max_iterations":  MAX_RETRIES,
            "score_breakdown": {
                "base":               100,
                "speed_bonus":        speed_bonus,
                "efficiency_penalty": efficiency_penalty,
                "final_score":        final_score,
            },
            "fixes":    all_fixes,
            "timeline": timeline,
            "status":   "SUCCESS" if final_status == "PASSED" else "FAILED",
        }

        http_status = 200 if final_status == "PASSED" else 207
        return jsonify(response), http_status

    except Exception as exc:
        logger.exception("Unhandled error during healing pipeline.")
        return jsonify({"error": str(exc), "status": "FATAL_ERROR"}), 500

    finally:
        # Always delete the cloned repo — no leftover disk usage
        if tmp_dir and os.path.exists(tmp_dir):
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
                logger.info("Cleaned up temp directory: %s", tmp_dir)
            except Exception as cleanup_err:
                logger.warning("Temp dir cleanup failed: %s", cleanup_err)


# ---------------------------------------------------------------------------
# Dev server entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"

    logger.info("Starting Velo on port %d  (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
