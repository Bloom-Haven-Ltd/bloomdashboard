/**
 * Admin session storage.
 *
 * The backend session ID is a credential-adjacent value: it must be stored
 * under a single namespaced key and cleared atomically with logout. No other
 * auth state is persisted client-side; identity and permissions always come
 * from the backend session validation, never from storage.
 *
 * A separate, PII-free presence cookie (`bloom.admin.hint=1`) is maintained
 * so edge middleware can redirect signed-out visitors before hydration.
 * It grants nothing: the backend still validates every request.
 */

const SESSION_KEY = 'bloom.admin.session_id';
export const SESSION_HINT_COOKIE = 'bloom.admin.hint';

function setHintCookie(): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_HINT_COOKIE}=1; path=/; SameSite=Strict${secure}; max-age=${60 * 60 * 24 * 7}`;
}

function clearHintCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; SameSite=Strict; max-age=0`;
}

export function readSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_KEY, sessionId);
    setHintCookie();
  } catch {
    // Storage may be unavailable (private mode) — session simply won't persist.
  }
}

export function clearSessionId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage failures on teardown.
  }
  clearHintCookie();
}
