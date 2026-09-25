import { describe, expect, it } from 'vitest';
import { ApiError, codeFromStatus, isApiErrorCode } from '@/lib/api/error';

describe('codeFromStatus', () => {
  it('maps HTTP statuses to stable codes', () => {
    expect(codeFromStatus(401)).toBe('AUTHENTICATION_REQUIRED');
    expect(codeFromStatus(403)).toBe('FORBIDDEN');
    expect(codeFromStatus(404)).toBe('NOT_FOUND');
    expect(codeFromStatus(409)).toBe('CONFLICT');
    expect(codeFromStatus(429)).toBe('RATE_LIMITED');
    expect(codeFromStatus(500)).toBe('INTERNAL_ERROR');
    expect(codeFromStatus(503)).toBe('INTERNAL_ERROR');
  });

  it('prefers an explicit backend code when recognized', () => {
    expect(codeFromStatus(409, 'INVALID_STATE_TRANSITION')).toBe('INVALID_STATE_TRANSITION');
    expect(codeFromStatus(422, 'PAYMENT_FAILED')).toBe('PAYMENT_FAILED');
  });

  it('ignores unrecognized backend codes', () => {
    expect(codeFromStatus(400, 'SOME_VENDOR_CODE')).toBe('VALIDATION_ERROR');
  });
});

describe('ApiError', () => {
  it('uses safe default copy per code', () => {
    const error = new ApiError('FORBIDDEN');
    expect(error.message).not.toMatch(/stack|trace|internal/i);
    expect(error.toDisplay()).toEqual({
      code: 'FORBIDDEN',
      message: expect.any(String),
    });
  });

  it('flags auth failures for session handling', () => {
    expect(new ApiError('SESSION_EXPIRED').isAuthFailure).toBe(true);
    expect(new ApiError('AUTHENTICATION_REQUIRED').isAuthFailure).toBe(true);
    expect(new ApiError('FORBIDDEN').isAuthFailure).toBe(false);
  });

  it('normalizes DOM AbortError to TIMEOUT', () => {
    const abort = new DOMException('Request timeout', 'AbortError');
    const normalized = ApiError.from(abort);
    expect(normalized.code).toBe('TIMEOUT');
  });

  it('normalizes network TypeErrors', () => {
    const normalized = ApiError.from(new TypeError('fetch failed'));
    expect(normalized.code).toBe('NETWORK_ERROR');
  });

  it('wraps unknown causes without leaking them', () => {
    const normalized = ApiError.from({ weird: 'object' });
    expect(normalized.code).toBe('UNKNOWN');
    expect(typeof normalized.message).toBe('string');
    expect(normalized.message.length).toBeGreaterThan(0);
  });

  it('validates the code guard', () => {
    expect(isApiErrorCode('FORBIDDEN')).toBe(true);
    expect(isApiErrorCode('NOT_A_CODE')).toBe(false);
  });
});
