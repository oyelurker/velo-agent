import { useState } from 'react';

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-4 border-indigo-500/20"
        />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-t-violet-400"
          style={{ animation: 'spin 1.2s linear infinite reverse' }}
        />
      </div>
      <div className="space-y-3 w-full max-w-md">
        <div className="skeleton h-4 w-3/4 mx-auto" />
        <div className="skeleton h-4 w-1/2 mx-auto" />
        <div className="skeleton h-4 w-2/3 mx-auto" />
      </div>
      <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase animate-pulse">
        Analyzing Repository…
      </p>
    </div>
  );
}

export default function InputForm({ onSubmit, loading }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [teamName, setTeamName] = useState('');
  const [leaderName, setLeaderName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ repo_url: repoUrl, team_name: teamName, leader_name: leaderName });
  };

  const inputClass =
    'w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-sm';

  const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] p-8 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Repository Analysis</h2>
            <p className="text-xs text-slate-500">Autonomous CI/CD healing pipeline</p>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>GitHub Repository URL</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
                </span>
                <input
                  type="url"
                  required
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className={inputClass + ' pl-10'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Team Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Alpha Squad"
                    className={inputClass + ' pl-10'}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Team Leader Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    required
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className={inputClass + ' pl-10'}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 relative group overflow-hidden rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 shadow-lg shadow-indigo-900/40 hover:shadow-indigo-600/30"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
                Analyze Repository
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
