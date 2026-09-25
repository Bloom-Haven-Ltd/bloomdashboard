# Bloom Haven Health — Admin Dashboard

Production-grade administrative control plane over the Bloom Haven Health platform (FastAPI backend). The dashboard is a **privileged client**: it displays authoritative data, collects administrative intent, and never implements authoritative business logic.

```
Component → Feature Hook (TanStack Query) → Feature Service (zod boundary)
          → API Client (auth, errors, request IDs) → FastAPI → PostgreSQL / Redis
```

## Prerequisites

- Node.js 20+
- A reachable Bloom Haven Health FastAPI backend (local: `http://127.0.0.1:8000`)
- Firebase web project credentials (client authentication only)

## Installation

```bash
npm install
cp .env.example .env.local   # fill in the NEXT_PUBLIC_* values
npm run dev                  # http://localhost:3000
```

The dev server proxies same-origin `/api/v1/*` to `API_PROXY_TARGET` (default `http://127.0.0.1:8000`). Never point a local dev environment at production.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals + TS) |
| `npm test` / `npm run test:watch` | Vitest unit suite |

## Environment variables

See [`.env.example`](.env.example). Only `NEXT_PUBLIC_*` values reach the browser. Rules:

- No secrets in this app — service-account keys, Paystack secret keys and DB passwords belong server-side only.
- `NEXT_PUBLIC_FIREBASE_*` is the public-by-design Firebase **web** config (authentication only; no Firestore/Storage/Admin SDK in this codebase).
- `API_PROXY_TARGET` is server-side only.

## Architecture

Documented in [`docs/architecture/overview.md`](docs/architecture/overview.md), with the full Phase 1 audit (every keep/move/merge/replace/delete decision) in [`docs/architecture/inventory.md`](docs/architecture/inventory.md).

Key layers: pages (`src/app/(dashboard)`) → feature hooks (`src/features/*/hooks.ts`, TanStack Query) → feature services (`src/features/*/service.ts`, zod-validated) → API client (`src/lib/api`). Status visuals come from the single map in `src/constants/status.ts`; formatting from `src/lib/formatting` (GHS money, Africa/Accra dates).

## Authentication

- Firebase client SDK signs the administrator in; a backend session is then created (`POST /auth/session`) and validated on every token refresh (`GET /users/me`).
- localStorage holds only the session ID under `bloom.admin.session_id`, plus a PII-free `bloom.admin.hint` cookie used by the edge proxy for redirect UX.
- Any 401 anywhere triggers the single session-expired path: teardown → `/login`.
- The backend is the authorization authority for every request; client checks are UX only.

## Roles & permissions

The FastAPI backend currently enforces a single `admin` role. The frontend ships a full permission catalog + role matrix (`src/lib/permissions/`) and `<PermissionGate>` so granular admin roles require only backend work plus a matrix extension. Details: [`docs/security/admin-rbac.md`](docs/security/admin-rbac.md).

## API architecture

One fetch boundary (`src/lib/api/client.ts`): auth header injection, `X-Request-ID` correlation, timeouts, `no-store` for sensitive data, normalized `ApiError { code, message, requestId }` (taxonomy in `src/lib/api/error.ts`), single 401 path. Mutations are never auto-retried. Response schemas live in `src/lib/api/schemas.ts` and are the only place payloads are trusted.

## Security

Baseline: CSP (via `src/proxy.ts`), HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP. PHI discipline: no PHI in logs, URLs, telemetry or error copy — record IDs only. Sensitive view events (`DOCUMENT_ACCESSED`, `CLINICAL_RECORD_ACCESSED`) post to `POST /admin/audit-logs` via `src/lib/auth/auditClient.ts`. Audit records are append-only; no dashboard code edits or deletes them.

## Testing

```bash
npm test
```

Unit coverage: permission matrix, ApiError taxonomy/normalization, status configs, GHS/Accra formatting, session storage lifecycle + hint cookie, PermissionGate semantics. Integration and E2E suites are scheduled phases (see roadmap below).

## Deployment

1. Set production env vars (`NEXT_PUBLIC_API_URL` to the public API origin, `API_PROXY_TARGET` to the internal API service, Firebase web config for the production project).
2. `npm run build` — must pass typecheck and lint with zero errors.
3. Verify the release checklist: no localhost URLs, no dev Firebase project, no mock data, correct metadata/branding.
4. Rollback: redeploy the previous build artifact; the dashboard holds no state, so rollback is instantaneous.

## Troubleshooting

- **Blank page after login** — check the browser console for `SESSION_EXPIRED`; the backend session was rejected (`GET /users/me`).
- **`AUTHENTICATION_NOT_CONFIGURED`-style errors** — Firebase web config missing in this environment; see `.env.example`.
- **403 on an action** — the backend denied the permission; this is expected behavior for unauthorized roles, not a bug.

## Incident handling

1. Suspend the affected admin (backend `PATCH /admin/users/{id}/status`) and revoke sessions (`DELETE /auth/sessions/{id}`).
2. Pull the audit trail (`GET /admin/audit-logs`) filtered by the actor and time window.
3. For suspected credential exposure: rotate the exposed credential server-side, then force sign-out-everywhere from the profile page.

## Roadmap

Foundation phases 1–3 are complete. Remaining (per the master plan): operational dashboard intelligence (Phase 4), people/partner detail views (5), verification workflow depth (6), clinical operations (7), pharmacy & laboratory depth (8), finance actions with idempotency + step-up auth and reconciliation workspace (9), observability (10), performance & accessibility passes (11), security testing & hardening (12), E2E cross-platform tests (13), release (14).

## Known follow-ups

- Replace `middleware.ts`-era CSP `unsafe-inline`/`unsafe-eval` with nonce-based CSP (tracked; requires hydration-safe rollout).
- Upgrade vitest to v5 (dev-only `@vitest/mocker` advisory; breaking major).
- Backend: granular admin roles, `GET /auth/sessions` pagination, server-side global search.
- Monorepo note: a twin of the removed credential-loading script exists at `../bloom-health-web/inspect_appointments.js` — outside this repo; flag for the platform team.
# bloomdashboard
