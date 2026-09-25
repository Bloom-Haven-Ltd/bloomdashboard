/**
 * Firebase **client SDK** — authentication only (§35).
 *
 * The dashboard is a pure client over the FastAPI backend. Firestore, Storage
 * and the Admin SDK are deliberately not initialized here: no database access
 * from the browser (§68), no service credentials in client code (§10).
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { env, isFirebaseConfigured } from '../config/env';

export { isFirebaseConfigured } from '../config/env';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured() && env.firebase) {
  try {
    const { storageBucket, messagingSenderId, measurementId, ...requiredConfig } = env.firebase;
    app = getApps().length > 0 ? getApp() : initializeApp({
      ...requiredConfig,
      ...(storageBucket ? { storageBucket } : {}),
      ...(messagingSenderId ? { messagingSenderId } : {}),
      ...(measurementId ? { measurementId } : {}),
    });
    auth = getAuth(app);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Firebase initialization failed:', err);
    }
    // Configuration errors surface through isFirebaseConfigured() checks at
    // the sign-in boundary rather than crashing the whole app.
    app = null;
    auth = null;
  }
}

export { app, auth };
