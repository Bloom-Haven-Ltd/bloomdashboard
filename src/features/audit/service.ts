/**
 * Audit feature service — re-exports the platform module so existing imports
 * (`features/audit/service`) keep working while Phase 10 consolidates the
 * audit architecture into `features/platform` (§72: one feature layer for
 * platform concerns). Read-only by design; no mutation functions exist.
 */

export { fetchAuditLogs, type AuditFeedResult } from '@/features/platform/service';
