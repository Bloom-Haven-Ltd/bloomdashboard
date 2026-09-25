# Trust & Safety — Phase 6 Pre-Implementation Audit

> Phase 6 §4 first task. Every claim below was verified by reading the cited source on
> 2026-09-24. **Nothing in this document is an assumption.** Sections marked
> **Backend dependency** are capabilities the spec asks for but the backend does not
> have — per §6 they are documented here and surfaced in the UI as "not yet supported",
> never faked.

---

## 1. Backend verification capability (authoritative)

### 1.1 Endpoints (bloom-backend/app/modules/admin/router.py)

| Endpoint | Method | Auth | Notes |
| --- | --- | --- | --- |
| `/admin/verifications/pending` | GET | `get_current_admin` | Returns a **bare JSON array** of `PendingVerification` (no pagination envelope) |
| `/admin/verify/{role}/{profile_id}` | PATCH | `get_current_admin` | Body `{is_verified: bool, rejection_reason?: string}`; returns `{message}` |
| `/admin/users/{user_id}/status` | PATCH | `get_current_admin` | Body `{is_active: bool}` — the only account-restriction lever |
| `/admin/audit-logs` | GET / POST | GET: admin · POST: any user | Paginated list; client audit create |
| `/admin/disputes`, `/admin/disputes/{id}/resolve` | GET / PATCH | `get_current_admin` | Closest existing "case management" capability |
| `/admin/notifications/broadcast` | POST | `get_current_admin` | Manual broadcast only |

### 1.2 The queue — `AdminService.get_pending_verifications` (service.py ~95–160)

Builds `PendingVerification {id, user_id, name, email, role, created_at, documents?, license_number?}` from three disjoint sources:

| Partner type | Queue membership rule | `documents` field | `rejection_reason` persisted? |
| --- | --- | --- | --- |
| Doctor | `DoctorProfile.is_verified == false` | **none** (no documents column on DoctorProfile) | **no** (DoctorProfile has no rejection_reason) |
| Lab | `LabProfile.is_verified == false` | `LabProfile.documents` JSONB (labs/models.py:90) | **no** |
| Pharmacy | `Pharmacy.status == PENDING` | `Pharmacy.documents` JSONB (pharmacy/models.py:92) | **yes** (`Pharmacy.rejection_reason`, cleared on approve) |

Approval side-effects (`verify_provider`):
- Labs & pharmacies: `subscription_status='trialing'`, `trial_expires_at = now + 30d`.
- The owning `User.is_verified` is set to the same boolean in every case.
- Pharmacies: `status → APPROVED/REJECTED`, `approved_at` set on approval.
- Every decision is audited server-side: `log_to_audit_trail(action='VERIFY_PROVIDER', target_type=ROLE, target_id=profile_id, new_value={is_verified, rejection_reason})`.

### 1.3 The state machine — what actually exists

```
Doctor / Lab :  is_verified=false  --PATCH is_verified=true-->  is_verified=true   (irreversible in practice; see 1.4)
                is_verified=false  --PATCH is_verified=false->  (no-op state change)
Pharmacy     :  PENDING --approve--> APPROVED --(lifecycle)--> ACTIVE / SUSPENDED / REJECTED
```

The complete verification vocabulary is therefore: **pending (unverified) / approved / rejected(pharmacy only)**. There is no UNDER_REVIEW, NEEDS_CORRECTION, RESUBMITTED, EXPIRING, EXPIRED, DRAFT, or REVERIFICATION_REQUIRED anywhere in the backend. `constants/status.ts` renders exactly these (the `verificationStatusConfig` "under_review"/"suspended" keys exist only as render affordances for unrecognized values, and `statusEnums.test.ts` pins the key set).

### 1.4 Concurrency and re-validation — verified gaps

`verify_provider` re-loads the profile and **blindly writes** the requested state:

- No check whether the profile is already verified → a second admin can flip an **approved** partner back to **unverified** (or vice versa) with no conflict.
- No optimistic-locking/version column, no `409 VERIFICATION_STATE_CHANGED`, no idempotency key. Double-approval is idempotent **by accident** (same write twice) but double-*decision-flip* is not guarded.
- Mitigation in this dashboard: server re-validation is absent, so the client treats every decision as final, disables controls while pending (§63), and refetches the queue after settle. **Backend dependency BG-1** (see §8).

---

## 2. Document infrastructure (§6.3)

### 2.1 What exists

- `POST /upload` (uploads/router.py): authenticated Cloudinary upload, JPG/PNG/PDF, 10 MB cap, returns a **permanent public `secure_url`** stored by partner apps.
- `documents` JSONB on `LabProfile` and `Pharmacy` holds whatever the partner app persisted (URLs/metadata — shape is not normalized server-side). `DoctorProfile` has **no documents field at all**.
- No document model, no document status enum, no expiry tracking, no reviewer state per document.

### 2.2 What does not exist — **Backend dependency BG-2 (signed URLs)**

There is **no endpoint that issues short-lived signed URLs** and no Cloudinary private/restricted configuration. uploads/router.py is POST-only; grep for `signed|private_download|asset_id` in the module returns nothing.

**Dashboard policy until BG-2 ships:** verification documents are rendered as **metadata only** (key names + field counts). No Cloudinary URL is ever fetched, rendered, or logged by the dashboard — mirroring the Phase 5 partner-detail pattern. The UI states this limitation inline. §16/§17 preview/zoom/download are **not implemented** and are listed as blocked-on-backend in docs/admin/verification.md.

### 2.3 Upload validation (relevant when BG-2 lands)

Backend validates: MIME allow-list, 10 MB size cap, Cloudinary ownership by folder `bloomhealth/{role}s/{user_id}`. Missing: integrity checks, per-document category, expiry — all backend dependencies (BG-3).

---

## 3. Dashboard verification feature today (§6.1)

| Artifact | State |
| --- | --- |
| `src/features/verification/service.ts` | `fetchPendingVerifications` (zod `listSchema`), `submitVerificationDecision` (PATCH, requires rejection reason client-side) |
| `src/features/verification/hooks.ts` | `verificationKeys.pending`, `usePendingVerifications`, `useVerificationDecision` (invalidates queue + `dashboardKeys.stats` on settle) |
| `src/app/(dashboard)/verification/page.tsx` | Single-queue table (partner, type, license, submitted) + approve/reject modal; rejection requires reason (≥4 chars); approve is a consequence-confirmation |
| `src/app/(dashboard)/partners/[type]/[id]/page.tsx` | Deep-links to `/verification` when the partner is pending; documents metadata-only |
| Client audit | `PARTNER_VIEWED` on profile open; decisions audited server-side (`VERIFY_PROVIDER`) |

**Duplication check (§4):** there is exactly one queue fetch and one decision mutation in the codebase. Phase 6 must extend these — not fork them.

---

## 4. RBAC audit (§6.4)

- Backend: **single `admin` role** (`get_current_admin`), no per-permission scopes, no role separation (§49), no four-eyes model (§50).
- Frontend: `lib/permissions` catalog (~31 permissions, all granted to `ADMIN`), `PermissionGate`, navigation gating. The catalog already contains `verification.read/review/approve/reject` and `audit.read`.
- Phase 6 additions (presentation-layer only): `trust_safety.read`, `documents.read`, `documents.download` — gated by the same single backend role, so in practice everything is granted. They exist so the IA is future-proof when the backend adds roles; they are never a security boundary (backend re-authorizes every call).

---

## 5. Trust & Safety capability audit (§6.15–6.18 scope)

| Spec capability | Closest backend reality | Phase 6 posture |
| --- | --- | --- |
| Trust cases (§31–32) | `SupportDispute` (open/in_review/resolved/cancelled) — dispute ≠ case; no case types, priority, assignment, escalation | Render disputes under Support (Phase 3). No fake case model. **BG-4** |
| Restrictions (§35–37) | `User.is_active` boolean only | Suspend/reactivate on user detail (Phase 5). No restriction types/time-boxing. **BG-5** |
| Risk signals/scores (§33–34) | None anywhere | Nothing rendered. No invented scores (spec §34 prohibits). **BG-6** |
| Security events (§58–59) | None. `AuditLog` rows exist but there is no security-event taxonomy, severity, or feed | Navigation keeps a disabled "Security Events" placeholder. **BG-7** |
| Reports/complaints (§40–41) | Disputes carry full `reporter_id` + narrative | Shown in Support with data-minimization posture; no reporter-privacy layer exists backend-side (documented). |
| Escalation (§42) | None | Not implemented; routing requires a backend target. Part of BG-4. |

The existing `/verification` page breadcrumbs under "Trust & Safety" in navigation, but Phase 6 keeps **verification and trust & safety conceptually separate** (§39): verification renders the real boolean queue; no page implies verification failure = fraud.

---

## 6. Notifications & realtime

- `verify_provider` triggers **no notification** to the partner. The only admin notification path is a manual broadcast. **BG-8**: partner notification on decision requires backend work; the dashboard cannot send it without inventing an unauthorized flow.
- WebSockets exist (`app/shared/websockets.py`, `broadcast_to_role`) but **no verification/trust events are emitted** anywhere (`grep VERIFICATION` in notifications/service.py → nothing). No realtime invalidation can be wired yet — **BG-9**. Post-decision invalidation is query-invalidation only.

---

## 7. Error & idempotency posture (§62–63)

- Backend error bodies: `detail: {code, message}`; taxonomy already handled by the dashboard API client. Verification-specific codes (`VERIFICATION_STATE_CHANGED`, `MISSING_REQUIRED_DOCUMENT`, …) **do not exist backend-side**; the UI maps unknown codes to generic decision-failure copy with refetch.
- No backend idempotency keys anywhere (Phase 1 audit finding, unchanged). Double-submit protection is client-side (mutation `isPending` disables controls) — documented as insufficient without backend support.

---

## 8. Missing-capability register (backend dependencies)

| ID | Capability (spec §) | Status | Blocks |
| --- | --- | --- | --- |
| BG-1 | Verification state re-validation + `409 VERIFICATION_STATE_CHANGED` + idempotency (§22, §27, §63) | Missing — blind writes | Safe concurrent review |
| BG-2 | Short-lived signed document URLs + private storage mode (§16–§17, §52) | Missing — POST-only uploads, public URLs | Document preview/download |
| BG-3 | Document status/expiration tracking (§18–§19, §53) | Missing — no per-document model | Expiry monitoring (§53/§6.14) |
| BG-4 | Trust-case model (types, priority, assignment, escalation) (§31–32, §42) | Missing — only SupportDispute | T&S case center |
| BG-5 | Restriction types beyond `is_active`, temp restrictions (§35–37) | Missing | Restriction workflows |
| BG-6 | Risk signals/scores (§33–34) | Missing | Risk display (correctly absent) |
| BG-7 | Security-event feed/taxonomy (§58–59) | Missing | Security events view |
| BG-8 | Decision notifications to partners (§44–45) | Missing — no notify in `verify_provider` | §6.20 |
| BG-9 | Realtime verification events (§64) | Missing — no events emitted | §6.21 |
| BG-10 | Queue filters (search/status/date/reviewer/priority), pagination, reviewer assignment, review history, notes, SLA (§8, §26, §28–§29, §54, §56) | Missing — GET returns unfiltered unpaginated array | §6.7 queue management |
| BG-11 | Multi-state verification lifecycle incl. NEEDS_CORRECTION/resubmit (§11, §21) | Missing — boolean only | Correction workflow §6.13 |
| BG-12 | Role separation / four-eyes (§49–§50) | Single admin role | Elevated approvals |
| BG-13 | Verification metrics: decided-today, review duration, rates (§7, §55) | Only `pending_verifications` count exists | §6.22 command center |

---

## 9. Security review of existing code

- ✅ Decisions are backend-authorized (`get_current_admin`) and audited server-side; the dashboard records zero privileged mutations client-side.
- ✅ No document URLs (public or otherwise) are fetched or rendered by the dashboard.
- ⚠️ `PATCH /admin/verify/...` accepts arbitrary role strings but only acts on `doctor|lab|pharmacy` (ValueError → 500 on other values; cosmetic).
- ⚠️ `POST /admin/audit-logs` is open to **any authenticated user** (`get_current_user`) and stores caller-supplied action/metadata verbatim — acceptable for client-observability events, but worth hardening backend-side (out of dashboard scope; noted for the backend team).
- ⚠️ No 409/idempotency (see BG-1). Known hardcoded Agora credentials in `app/config.py` (~101–102) remain flagged for rotation from the Phase 1 audit.

---

## 10. Phase 6 implementation decisions (from this audit)

1. **Extend, don't duplicate:** the existing `features/verification` service/hooks and `/verification` page are the single source; they gain a center (§6.6), filters (client-side over the one authoritative array until BG-10), and a **review detail page `/verification/[id]`** driven by the queue entry + partner profile — never a second fetch of "verification records" (there is no such endpoint).
2. **Categories shown:** Pending only. "Needs correction / expiring / expired / risk" tabs are **not rendered** (no backend states) — the UI explains why.
3. **Command center (§7):** pending count (from `/admin/stats`), plus per-type pending breakdown computed from the authoritative queue array. Metrics that don't exist (approved-today, review time) are listed as BG-13, not faked.
4. **Decision safety (§23–§25):** pre-decision checklist derived from real fields (license present, documents metadata present, profile fields), full re-fetch after decision, typed error surface, audit copy naming the server action.
5. **Correction/expiration/assignment/case features:** omitted with explicit "not supported by the backend yet" affordances where an admin might look for them, cross-linked to this audit. No mock states, no fake workflows.
