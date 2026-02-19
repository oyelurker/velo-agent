import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, getRedirectResult } from 'firebase/auth';
import { signInWithRedirect, GithubAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

const GITHUB_TOKEN_KEY = 'velo_github_access_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [githubAccessToken, setGitHubAccessTokenState] = useState(() => {
    try {
      return sessionStorage.getItem(GITHUB_TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });

  const unsubRef = useRef(null);
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return () => {};
    }
    unsubRef.current = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setGitHubAccessTokenState(null);
        try {
          sessionStorage.removeItem(GITHUB_TOKEN_KEY);
        } catch (_) {}
      }
      setLoading(false);
    });
    getRedirectResult(auth)
      .then((result) => {
        if (!result) return;
        const credential = GithubAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken || null;
        if (token) {
          setGitHubAccessTokenState(token);
          try {
            sessionStorage.setItem(GITHUB_TOKEN_KEY, token);
          } catch (_) {}
        }
      })
      .catch(() => {});
    return () => {
      unsubRef.current?.();
    };
  }, []);

  const signInWithGitHub = useCallback(async () => {
    if (!auth) throw new Error('Firebase not configured');
    const provider = new GithubAuthProvider();
    provider.addScope('repo');
    await signInWithRedirect(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth || !user) return null;
    try {
      return await user.getIdToken(true);
    } catch {
      return null;
    }
  }, [user]);

  const value = {
    user,
    loading,
    getIdToken,
    githubAccessToken,
    signInWithGitHub,
    signOut,
    isFirebaseConfigured: !!auth,
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
