/**
 * Dashboard overview feature service.
 * Endpoint contract: GET /admin/stats, /admin/audit-logs,
 * /admin/analytics/performance (verified against bloom-backend admin router).
 */

import { apiGet } from '@/lib/api/client';
import {
  parseWith,
  systemStatsSchema,
  paginatedAuditLogsSchema,
  platformPerformanceSchema,
  type SystemStatsDto,
  type AuditLogDto,
  type PlatformPerformanceDto,
} from '@/lib/api/schemas';

export async function fetchSystemStats(signal?: AbortSignal): Promise<SystemStatsDto> {
  const data = await apiGet<unknown>('/admin/stats', { signal });
  return parseWith(systemStatsSchema, data);
}

export async function fetchRecentAuditLogs(limit = 5, signal?: AbortSignal): Promise<AuditLogDto[]> {
  const data = await apiGet<unknown>(`/admin/audit-logs?page=1&page_size=${limit}`, { signal });
  return parseWith(paginatedAuditLogsSchema, data).data;
}

export type PerformancePeriod = '24h' | '7d' | '30d';

export async function fetchPerformance(
  period: PerformancePeriod,
  signal?: AbortSignal
): Promise<PlatformPerformanceDto> {
  const data = await apiGet<unknown>(`/admin/analytics/performance?period=${period}`, { signal });
  return parseWith(platformPerformanceSchema, data);
}
