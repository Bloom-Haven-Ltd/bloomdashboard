/**
 * Platform health feature service (§13).
 * Endpoint contract: GET /health — public, unauthenticated (verified against
 * bloom-backend main.py). Returns measured truth only: API reachability,
 * database and Redis connectivity, backend version. No service is ever
 * reported "operational" without a real signal (§5/§13).
 */

import { apiGet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/error';

export interface PlatformHealth {
  /** API answered the health probe. */
  reachable: boolean;
  status: 'healthy' | 'unhealthy' | 'unknown';
  database: boolean | null;
  redis: boolean | null;
  version: string | null;
  /** When the probe was performed (client clock, display only). */
  checkedAt: string;
}

function parseHealth(raw: unknown): PlatformHealth {
  const checkedAt = new Date().toISOString();
  if (!raw || typeof raw !== 'object') {
    return { reachable: true, status: 'unknown', database: null, redis: null, version: null, checkedAt };
  }
  const obj = raw as Record<string, unknown>;
  const boolOr = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
  return {
    reachable: true,
    status: obj.status === 'healthy' || obj.status === 'unhealthy' ? obj.status : 'unknown',
    database: boolOr(obj.database),
    redis: boolOr(obj.redis),
    version: typeof obj.version === 'string' ? obj.version : null,
    checkedAt,
  };
}

/**
 * Probes platform health. Network failure itself is a health signal:
 * the API is unreachable → OUTAGE-equivalent, not a thrown error state.
 */
export async function fetchPlatformHealth(timeoutMs = 8000): Promise<PlatformHealth> {
  try {
    const data = await apiGet<unknown>('/health', { timeoutMs, skipAuthTeardown: true });
    return parseHealth(data);
  } catch (error) {
    const apiError = ApiError.from(error);
    const unreachable = apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT';
    if (!unreachable) {
      // Unexpected non-network failure — still treat as degraded signal.
    }
    return {
      reachable: false,
      status: 'unhealthy',
      database: null,
      redis: null,
      version: null,
      checkedAt: new Date().toISOString(),
    };
  }
}
