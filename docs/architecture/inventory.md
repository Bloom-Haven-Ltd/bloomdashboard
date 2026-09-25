# Architecture Inventory — Phase 1 Audit

**Date:** 2026-09-23 · **Scope:** `bloomdashboard` (45 source files audited) · **Backend contract verified against `bloom-backend` source.**

## Disposition summary

| Decision | Items |
|---|---|
| KEEP | Firebase Auth client usage, Montserrat + brand tokens (primary `#1E6F5C`, secondary `#FFA62B`, warm-cream background), Tailwind v4 setup, rounded design language, `cn()` util |
| MOVE | Auth state → `src/providers/AuthProvider.tsx`; API access → `src/lib/api/`; per-domain logic → `src/features/*`; status maps → `src/constants/status.ts` |
| MERGE | `AdminGuard` + `ProtectedRoute` → `RequireAdmin`; three overlapping type files → `src/types/api.ts` |
| REFACTOR | `apiClient` → typed API client with error taxonomy; `AuthContext` → hardened `AuthProvider`; login page → design-system rebuild |
| REPLACE | `admin.service.ts` grab-bag → per-feature services; `console.log` audit stub → backend `POST /admin/audit-logs` recorder |
| DELETE | items below |

## Deleted artifacts

| Item | Reason |
|---|---|
| `inspect_appointments.js` | **Security**: imported `./serviceAccountKey.json` (Firebase Admin credentials pattern). §10 release blocker. |
| `TEST_WRITE.md` | Development leftover, no content. |
| `components/sections/*` (8 files) | Marketing-site remnants (Hero, Features, CTA…) — dead routes in an admin console. |
| `components/layout/Header.tsx`, `Footer.tsx`, `AppDownloadQR.tsx` | Consumer-site chrome; only referenced by deleted sections. |
| `react-icons`, `react-qr-code` deps | Superseded by lucide-react; bundle reduction. |
| `types/admin.ts`, `types/models.ts`, `types/shared.ts` | Conflicting duplicate domain models; Firestore `Timestamp` leaked into API contracts. Replaced by `src/types/api.ts`. |
| `lib/services/apiClient.ts` | Logged token length + session ID via `console.error` on every request; localhost fallback; no error taxonomy. Replaced by `src/lib/api/`. |
| `lib/services/admin.service.ts` | ~14 dead Firebase-era `subscribeTo*` wrappers; mock-returning functions; **errors silently swallowed into zero-valued metrics**. Replaced by feature services. |
| `lib/services/audit.service.ts` | Client-side `console.log` audit stub. Replaced by `lib/auth/auditClient.ts` posting to the backend. |
| `components/providers/AuthContext.tsx` | Unbounded `[key: string]: any` user type; client-side credential-migration fallback (sends raw password to a migration endpoint on any login failure). Intentionally not reproduced. |
| Legacy domain pages (`page.tsx`, users, verification, appointments, orders, finance, support, audit-logs, settings, profile, consultations, pharmacies, lab-bookings) | Rebuilt on the design system; "pharmacies" unified into People (`/users?role=pharmacy`). |

## Security defects found & fixed

1. **Service-account loading pattern** (`inspect_appointments.js`) — deleted; no `serviceAccountKey.json` present in repo (verified). Note: a twin copy exists at `bloom-health-web/inspect_appointments.js` in the monorepo — outside this repo's scope, flagged for the platform team.
2. **Session identifiers in logs** — `apiClient.ts` logged token length + session ID per request; new client performs zero sensitive logging.
3. **No-op middleware** — now redirects unauthenticated visitors (presence cookie) and sets CSP + headers.
4. **Hardcoded localhost** — `next.config.ts` rewrite and both API-base reads now env-driven (`API_PROXY_TARGET`, `NEXT_PUBLIC_API_URL`).
5. **Hardcoded Firebase project** (`bloom-health-115ba`) fallback — removed; fail-loud via `env.ts`.
6. **Fake infrastructure-health panel** (hardcoded "PostgreSQL 98% Optimal") — removed; honest error states instead. Real health feeds arrive in Phase 4.
7. **Client-side credential migration fallback** — removed (raw password shipped to a migration endpoint on any failed login).
8. **No security headers** — HSTS, nosniff, frame-deny, Referrer-Policy, Permissions-Policy, COOP + CSP now baseline.

## Verified backend contract (consumed by this dashboard)

`POST/DELETE /auth/session`, `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `GET /users` (admin, paginated), `GET /users/me`, `GET /admin/stats`, `GET /admin/verifications/pending`, `PATCH /admin/verify/{role}/{profile_id}`, `PATCH /admin/users/{id}/status`, `GET /admin/consultations`, `GET /admin/pharmacy-orders`, `GET /admin/lab-bookings`, `GET /admin/finance/transactions`, `GET /admin/settings`, `PATCH /admin/settings/{key}`, `GET/POST /admin/audit-logs`, `GET /admin/disputes`, `PATCH /admin/disputes/{id}/resolve`, `GET /admin/analytics/performance`.

**Known-but-unconsumed (Phase 9+):** `/wallets/reconcile`, `/withdrawals/pending`, `/withdrawals/{id}/approve|reject` — deliberately not wired: refund/withdrawal flows require idempotency keys, reason capture, and step-up confirmation before any UI exists for them.

## Test coverage added

`tests/unit/`: permissions matrix, ApiError taxonomy/normalization, status configs, GHS/date formatting (Accra), session storage lifecycle + hint cookie, PermissionGate semantics.
