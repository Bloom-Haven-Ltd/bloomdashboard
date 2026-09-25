/**
 * Centralized, typed environment configuration.
 *
 * Rules:
 * - Every `process.env` read in the application lives here, exactly once.
 * - Only values that are safe to ship to the browser may live in NEXT_PUBLIC_*.
 * - No secrets are permitted in this application: the dashboard is a pure
 *   client over the FastAPI backend. Service-account credentials and provider
 *   secret keys belong server-side only.
 * - Configuration problems must be visible at the point of use (fail loud),
 *   never silently papered over with hardcoded fallbacks.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string | null;
  messagingSenderId: string | null;
  appId: string;
  measurementId: string | null;
}

function cleanEnv(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Loads the Firebase **web** config (client SDK, authentication only).
 * Returns null when any required key is missing so callers can render an
 * explicit configuration error instead of crashing at import time.
 *
 * NOTE: Next.js only inlines NEXT_PUBLIC_* variables into the browser bundle
 * when they are accessed statically as `process.env.NEXT_PUBLIC_*`. Dynamic
 * property indexing like `process.env[key]` is never inlined by Turbopack/Webpack.
 */
function loadFirebaseConfig(): FirebaseWebConfig | null {
  const apiKey = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const authDomain = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const projectId = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const appId = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ?? null,
    messagingSenderId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ?? null,
    appId,
    measurementId: cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) ?? null,
  };
}

const firebaseConfig = loadFirebaseConfig();

export const env = {
  /**
   * Base URL of the FastAPI backend. Defaults to the same-origin `/api/v1`
   * path, which the Next.js rewrite proxies (dev) or the platform edge
   * proxies (production). Never falls back to a hardcoded localhost.
   */
  apiBaseUrl: cleanEnv(process.env.NEXT_PUBLIC_API_URL) ?? '/api/v1',

  isProduction: process.env.NODE_ENV === 'production',

  appVersion: cleanEnv(process.env['NEXT_PUBLIC_APP_VERSION']) ?? 'dev',

  /** Firebase web SDK config, or null when not configured. */
  firebase: firebaseConfig,
} as const;

/** True when Firebase authentication is usable in this environment. */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig !== null;
}

/** Error message shown when an admin attempts to sign in without config. */
export const FIREBASE_CONFIG_ERROR =
  'Authentication is not configured on this deployment. ' +
  'Set NEXT_PUBLIC_FIREBASE_* variables (see .env.example) and redeploy.';
