/**
 * Client-side audit event recorder.
 *
 * Backend mutations are audited server-side automatically; this recorder is
 * for client-originated events the backend cannot otherwise observe —
 * primarily **sensitive record access** (document/clinical views) and failed
 * actions on this client. Events are fire-and-forget: audit failures must
 * never block or break the administrator's workflow.
 *
 * PHI is never placed in audit metadata — IDs only (§33/§51).
 */

import { apiPost } from '@/lib/api/client';
import type { AuditLogCreateRequest } from '@/types/api';

/** Canonical client audit actions (extends the backend event vocabulary). */
export const AuditActions = {
  DOCUMENT_ACCESSED: 'DOCUMENT_ACCESSED',
  CLINICAL_RECORD_ACCESSED: 'CLINICAL_RECORD_ACCESSED',
  USER_VIEWED: 'USER_VIEWED',
  PARTNER_VIEWED: 'PARTNER_VIEWED',
  VERIFICATION_QUEUE_VIEWED: 'VERIFICATION_QUEUE_VIEWED',
  VIEW_VERIFICATION: 'VIEW_VERIFICATION',
  APPOINTMENT_VIEWED: 'APPOINTMENT_VIEWED',
  PHARMACY_ORDER_VIEWED: 'PHARMACY_ORDER_VIEWED',
  LAB_BOOKING_VIEWED: 'LAB_BOOKING_VIEWED',
  PRESCRIPTION_VIEWED: 'PRESCRIPTION_VIEWED',
  PAYMENT_VIEWED: 'PAYMENT_VIEWED',
  SENSITIVE_DATA_EXPORTED: 'SENSITIVE_DATA_EXPORTED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  CLIENT_VALIDATION_FAILED: 'CLIENT_VALIDATION_FAILED',
} as const;

export interface ClientAuditEvent {
  action: string;
  category?: string;
  details?: string;
  status?: 'success' | 'failure';
  /** ID (not name/content) of the accessed or affected resource. */
  resource?: string;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget audit event. Never throws. */
export function recordClientAudit(event: ClientAuditEvent): void {
  const payload: AuditLogCreateRequest = {
    action: event.action,
    category: event.category ?? 'AdminDashboard',
    details: event.details,
    status: event.status ?? 'success',
    resource: event.resource,
    metadata: event.metadata,
  };

  apiPost<{ message: string }>('/admin/audit-logs', payload, { skipAuthTeardown: true }).catch(() => {
    // Swallow — audit is best-effort from the client; server actions are authoritative.
  });
}
