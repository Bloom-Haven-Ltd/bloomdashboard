/**
 * Platform settings feature service.
 * Endpoint contract: GET /admin/settings, PATCH /admin/settings/{key}
 * (verified against backend admin router).
 */

import { apiGet, apiPatch } from '@/lib/api/client';
import { parseWith, listSchema, systemSettingSchema, type SystemSettingDto } from '@/lib/api/schemas';

export async function fetchSystemSettings(signal?: AbortSignal): Promise<SystemSettingDto[]> {
  const data = await apiGet<unknown>('/admin/settings', { signal });
  return parseWith(listSchema(systemSettingSchema), data);
}

/** Update one system setting by key. Audited server-side. */
export async function updateSystemSetting(key: string, value: string, signal?: AbortSignal): Promise<SystemSettingDto> {
  const data = await apiPatch<unknown>(`/admin/settings/${encodeURIComponent(key)}`, { value }, { signal });
  return parseWith(systemSettingSchema, data);
}
