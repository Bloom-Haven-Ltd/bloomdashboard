/**
 * Partners feature service (§16/§19).
 * Endpoint contracts verified against bloom-backend:
 * - GET /doctors, GET /doctors/{id} (public)
 * - GET /labs, GET /labs/{id} (public)
 * - GET /pharmacies, GET /pharmacies/{id} (public)
 *
 * Partner profile data is public marketing/operational data by backend design
 * (no PHI). Sensitive verification documents are NOT fetched here — see
 * docs/admin/users-partners-audit.md for the signed-URL dependency.
 */

import { apiGet } from '@/lib/api/client';
import {
  parseWith,
  paginatedSchema,
  doctorProfileSchema,
  labProfileSchema,
  pharmacyProfileSchema,
  type DoctorProfileDto,
  type LabProfileDto,
  type PharmacyProfileDto,
} from '@/lib/api/schemas';

export type PartnerType = 'doctor' | 'lab' | 'pharmacy';

/** Discriminated union for detail rendering (§19). */
export type PartnerProfile =
  | ({ kind: 'doctor' } & DoctorProfileDto)
  | ({ kind: 'lab' } & LabProfileDto)
  | ({ kind: 'pharmacy' } & PharmacyProfileDto);

export interface PartnerListResult<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}

export type DoctorSummary = Pick<
  DoctorProfileDto,
  'id' | 'user_id' | 'specialty' | 'is_verified' | 'rating' | 'first_name' | 'last_name' | 'created_at'
>;
export type LabSummary = Pick<LabProfileDto, 'id' | 'user_id' | 'name' | 'is_verified' | 'rating' | 'created_at'>;
export type PharmacySummary = Pick<
  PharmacyProfileDto,
  'id' | 'owner_id' | 'name' | 'status' | 'pharmacy_type' | 'rating' | 'created_at'
>;

const doctorSummarySchema = doctorProfileSchema.pick({
  id: true,
  user_id: true,
  specialty: true,
  is_verified: true,
  rating: true,
  first_name: true,
  last_name: true,
  created_at: true,
});
const labSummarySchema = labProfileSchema.pick({
  id: true,
  user_id: true,
  name: true,
  is_verified: true,
  rating: true,
  created_at: true,
});
const pharmacySummarySchema = pharmacyProfileSchema.pick({
  id: true,
  owner_id: true,
  name: true,
  status: true,
  pharmacy_type: true,
  rating: true,
  created_at: true,
});

export async function fetchDoctors(
  page = 1,
  pageSize = 20,
  search?: string,
  signal?: AbortSignal
): Promise<PartnerListResult<DoctorSummary>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search?.trim()) query.set('search', search.trim());
  const data = await apiGet<unknown>(`/doctors?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedSchema(doctorSummarySchema), data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

export async function fetchLabs(
  page = 1,
  pageSize = 20,
  search?: string,
  signal?: AbortSignal
): Promise<PartnerListResult<LabSummary>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search?.trim()) query.set('search', search.trim());
  const data = await apiGet<unknown>(`/labs?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedSchema(labSummarySchema), data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

export async function fetchPharmacies(
  page = 1,
  pageSize = 20,
  search?: string,
  signal?: AbortSignal
): Promise<PartnerListResult<PharmacySummary>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search?.trim()) query.set('search', search.trim());
  const data = await apiGet<unknown>(`/pharmacies?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedSchema(pharmacySummarySchema), data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

export async function fetchDoctorProfile(id: string, signal?: AbortSignal): Promise<DoctorProfileDto> {
  const data = await apiGet<unknown>(`/doctors/${id}`, { signal });
  return parseWith(doctorProfileSchema, data);
}

export async function fetchLabProfile(id: string, signal?: AbortSignal): Promise<LabProfileDto> {
  const data = await apiGet<unknown>(`/labs/${id}`, { signal });
  return parseWith(labProfileSchema, data);
}

export async function fetchPharmacyProfile(id: string, signal?: AbortSignal): Promise<PharmacyProfileDto> {
  const data = await apiGet<unknown>(`/pharmacies/${id}`, { signal });
  return parseWith(pharmacyProfileSchema, data);
}

/** Type-dispatched detail fetch returning a discriminated union. */
export async function fetchPartnerProfile(
  type: PartnerType,
  id: string,
  signal?: AbortSignal
): Promise<PartnerProfile> {
  switch (type) {
    case 'doctor':
      return { kind: 'doctor', ...(await fetchDoctorProfile(id, signal)) };
    case 'lab':
      return { kind: 'lab', ...(await fetchLabProfile(id, signal)) };
    case 'pharmacy':
      return { kind: 'pharmacy', ...(await fetchPharmacyProfile(id, signal)) };
  }
}
