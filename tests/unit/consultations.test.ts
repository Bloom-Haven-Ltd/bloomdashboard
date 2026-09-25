import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiError } from '@/lib/api/error';
import {
  fetchConsultationDetail,
  fetchConsultationRoom,
  fetchConsultations,
  fetchSessionEvents,
} from '@/features/consultations/service';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/api/client';
const mockedApiGet = vi.mocked(apiGet);

afterEach(() => vi.clearAllMocks());

const CONSULTATION_ID = '44444444-4444-4444-8444-444444444444';
const PATIENT_ID = '55555555-5555-5555-8555-555555555555';
const DOCTOR_ID = '66666666-6666-6666-8666-666666666666';

/** Shape of a backend ConsultationResponse — including fields the dashboard must strip (§30). */
const backendConsultation = {
  id: CONSULTATION_ID,
  patient_id: PATIENT_ID,
  doctor_id: DOCTOR_ID,
  date_time: '2026-09-24T10:30:00Z',
  status: 'confirmed',
  consultation_type: 'general',
  consultation_mode: 'video',
  payment_status: 'paid',
  amount: 250,
  currency: 'GHS',
  urgency_level: 'routine',
  is_consultation_ready: true,
  consultation_start_time: null,
  consultation_end_time: null,
  duration_seconds: null,
  cancellation_reason: null,
  reschedule_reason: null,
  payment_reference: 'PS-12345678',
  patient_name: 'Ama Mensah',
  provider: { doctor_id: DOCTOR_ID, name: 'Dr Kwesi Arthur', specialty: 'Cardiology' },
  created_at: '2026-09-20T09:00:00Z',
  // Clinical content returned by the backend — must never survive parsing:
  notes: 'Patient reports chest pain for three weeks.',
  suffering_description: 'Sharp pain radiating to left arm.',
  consultation_notes: 'Prescribed nitrates; follow up in two weeks.',
  patient_date_of_birth: '1990-04-12',
  patient_gender: 'female',
};

describe('consultation detail', () => {
  it('parses the operational detail payload', async () => {
    mockedApiGet.mockResolvedValueOnce(backendConsultation);
    const detail = await fetchConsultationDetail(CONSULTATION_ID);

    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(CONSULTATION_ID);
    expect(detail?.status).toBe('confirmed');
    expect(detail?.payment_reference).toBe('PS-12345678');
    expect(detail?.provider).toMatchObject({ name: 'Dr Kwesi Arthur' });
    expect(mockedApiGet).toHaveBeenCalledWith(`/consultations/${CONSULTATION_ID}`, expect.anything());
  });

  it('strips clinical content and patient demographics at the parse boundary (§30)', async () => {
    mockedApiGet.mockResolvedValueOnce(backendConsultation);
    const detail = await fetchConsultationDetail(CONSULTATION_ID);

    expect(detail).not.toBeNull();
    expect('notes' in detail!).toBe(false);
    expect('suffering_description' in detail!).toBe(false);
    expect('consultation_notes' in detail!).toBe(false);
    expect('patient_date_of_birth' in detail!).toBe(false);
    expect('patient_gender' in detail!).toBe(false);
  });

  it('maps 404 to null so deep links can render a not-found state', async () => {
    mockedApiGet.mockRejectedValueOnce(new ApiError('NOT_FOUND', undefined, { status: 404 }));
    await expect(fetchConsultationDetail(CONSULTATION_ID)).resolves.toBeNull();
  });

  it('propagates non-404 errors to the query layer', async () => {
    mockedApiGet.mockRejectedValueOnce(new ApiError('FORBIDDEN', undefined, { status: 403 }));
    await expect(fetchConsultationDetail(CONSULTATION_ID)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('consultation feed', () => {
  const feedRow = {
    id: CONSULTATION_ID,
    patient_id: PATIENT_ID,
    doctor_id: DOCTOR_ID,
    date_time: '2026-09-24T10:30:00Z',
    status: 'completed',
    consultation_type: 'general',
    consultation_mode: 'audio',
    payment_status: 'paid',
    amount: 250,
    currency: 'GHS',
    urgency_level: 'routine',
    patient_name: 'Ama Mensah',
    provider: null,
    created_at: '2026-09-20T09:00:00Z',
  };

  it('paginates server-side and forwards the status filter to /admin/consultations', async () => {
    mockedApiGet.mockResolvedValueOnce({
      success: true,
      data: [feedRow],
      total: 1,
      page: 2,
      page_size: 25,
      total_pages: 1,
    });
    const result = await fetchConsultations({ page: 2, pageSize: 25, status: 'completed' });

    expect(mockedApiGet).toHaveBeenCalledWith(
      '/admin/consultations?page=2&page_size=25&status=completed',
      expect.anything()
    );
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].status).toBe('completed');
  });

  it('omits the status param for the all view', async () => {
    mockedApiGet.mockResolvedValueOnce({
      success: true,
      data: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    });
    await fetchConsultations({ page: 1, pageSize: 20, status: 'all' });
    expect(mockedApiGet).toHaveBeenCalledWith('/admin/consultations?page=1&page_size=20', expect.anything());
  });
});

describe('session events', () => {
  it('parses the bare timeline array and strips event payloads', async () => {
    mockedApiGet.mockResolvedValueOnce([
      {
        id: '77777777-7777-7777-8777-777777777777',
        consultation_id: CONSULTATION_ID,
        actor_id: DOCTOR_ID,
        event_type: 'session_started',
        created_at: '2026-09-24T10:31:00Z',
        payload: { internal: 'should-not-surface' },
      },
      {
        id: '88888888-8888-8888-8888-888888888888',
        consultation_id: CONSULTATION_ID,
        actor_id: null,
        event_type: 'consultation_completed',
        created_at: '2026-09-24T11:02:00Z',
      },
    ]);

    const events = await fetchSessionEvents(CONSULTATION_ID);

    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe('session_started');
    expect(events[1].event_type).toBe('consultation_completed');
    expect(events[1].actor_id).toBeNull();
    expect('payload' in events[0]).toBe(false);
    expect(mockedApiGet).toHaveBeenCalledWith(`/consultations/${CONSULTATION_ID}/events`, expect.anything());
  });
});

describe('consultation room', () => {
  it('parses presence state and strips Agora identifiers (§32)', async () => {
    mockedApiGet.mockResolvedValueOnce({
      id: '99999999-9999-9999-8999-999999999999',
      consultation_id: CONSULTATION_ID,
      status: 'active',
      provider_online: true,
      patient_online: false,
      last_activity: '2026-09-24T10:35:00Z',
      agora_channel: 'consultation-abc123',
      agora_token: 'secret-agora-token',
    });

    const room = await fetchConsultationRoom(CONSULTATION_ID);

    expect(room).not.toBeNull();
    expect(room?.status).toBe('active');
    expect(room?.provider_online).toBe(true);
    expect(room?.patient_online).toBe(false);
    expect('agora_channel' in room!).toBe(false);
    expect('agora_token' in room!).toBe(false);
  });

  it('maps 404 to null when no room exists yet', async () => {
    mockedApiGet.mockRejectedValueOnce(new ApiError('NOT_FOUND', undefined, { status: 404 }));
    await expect(fetchConsultationRoom(CONSULTATION_ID)).resolves.toBeNull();
  });
});
