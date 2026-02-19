import { useState } from 'react';

const BUG_COLORS = {
  LINTING:     { bg: '#1e3a2e', border: '#22c55e40', text: '#4ade80' },
  SYNTAX:      { bg: '#1e2a3e', border: '#3b82f640', text: '#60a5fa' },
  LOGIC:       { bg: '#2e1e3e', border: '#8b5cf640', text: '#a78bfa' },
  TYPE_ERROR:  { bg: '#3e2a1e', border: '#f9731640', text: '#fb923c' },
  IMPORT:      { bg: '#1e2e3e', border: '#06b6d440', text: '#22d3ee' },
  INDENTATION: { bg: '#3e3a1e', border: '#eab30840', text: '#fbbf24' },
};

function Bug({ type }) {
  const c = BUG_COLORS[type] || { bg: '#1e1e2e', border: '#ffffff20', text: '#94a3b8' };
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  const ok = status?.toLowerCase() === 'fixed';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-red-500/10 text-red-400 border border-red-500/25'}`}>
      <span>{ok ? '✓' : '✗'}</span>{status}
    </span>
  );
}

export default function FixesTable({ fixes = [] }) {
  const [filter, setFilter] = useState('ALL');

  const counts = fixes.reduce((acc, f) => {
    const t = f.bug_type || 'UNKNOWN';
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const types = ['ALL', ...Object.keys(counts)];
  const visible = filter === 'ALL' ? fixes : fixes.filter(f => f.bug_type === filter);

  return (
    <div className="fade-in-3 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] overflow-hidden shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 p-6 pb-4">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
          <svg style={{width:'16px',height:'16px',color:'#60a5fa'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fixes Applied</h3>
          <p className="text-xs text-slate-500 mt-0.5">{fixes.length} total modifications</p>
        </div>
      </div>

      {/* Bug type filter pills */}
      <div className="flex flex-wrap gap-2 px-6 pb-4">
        {types.map(t => {
          const c = BUG_COLORS[t] || { bg: '#1e1e2e', border: '#ffffff20', text: '#94a3b8' };
          const active = filter === t;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-all duration-150"
              style={active
                ? { background: t === 'ALL' ? '#6366f120' : c.bg, border: `1px solid ${t === 'ALL' ? '#6366f140' : c.border}`, color: t === 'ALL' ? '#818cf8' : c.text }
                : { background: '#0a0a15', border: '1px solid #1a1a2e', color: '#475569' }
              }
            >
              {t}{t !== 'ALL' && ` (${counts[t]})`}
            </button>
          );
        })}
      </div>

      {/* Distribution bars */}
      {Object.keys(counts).length > 0 && (
        <div className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(counts).map(([type, count]) => {
            const c = BUG_COLORS[type] || { bg: '#1e1e2e', border: '#ffffff20', text: '#94a3b8' };
            const pct = Math.round((count / fixes.length) * 100);
            return (
              <div key={type} className="rounded-lg p-3" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.text }}>{type}</span>
                  <span className="text-[10px] text-slate-400">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#0a0a15]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.text }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-y border-[#1a1a2e] bg-[#09090e]">
              {['File', 'Bug Type', 'Line', 'Status', 'Commit Message'].map(h => (
                <th key={h} className={`px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap ${h === 'Commit Message' ? 'hidden md:table-cell' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0f0f1c]">
            {visible.length === 0 ? (
              <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-600 text-sm">No fixes match the filter.</td></tr>
            ) : visible.map((fix, i) => (
              <tr key={i} className="hover:bg-[#0a0a15] transition-colors group">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-indigo-300 group-hover:text-indigo-200 transition-colors">{fix.file}</span>
                </td>
                <td className="px-4 py-3"><Bug type={fix.bug_type} /></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{fix.line_number != null ? `L${fix.line_number}` : '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={fix.status} /></td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors line-clamp-1 max-w-xs block">{fix.commit_message}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
