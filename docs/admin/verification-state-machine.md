# Verification State Machine

> Phase 6 §79. This documents the **actual** backend state machine — the dashboard
> renders exactly these states and nothing more (§11: "do not invent states").

## 1. The real model

The backend models verification as a **boolean** (`is_verified`) plus an
**administrative decision queue** — not a multi-state workflow. The complete
vocabulary is:

```
                    ┌─────────────────────────────┐
   Doctor / Lab     │  pending (is_verified=false)│
   queue membership │  = queue entry exists       │
                    └──────────────┬──────────────┘
                                   │ PATCH /admin/verify/{role}/{id}
                 is_verified=true  │  is_verified=false (labs/doctors: state unchanged;
                                   ▼  pharmacies: PENDING → REJECTED)
                    ┌─────────────────────────────┐
                    │  approved (is_verified=true)│
                    └─────────────────────────────┘

   Pharmacy only:   PENDING → APPROVED → ACTIVE / SUSPENDED
                          └→ REJECTED (reason persisted on Pharmacy.rejection_reason)
```

- **Pending** exists only as the *absence of a decision*: for doctors/labs,
  `is_verified == false`; for pharmacies, `Pharmacy.status == PENDING`. The queue
  (GET /admin/verifications/pending) enumerates exactly these.
- **Approved** sets `User.is_verified = true` on the owning account (every type).
  Labs and pharmacies additionally receive `subscription_status='trialing'` with a
  30-day trial; pharmacies get `approved_at`.
- **Rejected** is only persisted for pharmacies (`Pharmacy.status=REJECTED` +
  `rejection_reason`). A lab/doctor rejection leaves `is_verified=false` — the
  entry stays pending with no marker that a decision was attempted.

States that **do not exist** anywhere in the backend and must not be rendered as
real states: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_CORRECTION`,
`RESUBMITTED`, `EXPIRING`, `EXPIRED`, `REVERIFICATION_REQUIRED`. The
`verificationStatusConfig` map in `src/constants/status.ts` contains only
`pending | approved | rejected`, and `tests/unit/statusEnums.test.ts` pins that key
set so invented states fail CI.

## 2. Transition semantics & concurrency

`verify_provider` (admin/service.py) re-loads the profile and **writes the
requested boolean unconditionally**:

- No state re-validation, no optimistic-lock version, no `409
  VERIFICATION_STATE_CHANGED`, no idempotency keys (audit **BG-1**).
- Consequence: a second decision can silently flip an approved partner back to
  unverified (or approve after another admin rejected). The dashboard mitigates
  client-side only: decisions disable their controls while pending and every settle
  invalidates + refetches the queue. Safe concurrency requires backend work (BG-1).
- Decision side effects are server-side and authoritative; the audit row
  (`VERIFY_PROVIDER`) is written in the same transaction by the backend.

## 3. Planned lifecycle (requires backend work)

The multi-state lifecycle from the Phase 6 spec (submitted → under review →
approved / needs-correction → resubmitted; document expiry → reverification) is a
**backend dependency**, not a frontend feature. Required backend primitives are
registered as BG-1, BG-3, BG-10, BG-11 in `trust-safety-audit.md` §8. The dashboard
will adopt new states only when the backend returns them; zod schemas here fail
closed on unknown values rather than guessing.
