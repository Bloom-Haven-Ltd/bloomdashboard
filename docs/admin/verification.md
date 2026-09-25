# Verification Center — API Contracts & Workflow

> Phase 6 §79. Contracts below are verified against `bloom-backend` as of 2026-09-24
> (see `trust-safety-audit.md` for the full capability audit). Fields the backend does
> not return are listed under **Dependencies**, never invented.

## 1. Live contracts (implemented in this dashboard)

### 1.1 Verification queue

```http
GET /admin/verifications/pending
Authorization: Bearer <firebase-id-token>
X-Session-ID: <session>
X-Request-ID: <uuid>
```

- Response: **bare array** of `PendingVerification` — no pagination envelope:

```json
[
  {
    "id": "uuid (profile id: DoctorProfile | LabProfile | Pharmacy)",
    "user_id": "uuid",
    "name": "string",
    "email": "string",
    "role": "doctor | lab | pharmacy",
    "created_at": "ISO-8601",
    "documents": { "…": "arbitrary JSONB — labs & pharmacies only; absent for doctors" },
    "license_number": "string | null"
  }
]
```

- `id` is the **profile** id (also the decision target), not the user id.
- No search/filter/sort/pagination parameters exist — the endpoint returns every
  pending entry (Dependency BG-10). The dashboard applies type/search/date filters
  client-side over this authoritative array and labels them as client-side until the
  backend adds parameters.

### 1.2 Decision

```http
PATCH /admin/verify/{role}/{profile_id}
{ "is_verified": true }                         // approve
{ "is_verified": false, "rejection_reason": "…" } // reject — reason required by this dashboard
```

- `role` ∈ `doctor | lab | pharmacy` (anything else → 500 backend-side).
- Response `{ "message": "…" }`; errors use the platform `detail: {code, message}` shape.
- Server side-effects: audit row `VERIFY_PROVIDER`; `User.is_verified` mirrors the
  decision; labs/pharmacies get a 30-day trial; pharmacies move `PENDING → APPROVED/REJECTED`.
- **No 409 / no state re-validation** (Dependency BG-1): the dashboard disables the
  controls while the mutation is pending and refetches the queue afterwards.

### 1.3 Supporting reads

```http
GET /admin/stats                          // pending_verifications count (command center)
GET /doctors/{id} | /labs/{id} | /pharmacies/{id}   // professional detail for review page
GET /admin/audit-logs?page=&page_size=    // review history source (VERIFY_PROVIDER events)
```

## 2. Review workflow (frontend orchestration, backend-authoritative states)

```
Queue (GET pending) ──► Review detail (/verification/{id}: queue entry + partner profile)
                              │
                              ├─ Approve ──► PATCH is_verified=true  ──► invalidate queue + stats ──► refetch
                              └─ Reject  ──► PATCH is_verified=false + reason (required, ≥4 chars)
                                              ──► invalidate queue + stats ──► refetch
```

Safety rails implemented (spec §23–§25, §63, §69, §70):
- Pre-decision checklist from real fields only (license present, documents metadata
  present, professional fields present).
- Rejection requires an audited free-text reason; approval shows a consequence
  confirmation naming the partner and the resulting platform access.
- Controls disabled while mutation pending (no double-submit); on failure the local
  state is never changed, the backend error is surfaced, and the queue refetches.
- Every decision's audit row is created **server-side** (`VERIFY_PROVIDER`); the
  dashboard adds no duplicate client audit for the mutation itself.

## 3. Not implemented — backend dependencies

| Workflow (spec) | Why it cannot be built | Dependency |
| --- | --- | --- |
| Assign reviewer (§26) | No reviewer model on verification | BG-10 |
| Request correction / resubmit (§21, §6.13) | No NEEDS_CORRECTION state; boolean `is_verified` only | BG-11 |
| Expiration / expiring-soon monitoring (§53, §6.14) | No document model, no expiry fields | BG-2/BG-3 |
| Document preview / download (§16–§17) | No signed-URL endpoint; uploads POST-only | BG-2 |
| Per-document approve/reject (§19–§20) | No document status enum | BG-3 |
| Review timeline (§28) | Queue entries carry no review history; `VERIFY_PROVIDER` audit rows are discoverable only by scanning `/admin/audit-logs` | BG-10 |
| Internal notes (§29) | No notes model | BG-10 |
| 409 conflict handling (§27) | Backend performs blind writes | BG-1 |
| Partner notification on decision (§44) | `verify_provider` sends none | BG-8 |
| Realtime queue invalidation (§64) | No verification events emitted over websockets | BG-9 |

The Verification Center renders explicit "not yet supported by the backend" notes for
these workflows instead of disabled ghosts, and the pages never fake their state.

## 4. Command-center metrics (§7/§55)

| Metric | Source | Live? |
| --- | --- | --- |
| Pending reviews | `/admin/stats` → `pending_verifications` | ✅ |
| Pending by type (doctor/lab/pharmacy) | Counted from the authoritative queue array | ✅ |
| Approved/Rejected today, avg/median review time, rates, expired documents | No backend computation or source | ❌ BG-13 — documented in `trust-safety-metrics.md`, not rendered |

## 5. Error handling

| HTTP | Handling |
| --- | --- |
| 401 | Session teardown (shared client), redirect to login |
| 403 | `INSUFFICIENT_PERMISSION` copy; no retry |
| 404 | Profile not found → detail page shows not-found state |
| 422 | Backend validation message surfaced verbatim |
| 409 | `VERIFICATION_STATE_CHANGED` handling **prepared** (typed code + refetch prompt) but cannot currently occur (BG-1) |
| 429/5xx | Generic decision-failed copy with refetch; queue state left authoritative |
