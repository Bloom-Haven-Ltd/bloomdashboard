# Partner & User Lifecycle

Cross-platform lifecycle documentation (§36/§69). Backend state machines are authoritative; the dashboard only renders and navigates them.

## Account states (verified backend model)

| Concept | Backend field | Values |
|---|---|---|
| Account access | `User.is_active` | `true` (active) / `false` (suspended) |
| Identity verification | `User.is_verified` | boolean |
| Provider verification | `DoctorProfile.is_verified` / `LabProfile.is_verified` | boolean |
| Pharmacy lifecycle | `PharmacyStatus` | `pending`, `approved`, `active`, `suspended`, `rejected` |

**No** PENDING / LOCKED / RESTRICTED / DEACTIVATED / DELETED account states exist in the backend; the dashboard must not render or assume them (§11). Suspension is `is_active=false`, set via `PATCH /admin/users/{id}/status` only.

## Partner lifecycle (cross-platform, §36/§66)

```text
Partner registers (Bloom Partner)
        ↓
Admin sees partner in Partners list / verification queue
        ↓  GET /admin/verifications/pending
Verification administrator reviews
        ↓  PATCH /admin/verify/{role}/{profile_id}   (is_verified, rejection_reason)
Approved → partner becomes operational for patients
Rejected → partner notified with reason; may resubmit
```

The same transition is visible in Bloom Partner (profile rejected/active) — one lifecycle, three surfaces. The dashboard introduces **no** alternative states.

## Statuses rendered in the dashboard

- Doctors/Labs: `is_verified` → verification `Approved`/`Pending` badge (queue shows pending only).
- Pharmacies: `PharmacyStatus` → `partnerStatusConfig` (pending/approved/active/suspended/rejected).
- Users: `is_active` → `userStatusConfig` (active/suspended).

## Verification states (§21 reality check)

The backend models verification as a **boolean plus a pending queue** — not a multi-state workflow. States the dashboard may therefore render: `pending`, `under_review` (queue), `approved`, `rejected`, `suspended` — and nothing else. NEEDS_CORRECTION / EXPIRED / reviewer timestamps / document-level statuses are **backend dependencies** (see users-partners-audit.md).

## Concurrency (§50)

The backend has no version/ETag fields on these resources. Current protections:
- All mutations re-validate state server-side (`verify_provider` re-loads the profile; already-verified profiles are rejected).
- The dashboard never mutates local-only state: after every mutation, queries invalidate and refetch (`useUpdateUserStatus`, `useVerificationDecision`).
- 409 responses surface as `ApiError('CONFLICT')` with the "record changed — refresh" copy.

## Auditing (§15/§58)

Server-side (authoritative): every admin mutation (verify, status change, dispute resolve, settings).
Client-side (best-effort, to `POST /admin/audit-logs`): `USER_VIEWED`, `PARTNER_VIEWED` — view events the backend cannot observe. No PHI in any audit payload; IDs only.
