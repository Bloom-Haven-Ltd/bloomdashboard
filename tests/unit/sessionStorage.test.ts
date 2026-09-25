import { beforeEach, describe, expect, it } from 'vitest';
import { clearSessionId, readSessionId, writeSessionId, SESSION_HINT_COOKIE } from '@/lib/auth/sessionStorage';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

describe('session storage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`;
  });

  it('round-trips the session id under the namespaced key', () => {
    expect(readSessionId()).toBeNull();
    writeSessionId('abc-123');
    expect(readSessionId()).toBe('abc-123');
  });

  it('sets the PII-free hint cookie on write (middleware presence check)', () => {
    writeSessionId('abc-123');
    expect(getCookie(SESSION_HINT_COOKIE)).toBe('1');
  });

  it('clears both the session id and hint cookie atomically', () => {
    writeSessionId('abc-123');
    clearSessionId();
    expect(readSessionId()).toBeNull();
    expect(getCookie(SESSION_HINT_COOKIE)).toBeNull();
  });
});
