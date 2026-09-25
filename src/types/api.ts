/**
 * Canonical API wire contract for the Bloom Haven Health FastAPI backend.
 *
 * These types mirror the backend Pydantic response schemas (snake_case) and are
 * the single source of truth for API payloads in the dashboard. The backend
 * remains authoritative: treat every payload as untrusted at the boundary and
 * validate with the zod schemas in `src/lib/api/schemas.ts` where behaviour
 * depends on the data.
 *
 * NOTE: Finance/wallet payload types (WalletTransactionResponse, withdrawals)
 * are intentionally absent until the Phase 9 finance work consumes them — they
 * must be written from the verified backend wallet schemas, never guessed.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type UUID = string;

/** ISO-8601 timestamp string as produced by the backend. */
export type ISODateTime = string;

export type UserRole = 'patient' | 'doctor' | 'pharmacy' | 'lab' | 'admin';

// ---------------------------------------------------------------------------
// Shared envelopes (app/shared/pagination.py)
// ---------------------------------------------------------------------------

/** Standard paginated list response wrapper returned by list endpoints. */
export interface Paginated<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Standard `{ message: string }` response from action endpoints. */
export interface ApiMessage {
  message: string;
}

// ---------------------------------------------------------------------------
// Users — mirrors app/modules/users/schemas.py (UserResponse)
// ---------------------------------------------------------------------------

export interface User {
  id: UUID;
  email: string;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  profile_picture: string | null;
  date_of_birth: string | null;
  gender: string | null;
  profile_complete: boolean;
  timezone: string;
  last_login: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  provider_verified: boolean;
}

/** Brief user info embedded in auth responses (UserBriefResponse). */
export interface UserBrief {
  id: UUID;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_verified: boolean;
  profile_complete: boolean;
  phone_number: string | null;
}

// ---------------------------------------------------------------------------
// Auth — mirrors app/modules/auth/schemas.py
// ---------------------------------------------------------------------------

/** Response of POST /auth/session. */
export interface SessionResponse {
  session_id: UUID;
  user: UserBrief;
  status: string;
  expires_at: ISODateTime;
}

/** Item of GET /auth/sessions. */
export interface ActiveSession {
  id: UUID;
  app_type: string | null;
  device_id: string | null;
  device_name: string | null;
  platform: string | null;
  os_version: string | null;
  app_version: string | null;
  created_at: ISODateTime;
  last_active_at: ISODateTime | null;
  is_current: boolean;
}

/** Request body of POST /auth/session. */
export interface SessionCreateRequest {
  app_type: 'admin_dashboard';
  platform: 'web';
}

// ---------------------------------------------------------------------------
// Admin — mirrors app/modules/admin/schemas.py
// ---------------------------------------------------------------------------

/** Response of GET /admin/stats. */
export interface SystemStats {
  total_users: number;
  users_by_role: Record<string, number>;
  total_doctors: number;
  total_labs: number;
  total_pharmacies: number;
  total_patients: number;
  pending_verifications: number;
  total_revenue: number;
  total_consultations: number;
  active_consultations: number;
  total_orders: number;
  total_disputes: number;
}

/** Item of GET /admin/verifications/pending. */
export interface PendingVerification {
  id: UUID;
  user_id: UUID;
  name: string;
  email: string;
  role: string;
  created_at: ISODateTime;
  documents: Record<string, unknown> | null;
  license_number: string | null;
}

/** Request body of PATCH /admin/verify/{role}/{profile_id}. */
export interface VerificationActionRequest {
  is_verified: boolean;
  rejection_reason?: string | null;
}

/** Request body of PATCH /admin/users/{user_id}/status. */
export interface UserStatusUpdateRequest {
  is_active: boolean;
}

/** Request body of POST /admin/notifications/broadcast. */
export interface BroadcastNotificationRequest {
  title: string;
  message: string;
  role?: UserRole | null;
  data?: Record<string, unknown> | null;
}

/** Item of GET /admin/settings. */
export interface SystemSetting {
  key: string;
  value: string;
  type: string;
  description: string | null;
}

/** Request body of PATCH /admin/settings/{key}. */
export interface SystemSettingUpdateRequest {
  value: string;
}

/** Item of GET /admin/audit-logs (AuditLogResponse). Audit records are
 * append-only: the dashboard never edits or deletes them. */
export interface AuditLog {
  id: UUID;
  user_id: UUID | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: ISODateTime;
}

/** Request body of POST /admin/audit-logs (AuditLogCreate). */
export interface AuditLogCreateRequest {
  action: string;
  category?: string | null;
  details?: string | null;
  status?: string | null;
  resource?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Item of GET /admin/disputes (SupportDisputeResponse). */
export interface SupportDispute {
  id: UUID;
  reporter_id: UUID;
  target_type: string;
  target_id: UUID;
  subject: string;
  description: string;
  status: string;
  resolution: string | null;
  resolved_by: UUID | null;
  resolved_at: ISODateTime | null;
  created_at: ISODateTime;
}

/** Request body of PATCH /admin/disputes/{dispute_id}/resolve. */
export interface DisputeResolveRequest {
  resolution: string;
  status?: string;
}

/** Point of the platform performance series. */
export interface PerformanceMetric {
  /** Time label, e.g. "08:00" or "Monday". */
  name: string;
  users: number;
  consultations: number;
  orders: number;
}

/** Response of GET /admin/analytics/performance. */
export interface PlatformPerformance {
  period: '24h' | '7d' | '30d';
  data: PerformanceMetric[];
}
