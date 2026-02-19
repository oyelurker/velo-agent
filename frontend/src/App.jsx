import { useState } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error,   setError]   = useState('');

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

  const handleReset = () => {
    setResults(null);
    setError('');
  };

  if (results && !loading) {
    return <Dashboard data={results} onReset={handleReset} />;
  }

  return (
    <>
      <LandingPage onSubmit={handleSubmit} loading={loading} />
      {error && !loading && (
        <div style={{
          position: 'fixed', bottom: 24, left: 24, right: 24, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--error-border)',
          borderRadius: 10, padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxWidth: 520, margin: '0 auto',
        }}>
          <svg width="18" height="18" fill="none" stroke="var(--error)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--error)', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Analysis Failed</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{error}</p>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
