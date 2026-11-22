import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import {
  parseWith,
  dailyAffirmationDtoSchema,
  paginatedAffirmationsDtoSchema,
  type DailyAffirmationDto,
  type PaginatedAffirmationsDto,
} from '@/lib/api/schemas';

export interface AffirmationFilters {
  page?: number;
  pageSize?: number;
  category?: string;
  isActive?: boolean;
  scheduledDate?: string;
  search?: string;
}

export interface CreateAffirmationPayload {
  text: string;
  author?: string;
  category?: string;
  scheduled_date?: string | null;
  is_active?: boolean;
}

export interface UpdateAffirmationPayload {
  text?: string;
  author?: string | null;
  category?: string;
  scheduled_date?: string | null;
  is_active?: boolean;
}

/** GET /admin/affirmations — admin listing with filters */
export async function fetchAffirmations(
  filters: AffirmationFilters = {},
  signal?: AbortSignal
): Promise<PaginatedAffirmationsDto> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('page_size', String(filters.pageSize));
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.isActive !== undefined) params.set('is_active', String(filters.isActive));
  if (filters.scheduledDate) params.set('scheduled_date', filters.scheduledDate);
  if (filters.search) params.set('search', filters.search);

  const query = params.toString() ? `?${params.toString()}` : '';
  const data = await apiGet<unknown>(`/admin/affirmations${query}`, { signal });
  return parseWith(paginatedAffirmationsDtoSchema, data);
}

/** GET /affirmations/today — resolved hybrid affirmation for today */
export async function fetchTodayAffirmation(signal?: AbortSignal): Promise<DailyAffirmationDto> {
  const data = await apiGet<unknown>('/affirmations/today', { signal });
  return parseWith(dailyAffirmationDtoSchema, data);
}

/** POST /admin/affirmations — create new affirmation */
export async function createAffirmation(
  payload: CreateAffirmationPayload,
  signal?: AbortSignal
): Promise<DailyAffirmationDto> {
  const data = await apiPost<unknown>('/admin/affirmations', payload, { signal });
  return parseWith(dailyAffirmationDtoSchema, data);
}

/** PATCH /admin/affirmations/{id} — update affirmation */
export async function updateAffirmation(
  id: string,
  payload: UpdateAffirmationPayload,
  signal?: AbortSignal
): Promise<DailyAffirmationDto> {
  const data = await apiPatch<unknown>(`/admin/affirmations/${id}`, payload, { signal });
  return parseWith(dailyAffirmationDtoSchema, data);
}

/** DELETE /admin/affirmations/{id} — delete affirmation */
export async function deleteAffirmation(
  id: string,
  signal?: AbortSignal
): Promise<{ message: string }> {
  return await apiDelete<{ message: string }>(`/admin/affirmations/${id}`, { signal });
}

/** POST /admin/affirmations/{id}/pin-today — pin directly as today's affirmation */
export async function pinAffirmationToToday(
  id: string,
  signal?: AbortSignal
): Promise<DailyAffirmationDto> {
  const data = await apiPost<unknown>(`/admin/affirmations/${id}/pin-today`, undefined, { signal });
  return parseWith(dailyAffirmationDtoSchema, data);
}
