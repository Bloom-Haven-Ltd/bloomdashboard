# Threat Model

> Scope: the complete chain from the admin browser through Next.js, the API
> client, FastAPI, data stores, external providers, WebSockets, and workers.
> Companion documents: `authorization-matrix.md`, `security-findings.md`,
> `production-hardening.md`.

## 1. Assets & classification (§5/§7)

| Class | Assets |
| --- | --- |
| Public | Marketing info, `GET /health` status booleans, `GET /app/config` operational flags, Firebase web SDK config (public by design) |
| Internal | Operational metadata, feature flags, system settings (non-secret values), announcement content |
| Sensitive | User identities, partner records, verification state, payment records, wallet balances, withdrawal requests, audit logs |
| Highly sensitive | PHI (consultation notes, clinical fields, DOB/gender), prescriptions, lab results, identity/verification documents, admin credentials, Paystack secret, Firebase service account, database/Redis credentials |

## 2. Trust boundaries

```text
TB1  Admin browser ── HTTPS ──▶ Next.js (Vercel)          [untrusted client]
TB2  Next.js ── rewrite/proxy ──▶ FastAPI                  [session-validated]
TB3  FastAPI ──▶ PostgreSQL / Redis                        [server-internal]
TB4  Paystack ── webhook ──▶ FastAPI                       [signature-verified]
TB5  Flutter apps / Admin ── WebSocket ──▶ FastAPI         [token-verified]
TB6  FastAPI ──▶ Paystack / Firebase / Agora / SMS / Cloudinary  [secret-held]
```

The frontend is never a security boundary (§3): every authorization decision is
re-made inside FastAPI per request.

## 3. Threat catalog & dispositions

| # | Threat | Boundary | Control (verified) | Disposition |
| --- | --- | --- | --- | --- |
| 1 | Account takeover / credential theft | TB1→TB2 | Firebase ID token + server-side `Session` row (ACTIVE) required on every call; single-active-session rule | Mitigated; MFA absent — **gap GA-1**, §9 |
| 2 | Session hijacking / fixation | TB1 | Opaque session-ID handle in `localStorage` (no authority), re-validated server-side each request | Mitigated |
| 3 | Privilege escalation (vertical) | TB2 | `require_role` re-checks role server-side; role never read from client claims | Mitigated; role-check coverage audit pending — **GA-2** |
| 4 | BOLA/IDOR | TB2 | Per-object checks (consultations participant-or-admin, payments owner-or-admin, wallets self-or-admin, settings/disputes admin-only) | Mitigated; reminders router was the hole — fixed (SEC-1/3) |
| 5 | Broken access control on stubs | TB2 | All reminder stubs now auth-gated (SEC-3) | Fixed |
| 6 | PHI exposure via API | TB2 | Admin consultation reads exist but clinical fields stripped at dashboard zod parse; lab feed patient PII stripped (PL-3) | Mitigated; backend serializer fix requested (PL-3) |
| 7 | Financial manipulation | TB2 | Amounts/state computed server-side; refund route fixed to validate state + bounds (SEC-5); wallet math row-locked | Mitigated |
| 8 | Refund abuse (duplicate/over/again) | TB2 | `refunded_amount` guard, state machine, provider-side validation; legacy route now admin-only (SEC-4) | Fixed; service-layer role check requested |
| 9 | Withdrawal abuse | TB2 | PIN + row-locked wallets + Paystack transfer + webhook completion; approve/reject admin-gated | Mitigated |
| 10 | Verification bypass | TB2 | Verification workflow is server-audited; dashboard read-only on decisions | Mitigated |
| 11 | Appointment manipulation | TB2 | Participant-only mutations (CG-1); admin read-only by design | Mitigated |
| 12 | Prescription access abuse | TB2 | Admin detail gated behind `prescriptions.clinical` permission + client audit; clinical fields stripped from list feeds | Mitigated |
| 13 | Lab result exposure | TB2 | Samples/results endpoints are lab-role-scoped (PL-2) | Mitigated |
| 14 | WebSocket auth bypass | TB5 | Token-verified connection; per-user event delivery only | Mitigated; subscription model pending (SEC-11) |
| 15 | Webhook forgery / replay | TB4 | HMAC SHA512 signature + `ProcessedWebhookEvent` idempotency + payload hash | Mitigated |
| 16 | Rate-limit abuse | TB2 | Limiter implemented but **not enforced anywhere** — **GA-3** (SEC-10) | Open gap |
| 17 | Injection (SQL) | TB3 | SQLAlchemy parameterized queries throughout; no string-built SQL found in admin-relevant paths | Mitigated |
| 18 | XSS (stored/reflected/DOM) | TB1 | React escaping; zero `dangerouslySetInnerHTML`; CSP present | Mitigated |
| 19 | CSRF | TB1→TB2 | Bearer-token auth (no cookies) → CSRF not applicable to the dashboard↔API channel | N/A (revisit if cookie auth lands) |
| 20 | SSRF | TB3/TB6 | No admin-reachable endpoint fetches caller-supplied URLs | Mitigated |
| 21 | File upload abuse | TB2 | MIME allowlist, 10 MB cap, Cloudinary server-side | Mitigated; content-type-only reliance noted — **GA-4** |
| 22 | Malicious document access | TB2 | Documents via Cloudinary signed flows, server-issued | Mitigated |
| 23 | Dependency compromise | CI | npm/pip audit not yet in CI — **GA-5** | Open gap |
| 24 | Secret exposure | Repo/CI | No secrets tracked (verified `git ls-files`); `.env*` ignored; dashboard holds no secrets | Mitigated; history scan + secret scanning in CI — **GA-6** |
| 25 | Log injection / PHI in logs | TB2 | Structured logging; dashboard zero console.log; audit metadata is IDs-only | Mitigated |
| 26 | Audit tampering | TB2 | Audit rows append-only; no mutation endpoints exist | Mitigated |
| 27 | DoS via expensive endpoints | TB2 | Pagination caps on all admin feeds; reconcile bounded to ≤200; search query-length capped | Mitigated |
| 28 | Configuration abuse | TB2 | Settings PATCH admin-only, server-audited with old/new values; secrets never returned | Mitigated |
| 29 | Enumeration | TB2 | Opaque UUIDs; 404s uniform; search BOLA-scoped | Mitigated |
| 30 | Clickjacking | TB1 | X-Frame-Options DENY (+ CSP frame-ancestors) | Mitigated |
| 31 | Open redirect | TB1 | No redirect params; login flow is static-route only | Mitigated |
| 32 | Admin invitation abuse | TB2 | No admin-invitation feature exists | N/A |

## 4. Known gaps register (GA = gap, action needed)

| ID | Gap | Severity | Strategy (§9: document, don't pretend) |
| --- | --- | --- | --- |
| GA-1 | No MFA on admin accounts | HIGH | FastAPI session model is the right seam: enforce TOTP enrolment for `admin` role at login; step-up re-auth for refund/withdrawal/config mutations |
| GA-2 | Role-check coverage audit (every admin endpoint carries `require_role`/`get_current_admin`) | MEDIUM | Automated route-table scan comparing admin-prefixed routes to auth dependencies — proposed CI check |
| GA-3 | Rate limiter unenforced | MEDIUM | Wire `check_rate_limit` into login, password reset, search, exports, refunds, withdrawals |
| GA-4 | Upload validation is content-type-based | MEDIUM | Add magic-byte sniffing + image re-encode; PDF text check |
| GA-5 | No dependency/secret scanning in CI | MEDIUM | Add `pip-audit`/`npm audit` + gitleaks to pipeline (§62/§63) |
| GA-6 | Git history not scanned for historical secrets | LOW | One-off gitleaks history scan before production cutover |
