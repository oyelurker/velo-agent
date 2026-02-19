function CircularScore({ score, max = 120 }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(score, max));
  const progress = clampedScore / max;
  const dashOffset = circumference * (1 - progress);

  const getColor = (s) => {
    if (s >= 90) return '#10b981';
    if (s >= 70) return '#6366f1';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const color = getColor(clampedScore);

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" width="144" height="144">
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="#1a1a2e"
          strokeWidth="10"
        />
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s ease' }}
        />
      </svg>
      <div className="z-10 text-center">
        <div className="text-4xl font-black" style={{ color }}>{clampedScore}</div>
        <div className="text-xs text-slate-500 font-medium">/120</div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, color, icon }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1a1a2e] last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className={`text-sm font-bold font-mono ${color}`}>{value > 0 ? `+${value}` : value}</span>
    </div>
  );
}

export default function ScoreBreakdown({ data }) {
  const { execution_time, total_fixes, score_breakdown } = data;

  // Parse execution time to minutes (expects formats like "3m 42s" or "7.5 minutes")
  const parseMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const mMatch = timeStr.match(/(\d+\.?\d*)\s*m/i);
    const sMatch = timeStr.match(/(\d+\.?\d*)\s*s/i);
    let mins = mMatch ? parseFloat(mMatch[1]) : 0;
    let secs = sMatch ? parseFloat(sMatch[1]) : 0;
    if (!mMatch && !sMatch) {
      const numMatch = timeStr.match(/(\d+\.?\d*)/);
      mins = numMatch ? parseFloat(numMatch[1]) : 0;
    }
    return mins + secs / 60;
  };

  const mins = parseMinutes(execution_time);
  const commits = total_fixes ?? 0;

  // Use provided score_breakdown or calculate
  const base = score_breakdown?.base ?? 100;
  const speedBonus = score_breakdown?.speed_bonus ?? (mins < 5 ? 10 : 0);
  const efficiencyPenalty = score_breakdown?.efficiency_penalty ?? (commits > 20 ? -2 * (commits - 20) : 0);
  const finalScore = score_breakdown?.final_score ?? (base + speedBonus + efficiencyPenalty);

  const getScoreLabel = (s) => {
    if (s >= 100) return { label: 'EXCELLENT', color: 'text-emerald-400' };
    if (s >= 80) return { label: 'GOOD', color: 'text-indigo-400' };
    if (s >= 60) return { label: 'AVERAGE', color: 'text-amber-400' };
    return { label: 'POOR', color: 'text-red-400' };
  };

  const { label: scoreLabel, color: scoreColor } = getScoreLabel(finalScore);

  return (
    <div className="rounded-2xl border border-[#1e1e3a] bg-[#0d0d1f] overflow-hidden shadow-2xl shadow-black/50 fade-in-up">
      <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Score Breakdown</h3>
            <p className="text-xs text-slate-500">Performance evaluation</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Circular chart */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <CircularScore score={finalScore} max={120} />
            <div className={`text-xs font-bold tracking-[0.2em] uppercase ${scoreColor}`}>
              {scoreLabel}
            </div>
          </div>

          {/* Breakdown rows */}
          <div className="flex-1 w-full">
            <div className="bg-[#0a0a15] rounded-xl border border-[#1a1a2e] px-4 py-1">
              <ScoreRow label="Base Score" value={base} color="text-slate-300" icon="📊" />
              <ScoreRow
                label={`Speed Bonus ${mins < 5 ? '(< 5 min)' : '(≥ 5 min)'}`}
                value={speedBonus}
                color={speedBonus > 0 ? 'text-emerald-400' : 'text-slate-500'}
                icon="⚡"
              />
              <ScoreRow
                label={`Efficiency Penalty (${commits} commits)`}
                value={efficiencyPenalty}
                color={efficiencyPenalty < 0 ? 'text-red-400' : 'text-slate-500'}
                icon="📉"
              />
            </div>

            {/* Total */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-600/10 to-violet-600/10 border border-indigo-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Final Total Score</span>
                <span className={`text-4xl font-black ${getScoreLabel(finalScore).color}`}>{finalScore}</span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2.5 rounded-full bg-[#1a1a2e] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.max(0, Math.min(100, (finalScore / 120) * 100))}%`,
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-600">0</span>
                <span className="text-xs text-slate-600">120</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
