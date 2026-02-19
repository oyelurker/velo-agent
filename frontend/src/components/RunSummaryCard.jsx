import { useState, useEffect, useRef } from 'react';

function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

function AnimBar({ label, value, max, barStyle, delay = 0 }) {
  const [w, setW] = useState('0%');
  useEffect(() => {
    const t = setTimeout(() => setW(max > 0 ? `${Math.min(100, (value / max) * 100)}%` : '0%'), delay + 200);
    return () => clearTimeout(t);
  }, [value, max, delay]);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-mono">{value}{label === 'Success Rate' ? '%' : ''}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#14142b] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: w, ...barStyle }} />
      </div>
    </div>
  );
}

export default function RunSummaryCard({ data }) {
  const [copied, setCopied] = useState(false);
  const failures    = useCountUp(data.total_failures ?? 0);
  const fixes       = useCountUp(data.total_fixes ?? 0);
  const isPassed    = data.ci_status?.toUpperCase() === 'PASSED';
  const successRate = data.total_failures > 0 ? Math.round((data.total_fixes / data.total_failures) * 100) : 0;

  const copy = () => {
    navigator.clipboard.writeText(data.branch_name || '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fade-in rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] overflow-hidden shadow-2xl shadow-black/50">
      <div className="h-1" style={{ background: isPassed ? 'linear-gradient(to right,#22c55e,#10b981)' : 'linear-gradient(to right,#ef4444,#dc2626)' }} />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
              <svg className="text-indigo-400" style={{width:'16px',height:'16px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Run Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">Analysis complete</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${isPassed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inset-0 rounded-full opacity-75 ${isPassed ? 'bg-emerald-400' : 'bg-red-400'}`} style={{animation:'ping 1.4s cubic-bezier(0,0,0.2,1) infinite'}} />
              <span className={`relative rounded-full h-2 w-2 ${isPassed ? 'bg-emerald-500' : 'bg-red-500'}`} />
            </span>
            {isPassed ? '✓ PASSED' : '✗ FAILED'}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e] mb-6">
          {[
            { label: 'Repository', value: data.repo_url },
            { label: 'Team', value: `${data.team_name} — ${data.leader_name}` },
            { label: 'Execution Time', value: data.execution_time },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
              <span className="text-sm text-white font-medium truncate">{value}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Branch Created</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded break-all">{data.branch_name}</span>
              <button onClick={copy} className="text-slate-500 hover:text-indigo-400 transition-colors flex-shrink-0" title="Copy branch name">
                {copied
                  ? <span className="text-xs text-emerald-400 font-medium">Copied!</span>
                  : <svg style={{width:'14px',height:'14px'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Stats + bar chart */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 py-5">
              <span className="text-4xl font-black text-red-400">{failures}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Failures</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-5">
              <span className="text-4xl font-black text-emerald-400">{fixes}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Fixes</span>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e]">
            <AnimBar label="Failures Detected" value={data.total_failures} max={data.total_failures} barStyle={{ background: '#f87171' }} delay={0} />
            <AnimBar label="Fixes Applied" value={data.total_fixes} max={data.total_failures} barStyle={{ background: '#34d399' }} delay={150} />
            <AnimBar label="Success Rate" value={successRate} max={100} barStyle={{ background: 'linear-gradient(to right,#6366f1,#8b5cf6)' }} delay={300} />
          </div>
        </div>
      </div>
    </div>
  );
}
