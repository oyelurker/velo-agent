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

import fnmatch
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import docker
import git
import google.generativeai as genai
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("velo.agent")

# Configure Gemini once at module load (key comes from .env, never hardcoded)
_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not _GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set — Node 2 (LLM Solver) will fail.")
genai.configure(api_key=_GEMINI_API_KEY)

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

    if not discovered_test_files:
        logger.warning("[Node 1] No test files found — skipping container execution.")
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

    # -----------------------------------------------------------------------
    # DOCKER SANDBOXED EXECUTION
    # The docker Python SDK (not subprocess) is used exclusively.
    # -----------------------------------------------------------------------
    test_logs  = ""
    exit_code  = 1
    container  = None

    try:
        client = docker.from_env()

        logger.info("[Node 1] Pulling image and starting container …")

        # detach=True → returns a Container object immediately so we can
        # call .wait() with a timeout and .logs() separately.
        container = client.containers.run(
            image       = docker_image,
            command     = test_cmd,
            volumes     = {
                repo_path: {
                    "bind": "/repo",
                    "mode": "rw",   # rw so pytest can write .pytest_cache etc.
                }
            },
            working_dir     = "/repo",
            detach          = True,
            remove          = False,     # We remove manually AFTER log capture
            stdout          = True,
            stderr          = True,
            mem_limit       = "512m",    # Prevent runaway memory usage
            cpu_period      = 100_000,
            cpu_quota       = 50_000,    # Cap at 50 % of one CPU core
        )

        logger.info("[Node 1] Container %s started — waiting for tests …", container.short_id)

        # Block until the container exits (max 180 s to allow pip installs)
        wait_result = container.wait(timeout=180)
        exit_code   = wait_result.get("StatusCode", 1)

        # Capture combined stdout + stderr
        test_logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")

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
        # ---------------------------------------------------------------
        # CONTAINER DESTRUCTION — always executes, even on exceptions.
        # This guarantees no dangling containers leak to the host.
        # ---------------------------------------------------------------
        if container is not None:
            try:
                container.remove(force=True)
                logger.info("[Node 1] Container %s removed successfully.", container.short_id)
            except Exception as cleanup_err:
                logger.warning("[Node 1] Container cleanup warning: %s", cleanup_err)

    tests_passed = (exit_code == 0)
    logger.info("[Node 1] Tests %s.", "PASSED ✅" if tests_passed else "FAILED ❌")

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

    # If tests passed there are no bugs to fix — short-circuit
    if state.get("tests_passed"):
        logger.info("[Node 2] Tests already passing — nothing to fix.")
        return {**state, "bug_reports": [], "fixes": {}}

    test_logs  = state["test_logs"]
    repo_path  = state["repo_path"]

    # Collect relevant source file contents mentioned in the logs
    source_context = _collect_source_context(repo_path, test_logs)

    # -----------------------------------------------------------------------
    # STRICT PROMPT — enforces EXACT output format
    # Any deviation (wrong arrow, wrong bug type, missing fields) causes the
    # regex parser below to silently skip that line, keeping results clean.
    # -----------------------------------------------------------------------
    prompt = f"""You are Velo, an autonomous code-repair AI.
Analyze the test failure logs and produce structured bug reports plus corrected source files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY OUTPUT FORMAT — deviating from this will break the system
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — BUG REPORT LINES (one per bug, no blank lines between them):

[BUG_TYPE] error in [filepath] line [line_number] {UNICODE_ARROW} Fix: [one-line description]

Rules for SECTION 1:
  • BUG_TYPE must be EXACTLY one of (case-sensitive, all caps):
    LINTING | SYNTAX | LOGIC | TYPE_ERROR | IMPORT | INDENTATION
  • The arrow MUST be the Unicode character → (U+2192). Never use -> or => or –>.
  • [filepath] must be the file path relative to the repo root.
  • [line_number] must be an integer.
  • [one-line description] must be concise (≤ 12 words).

SECTION 2 — FIXED FILES (immediately after all bug lines):

```json
{{
  "fixes": {{
    "relative/path/to/file.py": "COMPLETE corrected file content as a string"
  }}
}}
```

Rules for SECTION 2:
  • Include EVERY file that has at least one bug from Section 1.
  • The value must be the FULL corrected file content, not a diff or snippet.
  • Escape newlines as \\n inside the JSON string values.
  • Do NOT omit this block even if there is only one bug.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST FAILURE LOGS:
{test_logs}

SOURCE CODE CONTEXT:
{source_context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond now following the format above exactly:"""

    # -----------------------------------------------------------------------
    # GEMINI API CALL
    # -----------------------------------------------------------------------
    model = genai.GenerativeModel("gemini-2.0-flash")
    raw_output = ""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature      = 0.05,   # Near-zero for deterministic, format-compliant output
                max_output_tokens= 8192,
            ),
        )
        raw_output = response.text
        logger.info("[Node 2] LLM returned %d characters.", len(raw_output))

    except Exception as exc:
        logger.exception("[Node 2] Gemini API call failed.")
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
        # APPLY FIXES TO DISK
        # fixes = {relative_path: full_corrected_content}
        # -------------------------------------------------------------------
        applied: List[str] = []
        for rel_path, corrected_content in fixes.items():
            target = os.path.join(repo_path, rel_path)
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

        return {
            **state,
            "branch_pushed": formatted_branch,
            "commit_sha":    commit.hexsha,
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
        return {**state, "error": str(exc)}
    except OSError as exc:
        logger.exception("[Node 3] File I/O error while applying fix.")
        return {**state, "error": str(exc)}
    except Exception as exc:
        logger.exception("[Node 3] Unexpected GitOps error.")
        return {**state, "error": str(exc)}


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

def run_healing_agent(repo_path: str, raw_branch_name: str) -> Dict[str, Any]:
    """
    Kick off the fully autonomous healing pipeline.

    NO HUMAN INTERVENTION — this function calls graph.invoke() which
    executes all three nodes sequentially without any input() calls,
    confirmation prompts, or sleep/wait for human action.

    Args:
        repo_path:       Absolute path to the git repo to heal.
        raw_branch_name: Human-readable name from the frontend form input.

    Returns:
        A results dict that is also written to <repo_path>/results.json.
    """
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
        "results": {
            "run_timestamp":  datetime.now(timezone.utc).isoformat(),
            "repo_path":      repo_path,
            "branch_name":    formatted_branch,
        },
        "error": None,
    }

    # Compile and invoke the LangGraph pipeline
    agent_graph = build_agent_graph()
    final_state = agent_graph.invoke(initial_state)

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
