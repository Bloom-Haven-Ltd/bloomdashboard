/**
 * Pharmacy feature service (§8/§16, audit PL-1/PL-9/PL-12).
 *
 * Endpoint contracts verified against bloom-backend (2026-09-24):
 * - GET /admin/pharmacy-orders (page, page_size only — no filters, PL-12)
 * - GET /pharmacies, GET /pharmacies/{id} (public)
 * - GET /pharmacies/inventory/search (public global inventory)
 * - GET /prescriptions (admin-bypassed list service)
 *
 * Order detail / history / fulfillment are patient-or-pharmacy-only in the
 * backend — administrators receive 403 (audit PL-1), so no detail fetches
 * exist here. Inventory is read-only by spec (§16 — no mutations, PL-9).
 */

import { apiGet } from '@/lib/api/client';
import {
  parseWith,
  paginatedOrdersSchema,
  paginatedPrescriptionsSchema,
  paginatedInventorySchema,
  paginatedSchema,
  pharmacyProfileSchema,
  inventoryItemSchema,
  prescriptionDetailSchema,
  type OrderFeedDto,
  type PrescriptionFeedDto,
  type PrescriptionDetailDto,
  type InventoryItemDto,
  type PharmacyProfileDto,
} from '@/lib/api/schemas';

export interface FeedPage<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}

/** Paginated global pharmacy orders feed (OrderResponse display subset). */
export async function fetchPharmacyOrders(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal
): Promise<FeedPage<OrderFeedDto>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const data = await apiGet<unknown>(`/admin/pharmacy-orders?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedOrdersSchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

/** Paginated global prescription feed (admin scope enforced by backend role check). */
export async function fetchPrescriptions(
  page = 1,
  pageSize = 20,
  patientId?: string,
  signal?: AbortSignal
): Promise<FeedPage<PrescriptionFeedDto>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (patientId) query.set('patient_id', patientId);
  const data = await apiGet<unknown>(`/prescriptions?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedPrescriptionsSchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

/** Prescription detail — clinical fields parsed here, gated at render (§13). */
export async function fetchPrescriptionDetail(
  id: string,
  signal?: AbortSignal
): Promise<PrescriptionDetailDto> {
  const data = await apiGet<unknown>(`/prescriptions/${encodeURIComponent(id)}`, { signal });
  return parseWith(prescriptionDetailSchema, data);
}

export async function fetchPharmacyProfile(id: string, signal?: AbortSignal): Promise<PharmacyProfileDto> {
  const data = await apiGet<unknown>(`/pharmacies/${encodeURIComponent(id)}`, { signal });
  return parseWith(pharmacyProfileSchema, data);
}

/** Global medication availability (§16) — public inventory search. */
export async function fetchInventory(
  page = 1,
  pageSize = 20,
  params?: { search?: string; category?: string },
  signal?: AbortSignal
): Promise<FeedPage<InventoryItemDto>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.category?.trim()) query.set('category', params.category.trim());
  const data = await apiGet<unknown>(`/pharmacies/inventory/search?${query.toString()}`, { signal });
  const parsed = parseWith(paginatedInventorySchema, data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}

/** Single pharmacy inventory list (public endpoint; bare array). */
export async function fetchPharmacyMedications(
  pharmacyId: string,
  page = 1,
  pageSize = 20,
  search?: string,
  signal?: AbortSignal
): Promise<FeedPage<InventoryItemDto>> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search?.trim()) query.set('search', search.trim());
  const data = await apiGet<unknown>(
    `/pharmacies/${encodeURIComponent(pharmacyId)}/medications?${query.toString()}`,
    { signal }
  );
  const parsed = parseWith(paginatedSchema(inventoryItemSchema), data);
  return { items: parsed.data, total: parsed.total, totalPages: parsed.total_pages, page: parsed.page };
}
