/**
 * Laboratory feature service (§21/§24, audit PL-2/PL-4).
 *
 * Endpoint contracts verified against bloom-backend (2026-09-24):
 * - GET /admin/lab-bookings (page, page_size only — no filters, PL-12)
 * - GET /labs, GET /labs/{id} (public)
 * - GET /labs/catalog?category&search (public, bare list)
 *
 * Samples, results, and the lab dashboard are lab-scoped only — admins
 * receive 403 (audit PL-2), so no sample/result fetches exist here. The
 * booking feed embeds `patient` (email/phone/gender) and `request`; both are
 * dropped at the parse boundary except the operational `tests` list (PL-3).
 */

import { z } from 'zod';
import { apiGet } from '@/lib/api/client';
import {
  parseWith,
  paginatedLabBookingsSchema,
  labProfileSchema,
  labTestCatalogSchema,
  type LabBookingFeedDto,
  type LabProfileDto,
  type LabTestCatalogDto,
} from '@/lib/api/schemas';

export interface FeedPage<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}

/** Paginated global lab bookings feed (LabBookingResponse display subset). */
export async function fetchLabBookings(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal
): Promise<FeedPage<LabBookingFeedDto>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const data = await apiGet<unknown>(`/admin/lab-bookings?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedLabBookingsSchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

export async function fetchLabProfile(id: string, signal?: AbortSignal): Promise<LabProfileDto> {
  const data = await apiGet<unknown>(`/labs/${encodeURIComponent(id)}`, { signal });
  return parseWith(labProfileSchema, data);
}

/** Platform diagnostic test catalog (§24) — public, unpaginated array. */
export async function fetchLabCatalog(
  params?: { category?: string; search?: string },
  signal?: AbortSignal
): Promise<LabTestCatalogDto[]> {
  const query = new URLSearchParams();
  if (params?.category?.trim()) query.set('category', params.category.trim());
  if (params?.search?.trim()) query.set('search', params.search.trim());
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const data = await apiGet<unknown>(`/labs/catalog${suffix}`, { signal });
  return parseWith(z.array(labTestCatalogSchema), data);
}
