/**
 * Normalized API error model (§12 contract).
 *
 * Every failure surfaced to the dashboard is an `ApiError` carrying a stable
 * machine code, a human-safe message, and an optional request ID for support
 * and log correlation. Raw stack traces and backend internals never reach
 * the UI.
 */

/** Standardized error codes. Keep in sync with docs/api/api-client.md. */
export type ApiErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_FAILED'
  | 'INVALID_STATE_TRANSITION'
  | 'RESOURCE_LOCKED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN';

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  423: 'RESOURCE_LOCKED',
  429: 'RATE_LIMITED',
};

/** Human-safe default copy per code (admin-facing, no internals). */
const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  AUTHENTICATION_REQUIRED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested record was not found.',
  VALIDATION_ERROR: 'The request was not valid. Review the input and try again.',
  CONFLICT: 'This record was changed by someone else. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  PAYMENT_FAILED: 'The payment operation failed.',
  INVALID_STATE_TRANSITION: 'This action is not allowed for the current state of the record.',
  RESOURCE_LOCKED: 'This record is locked by another process.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  NETWORK_ERROR: 'Network error. Check your connection and try again.',
  TIMEOUT: 'The request timed out. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && value in DEFAULT_MESSAGES;
}

/** Machine-readable code from a backend status + body code, never internals. */
export function codeFromStatus(status: number, bodyCode?: string): ApiErrorCode {
  if (bodyCode && isApiErrorCode(bodyCode)) return bodyCode;
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN');
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message?: string,
    options?: { status?: number; requestId?: string; details?: unknown; cause?: unknown }
  ) {
    super(message ?? DEFAULT_MESSAGES[code], { cause: options?.cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = options?.status;
    this.requestId = options?.requestId;
    this.details = options?.details;
  }

  /** True when the session is no longer usable and re-auth is required. */
  get isAuthFailure(): boolean {
    return this.code === 'AUTHENTICATION_REQUIRED' || this.code === 'SESSION_EXPIRED';
  }

  /** Safe payload for user-facing display. */
  toDisplay(): { code: ApiErrorCode; message: string; requestId?: string } {
    return { code: this.code, message: this.message, requestId: this.requestId };
  }

  static from(cause: unknown): ApiError {
    if (cause instanceof ApiError) return cause;
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      return new ApiError('TIMEOUT', undefined, { cause });
    }
    if (cause instanceof TypeError) {
      return new ApiError('NETWORK_ERROR', undefined, { cause });
    }
    return new ApiError('UNKNOWN', undefined, { cause });
  }
}
