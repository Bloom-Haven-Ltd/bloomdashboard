# Architecture Overview

The Bloom Haven Health Admin Dashboard is a **privileged client over the FastAPI backend**. It displays authoritative data, collects administrative intent, and never implements authoritative business logic (§4).

```
Component → Feature Hook (TanStack Query) → Feature Service (zod boundary)
          → API Client (auth, errors, IDs) → FastAPI → PostgreSQL/Redis
```

## Layer responsibilities

| Layer | Location | Rule |
|---|---|---|
| Pages | `src/app/(dashboard)/*` | Composition + page state only; no fetch logic |
| Feature hooks | `src/features/*/hooks.ts` | TanStack Query wiring, cache invalidation |
| Feature services | `src/features/*/service.ts` | Endpoint contracts; zod parse on every response |
| API client | `src/lib/api/` | The single fetch boundary: auth headers, `X-Request-ID`, timeouts, `ApiError` normalization, 401 teardown |
| Permissions | `src/lib/permissions/` | Frontend RBAC **UX**; never a security boundary |
| Formatting | `src/lib/formatting/` | GHS money (display-only), Africa/Accra dates |
| Status config | `src/constants/status.ts` | Single source of status visuals/semantics |

## Non-negotiable principles

1. **The backend is authoritative** — for identity, permissions, money, clinical records, verification, and audit.
2. **One fetch boundary** — no component calls `fetch` directly; mutations are never auto-retried.
3. **Every response is untrusted** — validated with zod at the service boundary; failures surface as `ApiError('VALIDATION_ERROR')`.
4. **No secrets in the client** — Firebase web config is public by design; nothing else ships to the browser.
5. **PHI discipline** — IDs in logs/telemetry/URLs, never clinical content (§33).
6. **Observe → investigate → authorize → act → audit** — the dashboard's only mutation path (§89).

## Backend role model note

The FastAPI backend currently enforces a single `admin` role (`require_role("admin")` on every `/admin/*` route — verified). The frontend ships a full permission catalog + role matrix (`src/lib/permissions/`) so granular admin roles land as backend work plus a matrix extension — no page rewrites.

## Error handling contract

All failures surface as `ApiError { code, message, requestId }` (taxonomy in `src/lib/api/error.ts`). Pages render `ErrorState` with a retry action and support reference. No stack traces ever reach the UI.
