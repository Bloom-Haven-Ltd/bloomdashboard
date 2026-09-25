# Production Hardening Checklist

> Verification state as of Phase 12. Items marked ✅ are verified in source;
> ⚠ items require deployment-environment confirmation (cannot be verified from
> the repository alone).

## Environment & configuration

- ✅ Dashboard has **no secrets**: `NEXT_PUBLIC_*` only; Firebase web config is public-by-design and auth is migrated to FastAPI JWT. `.env.local` untracked; `.gitignore` covers `.env*`.
- ✅ Backend `.env` untracked, gitignored; `.env.example` documents shape without values.
- ⚠ `CORS_ORIGINS` **must** be pinned to exact production origins in the production environment (default includes localhost; `allow_credentials=True` — SEC-9).
- ✅ API base URL is env-driven (`NEXT_PUBLIC_API_URL`, same-origin `/api/v1` rewrite default) — no hardcoded localhost in source.
- ⚠ Production WebSocket URL, if enabled later, must be `wss://` behind the same origin policy.

## Transport & headers

- ✅ HSTS (2-year, preload), X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP set in `next.config.ts`.
- ✅ CSP injected per environment by `src/proxy.ts`; `unsafe-inline`/`unsafe-eval` documented as required by Next hydration + Recharts today, nonce-based tightening tracked in that file (do not "fix" blindly).
- ⚠ TLS termination at the platform edge (Vercel + backend host) — confirm HSTS preload submission and API certificate chain.
- ✅ Bearer-token auth → no cookies → CSRF not applicable to dashboard↔API channel.

## Secrets & history

- ✅ No secret patterns (`sk_live`/`sk_test`, private keys, `AIza…` beyond the public web config) in tracked source of either repo.
- ✅ Firebase service account, Paystack secret, DB/Redis credentials exist server-side only; never returned by admin APIs (settings surface is key/value/type only).
- ⚠ Run a gitleaks **history** scan (GA-6) before production cutover; rotate anything found (§52 — deleting the file is not enough).
- ⚠ Add secret + dependency scanning to CI (GA-5): `gitleaks`, `pip-audit`, `npm audit --production`.

## Authentication & sessions

- ✅ Every privileged request validates a Firebase ID token **and** an ACTIVE server-side `Session` row; single-active-session enforced.
- ✅ Dashboard stores only an opaque session handle (`localStorage`); authority is server-side. Logout tears down the handle and the client defers to the server's 401 path.
- ⚠ MFA for admin accounts is **not implemented** (GA-1) — documented gap with strategy in threat-model.md; treat as required before broader admin onboarding.
- ⚠ Confirm production session/idle timeout policy (§86) in the backend session service.

## Backend enforcement (fixed this phase)

- ✅ Reminders router: every endpoint auth-gated; appointment detail participant-or-admin (SEC-1/3); SMS relay self-or-admin (SEC-2).
- ✅ Legacy refund route admin-gated (SEC-4); admin refund route functional with state-machine + amount validation + audit (SEC-5); OTP/PIN relay auth-gated (SEC-6).
- ⚠ Rate limiting: limiter exists but has **no call sites** (GA-3) — enforce on login, password reset, search, exports, refunds, withdrawals before public exposure.
- ⚠ Add service-layer role check inside `RefundService.process_refund` (defense in depth beyond the router gate).

## Data protection

- ✅ PHI minimization at the parse boundary: clinical fields, agora tokens, patient PII (lab feed), bank account numbers are stripped/masked before any component or query cache sees them.
- ✅ No PHI in URLs (filters are status/page only); client audit events carry IDs, never content.
- ✅ Browser storage audit: session handle + sidebar collapse state only.
- ⚠ Backend serializer fixes requested: lab-feed patient PII (PL-3), withdrawal account masking (SEC-7), consultation clinical fields for admin reads.
- ⚠ Error tracking / telemetry: none wired yet — when added, scrub Authorization, cookies, tokens, PHI, payment payloads (§122) by configuration, not convention.

## Uploads & documents

- ✅ MIME allowlist + 10 MB cap + Cloudinary server-side credentials; documents reached only via server-issued access.
- ⚠ Magic-byte/content sniffing (GA-4) recommended before public partner onboarding.

## Webhooks & background work

- ✅ Paystack webhook: HMAC SHA512 verification, `ProcessedWebhookEvent` idempotency, payload hashing, transfer lifecycle handled server-side.
- ✅ No PHI in queue payloads (reminder tasks carry IDs and channels only).

## Pre-release security gate (run before Phase 13)

1. `gitleaks` history scan on both repos (GA-6) → rotate any hit.
2. `pip-audit` + `npm audit` triage (GA-5) → fix critical/high or document acceptance (§105).
3. CORS pinned + HSTS confirmed in production env.
4. Rate limiter wired on auth + high-risk mutations (GA-3).
5. Re-run full dashboard gates (`tsc`, lint, vitest, build) and backend `py_compile`.
6. Staging penetration pass per §128 (authentication, BOLA, financials, webhooks, uploads).
