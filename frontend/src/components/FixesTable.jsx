const BUG_TYPE_COLORS = {
  LINTING:     { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400' },
  SYNTAX:      { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400' },
  LOGIC:       { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400' },
  TYPE_ERROR:  { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400' },
  IMPORT:      { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   text: 'text-cyan-400' },
  INDENTATION: { bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',text: 'text-emerald-400' },
};

const VALID_BUG_TYPES = ['LINTING', 'SYNTAX', 'LOGIC', 'TYPE_ERROR', 'IMPORT', 'INDENTATION'];

function BugTypeBadge({ type }) {
  const normalized = type?.toUpperCase();
  const colors = BUG_TYPE_COLORS[normalized] || {
    bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-wider border ${colors.bg} ${colors.border} ${colors.text}`}>
      {normalized || type}
    </span>
  );
}

function StatusBadge({ status }) {
  const fixed = status?.toLowerCase() === 'fixed' || status === true;
  return fixed ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Fixed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
      Failed
    </span>
  );
}

export default function FixesTable({ fixes = [] }) {
  return (
    <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] overflow-hidden shadow-2xl shadow-black/50 fade-in-up">
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Fixes Applied</h3>
              <p className="text-xs text-slate-500">{fixes.length} changes processed</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {VALID_BUG_TYPES.slice(0, 3).map(t => (
              <BugTypeBadge key={t} type={t} />
            ))}
            <span className="text-xs text-slate-600 self-center">+3 more</span>
          </div>
        </div>

        {fixes.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No fixes recorded</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#1a1a2e]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0a0a15]">
                  {['File', 'Bug Type', 'Line', 'Commit Message', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-[#1a1a2e]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fixes.map((fix, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[#131325] hover:bg-[#0f0f20] transition-colors duration-150"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-300 bg-[#0a0a15] px-2 py-1 rounded">
                        {fix.file || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BugTypeBadge type={fix.bug_type} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">
                        {fix.line_number != null ? `L${fix.line_number}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {fix.commit_message || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={fix.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
