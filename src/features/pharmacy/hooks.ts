'use client';

/**
 * Pharmacy feature hooks — server-side pagination over backend feeds.
 * No realtime admin channel exists (audit PL-13 / CG-7); feeds refetch on
 * pagination and manual refresh only.
 */

import {
  fetchInventory,
  fetchPharmacyMedications,
  fetchPharmacyOrders,
  fetchPharmacyProfile,
  fetchPrescriptionDetail,
  fetchPrescriptions,
} from './service';
import { useApiQuery } from '@/hooks/useApiQuery';

export const pharmacyKeys = {
  orders: (page: number, pageSize: number) => ['pharmacy', 'orders', { page, pageSize }] as const,
  prescriptions: (page: number, pageSize: number, patientId?: string) =>
    ['pharmacy', 'prescriptions', { page, pageSize, patientId: patientId ?? null }] as const,
  prescription: (id: string) => ['pharmacy', 'prescriptions', 'detail', id] as const,
  profile: (id: string) => ['pharmacy', 'profile', id] as const,
  inventory: (page: number, pageSize: number, search: string, category: string) =>
    ['pharmacy', 'inventory', { page, pageSize, search, category }] as const,
  medications: (pharmacyId: string, page: number, pageSize: number, search: string) =>
    ['pharmacy', 'medications', pharmacyId, { page, pageSize, search }] as const,
};

export function usePharmacyOrders(page: number, pageSize = 20) {
  return useApiQuery(pharmacyKeys.orders(page, pageSize), (signal) => fetchPharmacyOrders(page, pageSize, signal));
}

export function usePrescriptions(page: number, pageSize = 20, patientId?: string) {
  return useApiQuery(pharmacyKeys.prescriptions(page, pageSize, patientId), (signal) =>
    fetchPrescriptions(page, pageSize, patientId, signal)
  );
}

export function usePrescriptionDetail(id: string) {
  return useApiQuery(pharmacyKeys.prescription(id), (signal) => fetchPrescriptionDetail(id, signal), {
    enabled: Boolean(id),
  });
}

export function usePharmacyProfile(id: string) {
  return useApiQuery(pharmacyKeys.profile(id), (signal) => fetchPharmacyProfile(id, signal), {
    enabled: Boolean(id),
  });
}

export function useInventory(
  page: number,
  pageSize: number,
  params: { search?: string; category?: string } = {}
) {
  const search = params.search?.trim() ?? '';
  const category = params.category?.trim() ?? '';
  return useApiQuery(pharmacyKeys.inventory(page, pageSize, search, category), (signal) =>
    fetchInventory(page, pageSize, { search, category }, signal)
  );
}

export function usePharmacyMedications(pharmacyId: string, page: number, pageSize: number, search = '') {
  return useApiQuery(pharmacyKeys.medications(pharmacyId, page, pageSize, search), (signal) =>
    fetchPharmacyMedications(pharmacyId, page, pageSize, search, signal)
  );
}
