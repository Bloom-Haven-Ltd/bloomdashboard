/**
 * Waitlist feature service — the app-launch list captured by the marketing
 * site (`bloom-health-web` → `/waitlist` → `POST /api/waitlist`).
 *
 * Endpoint contract (verified against `app/modules/waitlist/router.py`):
 *   GET   /waitlist   ?status&interest&page&page_size
 *   GET   /waitlist/{id}
 *   PATCH /waitlist/{id}/status   { status, internal_note }
 *
 * Deliberate omissions, inherited from the capture form's data minimisation:
 *   * **No search, and no `message` to search.** A waitlist row carries name,
 *     email, optional phone, and a closed-list product interest — no prose ever
 *     reaches this table, so there is nothing free-text to render or grep.
 *   * **No delete.** Same reasoning as the inbox: `archived` is the terminal
 *     state for junk, and the backend exposes no delete, so none is offered.
 *   * **No dedup UI.** Re-joining with the same email is idempotent server-side
 *     (the existing row is returned untouched), so one address is one row here.
 */

import { apiGet, apiPatch } from '@/lib/api/client';
import {
  paginatedWaitlistSignupsSchema,
  parseWith,
  waitlistSignupSchema,
  type WaitlistSignupDto,
  type WaitlistStatusDto,
} from '@/lib/api/schemas';

export interface WaitlistListParams {
  page?: number;
  pageSize?: number;
  status?: WaitlistStatusDto | 'all';
  interest?: string;
  signal?: AbortSignal;
}

export interface WaitlistListResult {
  signups: WaitlistSignupDto[];
  total: number;
  totalPages: number;
  page: number;
}

export async function fetchWaitlistSignups(params: WaitlistListParams = {}): Promise<WaitlistListResult> {
  const { page = 1, pageSize = 20, status, interest, signal } = params;

  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  // `all` is a UI state, not a backend value: omitting the parameter is the only
  // way to ask for every state, because sending `status=all` returns 422.
  if (status && status !== 'all') query.set('status', status);
  if (interest && interest !== 'all') query.set('interest', interest);

  const data = await apiGet<unknown>(`/waitlist?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedWaitlistSignupsSchema, data);
  return {
    signups: parsed.data,
    total: parsed.total,
    totalPages: parsed.total_pages,
    page: parsed.page,
  };
}

export async function fetchWaitlistSignup(id: string, signal?: AbortSignal): Promise<WaitlistSignupDto> {
  const data = await apiGet<unknown>(`/waitlist/${id}`, { signal });
  return parseWith(waitlistSignupSchema, data);
}

export interface WaitlistStatusAction {
  id: string;
  status: WaitlistStatusDto;
  /**
   * Free-text note kept against the record. Required when archiving: an
   * unexplained disappearance from the launch list is indistinguishable from a
   * bug, and the note is the only thing that will say which it was.
   */
  internalNote?: string;
}

export async function updateWaitlistStatus({
  id,
  status,
  internalNote,
}: WaitlistStatusAction): Promise<WaitlistSignupDto> {
  const note = internalNote?.trim();
  if (status === 'archived' && !note) {
    throw new Error('Add a short reason before archiving — it is kept on the record.');
  }
  if ((note?.length ?? 0) > 2000) {
    throw new Error('The internal note must be 2,000 characters or fewer.');
  }

  const data = await apiPatch<unknown>(`/waitlist/${id}/status`, {
    status,
    internal_note: note || null,
  });
  return parseWith(waitlistSignupSchema, data);
}
