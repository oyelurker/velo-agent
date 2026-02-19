import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'velo-70e3c.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || 'velo-70e3c',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'velo-70e3c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

let app;
let auth;
let analytics;
try {
  if (firebaseConfig.apiKey && firebaseConfig.appId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    if (firebaseConfig.measurementId && typeof window !== 'undefined') {
      try {
        analytics = getAnalytics(app);
      } catch (_) {}
    }
  }
} catch (_) {
  // Config missing or invalid
}
export { auth, analytics };
export default app;
