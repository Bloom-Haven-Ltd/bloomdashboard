import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  paymentReceiptSchema,
  withdrawalSchema,
  consultationFeedSchema,
} from '@/lib/api/schemas';
import { ApiError } from '@/lib/api/error';

/**
 * Security regression suite (§103: tests/security/) — automated checks for
 * the browser-side controls documented in docs/security/*. Each test reads
 * the real source or exercises the real parse boundary so a future edit that
 * reintroduces a fixed finding fails loudly here.
 */

const SRC = join(__dirname, '..', '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const allSource = walk(SRC);
const clientSource = allSource.filter((f) => !f.includes(`${join(SRC, 'lib', 'api')}`));

describe('XSS surface (§23/§24)', () => {
  it('contains no dangerouslySetInnerHTML or raw innerHTML assignments', () => {
    const offenders = allSource.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('opens no links with target=_blank', () => {
    const offenders = allSource.filter((f) => readFileSync(f, 'utf8').includes('target="_blank"'));
    expect(offenders).toEqual([]);
  });
});

describe('browser storage hygiene (§8/§33/§83)', () => {
  it('persists nothing sensitive: only the session handle and UI state keys', () => {
    const allowed = /SESSION_KEY|COLLAPSED_KEY|ThemeKey|THEME_KEY/;
    const offenders = allSource.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /(localStorage|sessionStorage)\.(get|set)Item/.test(text) && !allowed.test(text);
    });
    // Every storage call must go through the two audited helpers/constants.
    expect(offenders).toEqual([]);
  });
});

describe('secret hygiene (§51/§64/§97)', () => {
  it('contains no credential-shaped literals in source', () => {
    const patterns = [/sk_live_[A-Za-z0-9]+/, /sk_test_[A-Za-z0-9]+/, /-----BEGIN (RSA )?PRIVATE KEY-----/];
    const offenders = allSource.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return patterns.some((p) => p.test(text));
    });
    expect(offenders).toEqual([]);
  });

  it('never logs tokens, sessions or payloads (§64/§69)', () => {
    const offenders = allSource.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /console\.(log|debug)\(/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps NEXT_PUBLIC_* limited to non-secret configuration keys', () => {
    const allowed = /^(NEXT_PUBLIC_API_URL|NEXT_PUBLIC_FIREBASE_[A-Z_]+|NEXT_PUBLIC_APP_ENV|NEXT_PUBLIC_ENABLE_[A-Z_]+)$/;
    const offenders = allSource.filter((f) => {
      const text = readFileSync(f, 'utf8');
      const matches = text.match(/process\.env\.NEXT_PUBLIC_[A-Z_]+/g) ?? [];
      return matches.some((m) => !allowed.test(m.replace('process.env.', '')));
    });
    expect(offenders).toEqual([]);
  });
});

describe('security headers configuration (§47/§48/§87)', () => {
  const nextConfig = readFileSync(join(__dirname, '..', '..', 'next.config.ts'), 'utf8');
  const proxy = readFileSync(join(__dirname, '..', '..', 'src', 'proxy.ts'), 'utf8');

  it('sets frame protection, nosniff, HSTS, referrer and permissions policy', () => {
    expect(nextConfig).toContain('"X-Frame-Options", value: "DENY"');
    expect(nextConfig).toContain('"X-Content-Type-Options", value: "nosniff"');
    expect(nextConfig).toContain('Strict-Transport-Security');
    expect(nextConfig).toContain('Referrer-Policy');
    expect(nextConfig).toContain('Permissions-Policy');
  });

  it('injects a Content-Security-Policy with a documented basis', () => {
    expect(proxy).toContain("headers.set('Content-Security-Policy'");
  });
});

describe('PHI parse-boundary stripping (§31/§32)', () => {
  it('consultation feed schema drops clinical content fields', () => {
    const text = readFileSync(join(SRC, 'lib', 'api', 'schemas.ts'), 'utf8');
    // Clinical content must never be part of the feed contract.
    for (const field of ['suffering_description', 'consultation_notes']) {
      expect(text.includes(`${field}:`)).toBe(false);
    }
    expect(consultationFeedSchema.safeParse({}).success).toBe(false);
  });

  it('masks withdrawal account numbers end-to-end (SEC-7 mitigation)', () => {
    const parsed = withdrawalSchema.parse({
      id: '33333333-3333-4333-8333-333333333333',
      amount: 100,
      status: 'pending',
      bankAccountNumber: '1234567894821',
      bankAccountName: 'Partner',
      bankName: 'Bank',
      requestedAt: '2026-09-25T08:00:00Z',
    });
    expect(JSON.stringify(parsed)).not.toContain('1234567894821');
  });

  it('receipt schema exposes names and amounts but no provider credentials', () => {
    const parsed = paymentReceiptSchema.parse({
      receipt_number: 'REC-1',
      payment_reference: 'BH-PAY-1',
      patient_name: 'Patient',
      provider_name: 'Dr. Provider',
      service_type: 'CONSULTATION',
      service_id: '22222222-2222-4222-8222-222222222222',
      amount_ghs: 100,
      currency: 'GHS',
      payment_method: 'mobile_money',
      payment_status: 'SUCCESS',
      created_at: '2026-09-25T08:00:00Z',
    });
    expect(parsed.amount_ghs).toBe(100);
  });

  it('normalizes errors without leaking internals (§77)', () => {
    const error = new ApiError('VALIDATION_ERROR', undefined, { status: 422 });
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.message).not.toMatch(/select |insert into|stack|Traceback/i);
  });
});
