'use client';

import { useApiQuery } from '@/hooks/useApiQuery';
import { fetchSystemStats, fetchRecentAuditLogs, fetchPerformance, type PerformancePeriod } from './service';

export const dashboardKeys = {
  stats: ['admin', 'stats'] as const,
  recentAudit: (limit: number) => ['admin', 'audit-logs', 'recent', limit] as const,
  performance: (period: PerformancePeriod) => ['admin', 'analytics', 'performance', period] as const,
};

export function useSystemStats() {
  return useApiQuery(dashboardKeys.stats, (signal) => fetchSystemStats(signal), {
    // Operational overview: modest staleness window; manual refresh available.
    staleTime: 30_000,
  });
}

export function useRecentAuditLogs(limit = 5) {
  return useApiQuery(dashboardKeys.recentAudit(limit), (signal) => fetchRecentAuditLogs(limit, signal));
}

export function usePerformance(period: PerformancePeriod) {
  return useApiQuery(dashboardKeys.performance(period), (signal) => fetchPerformance(period, signal));
}
