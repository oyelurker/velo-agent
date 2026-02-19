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

import json
import os
import logging
import queue
import re
import shutil
import tempfile
import threading
import time
import urllib.request as urlreq
from datetime import datetime, timezone

import git
from flask import Flask, request, jsonify, Response, stream_with_context
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
CORS(app, resources={r"/api/*": {"origins": os.getenv("ALLOWED_ORIGINS", "*")}})

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("velo.app")

MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", 5))

_BUG_PATTERN = re.compile(
    r"\[(\w+)\] error in (.+?) line (\d+) \u2192 Fix: (.+)"
)


def _parse_bug_report(line: str) -> dict | None:
    m = _BUG_PATTERN.match(line.strip())
    if m:
        return {
            "bug_type":        m.group(1),
            "file":            m.group(2).strip(),
            "line_number":     int(m.group(3)),
            "fix_description": m.group(4).strip(),
        }
    return None


def _clone_url_with_token(repo_url: str) -> str:
    """If GITHUB_TOKEN is set, return a clone URL with auth so Railway/server can clone without prompt."""
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token or "github.com" not in repo_url:
        return repo_url
    return repo_url.replace("https://", f"https://{token}@", 1)


# ---------------------------------------------------------------------------
# Commit results.json to the healing branch
# ---------------------------------------------------------------------------
def _commit_results_json(repo_path: str, formatted_branch: str, payload: dict) -> None:
    try:
        repo = git.Repo(repo_path)
        try:
            current = repo.active_branch.name
        except TypeError:
            current = "DETACHED_HEAD"

        if current != formatted_branch:
            try:
                repo.git.checkout(formatted_branch)
            except git.GitCommandError:
                logger.warning(
                    "results.json commit skipped: could not checkout '%s'", formatted_branch
                )
                return

        results_path = os.path.join(repo_path, "results.json")
        with open(results_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)

        repo.index.add(["results.json"])
        if repo.index.diff("HEAD"):
            author_name  = os.getenv("GIT_AUTHOR_NAME")
            author_email = os.getenv("GIT_AUTHOR_EMAIL")
            commit_msg   = "[AI-AGENT] Add results.json — final pipeline report"
            if author_name and author_email:
                actor = git.Actor(author_name, author_email)
                repo.index.commit(commit_msg, author=actor, committer=actor)
            else:
                repo.index.commit(commit_msg)

            origin  = repo.remote(name="origin")
            refspec = f"{formatted_branch}:{formatted_branch}"
            origin.push(refspec=refspec, set_upstream=True)
            logger.info("results.json committed and pushed to '%s'.", formatted_branch)
        else:
            logger.info("results.json unchanged — no commit needed.")

    except Exception as exc:
        logger.warning("Could not commit results.json: %s", exc)


# ---------------------------------------------------------------------------
# Auto GitHub PR creation (best-effort, requires GITHUB_TOKEN env var)
# ---------------------------------------------------------------------------
def _create_github_pr(repo_url: str, branch_name: str, all_fixes: list) -> str | None:
    """
    Create a GitHub PR from the healing branch → default branch.
    Returns the PR HTML URL, or None if creation fails / token not set.
    """
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if not token:
        return None

    m = re.match(r"https://github\.com/([^/]+)/([^/\s]+?)(?:\.git)?/?$", repo_url.strip())
    if not m:
        return None

    owner, repo = m.group(1), m.group(2)

    fix_lines = "\n".join(
        f"- `{f['file']}` line {f.get('line_number', '?')} — **{f['bug_type']}**"
        for f in all_fixes[:15]
    )

    pr_body = (
        "## 🤖 Auto-Generated by Velo CI/CD Healing Agent\n\n"
        f"This PR was automatically created after detecting and fixing "
        f"**{len(all_fixes)} issue(s)** in the CI/CD pipeline.\n\n"
        f"### Fixes Applied\n{fix_lines}\n\n"
        "---\n*Powered by Gemini 2.5 Flash · Velo Autonomous Agent · RIFT 2026*"
    )

    headers = {
        "Authorization": f"token {token}",
        "Accept":        "application/vnd.github.v3+json",
        "Content-Type":  "application/json",
        "User-Agent":    "Velo-Agent/1.0",
    }

    try:
        # Get default branch
        req = urlreq.Request(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
        )
        with urlreq.urlopen(req, timeout=10) as r:
            repo_info = json.loads(r.read().decode())
        base = repo_info.get("default_branch", "main")

        # Create PR
        pr_payload = json.dumps({
            "title": f"[AI-AGENT] Velo Auto-Fix: {len(all_fixes)} issue(s) resolved",
            "body":  pr_body,
            "head":  branch_name,
            "base":  base,
        }).encode()

        req = urlreq.Request(
            f"https://api.github.com/repos/{owner}/{repo}/pulls",
            data=pr_payload,
            headers=headers,
            method="POST",
        )
        with urlreq.urlopen(req, timeout=10) as r:
            pr_data = json.loads(r.read().decode())

        pr_url = pr_data.get("html_url")
        logger.info("GitHub PR created: %s", pr_url)
        return pr_url

    except Exception as exc:
        logger.warning("Could not create GitHub PR: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Shared healing loop — used by both endpoints
# ---------------------------------------------------------------------------
def _run_healing_loop(
    repo_url: str,
    team_name: str,
    leader_name: str,
    tmp_dir: str,
    emit=None,
) -> dict:
    """
    Runs the full retry healing loop and returns the shaped response dict.
    `emit` is an optional callable(event_dict) for SSE streaming.
    """
    raw_branch_name  = f"{team_name} {leader_name}"
    formatted_branch = format_branch_name(raw_branch_name)
    start_time       = time.time()

    def _e(tag: str, msg: str) -> None:
        if emit:
            emit({"type": "log", "tag": tag, "message": msg})

    timeline:            list = []
    all_fixes:           list = []
    all_diffs:           dict = {}
    total_failures:      int  = 0
    total_fixes_applied: int  = 0
    commit_count:        int  = 0
    final_status:        str  = "FAILED"
    seen_bug_lines:      set  = set()

    for attempt in range(1, MAX_RETRIES + 1):
        _e("INFO", f"── Iteration {attempt} / {MAX_RETRIES} ──")
        logger.info("Healing attempt %d / %d", attempt, MAX_RETRIES)

        results      = run_healing_agent(
            repo_path=tmp_dir,
            raw_branch_name=raw_branch_name,
            emit=emit,
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

        # Merge diffs from this iteration
        all_diffs.update(results.get("diffs", {}))

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
                    "fix_description": parsed["fix_description"],
                })

        if tests_passed:
            final_status = "PASSED"
            logger.info("Tests passing after attempt %d — stopping retries.", attempt)
            break

        if not bug_reports:
            logger.info("No bugs reported after attempt %d — nothing left to fix.", attempt)
            break

    # Commit results.json
    _commit_results_json(tmp_dir, formatted_branch, {
        "repo_url":        repo_url,
        "team_name":       team_name,
        "leader_name":     leader_name,
        "branch_name":     formatted_branch,
        "total_failures":  total_failures,
        "total_fixes":     total_fixes_applied,
        "ci_status":       final_status,
        "iterations_used": len(timeline),
        "max_iterations":  MAX_RETRIES,
        "timeline":        timeline,
        "fixes":           all_fixes,
    })

    # Auto-create GitHub PR
    pr_url = None
    if final_status == "PASSED" and all_fixes:
        _e("INFO", "Creating GitHub Pull Request...")
        pr_url = _create_github_pr(repo_url, formatted_branch, all_fixes)
        if pr_url:
            _e("INFO", f"PR created → {pr_url}")
        else:
            _e("INFO", "GITHUB_TOKEN not set — skipping PR creation")

    elapsed            = time.time() - start_time
    minutes, secs      = divmod(int(elapsed), 60)
    execution_time     = f"{minutes}m {secs}s"
    speed_bonus        = 10 if elapsed < 300 else 0
    efficiency_penalty = max(0, (commit_count - 20) * 2)
    final_score        = 100 + speed_bonus - efficiency_penalty

    return {
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
        "diffs":    all_diffs,
        "pr_url":   pr_url,
        "timeline": timeline,
        "status":   "SUCCESS" if final_status == "PASSED" else "FAILED",
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status":  "ok",
        "service": "Velo CI/CD Healing Agent",
        "version": "1.1.0",
    }), 200


# ---------------------------------------------------------------------------
# Primary trigger endpoint (batch — waits for full result)
# ---------------------------------------------------------------------------
@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    repo_url    = data.get("repo_url",    "").strip()
    team_name   = data.get("team_name",   "").strip()
    leader_name = data.get("leader_name", "").strip()

    if not repo_url:    return jsonify({"error": "Missing required field: repo_url"}),    400
    if not team_name:   return jsonify({"error": "Missing required field: team_name"}),   400
    if not leader_name: return jsonify({"error": "Missing required field: leader_name"}), 400

    formatted_branch = format_branch_name(f"{team_name} {leader_name}")
    logger.info("Batch analysis — repo=%s  branch=%s", repo_url, formatted_branch)

    tmp_dir = None
    try:
        tmp_dir = tempfile.mkdtemp(prefix="velo_")
        clone_url = _clone_url_with_token(repo_url)
        try:
            git.Repo.clone_from(clone_url, tmp_dir)
        except git.GitCommandError as exc:
            return jsonify({"error": f"Failed to clone repository: {exc}"}), 400

        response = _run_healing_loop(repo_url, team_name, leader_name, tmp_dir)
        http_status = 200 if response["ci_status"] == "PASSED" else 207
        return jsonify(response), http_status

    except Exception as exc:
        logger.exception("Unhandled error during healing pipeline.")
        return jsonify({"error": str(exc), "status": "FATAL_ERROR"}), 500

    finally:
        if tmp_dir and os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Streaming endpoint — emits SSE events as the pipeline runs
# ---------------------------------------------------------------------------
@app.route("/api/analyze/stream", methods=["POST"])
def analyze_stream():
    """
    Same healing pipeline as /api/analyze but streams live progress events
    via Server-Sent Events (text/event-stream) so the frontend can show
    a real-time terminal as the agent runs.

    Final event: {"type": "done", "data": <full response object>}
    Log events:  {"type": "log",  "tag": "INFO|ERROR|AGENT|PATCH|PASS|BUG",
                  "message": "..."}
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    repo_url    = data.get("repo_url",    "").strip()
    team_name   = data.get("team_name",   "").strip()
    leader_name = data.get("leader_name", "").strip()

    if not repo_url:    return jsonify({"error": "Missing required field: repo_url"}),    400
    if not team_name:   return jsonify({"error": "Missing required field: team_name"}),   400
    if not leader_name: return jsonify({"error": "Missing required field: leader_name"}), 400

    event_q: queue.Queue = queue.Queue()

    def emit(event: dict) -> None:
        event_q.put(event)

    def run_pipeline() -> None:
        tmp_dir = None
        try:
            emit({"type": "log", "tag": "INFO", "message": "Initializing Velo Autonomous Agent..."})
            emit({"type": "log", "tag": "INFO", "message": f"Target: {repo_url}"})

            tmp_dir = tempfile.mkdtemp(prefix="velo_stream_")
            emit({"type": "log", "tag": "INFO", "message": f"Cloning repository..."})

            clone_url = _clone_url_with_token(repo_url)
            try:
                git.Repo.clone_from(clone_url, tmp_dir)
                emit({"type": "log", "tag": "INFO", "message": "Repository cloned ✓"})
            except git.GitCommandError as exc:
                emit({"type": "error", "message": f"Failed to clone repository: {exc}"})
                return

            response = _run_healing_loop(repo_url, team_name, leader_name, tmp_dir, emit=emit)
            emit({"type": "done", "data": response})

        except Exception as exc:
            logger.exception("Unhandled error in streaming pipeline.")
            emit({"type": "error", "message": str(exc)})

        finally:
            if tmp_dir and os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)
            event_q.put(None)  # Sentinel — signals generator to close

    thread = threading.Thread(target=run_pipeline, daemon=True)
    thread.start()

    def generate():
        while True:
            try:
                event = event_q.get(timeout=360)  # 6-min hard timeout
                if event is None:
                    return
                yield f"data: {json.dumps(event)}\n\n"
            except queue.Empty:
                # Send keepalive so the browser doesn't close the connection
                yield "data: {\"type\":\"keepalive\"}\n\n"

    resp_headers = {
        "Cache-Control":       "no-cache",
        "X-Accel-Buffering":   "no",
        "Connection":          "keep-alive",
        "Access-Control-Allow-Origin": os.getenv("ALLOWED_ORIGINS", "*"),
    }
    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers=resp_headers,
    )


# ---------------------------------------------------------------------------
# Dev server entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"

    logger.info("Starting Velo on port %d  (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
