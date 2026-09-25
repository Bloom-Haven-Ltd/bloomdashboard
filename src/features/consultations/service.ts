/**
 * Clinical operations feature service (§7/§26) — read-only operational
 * visibility over the same backend lifecycle endpoints the patient/partner
 * apps consume (contracts verified in docs/admin/clinical-operations-audit.md).
 *
 * The backend owns appointment state (dependency CG-1: participant-only
 * mutations), so this module exposes no mutations — only authoritative reads.
 * Schemas define operational fields only; clinical content returned by the
 * backend (`notes`, `suffering_description`, `consultation_notes`) and
 * telehealth secrets (`agora_token`, `agora_channel`) are stripped at the
 * parse boundary (§30/§32) and never reach components or cache.
 */

import { apiGet } from '@/lib/api/client';
import { z } from 'zod';
import { ApiError } from '@/lib/api/error';
import {
  parseWith,
  paginatedConsultationsSchema,
  consultationFeedSchema,
  type ConsultationFeedDto,
} from '@/lib/api/schemas';

/** Operational subset of GET /consultations/{id} (ConsultationResponse). */
export const consultationDetailSchema = consultationFeedSchema.pick({
  id: true,
  patient_id: true,
  doctor_id: true,
  date_time: true,
  status: true,
  consultation_type: true,
  consultation_mode: true,
  payment_status: true,
  amount: true,
  currency: true,
  urgency_level: true,
  is_consultation_ready: true,
  consultation_start_time: true,
  consultation_end_time: true,
  duration_seconds: true,
  cancellation_reason: true,
  reschedule_reason: true,
  payment_reference: true,
  patient_name: true,
  provider: true,
  created_at: true,
});
export type ConsultationDetailDto = z.infer<typeof consultationDetailSchema>;

/** Operational subset of GET /consultations/{id}/room (ConsultationRoom). */
export const consultationRoomSchema = z.object({
  id: z.string().uuid(),
  consultation_id: z.string().uuid(),
  status: z.string(),
  provider_online: z.boolean(),
  patient_online: z.boolean(),
  last_activity: z.string().min(1).nullable().optional(),
});
export type ConsultationRoomDto = z.infer<typeof consultationRoomSchema>;

/** Item of GET /consultations/{id}/events (SessionEvent). */
export const sessionEventSchema = z.object({
  id: z.string().uuid(),
  consultation_id: z.string().uuid(),
  actor_id: z.string().uuid().nullable().optional(),
  event_type: z.string(),
  created_at: z.string().min(1),
});
export type SessionEventDto = z.infer<typeof sessionEventSchema>;

export interface ConsultationListParams {
  page?: number;
  pageSize?: number;
  /** Backend enum value (ConsultationStatus) or 'all'. */
  status?: string;
  signal?: AbortSignal;
}

export async function fetchConsultations(params: ConsultationListParams = {}): Promise<ConsultationListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (params.status && params.status !== 'all') query.set('status', params.status);

  const data = await apiGet<unknown>(`/admin/consultations?${query.toString()}`, { signal: params.signal });
  const parsed = parseWith(paginatedConsultationsSchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

export interface ConsultationListResult {
  items: ConsultationFeedDto[];
  total: number;
  totalPages: number;
  page: number;
}

/** Consultation detail; 404 → null so deep links can render a not-found state. */
export async function fetchConsultationDetail(id: string, signal?: AbortSignal): Promise<ConsultationDetailDto | null> {
  try {
    const data = await apiGet<unknown>(`/consultations/${encodeURIComponent(id)}`, { signal });
    return parseWith(consultationDetailSchema, data);
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'NOT_FOUND') return null;
    throw cause;
  }
}

/** Operational timeline (§19) — actor, event, timestamp. Bare array. */
export async function fetchSessionEvents(id: string, signal?: AbortSignal): Promise<SessionEventDto[]> {
  const data = await apiGet<unknown>(`/consultations/${encodeURIComponent(id)}/events`, { signal });
  return parseWith(z.array(sessionEventSchema), data);
}

/** Room presence (§18/§34/§36); 404 → null when no room has been created yet. */
export async function fetchConsultationRoom(id: string, signal?: AbortSignal): Promise<ConsultationRoomDto | null> {
  try {
    const data = await apiGet<unknown>(`/consultations/${encodeURIComponent(id)}/room`, { signal });
    return parseWith(consultationRoomSchema, data);
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'NOT_FOUND') return null;
    throw cause;
  }
}
