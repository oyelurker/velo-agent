export default function RunSummaryCard({ data }) {
  const {
    repo_url,
    team_name,
    leader_name,
    branch_name,
    total_failures,
    total_fixes,
    ci_status,
    execution_time,
  } = data;

  const passed = ci_status?.toUpperCase() === 'PASSED';

  const StatItem = ({ label, value, accent }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${accent || 'text-white'}`}>{value}</span>
    </div>
  );

  const InfoRow = ({ icon, label, value }) => (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a] flex items-center justify-center mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-200 font-medium truncate mt-0.5">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] overflow-hidden shadow-2xl shadow-black/50 fade-in-up">
      {/* Top accent bar */}
      <div className={`h-1 w-full ${passed ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-600'}`} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Run Summary</h3>
              <p className="text-xs text-slate-500">Analysis complete</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-bold text-sm tracking-wider uppercase
            ${passed
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-900/20'
              : 'bg-red-500/10 border-red-500/40 text-red-400 shadow-lg shadow-red-900/20'
            }`}>
            <span className={`w-2 h-2 rounded-full ${passed ? 'bg-emerald-400' : 'bg-red-400'}`}
              style={{ animation: 'pulse 2s ease-in-out infinite' }} />
            {passed ? '✓ PASSED' : '✗ FAILED'}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e]">
          <InfoRow
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>}
            label="Repository"
            value={repo_url}
          />
          <InfoRow
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>}
            label="Team"
            value={team_name}
          />
          <InfoRow
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>}
            label="Team Leader"
            value={leader_name}
          />
          <InfoRow
            icon={<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414A1 1 0 0120 8.414V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>}
            label="Branch"
            value={<span className="font-mono text-indigo-400 text-xs bg-indigo-500/10 px-2 py-0.5 rounded">{branch_name}</span>}
          />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e] text-center">
            <StatItem label="Failures" value={total_failures ?? 0} accent="text-red-400" />
          </div>
          <div className="p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e] text-center">
            <StatItem label="Fixes Applied" value={total_fixes ?? 0} accent="text-emerald-400" />
          </div>
          <div className="p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e] text-center">
            <StatItem label="Exec Time" value={execution_time ?? 'N/A'} accent="text-indigo-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
