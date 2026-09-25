import { describe, expect, it } from 'vitest';
import {
  getStatusConfig,
  humanizeStatusKey,
  paymentStatusConfig,
  supportStatusConfig,
  userStatusConfig,
  consultationStatusConfig,
  orderStatusConfig,
} from '@/constants/status';

describe('status configs', () => {
  it('every configured status has label, meaning, tone and icon', () => {
    const maps = [paymentStatusConfig, supportStatusConfig, userStatusConfig, consultationStatusConfig, orderStatusConfig];
    for (const map of maps) {
      for (const [key, config] of Object.entries(map)) {
        expect(config.label, `${key} label`).toBeTruthy();
        expect(config.meaning, `${key} meaning`).toBeTruthy();
        expect(config.tone, `${key} tone`).toBeTruthy();
        expect(config.icon, `${key} icon`).toBeTruthy();
      }
    }
  });

  it('covers the lifecycle states the backend surfaces', () => {
    for (const status of ['pending', 'confirmed', 'completed', 'cancelled']) {
      expect(consultationStatusConfig[status]).toBeTruthy();
    }
    expect(paymentStatusConfig.paid).toBeTruthy();
    expect(paymentStatusConfig.refunded).toBeTruthy();
    expect(orderStatusConfig.out_for_delivery).toBeTruthy();
  });
});

describe('getStatusConfig', () => {
  it('normalizes casing and separators', () => {
    expect(getStatusConfig(supportStatusConfig, 'IN_PROGRESS').label).toBe('In Progress');
    expect(getStatusConfig(supportStatusConfig, 'in-progress').label).toBe('In Progress');
  });

  it('falls back to a neutral unknown status without crashing', () => {
    const fallback = getStatusConfig(supportStatusConfig, 'mystery_state');
    expect(fallback.tone).toBe('neutral');
    expect(fallback.label).toBe('Mystery State');
    expect(getStatusConfig(supportStatusConfig, null).label).toBe('Unknown');
  });
});

describe('humanizeStatusKey', () => {
  it('converts machine keys to readable labels', () => {
    expect(humanizeStatusKey('waiting_for_user')).toBe('Waiting For User');
    expect(humanizeStatusKey('WAITING-FOR-USER')).toBe('Waiting For User');
  });
});
