/**
 * Support (disputes) feature service.
 * Endpoint contract: GET /admin/disputes, PATCH /admin/disputes/{id}/resolve
 * (verified against backend admin router).
 */

import { apiGet, apiPatch } from '@/lib/api/client';
import {
  parseWith,
  paginatedDisputesSchema,
  supportDisputeSchema,
  type SupportDisputeDto,
} from '@/lib/api/schemas';

export interface DisputeListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  signal?: AbortSignal;
}

export async function fetchDisputes(params: DisputeListParams = {}): Promise<{
  disputes: SupportDisputeDto[];
  total: number;
  totalPages: number;
  page: number;
}> {
  const { page = 1, pageSize = 20, status, signal } = params;
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (status && status !== 'all') query.set('status', status);

  const data = await apiGet<unknown>(`/admin/disputes?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedDisputesSchema, data);
  return { disputes: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

/** Resolve a dispute. Audited server-side. */
export async function resolveDispute(
  disputeId: string,
  resolution: string,
  status = 'resolved',
  signal?: AbortSignal
): Promise<SupportDisputeDto> {
  const data = await apiPatch<unknown>(
    `/admin/disputes/${disputeId}/resolve`,
    { resolution, status },
    { signal }
  );
  return parseWith(supportDisputeSchema, data);
}
