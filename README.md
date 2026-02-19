# Velo - Autonomous CI/CD Healing Agent

> **RIFT 2026 Hackathon Submission**
> Track: AI/ML - DevOps Automation - Agentic Systems
> Team: **Vakratund** | Leader: **Tejas Kumar Punyap**

---

## Live Deployment

| Surface | URL |
|---------|-----|
| React Dashboard | _Add your Vercel/Netlify URL here after deploying_ |
| Backend API | _Add your Railway/Render URL here after deploying_ |

## Demo Video

_Add your LinkedIn video URL here after recording_

---

## Architecture

```
React Dashboard (InputForm, RunSummaryCard, ScoreBreakdown, FixesTable, CICDTimeline)
        |
        | POST /api/analyze  { repo_url, team_name, leader_name }
        v
Flask API  (app.py)
  1. Clone GitHub repo into secure temp directory
  2. Retry loop up to MAX_RETRIES (default: 5) iterations
     LangGraph Pipeline (agent.py)
       Node 1: sandbox_tester
         - os.walk() dynamic test discovery (no hardcoded paths)
         - Docker SDK sandboxed execution (python:3.11-slim / node:20-slim)
       Node 2: llm_solver
         - Gemini 1.5 Flash log analysis
         - Structured bug-report extraction (LINTING/SYNTAX/LOGIC/TYPE_ERROR/IMPORT/INDENTATION)
       Node 3: gitops
         - Branch: TEAM_LEADER_AI_Fix (uppercase, underscores)
         - Commit: [AI-AGENT] ... (mandatory prefix)
         - Push to remote (protected: never main/master)
  3. Write results.json to repo root
  4. Return shaped JSON response to dashboard
  5. Clean up temp directory
        |
        v
Docker container (python:3.11-slim)
sandboxed test execution per iteration
```

---

## Installation

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (Desktop or Engine) running
- Google Gemini API key ([get one free](https://aistudio.google.com/app/apikey))

### 1. Clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/velo-agent.git
cd velo-agent
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY
pip install -r requirements.txt
python app.py
```

Backend runs on `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:5000
npm install
npm run dev
```

Dashboard runs on `http://localhost:5173`.

### 4. Docker Compose (full stack)

```bash
# Create root .env with at minimum GEMINI_API_KEY set
cp backend/.env.example .env

docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

---

## Environment Setup

### `backend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **Yes** | - | Google Gemini API key |
| `PORT` | No | `5000` | Flask server port |
| `FLASK_ENV` | No | `production` | Set `development` for debug mode |
| `GIT_AUTHOR_NAME` | No | `oyelurker` | Name for `[AI-AGENT]` commits |
| `GIT_AUTHOR_EMAIL` | No | `oyelurker@gmail.com` | Email for `[AI-AGENT]` commits |
| `MAX_RETRIES` | No | `5` | Max heal-and-retest iterations |
| `ALLOWED_ORIGINS` | No | `*` | CORS allowed origins |

### `frontend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:5000` | Backend base URL |

---

## Usage

1. Open the dashboard
2. Enter a **GitHub repository URL** (e.g. `https://github.com/org/broken-repo`)
3. Enter your **Team Name** and **Team Leader Name**
4. Click **Analyze Repository**
5. Velo will:
   - Clone the repository
   - Discover and run all test files in a Docker sandbox
   - Send failures to Gemini for analysis
   - Apply fixes and commit with `[AI-AGENT]` prefix
   - Push to branch `TEAM_LEADER_AI_Fix`
   - Retry up to 5 times until all tests pass
6. Review the Score Breakdown, Fixes Table, and CI/CD Timeline

---

## Branch Naming

Branches are auto-generated from team name + leader name:

| Team Name | Leader Name | Branch |
|-----------|-------------|--------|
| Vakratund | Tejas Kumar Punyap | `VAKRATUND_TEJAS_KUMAR_PUNYAP_AI_Fix` |
| RIFT ORGANISERS | Saiyam Kumar | `RIFT_ORGANISERS_SAIYAM_KUMAR_AI_Fix` |

Rules: all uppercase, spaces to underscores, suffix exactly `_AI_Fix`.

---

## Supported Bug Types

| Type | Description |
|------|-------------|
| `LINTING` | Unused imports, style violations, unused variables |
| `SYNTAX` | Missing colons, brackets, semicolons |
| `LOGIC` | Inverted conditions, wrong operators |
| `TYPE_ERROR` | Type mismatches, wrong argument types |
| `IMPORT` | Missing or incorrect import paths |
| `INDENTATION` | Inconsistent spacing, mixed tabs/spaces |

---

## Output Format (results.json)

```json
{
  "repo_url": "https://github.com/org/repo",
  "team_name": "Vakratund",
  "leader_name": "Tejas Kumar Punyap",
  "branch_name": "VAKRATUND_TEJAS_KUMAR_PUNYAP_AI_Fix",
  "total_failures": 3,
  "total_fixes": 3,
  "ci_status": "PASSED",
  "execution_time": "2m 14s",
  "iterations_used": 2,
  "max_iterations": 5,
  "score_breakdown": {
    "base": 100,
    "speed_bonus": 10,
    "efficiency_penalty": 0,
    "final_score": 110
  },
  "fixes": [
    {
      "file": "src/utils.py",
      "bug_type": "LINTING",
      "line_number": 15,
      "commit_message": "[AI-AGENT] Fix: remove unused import statement",
      "status": "fixed"
    }
  ],
  "timeline": [
    {
      "status": "FAILED",
      "timestamp": "14:02:13",
      "message": "3 failure(s) detected, 3 fix(es) applied",
      "failures_in_run": 3,
      "fixes_in_run": 3
    },
    {
      "status": "PASSED",
      "timestamp": "14:04:27",
      "message": "All tests passing - pipeline green",
      "failures_in_run": 0,
      "fixes_in_run": 0
    }
  ]
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Backend | Python 3.11, Flask 3, flask-cors |
| Agent Orchestration | LangGraph (StateGraph, 3-node pipeline) |
| LLM | Google Gemini 1.5 Flash |
| Sandboxing | Docker Python SDK |
| Git Automation | GitPython 3 |
| Containerisation | Docker, Docker Compose |
| Deployment | Vercel (frontend), Railway (backend) |

---

## Known Limitations

- Private repositories require a GitHub token in the URL (`https://token@github.com/org/repo`)
- Very large repos (>500 MB) may hit the Docker container timeout (180 s)
- JavaScript/TypeScript tests require a `package.json` with a `test` script
- Multiple bugs in the same file are resolved in a single commit per iteration

---

## Team Members

| Name | Role |
|------|------|
| Tejas Kumar Punyap | Team Leader |
| Saurav Shankar | Developer |
| Karan Mani Tripathi | Developer |

---

*Built for RIFT 2026 - Autonomous DevOps Agent Challenge*
