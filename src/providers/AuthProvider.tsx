'use client';

/**
 * Authentication + session provider.
 *
 * Security model:
 * - Identity and role ALWAYS come from backend session validation
 *   (`POST /auth/session` at login, `GET /users/me` on token refresh).
 *   localStorage holds a session-ID handle only — never an authority.
 * - Any 401 anywhere in the app triggers the single session-expired path:
 *   teardown → redirect to /login. Registered with the API client below.
 * - Client-side `isAdmin` is UX state; the backend re-authorizes every
 *   request (§9). The legacy client-side credential-migration fallback is
 *   intentionally not reproduced here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { FIREBASE_CONFIG_ERROR, isFirebaseConfigured } from '@/lib/config/env';
import {
  api,
  registerSessionExpiredHandler,
  registerSessionIdProvider,
  registerTokenProvider,
} from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';
import { sessionResponseSchema, type SessionResponseDto } from '@/lib/api/schemas';
import { clearSessionId, readSessionId, writeSessionId } from '@/lib/auth/sessionStorage';
import { createPermissionChecker, type CheckPermission } from '@/lib/permissions';
import type { UserBrief } from '@/types/api';

interface AuthState {
  /** Firebase identity or null when signed out. */
  firebaseUser: FirebaseUser | null;
  /** Backend-validated admin identity. */
  adminUser: UserBrief | null;
  /** Resolved admin role for the RBAC layer. */
  role: 'ADMIN' | null;
  /** Permission checker bound to the session role. */
  can: CheckPermission;
  /** True until the first auth resolution completes. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Client-side admin check for UI gating only — never authorization. */
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const USERS_ME_TIMEOUT_MS = 15_000;

/**
 * Validates the backend session for the current Firebase token.
 * Returns the admin identity when valid, otherwise null (signed out).
 */
async function validateBackendSession(): Promise<UserBrief | null> {
  const sessionId = readSessionId();
  if (!sessionId) return null;

  try {
    const data = await api.get<unknown>('/users/me', {
      headers: { 'X-Session-ID': sessionId },
      timeoutMs: USERS_ME_TIMEOUT_MS,
      skipAuthTeardown: true,
    });
    if (
      data &&
      typeof data === 'object' &&
      'role' in data &&
      (data as { role: unknown }).role === 'admin' &&
      'id' in data &&
      'email' in data
    ) {
      return data as UserBrief;
    }
    return null;
  } catch {
    // Invalid/expired session or transient failure → treat as signed out;
    // individual API requests fail closed regardless.
    return null;
  }
}

function parseSessionResponse(raw: unknown): SessionResponseDto {
  const result = sessionResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('VALIDATION_ERROR', 'Sign-in succeeded but the session response was invalid.');
  }
  return result.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [adminUser, setAdminUser] = useState<UserBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const isSigningInRef = useRef(false);

  const teardown = useCallback(() => {
    clearSessionId();
    setAdminUser(null);
    setFirebaseUser(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Wire the single 401 path: teardown + redirect (registered once).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    registerSessionIdProvider(readSessionId);
    registerTokenProvider(async () => {
      if (!auth?.currentUser) return null;
      try {
        return await auth.currentUser.getIdToken();
      } catch {
        return null;
      }
    });

    registerSessionExpiredHandler(() => {
      teardown();
      if (auth) {
        void firebaseSignOut(auth).catch(() => undefined);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?reason=session_expired');
      }
    });
  }, [teardown]);

  // ---------------------------------------------------------------------------
  // Token lifecycle → backend session validation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const firebaseAuth = auth;

    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      if (!fbUser) {
        teardown();
        setLoading(false);
        return;
      }

      setFirebaseUser(fbUser);

      if (isSigningInRef.current) {
        // The signIn flow establishes the session and sets state itself.
        setLoading(false);
        return;
      }

      try {
        const validated = await validateBackendSession();
        if (validated) {
          setAdminUser(validated);
        } else {
          // Session revoked/expired/missing, or not an admin → clean teardown.
          teardown();
          void firebaseSignOut(firebaseAuth).catch(() => undefined);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [teardown]);

  // ---------------------------------------------------------------------------
  // Sign in
  // ---------------------------------------------------------------------------
  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth || !isFirebaseConfigured()) throw new Error(FIREBASE_CONFIG_ERROR);

    isSigningInRef.current = true;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token = await credential.user.getIdToken();

      const raw = await api.post<unknown>(
        '/auth/session',
        { app_type: 'admin_dashboard', platform: 'web' },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeoutMs: 65_000,
          skipAuthTeardown: true,
        }
      );
      const session = parseSessionResponse(raw);

      if (session.user.role !== 'admin') {
        await firebaseSignOut(auth);
        throw new ApiError('FORBIDDEN', 'Web access is restricted to administrators.');
      }

      writeSessionId(session.session_id);
      setFirebaseUser(credential.user);
      setAdminUser(session.user);
    } finally {
      isSigningInRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    const sessionId = readSessionId();
    const token = auth?.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    if (sessionId && token) {
      await api
        .delete('/auth/session', {
          headers: { 'X-Session-ID': sessionId, Authorization: `Bearer ${token}` },
          skipAuthTeardown: true,
        })
        .catch(() => undefined);
    }
    teardown();
    if (auth) await firebaseSignOut(auth).catch(() => undefined);
  }, [teardown]);

  // Single admin role today; the checker is created from the role constant so
  // the day a second role exists this is the only line that changes.
  const can = useMemo<CheckPermission>(() => createPermissionChecker('ADMIN'), []);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      adminUser,
      role: adminUser ? 'ADMIN' : null,
      can: adminUser ? can : () => false,
      loading,
      signIn,
      logout,
      isAdmin: adminUser?.role === 'admin',
    }),
    [firebaseUser, adminUser, loading, signIn, logout, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

/** Convenience hook for permission UX. */
export function usePermissions(): { can: CheckPermission; isAdmin: boolean } {
  const { can, isAdmin } = useAuth();
  return { can, isAdmin };
}
