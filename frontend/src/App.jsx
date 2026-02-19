import { useState } from 'react';
import InputForm from './components/InputForm';
import RunSummaryCard from './components/RunSummaryCard';
import ScoreBreakdown from './components/ScoreBreakdown';
import FixesTable from './components/FixesTable';
import CICDTimeline from './components/CICDTimeline';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DEMO = {
  repo_url:    'https://github.com/demo-org/sample-python-app',
  team_name:   'VAKRATUND',
  leader_name: 'oyelurker',
};

function GHIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{width:'16px',height:'16px'}}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

function VeloLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-9 h-9">
        <div className="absolute inset-0 rounded-xl" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}} />
        <div className="absolute inset-0 flex items-center justify-center text-white font-black text-lg" style={{fontFamily:'Inter,sans-serif'}}>V</div>
      </div>
      <div>
        <span className="font-black text-lg tracking-tight" style={{background:'linear-gradient(to right,#818cf8,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Velo</span>
        <span className="font-light text-lg text-slate-400"> Agent</span>
      </div>
    </div>
  );
}

function PipelineDot({ label, color, delay }) {
  return (
    <div className="flex items-center gap-2.5" style={{animationDelay:`${delay}ms`}}>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:color}} />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

const PIPE_NODES = [
  { label: 'Clone Repo',     color: '#6366f1', delay: 0 },
  { label: 'Discover Tests', color: '#8b5cf6', delay: 100 },
  { label: 'Run & Detect',   color: '#a78bfa', delay: 200 },
  { label: 'LLM Solver',     color: '#22d3ee', delay: 300 },
  { label: 'Commit & Push',  color: '#34d399', delay: 400 },
  { label: 'Verify CI/CD',   color: '#4ade80', delay: 500 },
];

export default function App() {
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState(null);
  const [error, setError]       = useState('');
  const [prefill, setPrefill]   = useState(null);

  const handleSubmit = async ({ repo_url, team_name, leader_name }) => {
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url, team_name, leader_name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResults(data);
    } catch (e) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const tryDemo = () => {
    setPrefill(DEMO);
    setResults(null);
    setError('');
  };

  const reset = () => {
    setResults(null);
    setError('');
    setPrefill(null);
  };

  return (
    <div style={{background:'#0a0a0f',minHeight:'100vh',display:'flex',flexDirection:'column'}}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{borderBottom:'1px solid #1a1a2e',background:'rgba(10,10,15,0.85)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:50}}>
        <div style={{maxWidth:'1280px',margin:'0 auto',padding:'0 24px',display:'flex',alignItems:'center',height:'60px',gap:'16px'}}>
          <VeloLogo />
          <div style={{flex:1}} />
          <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 14px',borderRadius:'9999px',background:'#1a1a2e',border:'1px solid #2a2a4e'}}>
            <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#34d399',animation:'pulse 2s ease-in-out infinite',display:'block'}} />
            <span style={{fontSize:'11px',color:'#94a3b8',fontWeight:500}}>Hackathon Build</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'5px 14px',borderRadius:'9999px',background:'#1a1a2e',border:'1px solid #2a2a4e',color:'#64748b',fontSize:'12px',cursor:'not-allowed'}}>
            <GHIcon />
            <span>Login</span>
            <span style={{fontSize:'9px',background:'#6366f120',border:'1px solid #6366f130',color:'#818cf8',borderRadius:'4px',padding:'1px 5px',fontWeight:700,letterSpacing:'0.05em'}}>SOON</span>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main style={{flex:1,maxWidth:'1280px',width:'100%',margin:'0 auto',padding:'32px 24px'}}>

        {/* Landing / Input */}
        {!results && (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'48px'}} className="landing-grid">
            {/* Hero */}
            <div style={{display:'flex',flexDirection:'column',gap:'24px',maxWidth:'680px',margin:'0 auto',width:'100%',textAlign:'center'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'5px 16px',borderRadius:'9999px',background:'#1a1a2e',border:'1px solid #2a2a4e',width:'fit-content',margin:'0 auto',fontSize:'11px',color:'#94a3b8',letterSpacing:'0.05em',fontWeight:600,textTransform:'uppercase'}}>
                <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#6366f1',display:'block'}} />
                Autonomous CI/CD Agent
              </div>

              <div>
                <h1 style={{fontSize:'clamp(2rem,5vw,3.25rem)',fontWeight:900,lineHeight:1.15,color:'white',marginBottom:'16px'}}>
                  Heal Your Pipeline{' '}
                  <span style={{background:'linear-gradient(135deg,#818cf8,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Autonomously</span>
                </h1>
                <p style={{fontSize:'1rem',color:'#64748b',lineHeight:1.6,maxWidth:'520px',margin:'0 auto'}}>
                  Point Velo at any GitHub repository. It detects test failures, applies LLM-powered fixes, commits them, and monitors your CI/CD — all without human intervention.
                </p>
              </div>

              {/* Stats row */}
              <div style={{display:'flex',justifyContent:'center',gap:'32px',flexWrap:'wrap'}}>
                {[['Multi-Agent','LangGraph'],['Sandboxed','Docker'],['LLM-Powered','Gemini'],['Auto-Commit','Git']].map(([top,bot]) => (
                  <div key={top} style={{textAlign:'center'}}>
                    <div style={{fontSize:'13px',fontWeight:700,color:'white'}}>{top}</div>
                    <div style={{fontSize:'11px',color:'#475569',marginTop:'2px'}}>{bot}</div>
                  </div>
                ))}
              </div>

              {/* Pipeline mini-diagram */}
              <div style={{padding:'20px',borderRadius:'16px',background:'#0d0d1f',border:'1px solid #1a1a2e',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px'}}>
                {PIPE_NODES.map(n => <PipelineDot key={n.label} {...n} />)}
              </div>

              <button
                onClick={tryDemo}
                style={{alignSelf:'center',padding:'8px 24px',borderRadius:'12px',background:'#1a1a2e',border:'1px solid #2a2a4e',color:'#94a3b8',fontSize:'13px',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#4a4a7e'; e.currentTarget.style.color='#c4c4e4'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#2a2a4e'; e.currentTarget.style.color='#94a3b8'; }}
              >
                Try with Demo Repo →
              </button>
            </div>

            {/* Input form */}
            <div style={{maxWidth:'560px',width:'100%',margin:'0 auto'}}>
              <InputForm onSubmit={handleSubmit} loading={loading} prefill={prefill} />
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && !loading && (
          <div style={{borderRadius:'16px',background:'#1a0a0a',border:'1px solid #ef444430',padding:'20px 24px',display:'flex',alignItems:'flex-start',gap:'16px',marginBottom:'32px'}}>
            <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'#ef444415',border:'1px solid #ef444430',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'16px'}}>✕</div>
            <div style={{flex:1}}>
              <p style={{color:'#f87171',fontWeight:600,marginBottom:'4px'}}>Analysis Failed</p>
              <p style={{color:'#94a3b8',fontSize:'13px'}}>{error}</p>
              <button onClick={reset} style={{marginTop:'12px',padding:'6px 16px',borderRadius:'8px',background:'#ef444415',border:'1px solid #ef444430',color:'#f87171',fontSize:'12px',cursor:'pointer'}}>Try Again</button>
            </div>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div style={{display:'flex',flexDirection:'column',gap:'28px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
              <div>
                <h2 style={{color:'white',fontWeight:800,fontSize:'1.25rem'}}>Analysis Results</h2>
                <p style={{color:'#475569',fontSize:'13px',marginTop:'4px'}}>{results.repo_url}</p>
              </div>
              <button
                onClick={reset}
                style={{padding:'8px 20px',borderRadius:'12px',background:'#1a1a2e',border:'1px solid #2a2a4e',color:'#94a3b8',fontSize:'13px',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#4a4a7e'; e.currentTarget.style.color='#c4c4e4'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#2a2a4e'; e.currentTarget.style.color='#94a3b8'; }}
              >
                ← New Analysis
              </button>
            </div>

            <RunSummaryCard data={results} />

            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'28px'}} className="results-grid">
              <ScoreBreakdown data={results.score_breakdown} />
              <CICDTimeline runs={results.cicd_timeline || []} maxRetries={results.max_retries || 5} />
            </div>

            <FixesTable fixes={results.fixes_applied || []} />
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{borderTop:'1px solid #14142a',padding:'20px 24px',textAlign:'center'}}>
        <p style={{color:'#2a2a4e',fontSize:'12px'}}>
          Velo Agent · Built by <span style={{color:'#4a4a7e'}}>Vakratund</span> for RIFT 2026
        </p>
      </footer>

      {/* Responsive grid helpers via <style> to avoid Tailwind JIT issues */}
      <style>{`
        @media (min-width: 900px) {
          .landing-grid { grid-template-columns: 1fr 1fr !important; }
          .results-grid  { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
