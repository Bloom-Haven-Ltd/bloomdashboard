/**
 * Public-inquiries feature service — the lead inbox captured from the marketing
 * site (`bloom-health-web` → `POST /api/contact`, `POST /api/partner-inquiry`).
 *
 * Endpoint contract (verified against `app/modules/inquiries/router.py`):
 *   GET   /inquiries   ?status&inquiry_type&channel&page&page_size
 *   GET   /inquiries/{id}
 *   PATCH /inquiries/{id}/status   { status, internal_note }
 *
 * Three deliberate omissions:
 *   * **No search parameter.** The backend has no text-search column query, and a
 *     client-side "search" over one page of results would silently lie about the
 *     total. Until the endpoint accepts one, filters are the honest surface.
 *   * **No assignment UI.** `assigned_to` is accepted by the API and validated
 *     against the users table, but the dashboard has no staff directory endpoint
 *     that returns a trustworthy picker list — so the field is read in the DTO
 *     and never written from here.
 *   * **No delete.** The inbox is a records system: `archived` is the terminal
 *     state an admin uses for junk. The backend exposes no delete, so none is
 *     offered.
 */

import { apiGet, apiPatch } from '@/lib/api/client';
import {
  paginatedInquiriesSchema,
  parseWith,
  publicInquirySchema,
  type InquiryStatusDto,
  type PublicInquiryDto,
} from '@/lib/api/schemas';

export interface InquiryListParams {
  page?: number;
  pageSize?: number;
  status?: InquiryStatusDto | 'all';
  inquiryType?: string;
  channel?: string;
  signal?: AbortSignal;
}

export interface InquiryListResult {
  inquiries: PublicInquiryDto[];
  total: number;
  totalPages: number;
  page: number;
}

export async function fetchInquiries(params: InquiryListParams = {}): Promise<InquiryListResult> {
  const { page = 1, pageSize = 20, status, inquiryType, channel, signal } = params;

  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  // `all` is a UI state, not a backend value: omitting the parameter is the only
  // way to ask for every state, because sending `status=all` returns 422.
  if (status && status !== 'all') query.set('status', status);
  if (inquiryType && inquiryType !== 'all') query.set('inquiry_type', inquiryType);
  if (channel && channel !== 'all') query.set('channel', channel);

  const data = await apiGet<unknown>(`/inquiries?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedInquiriesSchema, data);
  return {
    inquiries: parsed.data,
    total: parsed.total,
    totalPages: parsed.total_pages,
    page: parsed.page,
  };
}

export async function fetchInquiry(id: string, signal?: AbortSignal): Promise<PublicInquiryDto> {
  const data = await apiGet<unknown>(`/inquiries/${id}`, { signal });
  return parseWith(publicInquirySchema, data);
}

export interface InquiryStatusAction {
  id: string;
  status: InquiryStatusDto;
  /**
   * Free-text note kept against the record. Required when archiving: an
   * unexplained disappearance of a lead is indistinguishable from a bug, and the
   * note is the only thing that will say which it was.
   */
  internalNote?: string;
}

export async function updateInquiryStatus({
  id,
  status,
  internalNote,
}: InquiryStatusAction): Promise<PublicInquiryDto> {
  const note = internalNote?.trim();
  if (status === 'archived' && !note) {
    throw new Error('Add a short reason before archiving — it is kept on the record.');
  }
  if ((note?.length ?? 0) > 2000) {
    throw new Error('The internal note must be 2,000 characters or fewer.');
  }

  const data = await apiPatch<unknown>(`/inquiries/${id}/status`, {
    status,
    internal_note: note || null,
  });
  return parseWith(publicInquirySchema, data);
}
