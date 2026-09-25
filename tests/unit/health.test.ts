import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchPlatformHealth, type PlatformHealth } from '@/features/health/service';
import { HEALTH_STATE_CONFIG, HEALTH_SERVICES } from '@/constants/health';

// The health service reaches the API client; stub the module.
vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/api/client';
const mockedApiGet = vi.mocked(apiGet);

afterEach(() => {
  vi.clearAllMocks();
});

describe('fetchPlatformHealth (§13)', () => {
  it('parses the verified /health contract', async () => {
    mockedApiGet.mockResolvedValueOnce({
      status: 'healthy',
      version: '1.4.2',
      database: true,
      redis: true,
    });

    const health = await fetchPlatformHealth();
    expect(health.reachable).toBe(true);
    expect(health.status).toBe('healthy');
    expect(health.database).toBe(true);
    expect(health.redis).toBe(true);
    expect(health.version).toBe('1.4.2');
    expect(health.checkedAt).toBeTruthy();
  });

  it('coerces missing fields to unknown rather than assuming health', async () => {
    mockedApiGet.mockResolvedValueOnce({ status: 'weird' });
    const health = await fetchPlatformHealth();
    expect(health.status).toBe('unknown');
    expect(health.database).toBeNull();
    expect(health.redis).toBeNull();
  });

  it('treats network failure as an OUTAGE-equivalent signal, not a throw (§13)', async () => {
    const { ApiError } = await import('@/lib/api/error');
    mockedApiGet.mockRejectedValueOnce(new ApiError('NETWORK_ERROR'));
    const health = await fetchPlatformHealth();
    expect(health.reachable).toBe(false);
    expect(health.status).toBe('unhealthy');
  });
});

describe('health model (§14)', () => {
  it('defines all five canonical states', () => {
    for (const state of ['OPERATIONAL', 'DEGRADED', 'PARTIAL_OUTAGE', 'OUTAGE', 'UNKNOWN'] as const) {
      expect(HEALTH_STATE_CONFIG[state]).toBeTruthy();
      expect(HEALTH_STATE_CONFIG[state].label).toBeTruthy();
      expect(HEALTH_STATE_CONFIG[state].meaning).toBeTruthy();
    }
  });

  it('exposes only measurable services (§13 — no fabricated rows)', () => {
    expect(HEALTH_SERVICES.map((service) => service.key)).toEqual(['api', 'database', 'redis']);
  });
});
