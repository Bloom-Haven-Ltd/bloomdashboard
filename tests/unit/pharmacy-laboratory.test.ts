import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  fetchInventory,
  fetchPharmacyOrders,
  fetchPrescriptionDetail,
  fetchPrescriptions,
} from '@/features/pharmacy/service';
import { fetchLabBookings, fetchLabCatalog } from '@/features/laboratory/service';

vi.mock('@/lib/api/client', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from '@/lib/api/client';
const mockedApiGet = vi.mocked(apiGet);

afterEach(() => vi.clearAllMocks());

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const RX_ID = '22222222-2222-4222-8222-222222222222';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';
const PHARMACY_ID = '44444444-4444-4444-8444-444444444444';
const LAB_ID = '55555555-5555-5555-8555-555555555555';
const BOOKING_ID = '66666666-6666-6666-8666-666666666666';
const REQUEST_ID = '77777777-7777-7777-8777-777777777777';

const orderRow = {
  id: ORDER_ID,
  pharmacy_id: PHARMACY_ID,
  patient_id: PATIENT_ID,
  prescription_id: RX_ID,
  order_type: 'prescription',
  status: 'preparing',
  delivery_method: 'delivery',
  total_amount: 120.5,
  currency: 'GHS',
  payment_status: 'paid',
  created_at: '2026-09-24T09:00:00Z',
  updated_at: '2026-09-24T09:30:00Z',
};

function paginated(data: unknown[], page = 1) {
  return { success: true, data, total: data.length, page, page_size: 20, total_pages: 1 };
}

describe('pharmacy orders feed', () => {
  it('paginates server-side against /admin/pharmacy-orders', async () => {
    mockedApiGet.mockResolvedValueOnce(paginated([orderRow], 2));
    const result = await fetchPharmacyOrders(2, 20);

    expect(mockedApiGet).toHaveBeenCalledWith('/admin/pharmacy-orders?page=2&page_size=20', expect.anything());
    expect(result.items[0].status).toBe('preparing');
    expect(result.total).toBe(1);
  });
});

describe('prescriptions (PL-5 clinical gating)', () => {
  const backendPrescription = {
    id: RX_ID,
    consultation_id: '88888888-8888-8888-8888-888888888888',
    patient_id: PATIENT_ID,
    doctor_id: '99999999-9999-4999-8999-999999999999',
    diagnosis: 'Uncomplicated malaria',
    status: 'sent_to_pharmacy',
    pharmacy_id: PHARMACY_ID,
    fulfilled_at: null,
    created_at: '2026-09-24T08:00:00Z',
    medications: [
      {
        medication_name: 'Artemether/Lumefantrine',
        dosage: '20mg/120mg',
        frequency: 'Twice daily',
        duration: '3 days',
        instructions: 'Take with fatty food; complete the full course.',
      },
    ],
  };

  it('lists with the patient_id filter forwarded', async () => {
    mockedApiGet.mockResolvedValueOnce(paginated([backendPrescription]));
    await fetchPrescriptions(1, 20, PATIENT_ID);
    expect(mockedApiGet).toHaveBeenCalledWith(
      `/prescriptions?page=1&page_size=20&patient_id=${PATIENT_ID}`,
      expect.anything()
    );
  });

  it('strips clinical content from the list parse (§13/§38)', async () => {
    mockedApiGet.mockResolvedValueOnce(paginated([backendPrescription]));
    const result = await fetchPrescriptions(1, 20);

    const rx = result.items[0];
    expect('diagnosis' in rx).toBe(false);
    expect(rx.medications[0]).not.toHaveProperty('instructions');
    expect(rx.medications[0].medication_name).toBe('Artemether/Lumefantrine');
  });

  it('keeps gated clinical fields in the detail parse for the permission-gated route', async () => {
    mockedApiGet.mockResolvedValueOnce(backendPrescription);
    const detail = await fetchPrescriptionDetail(RX_ID);

    expect(detail.diagnosis).toBe('Uncomplicated malaria');
    expect(detail.medications[0].instructions).toBe('Take with fatty food; complete the full course.');
    expect(mockedApiGet).toHaveBeenCalledWith(`/prescriptions/${RX_ID}`, expect.anything());
  });
});

describe('inventory search (PL-9 read-only surface)', () => {
  it('forwards server-side search and parses three-tier stock', async () => {
    mockedApiGet.mockResolvedValueOnce(
      paginated([
        {
          id: '12121212-1212-4212-8212-121212121212',
          pharmacy_id: PHARMACY_ID,
          product_name: 'Paracetamol 500mg',
          generic_name: 'Paracetamol',
          dosage_form: 'tablet',
          strength: '500mg',
          unit_price: 2.5,
          quantity_in_stock: 40,
          reserved_quantity: 10,
          available_quantity: 30,
          reorder_level: 20,
          requires_prescription: false,
          is_active: true,
          created_at: '2026-09-01T00:00:00Z',
        },
      ])
    );
    const result = await fetchInventory(1, 20, { search: 'paracetamol', category: 'analgesics' });

    expect(mockedApiGet).toHaveBeenCalledWith(
      '/pharmacies/inventory/search?page=1&page_size=20&search=paracetamol&category=analgesics',
      expect.anything()
    );
    expect(result.items[0].available_quantity).toBe(30);
  });
});

describe('lab bookings feed (PL-3/PL-4 embed handling)', () => {
  const bookingRow = {
    id: BOOKING_ID,
    patient_id: PATIENT_ID,
    lab_id: LAB_ID,
    booking_date: '2026-09-25T10:00:00Z',
    booking_type: 'home_service',
    status: 'confirmed',
    amount: 180,
    currency: 'GHS',
    payment_status: 'pending',
    created_at: '2026-09-24T07:00:00Z',
    request: {
      id: REQUEST_ID,
      order_id: null,
      patient_id: PATIENT_ID,
      lab_id: LAB_ID,
      tests: ['Full Blood Count', 'Malaria RDT'],
      status: 'accepted',
      created_at: '2026-09-24T06:30:00Z',
    },
    // Backend embeds patient PII that must never survive the parse boundary:
    patient: {
      id: PATIENT_ID,
      first_name: 'Ama',
      last_name: 'Mensah',
      email: 'ama@example.com',
      phone_number: '+233201234567',
      gender: 'female',
    },
  };

  it('parses the operational request embed with tests', async () => {
    mockedApiGet.mockResolvedValueOnce(paginated([bookingRow]));
    const result = await fetchLabBookings(1, 20);

    expect(result.items[0].request?.tests).toEqual(['Full Blood Count', 'Malaria RDT']);
    expect(result.items[0].booking_type).toBe('home_service');
  });

  it('strips embedded patient demographics (§38/audit PL-3)', async () => {
    mockedApiGet.mockResolvedValueOnce(paginated([bookingRow]));
    const result = await fetchLabBookings(1, 20);

    const booking = result.items[0] as Record<string, unknown>;
    expect('patient' in booking).toBe(false);
  });

  it('tolerates a missing request embed (PL-4 detachment)', async () => {
    mockedApiGet.mockResolvedValueOnce(paginated([{ ...bookingRow, request: null }]));
    const result = await fetchLabBookings(1, 20);
    expect(result.items[0].request).toBeNull();
  });
});

describe('lab test catalog', () => {
  it('parses the bare array and forwards search params', async () => {
    mockedApiGet.mockResolvedValueOnce([
      {
        id: '13131313-1313-4313-8313-131313131313',
        code: 'FBC-01',
        name: 'Full Blood Count',
        category: 'hematology',
        sample_type: 'whole_blood',
        turnaround_hours: 24,
        prep_instructions: 'No fasting required.',
        is_active: true,
        created_at: '2026-08-01T00:00:00Z',
      },
    ]);
    const items = await fetchLabCatalog({ search: 'blood', category: 'hematology' });

    expect(mockedApiGet).toHaveBeenCalledWith('/labs/catalog?category=hematology&search=blood', expect.anything());
    expect(items[0].name).toBe('Full Blood Count');
    expect(items[0].turnaround_hours).toBe(24);
  });
});
