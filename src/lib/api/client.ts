/**
 * Centralized API client — the single fetch boundary of the dashboard.
 *
 * Responsibilities:
 * - Base URL from `lib/config/env` (never a hardcoded localhost).
 * - Firebase token + backend session ID injection.
 * - `X-Request-ID` correlation on every request.
 * - Timeouts via AbortSignal, combined with caller cancellation.
 * - Error normalization to `ApiError` with standardized codes.
 * - Single 401 path: session teardown + registered handler (→ login).
 * - No auto-retry of mutations. GET requests may retry once on network errors.
 *
 * Security notes:
 * - Never logs tokens, session IDs, payloads or URLs containing PHI.
 * - No credentials-mode usage: authentication is bearer-token based.
 * - Sensitive responses are never cached by the browser (`no-store`).
 */

import { ApiError, codeFromStatus } from './error';
import { env } from '../config/env';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Abort signal from the caller (e.g. TanStack Query cancellation). */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Internal: skip auth teardown (used by the auth flows themselves). */
  skipAuthTeardown?: boolean;
}

/** External modules register here to react to session loss (router redirect). */
export type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let tokenProvider: () => Promise<string | null> = async () => null;
let sessionIdProvider: () => string | null = () => null;

export function registerSessionExpiredHandler(handler: SessionExpiredHandler): void {
  sessionExpiredHandler = handler;
}

export function registerTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

export function registerSessionIdProvider(provider: () => string | null): void {
  sessionIdProvider = provider;
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ParsedErrorBody {
  code?: string;
  detail?: string;
  message?: string;
  requestId?: string;
}

function parseErrorBody(raw: string): ParsedErrorBody | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const detail = obj.detail;
      return {
        code: typeof obj.code === 'string' ? obj.code : undefined,
        detail:
          typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
              ? 'The request contained invalid values.'
              : undefined,
        message: typeof obj.message === 'string' ? obj.message : undefined,
        requestId: typeof obj.request_id === 'string' ? obj.request_id : undefined,
      };
    }
  } catch {
    // Non-JSON error body — fall through to generic handling.
  }
  return null;
}

function buildHeaders(
  method: string,
  token: string | null,
  sessionId: string | null,
  requestId: string,
  extra?: Record<string, string>
): Headers {
  const headers = new Headers(extra);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (sessionId) headers.set('X-Session-ID', sessionId);
  headers.set('X-Request-ID', requestId);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

/** Thin normalized response: `null` for 204/empty bodies. */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const requestId = newRequestId();

  if (!endpoint.startsWith('/')) {
    throw new ApiError('UNKNOWN', 'API endpoints must be root-relative paths.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Request timeout', 'AbortError')),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  // Combine caller cancellation with our timeout.
  const onCallerAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const [token, sessionId] = await Promise.all([tokenProvider(), Promise.resolve(sessionIdProvider())]);
    const response = await fetch(`${env.apiBaseUrl}${endpoint}`, {
      method,
      headers: buildHeaders(method, token, sessionId, requestId, options.headers),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError('VALIDATION_ERROR', 'The server returned an unreadable response.', {
          status: response.status,
          requestId,
        });
      }
    }

    const body = parseErrorBody(await response.text());
    const code = codeFromStatus(response.status, body?.code);

    // 401 → session is no longer usable. Tear down and notify once.
    if (response.status === 401 && !options.skipAuthTeardown) {
      const error = new ApiError('SESSION_EXPIRED', undefined, {
        status: 401,
        requestId: body?.requestId ?? requestId,
      });
      sessionExpiredHandler?.();
      throw error;
    }

    // Prefer the backend's own human detail, else our safe copy.
    const message =
      body?.detail ??
      body?.message ??
      undefined;

    throw new ApiError(code, message, {
      status: response.status,
      requestId: body?.requestId ?? requestId,
    });
  } catch (cause) {
    throw ApiError.from(cause);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Single-flight GET with one transparent retry on transient network failures.
 * Mutations are never retried automatically (§11).
 */
export async function apiGet<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await request<T>(endpoint, { ...options, method: 'GET' });
  } catch (error) {
    const apiError = ApiError.from(error);
    const transient =
      apiError.code === 'NETWORK_ERROR' ||
      apiError.code === 'TIMEOUT' ||
      apiError.code === 'SERVICE_UNAVAILABLE';
    if (transient) {
      return request<T>(endpoint, { ...options, method: 'GET' });
    }
    throw apiError;
  }
}

export function apiPost<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, { ...options, method: 'POST', body });
}

export function apiPatch<T>(endpoint: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, { ...options, method: 'PATCH', body });
}

export function apiDelete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(endpoint, { ...options, method: 'DELETE' });
}

export const api = { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete };
