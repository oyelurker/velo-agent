
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AuthPage from './components/AuthPage';
import { useApp } from './context/AppContext.jsx';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TAG_COLOR = {
  INFO:  '#6366f1',
  ERROR: '#ef4444',
  AGENT: '#f59e0b',
  PASS:  '#22c55e',
  PATCH: '#22d3ee',
  BUG:   '#f87171',
};

/* ── Live Analyzing Screen ── */
function AnalyzingScreen({ repoUrl, liveLog }) {
  const logRef  = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [liveLog]);

  // Derive which pipeline node is currently active
  const nodeMessages = liveLog.filter(e => e.message?.startsWith('── Node'));
  const activeNode   = nodeMessages[nodeMessages.length - 1]?.message || '';

  const nodeStatus = (label) => {
    const idx = nodeMessages.findIndex(e => e.message?.includes(label));
    if (idx === -1) return 'pending';
    if (nodeMessages[nodeMessages.length - 1]?.message?.includes(label)) return 'active';
    return 'done';
  };

  const NODES = [
    { key: '1', label: 'Sandbox Tester', color: '#60a5fa' },
    { key: '2', label: 'LLM Solver',     color: '#a78bfa' },
    { key: '3', label: 'GitOps',         color: '#34d399' },
  ];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(9,9,11,0.9)',
        backdropFilter: 'blur(12px)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Velo</span>
          <span style={{ color: 'var(--border)', fontSize: 16 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repoUrl?.replace('https://github.com/', '') || 'Analyzing...'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} className="pulse-dot" />
          <span className="mono" style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, letterSpacing: '0.06em' }}>LIVE</span>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 900, width: '100%', margin: '0 auto', padding: '36px 24px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Pipeline Node Status */}
        <div className="fade-in node-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {NODES.map((node, i) => {
            const status = nodeStatus(node.label);
            const isActive = status === 'active';
            const isDone   = status === 'done';
            return (
              <div key={node.key} className="card" style={{
                padding: '14px 18px',
                borderColor: isActive ? node.color + '55' : isDone ? 'var(--border)' : 'var(--border-subtle)',
                background: isActive ? node.color + '0a' : 'var(--surface)',
                transition: 'all 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className="mono" style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    color: isActive ? node.color : isDone ? 'var(--success)' : 'var(--text-3)',
                    background: (isActive ? node.color : isDone ? '#22c55e' : '#888') + '18',
                    border: `1px solid ${(isActive ? node.color : isDone ? '#22c55e' : '#888')}30`,
                    padding: '2px 7px', borderRadius: 4,
                  }}>
                    {isDone ? '✓ DONE' : isActive ? '⟳ RUNNING' : 'PENDING'}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>
                  {node.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Terminal */}
        <div className="fade-in-1" style={{ background: '#0d0d0f', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Title bar */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>
                velo-agent — live output
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} className="pulse-dot" />
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>STREAMING</span>
            </div>
          </div>

          {/* Log body */}
          <div ref={logRef} style={{
            padding: '12px 16px', fontSize: 12, lineHeight: 1.8,
            height: 380, overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>
            {liveLog.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>
                Connecting to agent...
              </div>
            )}
            {liveLog.map((event, i) => {
              const c = TAG_COLOR[event.tag] || 'var(--text-3)';
              const isBug    = event.tag === 'BUG';
              const isPass   = event.tag === 'PASS';
              const isHeader = event.message?.startsWith('──');
              return (
                <div key={i} style={{
                  display: 'flex', gap: 10,
                  borderLeft: isPass ? '2px solid var(--success)' : isBug ? '2px solid #f87171' : '2px solid transparent',
                  paddingLeft: 8, marginLeft: -10,
                  marginTop: isHeader ? 8 : 0,
                  opacity: isHeader ? 0.6 : 1,
                }}>
                  <span style={{ color: TAG_COLOR[event.tag] || '#6366f1', fontWeight: 700, minWidth: 48, flexShrink: 0, fontSize: 11 }}>
                    [{event.tag}]
                  </span>
                  <span style={{ color: isPass ? '#4ade80' : isBug ? '#fca5a5' : isHeader ? 'var(--text-3)' : '#d4d4d8', flex: 1 }}>
                    {event.message}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 10, paddingLeft: 8, marginLeft: -10, borderLeft: '2px solid transparent', marginTop: 2 }}>
              <span style={{ minWidth: 48, color: 'transparent' }}> </span>
              <span style={{ color: 'var(--accent)' }} className="blink-cursor">&nbsp;</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
          Autonomous healing in progress — this may take 1–3 minutes
        </div>
      </main>
    </div>
  );
}


/* ── Main content (landing + analyzing + dashboard) ── */
function AppContent() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();
  const {
    loading, setLoading,
    results, setResults,
    error, setError,
    liveLog, setLiveLog,
    analyzingRepo, setAnalyzingRepo,
    liveLogRef,
    reset,
  } = useApp();

  const handleSubmit = async ({ repo_url, team_name, leader_name }) => {
    const token = await getIdToken();
    if (!token) {
      setError('Please sign in to run analysis.');
      navigate('/auth', { replace: true });
      return;
    }
    setLoading(true);
    setError('');
    setResults(null);
    setLiveLog([]);
    setAnalyzingRepo(repo_url);
    liveLogRef.current = [];

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repo_url, team_name, leader_name }),
      });
      if (res.status === 401) {
        setError('Session expired. Please sign in again.');
        navigate('/auth', { replace: true });
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Server error ${res.status}`);
      }
      // Try streaming endpoint first; fall back to batch if needed
      let usedStream = false;
      const streamRes = await fetch(`${API_URL}/api/analyze/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ repo_url, team_name, leader_name }),
      });

      if (streamRes.ok && streamRes.headers.get('content-type')?.includes('text/event-stream')) {
        // ── Streaming path ────────────────────────────────────────────────
        usedStream = true;
        const reader  = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'keepalive') continue;

              if (event.type === 'done') {
                setResults({ ...event.data, liveLog: liveLogRef.current });
              } else if (event.type === 'error') {
                setError(event.message || 'Analysis failed.');
              } else if (event.type === 'log') {
                const updated = [...liveLogRef.current, event];
                liveLogRef.current = updated;
                setLiveLog([...updated]);
              }
            } catch {
              // ignore malformed SSE line
            }
          }
        }
      }

      if (!usedStream) {
        // ── Batch fallback (old Railway deployment / non-streaming backend) ─
        const batchRes = await fetch(`${API_URL}/api/analyze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ repo_url, team_name, leader_name }),
        });

        if (!batchRes.ok) {
          const j = await batchRes.json().catch(() => ({}));
          throw new Error(j.error || `Server error ${batchRes.status}`);
        }

        const data = await batchRes.json();
        setResults(data);
      }
    } catch (e) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setAnalyzingRepo('');
    }
  };

  const handleReset = () => reset();

  if (results && !loading) {
    return <Dashboard data={results} onReset={handleReset} />;
  }

  if (loading) {
    return <AnalyzingScreen repoUrl={analyzingRepo} liveLog={liveLog} />;
  }

  return (
    <>
      <LandingPage onSubmit={handleSubmit} loading={loading} />
      {error && !loading && !results && (
        <div style={{
          position: 'fixed', bottom: 24, left: 24, right: 24, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--error-border)',
          borderRadius: 10, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxWidth: 520, margin: '0 auto',
        }}>
          <svg width="18" height="18" fill="none" stroke="var(--error)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--error)', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Analysis Failed</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{error}</p>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<AppContent />} />
    </Routes>
  );
}
