# Security Findings Register

> Phase 12 adversarial review of `bloomdashboard` + `bloom-backend`.
> Severity per §130. "Fixed" = verified change in this phase; "Requested" =
> backend work documented for the owning team.

## Critical / High

| ID | Severity | Component | Finding | Status |
| --- | --- | --- | --- | --- |
| SEC-1 | **CRITICAL** | `consultations/reminders_router.py` | `GET /appointments/{id}` (Phase 7 P1, still open) served **full consultation detail — clinical notes, patient DOB/gender, provider data — with no authentication**; `get_by_id` has no ownership check and the route had no auth dependency. | **Fixed** — route now requires auth + participant-or-admin check. |
| SEC-2 | **CRITICAL** | `consultations/reminders_router.py` | `POST /notifications/sms` was unauthenticated with caller-supplied `recipientId`, title, and body — an open SMS-pumping / spoofed-notification relay. | **Fixed** — auth required; recipient restricted to self unless admin; 422 on malformed UUID. |
| SEC-3 | **HIGH** | `consultations/reminders_router.py` | All reminder/task/escalation stubs (`POST /reminders/tasks`, `PATCH|DELETE /reminders/tasks/{id}`, `PATCH /reminders/{id}/delivery-status`, `GET /reminders/{id}`, preferences by arbitrary `user_id`) were unauthenticated. Stubs now, real entities later — but every future implementer would inherit the open gate. | **Fixed** — all require an authenticated session; per-user preference endpoints enforce self-or-admin. |
| SEC-4 | **HIGH** | `payments/router.py` | Legacy `POST /payments/refund` (Phase 9 FS-8, still open) required only authentication — **any authenticated user could refund any consultation payment**; `RefundService.process_refund` performs no role check. | **Fixed** — route now requires the `admin` role. Service-level role check still requested (defense in depth). |
| SEC-5 | **HIGH** | `payments/router.py` | Admin refund route `POST /payments/{id}/refund` (Phase 9 FS-9) was **broken**: `RefundService(db, provider)` raised TypeError — admin refunds never worked. | **Fixed** — route resolves the payment server-side, enforces state machine (`SUCCESS`/`PARTIALLY_REFUNDED` only) + amount bounds, calls `provider.refund_transaction`, records a `Refund` row, updates `payment.refunded_amount`/status per the state machine, audits `PAYMENT_REFUND_INITIATED`. |
| SEC-6 | **HIGH** | `payments/router.py` | `POST /payments/submit-otp` and `/submit-pin` were unauthenticated relays to Paystack direct charge — anyone on the internet could drive OTP/PIN flows for arbitrary references. | **Fixed** — both now require authentication. |
| SEC-7 | **MEDIUM** | `WithdrawalResponse` (Phase 9 FS-10, still open) | Full bank account numbers serialized to admins. | **Requested** — backend masking (dashboard already masks at parse; raw value still transits TLS to an authorized admin, hence MEDIUM). |
| SEC-8 | **MEDIUM** | `WalletService` | No row-lock on `get_payment_by_id`-style wallet reads is fine, but refund path in `process_refund` mutates wallet balances without re-validating against ledger — compensating-entry only. | **Requested** — reconcile with `reconciliation_service` run in ops; no exploit path found from the dashboard. |
| SEC-9 | **MEDIUM** | `app/config.py` | `CORS_ORIGINS` defaults include localhost and a Vercel preview; `allow_credentials=True` + wildcard methods. Acceptable only if production env overrides `CORS_ORIGINS`. | **Requested** — production config must pin exact origins; documented in production-hardening.md. |
| SEC-10 | **MEDIUM** | Rate limiting | Redis sliding-window limiter exists (`shared/rate_limiter.py`) but **zero call sites** — login, password reset, search, exports, and admin mutations are unthrottled. | **Requested** — enforce on auth + high-risk admin mutations (§45); blocker for §131 only if brute-force exposure is confirmed externally. |
| SEC-11 | **LOW** | `websockets_router.py` | WS auth accepts custom JWT **or** Firebase token; per-user `send_json_to_user` scoping is sound, but no subscription-level authorization model exists (no admin broadcast — CG-7/PS-6). | **Requested** — design note for realtime phase. |
| SEC-12 | **LOW** | `payments/router.py` | Legacy `POST /payments/consultation` accepts client-supplied amounts via the MOCK path (FS-13). Not reachable from the dashboard. | **Requested** — backend cleanup. |

## Non-findings (verified sound)

- **Secrets**: no secret material in either repo's tracked files. `bloomdashboard/.env.local` is untracked (`git ls-files` clean); contains only a Firebase **web SDK** config (public by design, and auth is migrated to FastAPI JWT anyway). Backend `.env` untracked, `.gitignore` covers it. No `sk_live`/`sk_test`/private-key patterns in source.
- **Token handling**: dashboard keeps only an opaque session-ID handle in `localStorage` (authority is the server-side `Session` row validated with the Firebase ID token on every request); no tokens in storage.
- **XSS**: zero `dangerouslySetInnerHTML`/`innerHTML` usage; React escaping everywhere; no `target="_blank"` without rel.
- **Headers/CSP**: deliberate CSP set in `src/proxy.ts` (documents why `unsafe-inline`/`unsafe-eval` are currently required by Next hydration + Recharts; nonce tightening tracked there); X-Frame-Options DENY, HSTS preload, nosniff, Referrer-Policy, Permissions-Policy all present in `next.config.ts`.
- **Auth flow**: backend validates a Firebase ID token **plus** a session ID against an ACTIVE `Session` row on every request (`get_current_session`) — JWT claims are never trusted as authorization by themselves; `require_role` re-checks role server-side on every admin route.
- **CSP boundary**: no server-only modules in client bundles (dashboard is a pure client; all secrets server-side in FastAPI).
- **Uploads**: MIME allowlist + 10 MB cap + content-type enforcement in `uploads/router.py`; storage is Cloudinary (server-side credentials).
- **Webhooks**: Paystack HMAC SHA512 signature verification + `ProcessedWebhookEvent` idempotency + payload hashing (§42 verified in source, Phase 9).
- **Audit**: append-only by design; no edit/delete endpoints exist; settings/verification/dispute/refund mutations are server-audited.

## Testing evidence

- `bloom-backend`: `py_compile` on both modified routers — pass.
- `bloomdashboard`: `tsc --noEmit`, ESLint 0 warnings, vitest 111/111, production build — all pass (run in Phase 11 audit and re-run after any dashboard change).
