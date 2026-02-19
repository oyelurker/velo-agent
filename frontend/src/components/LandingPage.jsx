import { useState } from 'react';

const DEMO_PRESETS = [
  {
    label:      'Tejas',
    tag:        'TK',
    color:      '#6366f1',
    highlight:  true,
    repoUrl:    'https://github.com/oyelurker/velo-agent',
    teamName:   'Vakratund',
    leaderName: 'Tejas Kumar Punyap',
  },
  {
    label:      'Knoxiboy',
    tag:        'KB',
    color:      '#60a5fa',
    repoUrl:    'https://github.com/knoxiboy/velo_test_repo',
    teamName:   'Vakratund',
    leaderName: 'Knoxiboy',
  },
  {
    label:      'Oyelurker',
    tag:        'OY',
    color:      '#f59e0b',
    repoUrl:    'https://github.com/oyelurker/velo-agent',
    teamName:   'Vakratund',
    leaderName: 'Oyelurker',
  },
];

const PIPELINE_STEPS = [
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    label: 'Sandbox Tester',
    color: '#60a5fa',
    points: ['Clones repository', 'Discovers test files', 'Runs in isolation'],
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
    label: 'LLM Solver',
    color: '#a78bfa',
    points: ['Gemini 2.5 Flash', 'Analyzes failures', 'Generates patches'],
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M11 18H8a2 2 0 0 1-2-2V9"/>
      </svg>
    ),
    label: 'GitOps',
    color: '#34d399',
    points: ['Commits with [AI-AGENT]', 'Pushes to new branch', 'Verifies CI/CD'],
  },
];

export default function LandingPage({ onSubmit, loading }) {
  const [repoUrl,    setRepoUrl]    = useState('');
  const [teamName,   setTeamName]   = useState('');
  const [leaderName, setLeaderName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ repo_url: repoUrl, team_name: teamName, leader_name: leaderName });
  };

  const fillDemo = (preset = DEMO_PRESETS[0]) => {
    setRepoUrl(preset.repoUrl);
    setTeamName(preset.teamName);
    setLeaderName(preset.leaderName);
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--text)' }}>Velo</span>
          <span style={{ color: 'var(--border)', fontSize: 16, margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>CI/CD Agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge" style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
            <span style={{ width: 5, height: 5, background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
            Live
          </span>
          <span className="badge" style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
            v1.0.0
          </span>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* ── Hero + Form split ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,440px)', gap: 64, alignItems: 'start' }}>

          {/* Left: Hero */}
          <div className="fade-in">
            <div className="badge fade-in" style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)', marginBottom: 20, fontSize: 12 }}>
              Hackathon Build — RIFT 2026
            </div>
            <h1 style={{
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
              marginBottom: 20,
            }}>
              Autonomous<br />CI/CD Healing<br />
              <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>Agent</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 460, marginBottom: 36 }}>
              Point Velo at any GitHub repository. It clones the code, runs all tests, detects failures, generates fixes with Gemini AI, and commits them back — automatically.
            </p>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
              {[
                { label: 'Agents', value: '3', sub: 'in pipeline' },
                { label: 'Max Retries', value: '5', sub: 'per run' },
                { label: 'Fix Rate', value: '~95%', sub: 'success' },
              ].map(s => (
                <div key={s.label} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, minWidth: 100 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.2 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pipeline flow - horizontal */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>How it works</div>
              <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                {PIPELINE_STEPS.map((step, i) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ color: step.color, marginBottom: 8 }}>{step.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>{step.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {step.points.map(p => (
                          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
                            <div style={{ width: 3, height: 3, borderRadius: '50%', background: step.color, flexShrink: 0 }} />
                            {p}
                          </div>
                        ))}
                      </div>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div style={{ padding: '0 6px', flexShrink: 0 }}>
                        <svg width="14" height="14" fill="none" stroke="var(--text-3)" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="fade-in-2">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Analyze Repository</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Enter your GitHub repo to begin</div>
                  </div>
                </div>
                {/* Demo presets */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center', marginRight: 2 }}>Try demo:</span>
                  {DEMO_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => fillDemo(preset)}
                      className="mono"
                      style={{
                        padding: preset.highlight ? '5px 12px' : '4px 10px',
                        borderRadius: 6, fontSize: preset.highlight ? 11 : 10,
                        fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer',
                        background: preset.highlight ? preset.color : preset.color + '15',
                        color:      preset.highlight ? '#fff'       : preset.color,
                        border: `1px solid ${preset.highlight ? preset.color : preset.color + '40'}`,
                        boxShadow: preset.highlight ? `0 0 10px ${preset.color}55` : 'none',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.opacity = '0.85';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      {preset.highlight ? '★ ' : ''}{preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form body */}
              <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label">GitHub Repository URL</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input mono"
                      type="url"
                      required
                      value={repoUrl}
                      onChange={e => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      style={{ paddingLeft: 38 }}
                    />
                    <svg style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-3)', flexShrink: 0 }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                    </svg>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Team Name</label>
                    <input
                      className="input"
                      type="text"
                      required
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      placeholder="e.g. Vakratund"
                    />
                  </div>
                  <div>
                    <label className="label">Leader Name</label>
                    <input
                      className="input"
                      type="text"
                      required
                      value={leaderName}
                      onChange={e => setLeaderName(e.target.value)}
                      placeholder="e.g. Tejas Kumar"
                    />
                  </div>
                </div>

                {/* Info note */}
                <div style={{ padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text-2)' }}>Branch naming: </span>
                  <code className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>TEAM_LEADER_AI_Fix</code>
                  {' '}— commits will carry the <code className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>[AI-AGENT]</code> prefix.
                </div>

                <button
                  className="btn-primary"
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 14 }}
                >
                  {loading ? (
                    <>
                      <svg className="spin" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Running Analysis…
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Run Analysis
                    </>
                  )}
                </button>

                {loading && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6 }}>
                    Cloning repository and running test suite…<br />
                    <span style={{ color: 'var(--text-2)' }}>This may take 1–3 minutes.</span>
                  </div>
                )}
              </form>
            </div>

            {/* Footer note */}
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Repository must be publicly accessible. Private repos require a GitHub token in the backend <code className="mono" style={{ fontSize: 11 }}>.env</code>.
            </div>
          </div>
        </div>

        {/* ── Workflow steps ── */}
        <div className="fade-in-3" style={{ marginTop: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Execution sequence</span>
            <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { num: '01', title: 'Detection Phase', color: '#60a5fa', desc: 'Real-time pipeline surveillance captures build failures. Logs and environment state are extracted to the secure container for analysis.' },
              { num: '02', title: 'Resolution Loop', color: '#a78bfa', desc: 'Gemini AI agents analyze stack traces, reproduce errors in isolated sandboxes, and iterate on code patches — up to 5 retries.' },
              { num: '03', title: 'Deployment Ready', color: '#34d399', desc: 'Optimized solution is packaged into a clean GitOps branch, committed with the [AI-AGENT] prefix, pushed, and CI/CD re-verified.' },
            ].map(step => (
              <div key={step.num} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: step.color, background: `${step.color}15`, border: `1px solid ${step.color}30`, padding: '2px 8px', borderRadius: 5 }}>{step.num}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{step.title}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Built by <span style={{ color: 'var(--text-2)' }}>Team Vakratund</span> for RIFT 2026
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 16 }}>
          <span>Tejas Kumar Punyap</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>Saurav Shankar</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>Karan Mani Tripathi</span>
        </div>
      </footer>
    </div>
  );
}
