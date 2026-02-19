import { useState } from 'react';
import InputForm from './components/InputForm';
import RunSummaryCard from './components/RunSummaryCard';
import ScoreBreakdown from './components/ScoreBreakdown';
import FixesTable from './components/FixesTable';
import CICDTimeline from './components/CICDTimeline';

const MOCK_RESPONSE = {
  repo_url: 'https://github.com/demo/ci-demo',
  team_name: 'Alpha Squad',
  leader_name: 'Sarah Connor',
  branch_name: 'SARAH_CONNOR_AI_Fix',
  total_failures: 7,
  total_fixes: 5,
  ci_status: 'PASSED',
  execution_time: '3m 42s',
  score_breakdown: {
    base: 100,
    speed_bonus: 10,
    efficiency_penalty: 0,
    final_score: 110,
  },
  fixes: [
    { file: 'src/api/routes.py',   bug_type: 'SYNTAX',      line_number: 42,  commit_message: 'fix: corrected missing colon in function definition',  status: 'fixed' },
    { file: 'src/utils/parser.js', bug_type: 'LINTING',     line_number: 17,  commit_message: 'style: removed trailing whitespace and unused imports',  status: 'fixed' },
    { file: 'src/models/user.ts',  bug_type: 'TYPE_ERROR',  line_number: 88,  commit_message: 'fix: resolved type mismatch in UserProfile interface',   status: 'fixed' },
    { file: 'components/Nav.tsx',  bug_type: 'IMPORT',      line_number: 3,   commit_message: 'fix: corrected relative import path for NavBar module',  status: 'fixed' },
    { file: 'tests/test_auth.py',  bug_type: 'LOGIC',       line_number: 56,  commit_message: 'fix: fixed inverted condition in auth validation logic',  status: 'fixed' },
    { file: 'src/config.yaml',     bug_type: 'INDENTATION', line_number: 14,  commit_message: 'style: normalized YAML indentation to 2-space standard', status: 'failed' },
    { file: 'src/db/queries.sql',  bug_type: 'SYNTAX',      line_number: 101, commit_message: 'fix: added missing semicolon in SELECT statement',       status: 'failed' },
  ],
  timeline: [
    { status: 'FAILED', timestamp: '14:02:13', message: 'Initial lint check — 7 violations detected', failures_in_run: 7, fixes_in_run: 0 },
    { status: 'FAILED', timestamp: '14:03:01', message: 'Syntax & import fixes applied — partial success', failures_in_run: 4, fixes_in_run: 3 },
    { status: 'FAILED', timestamp: '14:03:55', message: 'Type errors resolved — 2 remaining', failures_in_run: 2, fixes_in_run: 2 },
    { status: 'PASSED', timestamp: '14:04:44', message: 'Logic & linting issues patched — pipeline green', failures_in_run: 0, fixes_in_run: 2 },
  ],
};

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <div>
        <span className="text-xl font-black text-white tracking-tight">VELO</span>
        <span className="ml-2 text-xs text-indigo-400 font-semibold tracking-widest uppercase">CI/CD Agent</span>
      </div>
    </div>
  );
}

function StatusDot({ active }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-600'}`}
        style={active ? { animation: 'pulse 2s ease-in-out infinite' } : {}} />
      {active ? 'Live' : 'Idle'}
    </span>
  );
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 fade-in-up">
      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-semibold">Analysis Failed</p>
        <p className="text-xs mt-1 text-red-400/70">{message}</p>
      </div>
      <button onClick={onDismiss} className="text-red-400/60 hover:text-red-400 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      // Fallback to mock data in dev when backend is unavailable
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.warn('Backend unavailable — using mock data');
        await new Promise(r => setTimeout(r, 2200));
        setResult({
          ...MOCK_RESPONSE,
          repo_url: formData.repo_url || MOCK_RESPONSE.repo_url,
          team_name: formData.team_name || MOCK_RESPONSE.team_name,
          leader_name: formData.leader_name || MOCK_RESPONSE.leader_name,
          branch_name: `${[formData.team_name, formData.leader_name].filter(Boolean).join(' ').replace(/\s+/g, '_').toUpperCase()}_AI_Fix`,
        });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-blue-600/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-[#1a1a2e] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <StatusDot active={loading || !!result} />
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-px h-4 bg-[#2a2a4a]" />
              <span>v2.0.1</span>
            </div>
            {result && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2a4a] text-xs text-slate-400 hover:text-white hover:border-slate-400 transition-all duration-200"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Analysis
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        {!result && !loading && (
          <div className="text-center mb-12 fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
              Autonomous Healing Pipeline
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              CI/CD Failure
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent"> Healed</span>
              {' '}Automatically
            </h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Submit your repository and let Velo detect, analyze, and patch CI/CD failures autonomously — with a full audit trail.
            </p>
          </div>
        )}

        {/* Section 1 — Input Form */}
        {!result && (
          <div className="mb-10">
            <InputForm onSubmit={handleSubmit} loading={loading} />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-8">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Results Dashboard */}
        {result && (
          <div className="space-y-6">
            {/* Section 2 — Run Summary */}
            <RunSummaryCard data={result} />

            {/* Section 3 — Score */}
            <ScoreBreakdown data={result} />

            {/* Sections 4 & 5 — side by side on large screens */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-3">
                <FixesTable fixes={result.fixes || []} />
              </div>
              <div className="xl:col-span-2">
                <CICDTimeline runs={result.timeline || []} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1a1a2e] mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-slate-700">Velo Autonomous CI/CD Agent — 2026</span>
          <span className="text-xs text-slate-700 font-mono">POST → {(import.meta.env.VITE_API_URL || 'http://localhost:5000')}/api/analyze</span>
        </div>
      </footer>
    </div>
  );
}
