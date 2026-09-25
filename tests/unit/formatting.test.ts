import { describe, expect, it } from 'vitest';
import { formatCount, formatGhs } from '@/lib/formatting/money';
import {
  PLATFORM_TIME_ZONE,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatTime,
} from '@/lib/formatting/dates';

describe('formatGhs', () => {
  it('formats authoritative amounts with the GHS code', () => {
    expect(formatGhs(250)).toMatch(/GHS/);
    expect(formatGhs(250)).toContain('250.00');
    expect(formatGhs('1234.5')).toContain('1,234.50');
  });

  it('never renders misleading zeros for missing values', () => {
    expect(formatGhs(null)).toBe('—');
    expect(formatGhs(undefined)).toBe('—');
    expect(formatGhs('')).toBe('—');
    expect(formatGhs(Number.NaN)).toBe('—');
  });
});

describe('formatCount', () => {
  it('groups large numbers', () => {
    expect(formatCount(12345)).toContain('12,345');
  });

  it('uses an em dash for invalid input', () => {
    expect(formatCount(null)).toBe('—');
    expect(formatCount(undefined)).toBe('—');
  });
});

describe('date formatting', () => {
  // 2026-09-23 14:05 UTC → 14:05 in Accra (GMT, no DST) on the same day.
  const timestamp = '2026-09-23T14:05:00Z';

  it('pins rendering to Africa/Accra regardless of device timezone', () => {
    expect(PLATFORM_TIME_ZONE).toBe('Africa/Accra');
    expect(formatTime(timestamp)).toBe('14:05');
    // Month abbreviation varies by ICU version (Sep / Sept) — assert structure.
    expect(formatDate(timestamp)).toMatch(/^23 Sep(t)? 2026$/);
    expect(formatDateTime(timestamp)).toMatch(/^23 Sep(t)? 2026, 14:05$/);
  });

  it('handles invalid and missing input gracefully', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatTime(undefined)).toBe('—');
  });

  it('renders coarse relative time', () => {
    const now = new Date('2026-09-23T15:00:00Z');
    expect(formatRelativeTime('2026-09-23T14:58:00Z', now)).toBe('2m ago');
    expect(formatRelativeTime('2026-09-23T14:00:00Z', now)).toBe('1h ago');
    expect(formatRelativeTime('2026-09-21T15:00:00Z', now)).toBe('2d ago');
    expect(formatRelativeTime('2026-09-23T14:59:50Z', now)).toBe('just now');
  });
});
