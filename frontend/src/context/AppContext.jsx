import { createContext, useContext, useState, useRef } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [loading,      setLoading]      = useState(false);
  const [results,      setResults]      = useState(null);
  const [error,        setError]        = useState('');
  const [liveLog,      setLiveLog]      = useState([]);
  const [analyzingRepo,setAnalyzingRepo] = useState('');
  const liveLogRef = useRef([]);

  const reset = () => {
    setResults(null);
    setError('');
    setLiveLog([]);
    liveLogRef.current = [];
  };

  return (
    <AppContext.Provider value={{
      loading, setLoading,
      results, setResults,
      error,   setError,
      liveLog, setLiveLog,
      analyzingRepo, setAnalyzingRepo,
      liveLogRef,
      reset,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
