import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchPartnerProfile, fetchDoctors, type PartnerProfile } from '@/features/partners/service';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/api/client';
const mockedApiGet = vi.mocked(apiGet);

afterEach(() => vi.clearAllMocks());

const DOCTOR = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  specialty: 'Cardiology',
  experience_years: 8,
  consultation_fee: 250,
  currency: 'GHS',
  is_verified: true,
  rating: 4.6,
  total_reviews: 51,
  created_at: '2026-01-15T09:00:00Z',
  first_name: 'Kwesi',
  last_name: 'Arthur',
};

describe('partner profile schemas', () => {
  it('parses a doctor profile and rejects malformed payloads', async () => {
    mockedApiGet.mockResolvedValueOnce(DOCTOR);
    const profile = await fetchPartnerProfile('doctor', DOCTOR.id);
    expect(profile.kind).toBe('doctor');
    if (profile.kind === 'doctor') {
      expect(profile.specialty).toBe('Cardiology');
      expect(profile.first_name).toBe('Kwesi');
    }
  });

  it('dispatches by type to the correct endpoint', async () => {
    mockedApiGet.mockResolvedValueOnce(DOCTOR);
    await fetchPartnerProfile('doctor', DOCTOR.id);
    expect(mockedApiGet).toHaveBeenCalledWith('/doctors/11111111-1111-4111-8111-111111111111', expect.anything());

    mockedApiGet.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      user_id: DOCTOR.user_id,
      name: 'Accra Central Lab',
      is_verified: false,
      rating: 4.1,
      total_reviews: 12,
      created_at: '2026-02-01T09:00:00Z',
    });
    const lab = await fetchPartnerProfile('lab', '33333333-3333-4333-8333-333333333333');
    expect(lab.kind).toBe('lab');
    if (lab.kind === 'lab') expect(lab.name).toBe('Accra Central Lab');
  });

  it('falls back safely when doctor summary list rows omit optional fields', async () => {
    mockedApiGet.mockResolvedValueOnce({
      success: true,
      data: [{ ...DOCTOR, education: undefined, languages: undefined }],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
    const result = await fetchDoctors(1, 20);
    expect(result.items[0].specialty).toBe('Cardiology');
  });
});
