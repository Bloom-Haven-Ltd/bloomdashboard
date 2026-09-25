import { describe, expect, it } from 'vitest';
import {
  consultationStatusConfig,
  getStatusConfig,
  humanizeStatusKey,
  labBookingStatusConfig,
  orderStatusConfig,
  partnerStatusConfig,
  paymentStatusConfig,
  supportStatusConfig,
  verificationStatusConfig,
  STATUS_TONE_CHART_COLORS,
} from '@/constants/status';

/**
 * These lists mirror the verified FastAPI enums (see file header of
 * constants/status.ts). If the backend adds a state, update both — these
 * tests intentionally fail first.
 */
describe('backend enum reconciliation', () => {
  it('covers every ConsultationStatus value', () => {
    for (const status of [
      'pending', 'confirmed', 'ready', 'in_progress', 'interrupted',
      'documentation_pending', 'completed', 'cancelled', 'no_show', 'rescheduled',
    ]) {
      expect(consultationStatusConfig[status], `consultations: ${status}`).toBeTruthy();
    }
  });

  it('covers every payments-module PaymentStatus value (UPPERCASE source)', () => {
    for (const status of [
      'INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED',
      'ABANDONED', 'REVERSED', 'REFUNDED', 'PARTIALLY_REFUNDED',
    ]) {
      expect(getStatusConfig(paymentStatusConfig, status).label, `payments: ${status}`).not.toBe('Unknown');
    }
  });

  it('covers consultations-module payment statuses (lowercase source)', () => {
    for (const status of ['pending', 'paid', 'refunded', 'failed', 'waived']) {
      expect(paymentStatusConfig[status], `consultation payment: ${status}`).toBeTruthy();
    }
  });

  it('covers every pharmacy OrderStatus value', () => {
    for (const status of [
      'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
      'delivered', 'cancelled', 'rejected', 'returned', 'failed', 'completed',
    ]) {
      expect(orderStatusConfig[status], `orders: ${status}`).toBeTruthy();
    }
  });

  it('covers every LabBookingStatus value', () => {
    for (const status of ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']) {
      expect(labBookingStatusConfig[status], `lab bookings: ${status}`).toBeTruthy();
    }
  });

  it('covers every PharmacyStatus value', () => {
    for (const status of ['pending', 'approved', 'active', 'suspended', 'rejected']) {
      expect(partnerStatusConfig[status], `pharmacy: ${status}`).toBeTruthy();
    }
  });

  it('covers support/dispute statuses', () => {
    for (const status of ['open', 'in_progress', 'escalated', 'resolved', 'rejected', 'cancelled']) {
      expect(supportStatusConfig[status], `support: ${status}`).toBeTruthy();
    }
  });

  it('verification reflects the boolean-backend reality (no invented workflow states)', () => {
    // Backend vocabulary is exactly pending/approved (+rejected for pharmacies)
    // — see docs/admin/verification-state-machine.md.
    expect(Object.keys(verificationStatusConfig).sort()).toEqual(['approved', 'pending', 'rejected']);
  });
});

describe('lookup normalization', () => {
  it('normalizes any backend casing', () => {
    expect(getStatusConfig(paymentStatusConfig, 'PARTIALLY_REFUNDED').label).toBe('Partially Refunded');
    expect(getStatusConfig(paymentStatusConfig, 'Partially-Refunded').label).toBe('Partially Refunded');
    expect(getStatusConfig(consultationStatusConfig, 'NO_SHOW').label).toBe('No-show');
  });

  it('falls back safely for unknown statuses', () => {
    const fallback = getStatusConfig(consultationStatusConfig, 'hyperdrive');
    expect(fallback.tone).toBe('neutral');
    expect(fallback.label).toBe('Hyperdrive');
    expect(getStatusConfig(consultationStatusConfig, null).label).toBe('Unknown');
  });
});

describe('humanizeStatusKey', () => {
  it('renders readable labels', () => {
    expect(humanizeStatusKey('out_for_delivery')).toBe('Out For Delivery');
    expect(humanizeStatusKey('DOCUMENTATION-PENDING')).toBe('Documentation Pending');
  });
});

describe('chart tokens', () => {
  it('every tone has a chart color variable (§40)', () => {
    for (const tone of Object.keys(STATUS_TONE_CHART_COLORS) as Array<keyof typeof STATUS_TONE_CHART_COLORS>) {
      expect(STATUS_TONE_CHART_COLORS[tone]).toMatch(/^var\(--chart/);
    }
  });
});
