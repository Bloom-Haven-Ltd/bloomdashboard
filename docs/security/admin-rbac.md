# Admin RBAC

## Current model (verified against bloom-backend)

The backend enforces a **single `admin` role** — every `/admin/*` route depends on `get_current_admin = require_role("admin")`, and every request is re-authorized server-side against the session (`X-Session-ID` + Firebase token). There is no granular admin-role table yet.

## Frontend scaffold (this repo)

`src/lib/permissions/` defines:

- **Permission catalog** (`PERMISSIONS`) — 31 permissions across People, Operations, Finance, Trust & Safety, Support, Platform.
- **Role matrix** (`ROLE_PERMISSIONS`) — `ADMIN` holds the full catalog today.
- `createPermissionChecker(role)` — bound checker used by `usePermissions()` / `<PermissionGate>`.

Navigation (`src/components/layout/navigation.ts`) and every gated control declare the permission they need. When the backend introduces granular roles, the rollout is:

1. Backend: add role values + per-route permission checks (authoritative change).
2. Frontend: map new roles in `ROLE_PERMISSIONS` (e.g. `FINANCE_ADMIN = finance.* + audit.read`).
3. No page or component changes required.

## Hard rules

- `PermissionGate` is **UX only**. Hiding a button authorizes nothing; the backend re-checks every request (§9).
- Never gate by client state alone for sensitive flows — require the server round-trip and rely on its `403 FORBIDDEN`.
- Sensitive views record client audit events (`DOCUMENT_ACCESSED`, `CLINICAL_RECORD_ACCESSED`) via `lib/auth/auditClient.ts` → `POST /admin/audit-logs`.
- Step-up authentication for high-risk finance actions is specified but not yet implemented — it is a release requirement for Phase 9 finance mutations, which is why those mutations are deliberately not built yet.
