import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createAiModel,
  deleteAiModel,
  fetchAiModels,
  updateAiModel,
} from '@/features/settings/service';

// The registry service reaches the API client; stub the module.
vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';

const mockedGet = vi.mocked(apiGet);
const mockedPost = vi.mocked(apiPost);
const mockedPatch = vi.mocked(apiPatch);
const mockedDelete = vi.mocked(apiDelete);

afterEach(() => {
  vi.clearAllMocks();
});

// Exactly the backend AiModelConfigResponse shape — note there is no
// api_key field to shape: the server only ever returns the masked preview.
const ROW = {
  id: '3f2a1b0c-9d8e-7f6a-5b4c-3d2e1f0a9b8c',
  label: 'Qwen primary',
  model: 'Qwen/Qwen3-4B-Instruct-2507:featherless-ai',
  base_url: 'https://router.huggingface.co/v1',
  provider: 'huggingface',
  api_key_masked: '\u2022\u2022\u2022\u2022cret',
  is_enabled: true,
  priority: 100,
  created_at: '2026-10-11T09:00:00Z',
  updated_at: '2026-10-11T09:00:00Z',
};

describe('AI model registry service contract (/admin/ai-models)', () => {
  it('fetchAiModels parses the masked read shape and never carries a raw key', async () => {
    // Even if a future backend response leaked one, the zod schema strips
    // unknown keys — the view state structurally cannot hold the secret.
    mockedGet.mockResolvedValueOnce([{ ...ROW, api_key: 'hf_should_be_stripped' }]);

    const rows = await fetchAiModels();

    expect(mockedGet).toHaveBeenCalledWith('/admin/ai-models', expect.anything());
    expect(rows).toHaveLength(1);
    expect(rows[0].api_key_masked).toBe(ROW.api_key_masked);
    expect('api_key' in rows[0]).toBe(false);
  });

  it('createAiModel posts the full input including the key, once, one way', async () => {
    mockedPost.mockResolvedValueOnce(ROW);
    const input = {
      label: 'Qwen primary',
      model: ROW.model,
      base_url: ROW.base_url,
      api_key: 'hf_key_alpha_secret',
      provider: 'huggingface',
      is_enabled: true,
      priority: 100,
    };

    const row = await createAiModel(input);

    expect(mockedPost).toHaveBeenCalledWith('/admin/ai-models', input, expect.anything());
    expect(row.api_key_masked).toBe(ROW.api_key_masked);
  });

  it('updateAiModel patches by id (blank key is never shipped — "keep" is omitting)', async () => {
    mockedPatch.mockResolvedValueOnce({ ...ROW, is_enabled: false });

    const row = await updateAiModel(ROW.id, { is_enabled: false });

    expect(mockedPatch).toHaveBeenCalledWith(
      `/admin/ai-models/${ROW.id}`,
      { is_enabled: false },
      expect.anything()
    );
    expect(row.is_enabled).toBe(false);
  });

  it('deleteAiModel calls DELETE on the model path', async () => {
    mockedDelete.mockResolvedValueOnce({ message: 'removed' });

    await deleteAiModel(ROW.id);

    expect(mockedDelete).toHaveBeenCalledWith(`/admin/ai-models/${ROW.id}`, expect.anything());
  });
});
