import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  fetchPlatformHealth,
  fetchAppConfig,
  fetchFeatureFlags,
  fetchAuditLogs,
  isSecurityRelevantAction,
  classifySecuritySeverity,
  toSecurityEvents,
} from '@/features/platform/service';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/api/client';
const mockedGet = vi.mocked(apiGet);

afterEach(() => {
  vi.clearAllMocks();
});

describe('platform health (§7/§8)', () => {
  it('parses the authoritative health payload', async () => {
    mockedGet.mockResolvedValueOnce({ status: 'healthy', version: '2.6.0', database: true, redis: true });
    const health = await fetchPlatformHealth();
    expect(mockedGet).toHaveBeenCalledWith('/health', expect.anything());
    expect(health.status).toBe('healthy');
    expect(health.database).toBe(true);
    expect(health.redis).toBe(true);
  });

  it('parses a degraded backend without inferring health client-side', async () => {
    mockedGet.mockResolvedValueOnce({ status: 'unhealthy', version: '2.6.0', database: false, redis: true });
    const health = await fetchPlatformHealth();
    expect(health.status).toBe('unhealthy');
    expect(health.database).toBe(false);
  });
});

describe('app config & feature flags (§42/§45/§33)', () => {
  it('parses remote app config including maintenance mode', async () => {
    mockedGet.mockResolvedValueOnce({
      minimum_supported_version: '2.4.0',
      latest_version: '2.6.0',
      force_update: false,
      maintenance_mode: true,
      maintenance_message: 'Scheduled maintenance',
      support_email: 'support@bloomhealth.com',
    });
    const config = await fetchAppConfig();
    expect(config.maintenance_mode).toBe(true);
    expect(config.latest_version).toBe('2.6.0');
  });

  it('parses feature flags as a boolean record (read-only, PS-8)', async () => {
    mockedGet.mockResolvedValueOnce({ flags: { telehealth_v2: true, new_pharmacy_flow: false } });
    const flags = await fetchFeatureFlags();
    expect(mockedGet).toHaveBeenCalledWith('/feature-flags?role=admin', expect.anything());
    expect(flags.flags.telehealth_v2).toBe(true);
    expect(flags.flags.new_pharmacy_flow).toBe(false);
  });
});

describe('security lens (§17/§18 — display classification only)', () => {
  it('classifies security-relevant actions', () => {
    expect(isSecurityRelevantAction('LOGIN_FAILED')).toBe(true);
    expect(isSecurityRelevantAction('ACCOUNT_SUSPENDED')).toBe(true);
    expect(isSecurityRelevantAction('VIEW_VERIFICATION')).toBe(false);
    expect(isSecurityRelevantAction('UPDATE_SETTING')).toBe(false);
  });

  it('ranks severity by action semantics (display-only)', () => {
    expect(classifySecuritySeverity('UNAUTHORIZED_ACCESS_ATTEMPT')).toBe('critical');
    expect(classifySecuritySeverity('LOGIN_FAILED')).toBe('high');
    expect(classifySecuritySeverity('PAYMENT_REJECTED')).toBe('medium');
    expect(classifySecuritySeverity('ADMIN_LOGIN')).toBe('low');
    expect(classifySecuritySeverity('SOMETHING_ELSE')).toBe('info');
  });

  it('filters and classifies an audit page into security events', () => {
    const logs = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: null,
        action: 'LOGIN_FAILED',
        target_type: null,
        target_id: null,
        old_value: null,
        new_value: null,
        ip_address: '10.0.0.1',
        created_at: '2026-09-25T09:00:00Z',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        user_id: '33333333-3333-4333-8333-333333333333',
        action: 'UPDATE_SETTING',
        target_type: 'SETTING',
        target_id: 'LAB_SUBSCRIPTION_FEE',
        old_value: { value: '500' },
        new_value: { value: '600' },
        ip_address: null,
        created_at: '2026-09-25T09:05:00Z',
      },
    ];
    const events = toSecurityEvents(logs);
    expect(events).toHaveLength(1);
    expect(events[0].severity).toBe('high');
    expect(events[0].log.ip_address).toBe('10.0.0.1');
  });
});

describe('audit feed (§11/§16 — no backend filters, PS-2)', () => {
  it('fetches the paginated audit feed', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          user_id: '33333333-3333-4333-8333-333333333333',
          action: 'UPDATE_SETTING',
          target_type: 'SETTING',
          target_id: 'PHARMACY_SUBSCRIPTION_FEE',
          old_value: { value: '500' },
          new_value: { value: '750' },
          ip_address: '10.0.0.2',
          created_at: '2026-09-25T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
    const result = await fetchAuditLogs(1, 50);
    expect(mockedGet).toHaveBeenCalledWith('/admin/audit-logs?page=1&page_size=50', expect.anything());
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].action).toBe('UPDATE_SETTING');
    expect(result.total).toBe(1);
  });
});
