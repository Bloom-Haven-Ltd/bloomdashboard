/**
 * Platform feature service (Phase 10) — the dashboard observes and controls
 * the platform without becoming it. All contracts verified against the
 * backend in docs/admin/platform-audit.md:
 *
 *  - GET /health            → public DB+Redis health (PS-1: no per-integration
 *                             checks exist; never inferred client-side)
 *  - GET /app/config        → remote app config (maintenance mode etc.)
 *  - GET /feature-flags     → backend-owned booleans (read-only, PS-8)
 *  - GET /admin/audit-logs  → audit feed (PS-2: no filters, no single read)
 *
 * Deliberately absent: any mutation of audit records (§15), any security-event
 * mutation (PS-5: no model exists), any client-side health inference (§7).
 */

import { apiGet } from '@/lib/api/client';
import { z } from 'zod';
import {
  parseWith,
  paginatedAuditLogsSchema,
  platformHealthSchema,
  appConfigSchema,
  featureFlagsSchema,
  type PlatformHealthDto,
  type AppConfigDto,
  type FeatureFlagsDto,
  type AuditLogDto,
} from '@/lib/api/schemas';

/** GET /health — public endpoint, no auth. DB + Redis only. */
export async function fetchPlatformHealth(signal?: AbortSignal): Promise<PlatformHealthDto> {
  const data = await apiGet<unknown>('/health', { signal });
  return parseWith(platformHealthSchema, data);
}

/** GET /app/config — public remote configuration. */
export async function fetchAppConfig(signal?: AbortSignal): Promise<AppConfigDto> {
  const data = await apiGet<unknown>('/app/config', { signal });
  return parseWith(appConfigSchema, data);
}

/** GET /feature-flags?role=admin — backend-owned flags; read-only (PS-8). */
export async function fetchFeatureFlags(signal?: AbortSignal): Promise<FeatureFlagsDto> {
  const data = await apiGet<unknown>('/feature-flags?role=admin', { signal });
  return parseWith(featureFlagsSchema, data);
}

export interface AuditFeedResult {
  logs: AuditLogDto[];
  total: number;
  totalPages: number;
  page: number;
}

/** GET /admin/audit-logs — paginated feed; backend supports no filters (PS-2). */
export async function fetchAuditLogs(
  page = 1,
  pageSize = 50,
  signal?: AbortSignal
): Promise<AuditFeedResult> {
  const query = new URLSearchParams({ page: String(page), page_size: String(Math.min(pageSize, 200)) });
  const data = await apiGet<unknown>(`/admin/audit-logs?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedAuditLogsSchema, data);
  return { logs: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

// ---------------------------------------------------------------------------
// Security-events lens (PS-5): no backend security-event model exists. The
// dashboard filters the audit feed client-side over security-relevant actions.
// Severity is a DISPLAY classification, never backend truth (§18).
// ---------------------------------------------------------------------------

const SECURITY_ACTION_PATTERNS = [
  'FAILED',
  'DENIED',
  'REJECT',
  'SUSPEND',
  'BAN',
  'LOCK',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'LOGIN',
  'LOGOUT',
  'SESSION',
];

/** True when an audit action looks security-relevant (display heuristic only). */
export function isSecurityRelevantAction(action: string): boolean {
  const upper = action.toUpperCase();
  return SECURITY_ACTION_PATTERNS.some((p) => upper.includes(p));
}

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Display-only severity classification from the action name (§18). */
export function classifySecuritySeverity(action: string): SecuritySeverity {
  const upper = action.toUpperCase();
  if (upper.includes('BAN') || upper.includes('UNAUTHORIZED') || upper.includes('FORBIDDEN')) return 'critical';
  if (upper.includes('FAILED') || upper.includes('DENIED') || upper.includes('SUSPEND')) return 'high';
  if (upper.includes('REJECT') || upper.includes('LOCK')) return 'medium';
  if (upper.includes('LOGIN') || upper.includes('LOGOUT') || upper.includes('SESSION')) return 'low';
  return 'info';
}

export interface SecurityEvent {
  log: AuditLogDto;
  severity: SecuritySeverity;
}

/** Filter + classify an audit page into the security-events lens. */
export function toSecurityEvents(logs: AuditLogDto[]): SecurityEvent[] {
  return logs.filter((log) => isSecurityRelevantAction(log.action)).map((log) => ({
    log,
    severity: classifySecuritySeverity(log.action),
  }));
}

const securityLensSchema = z.object({ logs: z.array(z.custom<AuditLogDto>()) });
export const __securityLensSchema = securityLensSchema; // exported for tests
