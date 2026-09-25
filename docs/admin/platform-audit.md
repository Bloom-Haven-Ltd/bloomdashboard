# Platform, Audit & Observability — Capability Audit (Phase 10)

> Audited: `bloom-backend/app/{main.py,shared/{audit_log,audit_utils,websockets}.py,
> modules/{admin,platform,notifications,search}}` and the dashboard's existing
> `/audit-logs`, `/settings`, error boundaries, security headers. Everything the
> dashboard builds on was verified in source; gaps are dependencies (PS-…), never faked.

## 1. Health & observability (backend reality)

| Capability | Status | Source |
| --- | --- | --- |
| Single health endpoint | ✅ `GET /health` (also `/api/v1/health`), public, no auth | `app/main.py` L114–140 |
| Database check | ✅ `SELECT 1` → boolean | same |
| Redis check | ✅ `PING` → boolean | same |
| Version | ✅ `settings.APP_VERSION` | same |
| Aggregate status | ✅ `healthy` only when db **and** redis ok | same |
| Per-dependency health (Firebase/Paystack/Agora/SMS/Cloudinary) | ❌ none (PS-1) | — |
| Liveness/readiness separation | ❌ none (PS-1) | — |
| API metrics (volume/latency/percentiles) | ❌ none (PS-9) | — |
| Background-job framework + monitoring | ❌ no celery/apscheduler/arq; `reminders_worker.py` is an in-process loop (PS-7) | — |
| WebSocket connection metrics | ❌ none; per-user `send_json_to_user` only, `broadcast_to_role` empty stub (PS-6, carried from CG-7) | `app/shared/websockets.py` |

`GET /health` shape: `{ status: 'healthy'|'unhealthy', version, database: bool, redis: bool }`.

## 2. Audit infrastructure (backend reality)

**Two systems exist:**

1. **`audit_logs`** (`app/modules/admin/models.py` AuditLog) — the general admin trail:
   `user_id, action, target_type, target_id, old_value(JSONB), new_value(JSONB), ip_address, created_at`.
   Written by `app/shared/audit_utils.log_to_audit_trail` (settings changes, dispute resolution,
   refunds, verification actions, …) and by the client recorder via `POST /admin/audit-logs`.
   - Read: `GET /admin/audit-logs` (admin) — **paginated only, zero filters** (no action/actor/date/resource query params — PS-2).
   - No single-event endpoint (PS-2b) → the dashboard renders event detail as an in-row drawer from feed data.
   - No `request_id`/`correlation_id` columns (PS-3); the dashboard sends `X-Request-ID` on every call but the backend does not persist or echo it.
   - No severity field; severity is derived **display-only** from action names.
   - No retention/deletion endpoints — append-only by omission (satisfies §15/§58 for now; retention policy itself is a backend concern).
2. **`phi_audit_logs`** (`app/shared/audit_log.py`) — PHI access trail with an auto-middleware
   (`AuditMiddleware`) for mutating requests on `/consultations`, `/prescriptions`, `/patients`
   + fine-grained service-level logging. **No admin read endpoint** (PS-4).

Indexing: `user_id`, `action`, `created_at` are indexed on both tables (matches §62 patterns);
no index on `target_id`/`resource` (PS-10).

## 3. Security events (backend reality)

No dedicated security-event model, no severity engine, no security feed (PS-5).
Security-relevant signals are ordinary audit rows (FAILED/REJECT/DENIED/SUSPEND actions,
failed logins where services log them). The dashboard's Security Events view is therefore a
**client-side filtered lens over the audit feed**, explicitly labeled as such — severity shown
is display classification, never backend truth (§18).

## 4. Configuration & flags (backend reality)

| Surface | Endpoint | Auth | Shape |
| --- | --- | --- | --- |
| App config | `GET /app/config` | public | `maintenance_mode`, `force_update`, `minimum_supported_version`, `latest_version`, support contacts |
| Feature flags | `GET /feature-flags?role=` | public, role-aware | `{ flags: Record<string, boolean> }` (dict of booleans only) |
| Flag mutation | ❌ none (PS-8) | — | flags are code/config-owned; no admin toggle, no owner/rollout metadata |
| System settings | `GET /admin/settings`, `PATCH /admin/settings/{key}` | admin | `key/value/type/description`; updates audited server-side with old+new values (`UPDATE_SETTING`) |
| Announcements | `GET /announcements`, `POST /announcements` | public / admin | title, message, priority, target_role, window |

Settings values are plain strings (type field distinguishes them); no secret-type settings
exist in the admin surface, satisfying §33 by construction — the dashboard never displays
secret material and no endpoint returns any.

## 5. Notifications & search (backend reality)

- `Notification` model tracks `delivery_status` (pending/delivered/failed), `channel`
  (in_app/email/sms/push), `type`, `recipient_id` — but the **only admin capability is
  broadcast**; there is no admin notification feed or failure queue (PS-11, closes the CG-6
  loop from Phase 7 — still backend-blocked).
- `GET /search` is a role-authorized global search (doctors, pharmacies, labs, services,
  appointments, own records) with strict BOLA — but **no admin branch** (no patients,
  payments, or audit-event search for admins) (PS-12). A platform-wide admin search is not
  buildable without backend work; client-side cross-dataset search is prohibited (§48).

## 6. Dependency register

| ID | Finding | Dashboard disposition |
| --- | --- | --- |
| PS-1 | Health endpoint covers DB+Redis only; no Firebase/Paystack/Agora/SMS checks, no liveness/readiness split | Health page shows the three real signals; per-integration status rendered as explicit "Not exposed" entries, never inferred |
| PS-2 | `GET /admin/audit-logs` has no query filters and no single-event read | Client-side action/actor filtering over the loaded page (labeled), event detail as an in-row drawer |
| PS-3 | No request/correlation IDs persisted on audit rows | IDs displayed only where the dashboard generates them (its own requests); cross-system tracing documented as backend dependency |
| PS-4 | `phi_audit_logs` has no admin read endpoint | PHI-access audit invisible to admins; flagged for backend |
| PS-5 | No security-event model/severity engine | Security Events = labeled audit lens; severity is display-only |
| PS-6 | No WebSocket metrics; no role broadcast (CG-7) | No WS monitoring page; polling stands in |
| PS-7 | No job framework/monitoring | No jobs page; in-process reminder worker noted |
| PS-8 | Feature flags have no admin mutation/read-model (owner, rollout, env) | Flags page is read-only, labeled backend-owned |
| PS-9 | No API metrics endpoint (volume/latency/errors) | No observability page; documented |
| PS-10 | No index on audit `target_id` | Backend recommendation recorded |
| PS-11 | No admin notification feed/failure queue | Not built; broadcast exists but is out of scope for monitoring |
| PS-12 | Global search has no admin branch | No platform search UI; documented |

## 7. Frontend baseline (verified)

- `/audit-logs` exists (feed, severity display helper, read-only) — upgraded this phase.
- `/settings` exists (edit modal → `PATCH /admin/settings/{key}`, server-audited) — kept.
- Route-level `error.tsx` in `(dashboard)` + app-level handlers exist (§65).
- `next.config.ts` ships baseline security headers (CSP-adjacent set) (§88).
- API client sends `X-Request-ID` on every request (§21, client half only).
- Permissions: `audit.read`, `settings.read` already catalogued.
