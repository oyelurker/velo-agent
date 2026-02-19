import { useState, useEffect } from 'react';

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-5 py-12">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 spin" />
        <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-violet-400 spin-rev" />
      </div>
      <div className="w-full space-y-2">
        <div className="skeleton h-3 w-3/4 mx-auto" />
        <div className="skeleton h-3 w-1/2 mx-auto" />
        <div className="skeleton h-3 w-2/3 mx-auto" />
      </div>
      <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase" style={{ animation: 'pulse 1.8s ease-in-out infinite' }}>
        Analyzing Repository…
      </p>
    </div>
  );
}

export default function InputForm({ onSubmit, loading, prefill }) {
  const [repoUrl, setRepoUrl]     = useState('');
  const [teamName, setTeamName]   = useState('');
  const [leaderName, setLeaderName] = useState('');

  useEffect(() => {
    if (prefill) {
      setRepoUrl(prefill.repo_url || '');
      setTeamName(prefill.team_name || '');
      setLeaderName(prefill.leader_name || '');
    }
  }, [prefill]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ repo_url: repoUrl, team_name: teamName, leader_name: leaderName });
  };

  const inputCls = 'w-full rounded-lg border border-[#2a2a4a] bg-[#0f0f1a] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-colors';
  const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="w-full rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] p-7 shadow-2xl shadow-black/60">
      <div className="flex items-center gap-3 mb-7">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
          <svg className="w-4.5 h-4.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:'18px',height:'18px'}}>
            <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Repository Analysis</h3>
          <p className="text-xs text-slate-500 mt-0.5">Autonomous CI/CD healing pipeline</p>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>GitHub Repository URL</label>
            <input
              type="url" required value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Team Name</label>
              <input
                type="text" required value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. RIFT ORGANISERS"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Team Leader Name</label>
              <input
                type="text" required value={leaderName}
                onChange={e => setLeaderName(e.target.value)}
                placeholder="e.g. Saiyam Kumar"
                className={inputCls}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full mt-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold tracking-wide transition-all duration-200 shadow-lg shadow-indigo-900/40 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Analyze Repository
          </button>
        </form>
      )}
    </div>
  );
}
