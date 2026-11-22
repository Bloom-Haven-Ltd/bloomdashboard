/**
 * Platform settings feature service.
 * Endpoint contract: GET /admin/settings, PATCH /admin/settings/{key}
 * (verified against backend admin router).
 * AI model registry contract: GET/POST /admin/ai-models,
 * PATCH/DELETE /admin/ai-models/{id} — read shapes only ever carry the masked
 * key preview; the raw api_key travels one way, admin → backend.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import {
  parseWith,
  listSchema,
  systemSettingSchema,
  aiModelConfigSchema,
  type SystemSettingDto,
  type AiModelConfigDto,
  type AiModelConfigInput,
  type AiModelConfigPatch,
} from '@/lib/api/schemas';

export async function fetchSystemSettings(signal?: AbortSignal): Promise<SystemSettingDto[]> {
  const data = await apiGet<unknown>('/admin/settings', { signal });
  return parseWith(listSchema(systemSettingSchema), data);
}

/** Update one system setting by key. Audited server-side. */
export async function updateSystemSetting(key: string, value: string, signal?: AbortSignal): Promise<SystemSettingDto> {
  const data = await apiPatch<unknown>(`/admin/settings/${encodeURIComponent(key)}`, { value }, { signal });
  return parseWith(systemSettingSchema, data);
}

// --- AI assistant models (multi-model registry) ---------------------------

export async function fetchAiModels(signal?: AbortSignal): Promise<AiModelConfigDto[]> {
  const data = await apiGet<unknown>('/admin/ai-models', { signal });
  return parseWith(listSchema(aiModelConfigSchema), data);
}

export async function createAiModel(input: AiModelConfigInput, signal?: AbortSignal): Promise<AiModelConfigDto> {
  const data = await apiPost<unknown>('/admin/ai-models', input, { signal });
  return parseWith(aiModelConfigSchema, data);
}

export async function updateAiModel(id: string, patch: AiModelConfigPatch, signal?: AbortSignal): Promise<AiModelConfigDto> {
  const data = await apiPatch<unknown>(`/admin/ai-models/${encodeURIComponent(id)}`, patch, { signal });
  return parseWith(aiModelConfigSchema, data);
}

export async function deleteAiModel(id: string, signal?: AbortSignal): Promise<void> {
  await apiDelete<unknown>(`/admin/ai-models/${encodeURIComponent(id)}`, { signal });
}
