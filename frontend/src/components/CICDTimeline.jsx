function TimelineNode({ run, index, total, isLast }) {
  const passed = run.status?.toUpperCase() === 'PASSED' || run.status === true;

  return (
    <div className="relative flex gap-5">
      {/* Spine line */}
      {!isLast && (
        <div className="absolute left-5 top-10 w-0.5 bg-gradient-to-b from-[#2a2a4a] to-transparent"
          style={{ height: 'calc(100% + 8px)' }} />
      )}

      {/* Node icon */}
      <div className="flex-shrink-0 z-10">
        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all
          ${passed
            ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-900/30'
            : 'bg-red-500/10 border-red-500 shadow-lg shadow-red-900/30'
          }`}>
          {passed ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>

      {/* Content card */}
      <div className={`flex-1 mb-6 rounded-xl border p-4 transition-all hover:translate-x-1 duration-200
        ${passed
          ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
          : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
        }`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-3">
            {/* Attempt badge */}
            <span className="text-xs font-bold text-slate-400 bg-[#1a1a2e] px-2.5 py-1 rounded-full border border-[#2a2a4a]">
              Attempt {index + 1}/{total}
            </span>
            {/* Pass/fail badge */}
            <span className={`text-xs font-bold tracking-wider px-2.5 py-1 rounded-full
              ${passed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
              {passed ? '✓ PASS' : '✗ FAIL'}
            </span>
          </div>
          {/* Timestamp */}
          <span className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {run.timestamp || `T+${index * 47}s`}
          </span>
        </div>

        {/* Details */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1">
          {run.message && (
            <p className="text-xs text-slate-400 leading-relaxed">{run.message}</p>
          )}
          {run.duration && (
            <span className="text-xs text-slate-600">
              Duration: <span className="text-slate-400 font-medium">{run.duration}</span>
            </span>
          )}
          {run.fixes_in_run != null && (
            <span className="text-xs text-slate-600">
              Fixes: <span className="text-emerald-400 font-medium">{run.fixes_in_run}</span>
            </span>
          )}
          {run.failures_in_run != null && (
            <span className="text-xs text-slate-600">
              Failures: <span className="text-red-400 font-medium">{run.failures_in_run}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CICDTimeline({ runs = [] }) {
  return (
    <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] overflow-hidden shadow-2xl shadow-black/50 fade-in-up">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">CI/CD Status Timeline</h3>
            <p className="text-xs text-slate-500">{runs.length} iteration{runs.length !== 1 ? 's' : ''} recorded</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />Pass
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-red-500" />Fail
            </span>
          </div>
        </div>

        {runs.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-sm">No pipeline runs recorded</p>
          </div>
        ) : (
          <div className="relative pl-0">
            {runs.map((run, idx) => (
              <TimelineNode
                key={idx}
                run={run}
                index={idx}
                total={runs.length}
                isLast={idx === runs.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
