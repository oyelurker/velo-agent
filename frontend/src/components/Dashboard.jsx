import { useState, useEffect, useRef } from 'react';

/* ── Count-up hook ── */
function useCountUp(target, dur = 900) {
  const [v, setV] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(e * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return v;
}

/* ── Bug type config ── */
const BUG_CFG = {
  LINTING:     { bg: '#1e1b4b', color: '#818cf8', border: 'rgba(129,140,248,0.3)' },
  SYNTAX:      { bg: '#451a03', color: '#fbbf24', border: 'rgba(251,191,36,0.3)'  },
  LOGIC:       { bg: '#450a0a', color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  TYPE_ERROR:  { bg: '#431407', color: '#fb923c', border: 'rgba(251,146,60,0.3)'  },
  IMPORT:      { bg: '#083344', color: '#22d3ee', border: 'rgba(34,211,238,0.3)'  },
  INDENTATION: { bg: '#052e16', color: '#4ade80', border: 'rgba(74,222,128,0.3)'  },
};

function BugPill({ type }) {
  const c = BUG_CFG[type] || { bg: 'var(--surface-3)', color: 'var(--text-3)', border: 'var(--border)' };
  return (
    <span className="mono" style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 5,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      {type}
    </span>
  );
}

/* ── Score Ring (SVG donut) ── */
function ScoreRing({ score, max = 200 }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  const pct = Math.min(Math.max(score, 0), max) / max;
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - pct)), 200);
    return () => clearTimeout(t);
  }, [pct, circ]);

  const color = score >= 100 ? '#6366f1' : score >= 80 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ width: 120, height: 120, position: 'relative', flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,0.61,0.36,1)', filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)' }}>{score}</span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em' }}>SCORE</span>
      </div>
    </div>
  );
}

/* ── Terminal log ── */
function buildLogLines(runs, maxRetries) {
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const ts = (off) => {
    const d = new Date(now.getTime() - (runs.length * 60 - off) * 1000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const lines = [
    { tag: 'INFO',  time: ts(0),  text: `Initializing Velo Autonomous Agent...` },
    { tag: 'INFO',  time: ts(2),  text: `Max retries: ${maxRetries}. Monitoring ${runs.length} run(s).` },
  ];
  runs.forEach((run, i) => {
    const t = run.timestamp || ts(10 + i * 30);
    lines.push({ tag: '', time: '', text: '' });
    lines.push({ tag: 'INFO',  time: t, text: `── Iteration ${i + 1} / ${maxRetries} ──` });
    const passed = run.status?.toUpperCase() === 'PASSED';
    if (!passed) {
      lines.push({ tag: 'ERROR', time: t, text: `${run.failures_count || 0} failure(s) detected.` });
      if (run.fixes_applied) lines.push({ tag: 'AGENT', time: t, text: `Applying ${run.fixes_applied} fix(es) via Gemini 2.5 Flash...` });
      if (run.commit_sha)    lines.push({ tag: 'PATCH', time: t, text: `Committed ${run.commit_sha} to branch.` });
    } else {
      lines.push({ tag: 'PASS',  time: t, text: `All tests passing — pipeline green ✓` });
    }
  });
  lines.push({ tag: '', time: '', text: '' });
  lines.push({ tag: 'INFO', time: ts(99), text: 'Pipeline monitoring complete.' });
  return lines;
}

function TerminalLog({ runs = [], maxRetries = 5 }) {
  const allLines = buildLogLines(runs, maxRetries);
  const [shown, setShown] = useState([]);
  const timerRef = useRef(null);
  const bodyRef  = useRef(null);

  useEffect(() => {
    setShown([]);
    let i = 0;
    const tick = () => {
      if (i >= allLines.length) return;
      setShown(prev => [...prev, allLines[i++]]);
      timerRef.current = setTimeout(tick, 55);
    };
    timerRef.current = setTimeout(tick, 300);
    return () => clearTimeout(timerRef.current);
  }, [runs]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [shown]);

  const done = shown.length >= allLines.length;

  const tagColor = { INFO: '#6366f1', ERROR: '#ef4444', AGENT: '#f59e0b', PASS: '#22c55e', PATCH: '#22d3ee' };

  return (
    <div style={{ background: '#0d0d0f', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Title bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>agent-output — live</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: done ? 'var(--success)' : 'var(--warning)', display: 'inline-block' }} className={done ? '' : 'pulse-dot'} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{done ? 'COMPLETE' : 'STREAMING'}</span>
        </div>
      </div>
      {/* Log body */}
      <div ref={bodyRef} style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.7, height: 240, overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>
        {shown.map((line, i) => {
          if (!line) return null;
          if (!line.text) return <div key={i} style={{ height: 6 }} />;
          const c = tagColor[line.tag] || 'var(--text-3)';
          return (
            <div key={i} style={{ display: 'flex', gap: 12, borderLeft: line.tag === 'PASS' ? '2px solid var(--success)' : '2px solid transparent', paddingLeft: 6, marginLeft: -8 }}>
              <span style={{ color: 'var(--text-3)', minWidth: 52, flexShrink: 0 }}>{line.time}</span>
              <span style={{ color: c, fontWeight: 700, minWidth: 44, flexShrink: 0 }}>[{line.tag}]</span>
              <span style={{ color: '#d4d4d8' }}>{line.text}</span>
            </div>
          );
        })}
        {!done && (
          <div style={{ display: 'flex', gap: 12, paddingLeft: 6, marginLeft: -8, borderLeft: '2px solid transparent' }}>
            <span style={{ color: 'var(--text-3)', minWidth: 52 }}>…</span>
            <span style={{ color: 'var(--accent)' }} className="blink-cursor">&nbsp;</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function Dashboard({ data, onReset }) {
  const [bugFilter,    setBugFilter]    = useState('ALL');
  const [copiedBranch, setCopiedBranch] = useState(false);

  const isPassed    = data.ci_status?.toUpperCase() === 'PASSED';
  const failures    = useCountUp(data.total_failures ?? 0);
  const fixesCount  = useCountUp(data.total_fixes ?? 0);
  const score       = data.score_breakdown?.final_score ?? data.score_breakdown?.final ?? 0;
  const fixRate     = data.total_failures > 0
    ? Math.round((data.total_fixes / data.total_failures) * 100) : 0;

  const allFixes      = data.fixes_applied || data.fixes || [];
  const cicdTimeline  = data.cicd_timeline  || data.timeline || [];

  const bugCounts = allFixes.reduce((acc, f) => {
    const t = f.bug_type || 'UNKNOWN';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const visibleFixes = bugFilter === 'ALL' ? allFixes : allFixes.filter(f => f.bug_type === bugFilter);

  const copyBranch = () => {
    navigator.clipboard.writeText(data.branch_name || '').catch(() => {});
    setCopiedBranch(true);
    setTimeout(() => setCopiedBranch(false), 2000);
  };

  const baseScore   = data.score_breakdown?.base ?? data.score_breakdown?.base_score ?? 100;
  const speedBonus  = data.score_breakdown?.speed_bonus ?? 0;
  const penalty     = Math.abs(data.score_breakdown?.efficiency_penalty ?? 0);
  const maxRetries  = data.max_retries || data.max_iterations || 5;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(9,9,11,0.9)',
        backdropFilter: 'blur(12px)',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Velo</span>
          <span style={{ color: 'var(--border)', fontSize: 16 }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.repo_url?.replace('https://github.com/', '') || 'Analysis'}
          </span>
          <span className={`badge ${isPassed ? '' : ''}`} style={{
            background: isPassed ? 'var(--success-muted)' : 'var(--error-muted)',
            color: isPassed ? 'var(--success)' : 'var(--error)',
            border: `1px solid ${isPassed ? 'var(--success-border)' : 'var(--error-border)'}`,
            marginLeft: 8,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isPassed ? 'var(--success)' : 'var(--error)', display: 'inline-block' }} />
            {isPassed ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        <button className="btn-ghost" onClick={onReset} style={{ fontSize: 13 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12l7-7 7 7"/>
          </svg>
          New Scan
        </button>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 1280, width: '100%', margin: '0 auto', padding: '28px 24px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Stat row ── */}
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            {
              label: 'CI Status',
              value: isPassed ? 'PASSED' : 'FAILED',
              mono: true,
              color: isPassed ? 'var(--success)' : 'var(--error)',
              sub: data.execution_time ? `in ${data.execution_time}` : 'completed',
            },
            {
              label: 'Failures Detected',
              value: failures,
              color: 'var(--text)',
              sub: `${data.total_failures || 0} total`,
            },
            {
              label: 'Fixes Applied',
              value: fixesCount,
              color: 'var(--text)',
              sub: `${fixRate}% fix rate`,
            },
            {
              label: 'Score',
              value: score,
              color: score >= 100 ? 'var(--accent)' : 'var(--warning)',
              sub: `of 200 max`,
            },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: s.mono ? 16 : 28, fontWeight: 700, letterSpacing: s.mono ? '0.02em' : '-0.04em', color: s.color, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Run info + Score row ── */}
        <div className="fade-in-1" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

          {/* Run summary */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Run Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: 'Repository', value: data.repo_url?.replace('https://github.com/', '') || '—', mono: true },
                { label: 'Branch Created', value: data.branch_name || '—', mono: true, copy: true },
                { label: 'Team', value: data.team_name || '—', mono: false },
                { label: 'Leader', value: data.leader_name || '—', mono: false },
                { label: 'Iterations Used', value: `${cicdTimeline.length} / ${maxRetries}`, mono: true },
                { label: 'Execution Time', value: data.execution_time || '—', mono: true },
              ].map(item => (
                <div key={item.label} style={{ padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span className={item.mono ? 'mono' : ''} style={{ fontSize: item.mono ? 12 : 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {item.value}
                    </span>
                    {item.copy && (
                      <button onClick={copyBranch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedBranch ? 'var(--success)' : 'var(--text-3)', flexShrink: 0, padding: 0 }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          {copiedBranch
                            ? <polyline points="20 6 9 17 4 12"/>
                            : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
                          }
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score breakdown */}
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Performance Score
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ScoreRing score={score} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Base',         val: baseScore,            color: '#6366f1', pct: (baseScore / 200) * 100 },
                  { label: 'Speed Bonus',  val: `+${speedBonus}`,     color: 'var(--success)', pct: (speedBonus / 20) * 100 },
                  { label: 'Penalty',      val: penalty ? `-${penalty}` : '0', color: penalty ? 'var(--error)' : 'var(--text-3)', pct: (penalty / 20) * 100 },
                ].map(row => (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-3)' }}>{row.label}</span>
                      <span className="mono" style={{ fontWeight: 700, color: row.color, fontSize: 12 }}>{row.val}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: row.color, width: `${Math.max(row.pct, 2)}%`, borderRadius: 2, transition: 'width 1s ease-out' }} />
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>Final</span>
                  <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: score >= 100 ? 'var(--accent)' : 'var(--warning)', letterSpacing: '-0.03em' }}>{score}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixes Table ── */}
        <div className="card fade-in-2" style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" fill="none" stroke="var(--text-3)" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Fixes Applied</span>
              <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border)', fontSize: 11 }}>
                {allFixes.length}
              </span>
            </div>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto' }} className="no-scrollbar">
              {['ALL', ...Object.keys(bugCounts)].map(t => {
                const isActive = bugFilter === t;
                const c = t !== 'ALL' ? BUG_CFG[t] : null;
                return (
                  <button
                    key={t}
                    onClick={() => setBugFilter(t)}
                    className="mono"
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.04em', cursor: 'pointer', whiteSpace: 'nowrap',
                      background: isActive ? (c ? c.bg : 'var(--accent-muted)') : 'transparent',
                      color:      isActive ? (c ? c.color : 'var(--accent)') : 'var(--text-3)',
                      border: isActive ? `1px solid ${c ? c.border : 'var(--accent-border)'}` : '1px solid var(--border)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t === 'ALL' ? 'All' : `${t} (${bugCounts[t]})`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['File', 'Bug Type', 'Line', 'Commit Message', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                      textAlign: h === 'Line' ? 'right' : h === 'Status' ? 'center' : 'left',
                      whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleFixes.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                      No fixes recorded for this filter.
                    </td>
                  </tr>
                ) : visibleFixes.map((fix, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fix.file}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <BugPill type={fix.bug_type} />
                    </td>
                    <td className="mono" style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>
                      {fix.line_number != null ? fix.line_number : '—'}
                    </td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-3)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fix.commit_message || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {fix.status?.toLowerCase() === 'fixed' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                          Fixed
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--error)' }}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Terminal Log ── */}
        <div className="fade-in-3">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            CI/CD Agent Log
          </div>
          <TerminalLog runs={cicdTimeline} maxRetries={maxRetries} />
        </div>

      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Powered by <span style={{ color: 'var(--accent)' }}>Gemini 2.5 Flash</span> · Velo CI/CD Agent
        </div>
        <button className="btn-ghost" onClick={onReset} style={{ fontSize: 12, padding: '6px 12px' }}>
          ← Back to home
        </button>
      </footer>
    </div>
  );
}
