import { useState, useEffect, useRef } from 'react';

function buildLines(runs = [], maxRetries = 5) {
  const lines = [];
  const push = (text, type = 'info') => lines.push({ text, type });

  push(`[AGENT] Velo Autonomous CI/CD Healing Pipeline`, 'agent');
  push(`[INFO]  Max retries configured: ${maxRetries}`, 'info');
  push(`[INFO]  Monitoring ${runs.length} pipeline run(s)`, 'info');

  runs.forEach((run, i) => {
    push(``, 'blank');
    push(`[INFO]  ─── Iteration ${i + 1} / ${maxRetries} ───────────────────`, 'info');
    if (run.timestamp) push(`[INFO]  Timestamp  : ${run.timestamp}`, 'info');
    const passed = run.status?.toUpperCase() === 'PASSED';
    if (passed) {
      push(`[PASS]  CI Status  : PASSED  ✓ All tests green`, 'pass');
    } else {
      push(`[ERROR] CI Status  : FAILED  ✗ Failures detected`, 'error');
      if (run.failures_count) push(`[ERROR] Failures   : ${run.failures_count}`, 'error');
      if (run.fixes_applied) push(`[AGENT] Fixes Applied: ${run.fixes_applied}`, 'agent');
      if (run.commit_sha)    push(`[INFO]  Commit SHA : ${run.commit_sha}`, 'info');
    }
    if (run.duration)       push(`[INFO]  Duration   : ${run.duration}`, 'info');
  });

  push(``, 'blank');
  push(`[INFO]  Pipeline monitoring complete.`, 'info');
  return lines;
}

const LINE_COLOR = { info: '#94a3b8', error: '#f87171', agent: '#a78bfa', pass: '#34d399', blank: 'transparent' };
const TAG_COLOR  = { info: '#475569', error: '#f8717180', agent: '#a78bfa80', pass: '#34d39980', blank: 'transparent' };

export default function CICDTimeline({ runs = [], maxRetries = 5 }) {
  const allLines = buildLines(runs, maxRetries);
  const [shown, setShown] = useState([]);
  const timerRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    setShown([]);
    let i = 0;
    function tick() {
      if (i >= allLines.length) return;
      setShown(prev => [...prev, allLines[i]]);
      i++;
      timerRef.current = setTimeout(tick, 45);
    }
    timerRef.current = setTimeout(tick, 200);
    return () => clearTimeout(timerRef.current);
  }, [runs]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [shown]);

  const done = shown.length >= allLines.length;

  return (
    <div className="fade-in-4 rounded-2xl border border-[#1e1e3a] overflow-hidden shadow-2xl shadow-black/50">
      {/* macOS title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#141425] border-b border-[#1a1a2e]">
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-[11px] text-slate-500 font-mono select-none">velo-agent — live-pipeline-logs</span>
        <div className="ml-auto flex items-center gap-2">
          {!done && (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{animation:'pulse 1.2s ease-in-out infinite'}} />
              LIVE
            </span>
          )}
          <span className="text-[10px] text-slate-600 font-mono">{shown.length}/{allLines.length}</span>
        </div>
      </div>

      {/* Log body */}
      <div
        ref={bodyRef}
        className="font-mono text-[12px] leading-6 p-4 overflow-y-auto"
        style={{ background: '#0d1117', maxHeight: '380px', minHeight: '220px' }}
      >
        {shown.map((line, i) => {
          if (line.type === 'blank') return <div key={i} className="h-2" />;
          return (
            <div key={i} className="flex items-start gap-2 hover:bg-white/[0.02] px-1 rounded">
              <span className="flex-shrink-0 w-[52px] text-right font-bold text-[10px] mt-0.5 opacity-60" style={{ color: LINE_COLOR[line.type] }}>
                {i + 1}
              </span>
              <span style={{ color: LINE_COLOR[line.type] }} className="break-all whitespace-pre-wrap">
                {line.text}
              </span>
            </div>
          );
        })}
        {!done && (
          <div className="flex items-start gap-2 px-1">
            <span className="w-[52px]" />
            <span className="text-indigo-400 blink">▌</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-t border-[#1a1a2e]">
        <span className="text-[10px] font-mono text-slate-600">{runs.length} runs · {maxRetries} max retries</span>
        <span className={`text-[10px] font-mono font-bold ${done ? 'text-emerald-500' : 'text-yellow-500'}`}>
          {done ? '● complete' : '● streaming…'}
        </span>
      </div>
    </div>
  );
}
