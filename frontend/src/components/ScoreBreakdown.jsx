import { useEffect, useRef, useState } from 'react';

const ROWS = [
  { label: 'Base Score',         key: 'base_score',         icon: '⬡', color: '#6366f1' },
  { label: 'Speed Bonus',        key: 'speed_bonus',        icon: '⚡', color: '#a78bfa', sign: '+' },
  { label: 'Efficiency Penalty', key: 'efficiency_penalty', icon: '−', color: '#f87171', sign: '-' },
];

function Ring({ score, max = 200 }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  const pct = Math.min(Math.max(score, 0), max) / max;
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - pct)), 250);
    return () => clearTimeout(t);
  }, [pct, circ]);

  const hue = 120 * pct;
  const scoreColor = `hsl(${hue}, 70%, 65%)`;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <defs>
        <linearGradient id="ring-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={r} fill="none" stroke="#1a1a2e" strokeWidth="14" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke="url(#ring-g)" strokeWidth="14"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1)', transformOrigin: '70px 70px', transform: 'rotate(-90deg)' }}
      />
      <text x="70" y="64" textAnchor="middle" fill={scoreColor} fontSize="28" fontWeight="800" fontFamily="Inter,sans-serif">{score}</text>
      <text x="70" y="82" textAnchor="middle" fill="#475569" fontSize="11" fontFamily="Inter,sans-serif">/ {max} pts</text>
    </svg>
  );
}

function ScoreRow({ label, value, icon, color, sign }) {
  const [w, setW] = useState('0%');
  useEffect(() => {
    const t = setTimeout(() => setW(`${Math.min(100, Math.abs(value ?? 0))}%`), 400);
    return () => clearTimeout(t);
  }, [value]);

  const display = sign === '-' ? `-${Math.abs(value ?? 0)}` : sign === '+' ? `+${value ?? 0}` : `${value ?? 0}`;

  return (
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{ background: color + '18', border: `1px solid ${color}30`, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-400">{label}</span>
          <span className="font-mono font-bold" style={{ color }}>{display}</span>
        </div>
        <div className="h-2 rounded-full bg-[#0a0a15] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: w, background: color }} />
        </div>
      </div>
    </div>
  );
}

export default function ScoreBreakdown({ data }) {
  const score = data?.final_score ?? 0;

  let grade = 'F', gradeColor = '#f87171';
  if (score >= 180) { grade = 'S'; gradeColor = '#f59e0b'; }
  else if (score >= 150) { grade = 'A'; gradeColor = '#6366f1'; }
  else if (score >= 120) { grade = 'B'; gradeColor = '#8b5cf6'; }
  else if (score >= 90)  { grade = 'C'; gradeColor = '#3b82f6'; }
  else if (score >= 60)  { grade = 'D'; gradeColor = '#f97316'; }

  return (
    <div className="fade-in-2 rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] p-6 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
          <svg style={{width:'16px',height:'16px',color:'#a78bfa'}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Score Breakdown</h3>
          <p className="text-xs text-slate-500 mt-0.5">Performance metrics</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 p-4 rounded-xl bg-[#0a0a15] border border-[#1a1a2e]">
        <Ring score={score} />
        <div className="flex flex-col items-center sm:items-start gap-1">
          <span className="text-4xl font-black" style={{ color: gradeColor }}>{grade}</span>
          <span className="text-xs text-slate-500 uppercase tracking-widest">Grade</span>
          <span className="text-2xl font-black text-white mt-1">{score} <span className="text-sm text-slate-500 font-normal">pts</span></span>
        </div>
      </div>

      <div className="space-y-4">
        {ROWS.map(r => (
          <ScoreRow key={r.key} label={r.label} value={data?.[r.key] ?? 0} icon={r.icon} color={r.color} sign={r.sign} />
        ))}
      </div>
    </div>
  );
}
