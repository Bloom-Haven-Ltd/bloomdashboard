/**
 * Verification feature service (§6.5/§61) — contracts verified against
 * bloom-backend (docs/admin/verification.md):
 *
 * - GET  /admin/verifications/pending   → bare array of PendingVerification
 * - PATCH /admin/verify/{role}/{id}     → {message}; audited server-side
 *
 * The backend owns verification state. This module only submits administrative
 * intent and validates the authoritative responses.
 */

import { apiGet, apiPatch } from '@/lib/api/client';
import {
  parseWith,
  listSchema,
  pendingVerificationSchema,
  type PendingVerificationDto,
} from '@/lib/api/schemas';

export type VerificationRole = 'doctor' | 'lab' | 'pharmacy';

export async function fetchPendingVerifications(signal?: AbortSignal): Promise<PendingVerificationDto[]> {
  const data = await apiGet<unknown>('/admin/verifications/pending', { signal });
  return parseWith(listSchema(pendingVerificationSchema), data);
}

export interface VerificationAction {
  /** Partner role segment of the decision endpoint. */
  role: VerificationRole;
  /** Profile id (DoctorProfile | LabProfile | Pharmacy) — the decision target. */
  profileId: string;
  approve: boolean;
  /** Required by this dashboard whenever `approve` is false (§24). */
  rejectionReason?: string;
}

/**
 * Approve or reject a partner verification. The backend re-authorizes,
 * validates, writes state, and writes the `VERIFY_PROVIDER` audit row.
 */
export async function submitVerificationDecision(action: VerificationAction, signal?: AbortSignal): Promise<void> {
  if (!action.approve && !action.rejectionReason?.trim()) {
    throw new Error('A rejection reason is required.');
  }
  await apiPatch<{ message: string }>(
    `/admin/verify/${encodeURIComponent(action.role)}/${encodeURIComponent(action.profileId)}`,
    {
      is_verified: action.approve,
      ...(action.approve ? {} : { rejection_reason: action.rejectionReason!.trim() }),
    },
    { signal }
  );
}
