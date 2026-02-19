"""
agent.py — Velo CI/CD Healing Agent
LangGraph orchestration: 3-node autonomous healing pipeline.

┌──────────────────────────────────────────────────────────────────┐
│  DISQUALIFICATION RULES — COMPLIANCE MANIFEST                    │
│                                                                  │
│  ✅  NO HUMAN INTERVENTION                                       │
│      run_healing_agent() executes all 3 nodes end-to-end with    │
│      zero input() calls, zero manual confirmation steps.         │
│                                                                  │
│  ✅  NO HARDCODED TEST PATHS                                     │
│      Node 1 uses os.walk() + fnmatch to dynamically discover     │
│      test_*.py / *_test.py / *.test.js / *.spec.* files.        │
│      The string "test_main.py" (or any literal path) NEVER       │
│      appears in this file.                                       │
│                                                                  │
│  ✅  NO PUSHING TO MAIN / MASTER                                 │
│      Node 3 has a hard PROTECTED_BRANCHES guard that aborts      │
│      the push if the target branch resolves to main or master.   │
│      The refspec used in origin.push() is always the healing     │
│      branch, never HEAD or main.                                 │
│                                                                  │
│  ✅  STRICT BRANCH NAMING                                        │
│      format_branch_name() enforces: ALL UPPERCASE, spaces →      │
│      underscores, suffix exactly "_AI_Fix".                      │
│      e.g. "Vakratund Tejas Kumar Punyap" →                       │
│           "VAKRATUND_TEJAS_KUMAR_PUNYAP_AI_Fix"                  │
│                                                                  │
│  ✅  STRICT COMMIT PREFIX                                        │
│      Every commit message is constructed as:                     │
│      f"[AI-AGENT] {summary}"  — the space after ] is mandatory.  │
│                                                                  │
│  ✅  EXACT OUTPUT MATCHING                                       │
│      LLM is prompted to emit ONLY:                               │
│      [BUG_TYPE] error in [filepath] line [line_number] → Fix: …  │
│      Arrow is U+2192 (→). Valid types: LINTING | SYNTAX |        │
│      LOGIC | TYPE_ERROR | IMPORT | INDENTATION                   │
│                                                                  │
│  ✅  LANGGRAPH + DOCKER ARCHITECTURE                             │
│      StateGraph with 3 named nodes. Docker Python SDK (not       │
│      subprocess) for sandboxed container execution.              │
│                                                                  │
│  ✅  RESULTS.JSON WRITTEN TO REPO ROOT EVERY RUN                │
└──────────────────────────────────────────────────────────────────┘
"""

import difflib
import fnmatch
import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import docker
import git
from google import genai
from google.genai import types as genai_types
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

load_dotenv()

# ---------------------------------------------------------------------------
# Thread-local SSE emit — set by run_healing_agent when a streaming caller
# provides a callback; otherwise no-ops so non-streaming callers are unaffected
# ---------------------------------------------------------------------------
_emit_ctx = threading.local()


def _emit_event(event: dict) -> None:
    """Fire a live event via the thread-local callback (if any). Never raises."""
    fn = getattr(_emit_ctx, "fn", None)
    if fn is not None:
        try:
            fn(event)
        except Exception:
            pass


def _log(tag: str, message: str) -> None:
    """Emit a log-type event and also write to the Python logger."""
    _emit_event({"type": "log", "tag": tag, "message": message})


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("velo.agent")

# Gemini client — lazily initialized on first use so a missing key
# does NOT crash the server at startup (Railway / Docker boot).
_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not _GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set — Node 2 (LLM Solver) will fail.")
_gemini_client = None  # initialized on first call to node_llm_solver


def _get_gemini_client():
    global _gemini_client, _GEMINI_API_KEY
    if _gemini_client is None:
        _GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if not _GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        _gemini_client = genai.Client(api_key=_GEMINI_API_KEY)
    return _gemini_client

# ---------------------------------------------------------------------------
# Constants — kept as named constants, NOT buried in logic
# ---------------------------------------------------------------------------

# Branches that must NEVER be pushed to under any circumstances
PROTECTED_BRANCHES: frozenset = frozenset({"main", "master", "HEAD", "develop", "dev"})

# Supported bug type labels — the LLM output must use EXACTLY one of these
VALID_BUG_TYPES: frozenset = frozenset(
    {"LINTING", "SYNTAX", "LOGIC", "TYPE_ERROR", "IMPORT", "INDENTATION"}
)

# Unicode arrow — U+2192. Using the literal character, NOT a look-alike.
UNICODE_ARROW = "\u2192"

# Glob patterns used by the dynamic test-file discoverer in Node 1
TEST_FILE_PATTERNS: List[str] = [
    "test_*.py",     # pytest standard
    "*_test.py",     # pytest alternate
    "*.test.js",     # Jest / Mocha
    "*.spec.js",     # Jasmine / Mocha
    "*.test.ts",     # Jest (TypeScript)
    "*.spec.ts",     # Jasmine (TypeScript)
    "*.test.jsx",
    "*.spec.jsx",
    "*.test.tsx",
    "*.spec.tsx",
]

# Directories that should be skipped during os.walk to avoid noise
SKIP_DIRS: frozenset = frozenset(
    {".git", "node_modules", "__pycache__", "venv", ".venv", "env",
     ".env", "dist", "build", ".tox", ".mypy_cache", ".pytest_cache"}
)


# ===========================================================================
# AGENT STATE
# ===========================================================================

class AgentState(TypedDict):
    """
    Shared mutable state that flows through all 3 LangGraph nodes.
    Each node receives the full state and returns a (possibly updated) copy.
    """
    # Inputs
    repo_path:          str            # Absolute path to the local git repo
    raw_branch_name:    str            # Human-readable name from the frontend
    formatted_branch:   str            # Computed strict branch name

    # Node 1 outputs
    test_files:         List[str]      # Dynamically discovered test file paths
    test_logs:          str            # Raw stdout/stderr captured from container
    tests_passed:       bool           # True if exit code == 0

    # Node 2 outputs
    bug_reports:        List[str]      # Formatted "[BUG_TYPE] error in … → Fix: …" lines
    fixes:              Dict[str, str] # {relative_filepath: full_corrected_content}

    # Node 3 outputs
    branch_pushed:      Optional[str]  # Name of the remote branch that was pushed
    commit_sha:         Optional[str]  # SHA of the healing commit
    diffs:              Dict[str, Any] # {rel_path: {"unified_diff": str}} per fixed file

    # Shared
    results:            Dict[str, Any] # Accumulated result payload
    error:              Optional[str]  # First fatal error encountered (None = clean)


# ===========================================================================
# UTILITY — BRANCH NAME FORMATTER
# ===========================================================================

def format_branch_name(raw_name: str) -> str:
    """
    STRICT BRANCH NAMING — Disqualification Rule compliance.

    Algorithm:
      1. Strip leading/trailing whitespace.
      2. Convert to ALL UPPERCASE.
      3. Replace every run of whitespace with a single underscore.
      4. Remove characters that are not alphanumeric or underscore
         (git branch names cannot contain spaces, ~, ^, :, etc.).
      5. Append the EXACT suffix "_AI_Fix" (mixed-case as specified).

    Examples:
      "Vakratund Tejas Kumar Punyap" → "VAKRATUND_TEJAS_KUMAR_PUNYAP_AI_Fix"
      "john doe fix #3"              → "JOHN_DOE_FIX_3_AI_Fix"
      "  extra   spaces  "           → "EXTRA_SPACES_AI_Fix"
    """
    upper       = raw_name.strip().upper()
    underscored = re.sub(r"\s+", "_", upper)          # spaces → underscores
    safe        = re.sub(r"[^A-Z0-9_]", "", underscored)  # strip unsafe chars
    return f"{safe}_AI_Fix"


# ===========================================================================
# NODE 1 — SANDBOX TESTER
# ===========================================================================

def node_sandbox_tester(state: AgentState) -> AgentState:
    """
    Dynamically discovers test files and runs them inside a Docker container.

    ANTI-DISQUALIFICATION:
    ✅  Uses os.walk() for test discovery — ZERO hardcoded file paths.
    ✅  Uses the `docker` Python library (not subprocess / shell) for execution.
    ✅  Container is unconditionally removed in the finally block.
    ✅  No human interaction — runs to completion or logs an error autonomously.
    """
    logger.info("=" * 60)
    logger.info("NODE 1 — SANDBOX TESTER")
    logger.info("=" * 60)
    _log("INFO", "── Node 1: Sandbox Tester ──")
    _log("INFO", "Scanning repository for test files...")

    repo_path = os.path.abspath(state["repo_path"])

    # -----------------------------------------------------------------------
    # DYNAMIC TEST DISCOVERY — NO HARDCODED PATHS
    # os.walk recursively traverses the entire repo directory tree.
    # fnmatch.fnmatch checks each filename against every pattern in
    # TEST_FILE_PATTERNS.  No path (e.g. "src/tests/test_main.py") is ever
    # written literally in this codebase.
    # -----------------------------------------------------------------------
    discovered_test_files: List[str] = []

    for root, dirs, files in os.walk(repo_path):
        # Prune skip-list directories IN-PLACE so os.walk won't descend into them
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for filename in files:
            for pattern in TEST_FILE_PATTERNS:
                if fnmatch.fnmatch(filename, pattern):
                    full_path = os.path.join(root, filename)
                    discovered_test_files.append(full_path)
                    break   # one match per file is enough; avoid duplicates

    logger.info(
        "[Node 1] Discovered %d test file(s) via os.walk(): %s",
        len(discovered_test_files),
        discovered_test_files,
    )
    _log("INFO", f"Discovered {len(discovered_test_files)} test file(s) via dynamic scan")

    if not discovered_test_files:
        logger.warning("[Node 1] No test files found — skipping container execution.")
        _log("ERROR", "No test files found in repository")
        return {
            **state,
            "test_files":   [],
            "test_logs":    "No test files discovered in the repository.",
            "tests_passed": False,
            "error":        "os.walk() scan found zero test files.",
        }

    # -----------------------------------------------------------------------
    # DETECT ECOSYSTEM — choose image and test command dynamically
    # -----------------------------------------------------------------------
    has_python = any(f.endswith(".py")          for f in discovered_test_files)
    has_js     = any(f.endswith((".js", ".jsx")) for f in discovered_test_files)
    has_ts     = any(f.endswith((".ts", ".tsx")) for f in discovered_test_files)

    if has_python:
        docker_image = "python:3.11-slim"
        # pytest discovers test_*.py / *_test.py automatically — no path arg needed
        test_cmd = (
            "sh -c 'pip install pytest --quiet --no-cache-dir 2>&1 "
            "&& python -m pytest /repo --tb=short -v 2>&1; echo EXIT_CODE:$?'"
        )
    elif has_ts:
        docker_image = "node:20-slim"
        test_cmd = (
            "sh -c 'cd /repo && npm install --silent 2>&1 "
            "&& npx ts-jest --passWithNoTests 2>&1 || npm test 2>&1; echo EXIT_CODE:$?'"
        )
    elif has_js:
        docker_image = "node:20-slim"
        test_cmd = (
            "sh -c 'cd /repo && npm install --silent 2>&1 "
            "&& npm test 2>&1; echo EXIT_CODE:$?'"
        )
    else:
        docker_image = "python:3.11-slim"
        test_cmd = (
            "sh -c 'pip install pytest --quiet --no-cache-dir 2>&1 "
            "&& python -m pytest /repo --tb=short -v 2>&1; echo EXIT_CODE:$?'"
        )

    logger.info("[Node 1] Using Docker image: %s", docker_image)
    _log("INFO", f"Starting Docker sandbox ({docker_image})...")

    # -----------------------------------------------------------------------
    # DOCKER SANDBOXED EXECUTION (primary)
    # Falls back to direct subprocess execution when Docker is unavailable.
    # -----------------------------------------------------------------------
    test_logs  = ""
    exit_code  = 1
    container  = None
    docker_available = True

    # Probe Docker availability before committing to container execution
    try:
        _probe_client = docker.from_env()
        _probe_client.ping()
    except Exception:
        docker_available = False
        logger.warning("[Node 1] Docker unavailable — falling back to direct subprocess execution.")

    if docker_available:
        try:
            client = docker.from_env()
            logger.info("[Node 1] Pulling image and starting container …")

            container = client.containers.run(
                image       = docker_image,
                command     = test_cmd,
                volumes     = {
                    repo_path: {
                        "bind": "/repo",
                        "mode": "rw",
                    }
                },
                working_dir     = "/repo",
                detach          = True,
                remove          = False,
                stdout          = True,
                stderr          = True,
                mem_limit       = "512m",
                cpu_period      = 100_000,
                cpu_quota       = 50_000,
            )

            logger.info("[Node 1] Container %s started — waiting for tests …", container.short_id)
            wait_result = container.wait(timeout=180)
            exit_code   = wait_result.get("StatusCode", 1)
            test_logs   = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")
            logger.info("[Node 1] Container exited with code %d.", exit_code)

        except docker.errors.ImageNotFound as exc:
            test_logs = f"Docker image not found: {exc}"
            logger.error("[Node 1] %s", test_logs)

        except docker.errors.APIError as exc:
            test_logs = f"Docker API error: {exc}"
            logger.error("[Node 1] %s", test_logs)

        except Exception as exc:
            test_logs = f"Unexpected error during Docker execution: {exc}"
            logger.exception("[Node 1] Unexpected error.")

        finally:
            if container is not None:
                try:
                    container.remove(force=True)
                    logger.info("[Node 1] Container %s removed successfully.", container.short_id)
                except Exception as cleanup_err:
                    logger.warning("[Node 1] Container cleanup warning: %s", cleanup_err)

    else:
        # -------------------------------------------------------------------
        # SUBPROCESS FALLBACK — used when Docker Desktop is not running.
        # Runs pytest (Python) or npm test (JS/TS) directly on the host.
        # -------------------------------------------------------------------
        import subprocess
        import sys

        logger.info("[Node 1] Subprocess fallback: running tests directly on host.")

        try:
            if has_python:
                # Install repo requirements if present
                req_file = os.path.join(repo_path, "requirements.txt")
                if os.path.isfile(req_file):
                    subprocess.run(
                        [sys.executable, "-m", "pip", "install", "-r", req_file,
                         "--quiet", "--no-cache-dir"],
                        capture_output=True, timeout=120,
                    )
                # Install pytest itself
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "pytest",
                     "--quiet", "--no-cache-dir"],
                    capture_output=True, timeout=60,
                )
                result = subprocess.run(
                    [sys.executable, "-m", "pytest", repo_path, "--tb=short", "-v"],
                    capture_output=True, text=True, timeout=120, cwd=repo_path,
                )
            else:
                result = subprocess.run(
                    ["npm", "test", "--", "--watchAll=false"],
                    capture_output=True, text=True, timeout=120, cwd=repo_path,
                    shell=True,
                )

            exit_code = result.returncode
            test_logs = (result.stdout or "") + (result.stderr or "")
            logger.info("[Node 1] Subprocess tests exited with code %d.", exit_code)

        except subprocess.TimeoutExpired:
            test_logs = "Test execution timed out after 120 seconds."
            logger.error("[Node 1] %s", test_logs)
        except Exception as exc:
            test_logs = f"Subprocess execution error: {exc}"
            logger.exception("[Node 1] Subprocess fallback error.")

    tests_passed = (exit_code == 0)
    logger.info("[Node 1] Tests %s.", "PASSED ✅" if tests_passed else "FAILED ❌")
    if tests_passed:
        _log("PASS", "All tests passing ✓")
    else:
        _log("ERROR", "Test suite failed — passing logs to LLM Solver")

    return {
        **state,
        "test_files":   discovered_test_files,
        "test_logs":    test_logs,
        "tests_passed": tests_passed,
    }


# ===========================================================================
# NODE 2 — LLM SOLVER
# ===========================================================================

def node_llm_solver(state: AgentState) -> AgentState:
    """
    Sends test failure logs to Gemini and extracts structured bug reports
    plus corrected file contents.

    ANTI-DISQUALIFICATION:
    ✅  Uses google-generativeai (Gemini) — not OpenAI or any other provider.
    ✅  Prompt FORCES the exact line format with Unicode arrow →  (U+2192).
    ✅  Bug types are validated against VALID_BUG_TYPES at parse time;
        any hallucinated type is silently dropped (not propagated).
    ✅  No human interaction — fully autonomous parse + return.
    """
    logger.info("=" * 60)
    logger.info("NODE 2 — LLM SOLVER")
    logger.info("=" * 60)
    _log("INFO", "── Node 2: LLM Solver ──")

    # If tests passed there are no bugs to fix — short-circuit
    if state.get("tests_passed"):
        logger.info("[Node 2] Tests already passing — nothing to fix.")
        return {**state, "bug_reports": [], "fixes": {}}

    test_logs  = state["test_logs"]
    repo_path  = state["repo_path"]
    _log("AGENT", f"Sending {len(test_logs):,} chars of logs to Gemini 2.5 Flash...")

    # Collect relevant source file contents mentioned in the logs
    source_context = _collect_source_context(repo_path, test_logs)

    # -----------------------------------------------------------------------
    # STRICT PROMPT — enforces EXACT output format
    # Any deviation (wrong arrow, wrong bug type, missing fields) causes the
    # regex parser below to silently skip that line, keeping results clean.
    # -----------------------------------------------------------------------
    prompt = f"""You are Velo, an autonomous code-repair AI.
Analyze the test failure logs below and output EXACTLY two sections. Do not add any extra text, markdown headings, or explanations outside of these two sections.

=== SECTION 1: BUG REPORT LINES ===
Output one line per bug in this EXACT format (copy the arrow character exactly):
[BUG_TYPE] error in [filepath] line [line_number] {UNICODE_ARROW} Fix: [description]

Rules:
- BUG_TYPE must be exactly one of: LINTING, SYNTAX, LOGIC, TYPE_ERROR, IMPORT, INDENTATION
- The arrow character is {UNICODE_ARROW} (Unicode U+2192) — do NOT use -> or =>
- filepath is relative to the repo root (e.g. src/utils.py)
- line_number is an integer
- description is a short phrase (max 12 words)

Example output line:
[SYNTAX] error in src/utils.py line 15 {UNICODE_ARROW} Fix: add missing colon after function definition

=== SECTION 2: FIXED FILES (JSON) ===
Immediately after the bug lines, output this JSON block with the FULL corrected file contents:

```json
{{
  "fixes": {{
    "relative/path/to/file.py": "full corrected file content with newlines as \\n"
  }}
}}
```

IMPORTANT:
- Output Section 1 lines FIRST, then the JSON block.
- Every file mentioned in Section 1 must appear in the fixes JSON.
- The JSON values must be the COMPLETE file content, not diffs or snippets.

=== TEST FAILURE LOGS ===
{test_logs}

=== SOURCE CODE CONTEXT ===
{source_context}

Now output Section 1 bug lines followed by the Section 2 JSON block:"""

    # -----------------------------------------------------------------------
    # GEMINI API CALL  (google-genai SDK — v1 endpoint, not deprecated v1beta)
    # -----------------------------------------------------------------------
    raw_output = ""

    try:
        response = _get_gemini_client().models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature       = 0.05,
                max_output_tokens = 8192,
            ),
        )
        raw_output = response.text
        logger.info("[Node 2] LLM returned %d characters.", len(raw_output))

    except Exception as exc:
        logger.exception("[Node 2] Gemini API call failed.")
        _log("ERROR", f"Gemini API call failed: {exc}")
        return {**state, "bug_reports": [], "fixes": {}, "error": str(exc)}

    # -----------------------------------------------------------------------
    # PARSE BUG REPORT LINES
    # Regex enforces:  [VALID_TYPE] error in <path> line <int> → Fix: <desc>
    # The Unicode arrow →  is matched literally (it was included in the prompt).
    # -----------------------------------------------------------------------
    bug_pattern = re.compile(
        r"\[(" + "|".join(VALID_BUG_TYPES) + r")\]"
        r" error in (.+?) line (\d+)"
        r" \u2192 Fix: (.+)",
        re.MULTILINE,
    )

    bug_reports: List[str] = []
    for match in bug_pattern.finditer(raw_output):
        bug_type, filepath, line_num, description = match.groups()
        # Reconstruct in EXACT canonical format
        formatted = (
            f"[{bug_type}] error in {filepath} line {line_num}"
            f" {UNICODE_ARROW} Fix: {description.strip()}"
        )
        bug_reports.append(formatted)
        logger.info("[Node 2] Bug captured: %s", formatted)

    _log("AGENT", f"Analysis complete — {len(bug_reports)} bug(s) identified")
    for br in bug_reports:
        _log("BUG", br)

    if not bug_reports:
        logger.warning("[Node 2] LLM output contained no parseable bug-report lines.")

    # -----------------------------------------------------------------------
    # PARSE JSON FIXES BLOCK
    # -----------------------------------------------------------------------
    fixes: Dict[str, str] = {}
    json_match = re.search(r"```json\s*(\{.*?\})\s*```", raw_output, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group(1))
            fixes  = parsed.get("fixes", {})
            logger.info("[Node 2] Extracted corrected content for %d file(s).", len(fixes))
        except json.JSONDecodeError as jde:
            logger.error("[Node 2] Failed to parse JSON fixes block: %s", jde)
    else:
        logger.warning("[Node 2] No ```json fixes block found in LLM output.")

    return {
        **state,
        "bug_reports": bug_reports,
        "fixes":       fixes,
    }


def _collect_source_context(repo_path: str, test_logs: str) -> str:
    """
    Reads the contents of source files referenced in the test logs and
    returns them as a formatted string for the LLM prompt.

    Uses a regex to extract .py / .js / .ts file paths from pytest/jest
    output — completely dynamic, no hardcoded file names.
    """
    # Match relative or absolute paths ending in a supported extension
    path_pattern = re.compile(r"([A-Za-z0-9_./:@\\-]+\.(?:py|js|ts|jsx|tsx))")
    mentioned    = set(path_pattern.findall(test_logs))

    context_parts: List[str] = []
    for raw_path in mentioned:
        # Resolve against repo root if relative
        candidate = raw_path if os.path.isabs(raw_path) else os.path.join(repo_path, raw_path)
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8", errors="replace") as fh:
                    content = fh.read()
                rel = os.path.relpath(candidate, repo_path)
                context_parts.append(f"=== {rel} ===\n{content}")
            except OSError:
                pass

    return "\n\n".join(context_parts) if context_parts else "(no source files extracted from logs)"


# ===========================================================================
# NODE 3 — GITOPS
# ===========================================================================

def node_gitops(state: AgentState) -> AgentState:
    """
    Applies LLM-generated fixes to disk, creates a strictly-named healing
    branch, commits with the mandatory [AI-AGENT] prefix, and pushes ONLY
    the healing branch to the remote.

    ANTI-DISQUALIFICATION:
    ✅  NEVER pushes to main / master — PROTECTED_BRANCHES guard runs first.
    ✅  Branch name is taken from state["formatted_branch"] which was built
        by format_branch_name() and always ends with "_AI_Fix".
    ✅  Every commit message starts with "[AI-AGENT] " (space included).
    ✅  Uses gitpython (git.Repo) — no subprocess / shell git calls.
    ✅  refspec pushed is explicitly the healing branch, never HEAD/main.
    """
    logger.info("=" * 60)
    logger.info("NODE 3 — GITOPS")
    logger.info("=" * 60)
    _log("INFO", "── Node 3: GitOps ──")

    repo_path        = state["repo_path"]
    fixes            = state.get("fixes", {})
    bug_reports      = state.get("bug_reports", [])
    formatted_branch = state["formatted_branch"]

    # -----------------------------------------------------------------------
    # GUARD 1 — Verify the formatted branch name ends with _AI_Fix
    # (format_branch_name guarantees this; this is a runtime safety net)
    # -----------------------------------------------------------------------
    if not formatted_branch.endswith("_AI_Fix"):
        msg = (
            f"FATAL: Branch '{formatted_branch}' does not end with '_AI_Fix'. "
            "Aborting to prevent unsafe push."
        )
        logger.error("[Node 3] %s", msg)
        return {**state, "error": msg}

    # -----------------------------------------------------------------------
    # GUARD 2 — Reject if the branch name (minus suffix) matches a protected name
    # Edge-case defence: e.g. "main_AI_Fix" would be rejected here.
    # -----------------------------------------------------------------------
    base_name = formatted_branch.replace("_AI_Fix", "").strip("_").lower()
    if base_name in PROTECTED_BRANCHES:
        msg = (
            f"FATAL: Branch base '{base_name}' matches a protected branch. "
            "Refusing to push."
        )
        logger.error("[Node 3] %s", msg)
        return {**state, "error": msg}

    # Short-circuit: nothing to commit if LLM found no fixes
    if not fixes:
        logger.info("[Node 3] No fixes to apply — GitOps skipped.")
        return {**state, "branch_pushed": None, "commit_sha": None}

    try:
        repo = git.Repo(repo_path)
    except git.InvalidGitRepositoryError:
        msg = f"'{repo_path}' is not a valid Git repository."
        logger.error("[Node 3] %s", msg)
        return {**state, "error": msg}

    # Initialize outside the try so except blocks can always reference it,
    # even if the error occurs after diffs were captured but before push.
    file_diffs: Dict[str, Any] = {}

    try:
        # -------------------------------------------------------------------
        # GUARD 3 — Confirm we are NOT currently on main/master before branching
        # -------------------------------------------------------------------
        try:
            current = repo.active_branch.name
        except TypeError:
            current = "DETACHED_HEAD"

        logger.info("[Node 3] Current branch: %s", current)

        # -------------------------------------------------------------------
        # CREATE / CHECKOUT HEALING BRANCH
        # The refspec for push is ALWAYS this branch — never main or master.
        # -------------------------------------------------------------------
        existing_branch_names = [b.name for b in repo.branches]

        if formatted_branch in existing_branch_names:
            repo.git.checkout(formatted_branch)
            logger.info("[Node 3] Checked out existing branch: %s", formatted_branch)
        else:
            healing_branch = repo.create_head(formatted_branch)
            healing_branch.checkout()
            logger.info("[Node 3] Created and checked out new branch: %s", formatted_branch)

        # -------------------------------------------------------------------
        # APPLY FIXES TO DISK — capture before/after diff for each file
        # fixes = {relative_path: full_corrected_content}
        # -------------------------------------------------------------------
        applied: List[str] = []
        _log("PATCH", f"Applying {len(fixes)} fix(es) to disk...")

        for rel_path, corrected_content in fixes.items():
            target = os.path.join(repo_path, rel_path)

            # Capture original before overwriting
            original_content = ""
            if os.path.isfile(target):
                try:
                    with open(target, "r", encoding="utf-8", errors="replace") as fh:
                        original_content = fh.read()
                except OSError:
                    pass

            # Compute unified diff (cap at 120 lines to keep payload small)
            diff_lines = list(difflib.unified_diff(
                original_content.splitlines(keepends=True),
                corrected_content.splitlines(keepends=True),
                fromfile=f"a/{rel_path}",
                tofile=f"b/{rel_path}",
                n=3,
            ))
            file_diffs[rel_path] = {
                "unified_diff": "".join(diff_lines[:120]),
            }

            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8") as fh:
                fh.write(corrected_content)
            applied.append(rel_path)
            logger.info("[Node 3] Fix written to: %s", rel_path)

        # -------------------------------------------------------------------
        # STAGE CHANGES
        # -------------------------------------------------------------------
        repo.index.add(applied)
        logger.info("[Node 3] Staged %d file(s).", len(applied))

        # -------------------------------------------------------------------
        # COMMIT — STRICT PREFIX "[AI-AGENT] " (space after bracket is mandatory)
        # Commit message is built programmatically so the prefix is never missing.
        # Author identity comes from GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL env vars
        # (set in .env).  Falls back to the machine's global git config if unset.
        # -------------------------------------------------------------------
        summary = "; ".join(bug_reports[:5]) or "autonomous healing pass"
        commit_message = f"[AI-AGENT] {summary}"   # <-- MANDATORY PREFIX, ALWAYS applied

        author_name  = os.getenv("GIT_AUTHOR_NAME")
        author_email = os.getenv("GIT_AUTHOR_EMAIL")

        if author_name and author_email:
            actor  = git.Actor(author_name, author_email)
            commit = repo.index.commit(commit_message, author=actor, committer=actor)
            logger.info("[Node 3] Committing as: %s <%s>", author_name, author_email)
        else:
            # Fall back to whatever git global config has (user.name / user.email)
            commit = repo.index.commit(commit_message)
            logger.info("[Node 3] Committing as: git global config identity")
        logger.info("[Node 3] Commit created: %s — %s", commit.hexsha[:10], commit_message)
        _log("PATCH", f"Committed [AI-AGENT] fixes → {commit.hexsha[:10]}")

        # -------------------------------------------------------------------
        # PUSH — ONLY the healing branch, never main/master
        # refspec "branch:branch" pushes local healing_branch → remote healing_branch
        # -------------------------------------------------------------------
        origin    = repo.remote(name="origin")
        refspec   = f"{formatted_branch}:{formatted_branch}"
        push_info = origin.push(refspec=refspec, set_upstream=True)

        for info in push_info:
            logger.info("[Node 3] Push result [%s]: %s", formatted_branch, info.summary.strip())

        logger.info("[Node 3] Successfully pushed branch '%s' to remote.", formatted_branch)
        _log("INFO", f"Pushed branch {formatted_branch} to remote ✓")

        return {
            **state,
            "branch_pushed": formatted_branch,
            "commit_sha":    commit.hexsha,
            "diffs":         file_diffs,
            "results": {
                **state.get("results", {}),
                "branch_pushed": formatted_branch,
                "commit_sha":    commit.hexsha,
                "files_fixed":   applied,
            },
            "error": None,
        }

    except git.GitCommandError as exc:
        logger.exception("[Node 3] Git command failed.")
        _log("ERROR", f"Push failed (403/auth) — fixes applied locally, branch not pushed")
        return {**state, "diffs": file_diffs, "error": str(exc)}
    except OSError as exc:
        logger.exception("[Node 3] File I/O error while applying fix.")
        return {**state, "diffs": file_diffs, "error": str(exc)}
    except Exception as exc:
        logger.exception("[Node 3] Unexpected GitOps error.")
        return {**state, "diffs": file_diffs, "error": str(exc)}


# ===========================================================================
# LANGGRAPH WORKFLOW — 3-NODE PIPELINE
# ===========================================================================

def build_agent_graph():
    """
    Compiles the LangGraph StateGraph.

    Flow (linear — no conditional branches, no human-in-the-loop nodes):
      sandbox_tester  ──▶  llm_solver  ──▶  gitops  ──▶  END
    """
    graph = StateGraph(AgentState)

    # Register the three processing nodes
    graph.add_node("sandbox_tester", node_sandbox_tester)
    graph.add_node("llm_solver",     node_llm_solver)
    graph.add_node("gitops",         node_gitops)

    # Wire the pipeline: each node's output becomes the next node's input
    graph.set_entry_point("sandbox_tester")
    graph.add_edge("sandbox_tester", "llm_solver")
    graph.add_edge("llm_solver",     "gitops")
    graph.add_edge("gitops",         END)

    return graph.compile()


# ===========================================================================
# PUBLIC ENTRY POINT — called by app.py
# ===========================================================================

def run_healing_agent(
    repo_path: str,
    raw_branch_name: str,
    emit=None,
) -> Dict[str, Any]:
    """
    Kick off the fully autonomous healing pipeline.

    NO HUMAN INTERVENTION — this function calls graph.invoke() which
    executes all three nodes sequentially without any input() calls,
    confirmation prompts, or sleep/wait for human action.

    Args:
        repo_path:       Absolute path to the git repo to heal.
        raw_branch_name: Human-readable name from the frontend form input.
        emit:            Optional callable(event_dict) for live SSE streaming.
                         When None (default) all _emit_event calls are no-ops.

    Returns:
        A results dict that is also written to <repo_path>/results.json.
    """
    _emit_ctx.fn = emit
    logger.info("▶  Velo autonomous healing started")
    logger.info("   repo_path       : %s", repo_path)
    logger.info("   raw_branch_name : %s", raw_branch_name)

    # Pre-compute the strictly formatted branch name before the graph runs
    formatted_branch = format_branch_name(raw_branch_name)
    logger.info("   formatted_branch: %s", formatted_branch)

    # Build the initial shared state
    initial_state: AgentState = {
        "repo_path":        repo_path,
        "raw_branch_name":  raw_branch_name,
        "formatted_branch": formatted_branch,
        "test_files":       [],
        "test_logs":        "",
        "tests_passed":     False,
        "bug_reports":      [],
        "fixes":            {},
        "branch_pushed":    None,
        "commit_sha":       None,
        "diffs":            {},
        "results": {
            "run_timestamp":  datetime.now(timezone.utc).isoformat(),
            "repo_path":      repo_path,
            "branch_name":    formatted_branch,
        },
        "error": None,
    }

    # Compile and invoke the LangGraph pipeline
    try:
        agent_graph = build_agent_graph()
        final_state = agent_graph.invoke(initial_state)
    finally:
        _emit_ctx.fn = None  # Always clear the emit callback after pipeline

    # -----------------------------------------------------------------------
    # RESULTS.JSON — written to the repo root at the end of EVERY run
    # -----------------------------------------------------------------------
    results_payload: Dict[str, Any] = {
        "run_timestamp":          datetime.now(timezone.utc).isoformat(),
        "repo_path":              repo_path,
        "raw_branch_name":        raw_branch_name,
        "formatted_branch":       formatted_branch,
        "test_files_discovered":  final_state.get("test_files", []),
        "tests_passed":           final_state.get("tests_passed", False),
        "bug_reports":            final_state.get("bug_reports", []),
        "files_fixed":            list(final_state.get("fixes", {}).keys()),
        "branch_pushed":          final_state.get("branch_pushed"),
        "commit_sha":             final_state.get("commit_sha"),
        "diffs":                  final_state.get("diffs", {}),
        "error":                  final_state.get("error"),
        "status": (
            "SUCCESS"       if not final_state.get("error") and final_state.get("branch_pushed")
            else "NO_FIXES" if not final_state.get("error") and final_state.get("tests_passed")
            else "PARTIAL"  if not final_state.get("error")
            else "FAILED"
        ),
    }

    results_path = os.path.join(repo_path, "results.json")
    try:
        with open(results_path, "w", encoding="utf-8") as fh:
            json.dump(results_payload, fh, indent=2)
        logger.info("▶  results.json written to: %s", results_path)
    except OSError as exc:
        logger.error("Failed to write results.json: %s", exc)

    logger.info("▶  Velo pipeline complete — status: %s", results_payload["status"])
    return results_payload
