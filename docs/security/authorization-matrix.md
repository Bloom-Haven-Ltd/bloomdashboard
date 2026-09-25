# Authorization Matrix (derived from backend source)

> Every cell below reflects code-level enforcement in `bloom-backend`
> (dependencies + service-layer checks), not dashboard UI visibility. The
> backend has a single privileged role today: `admin`. Frontend permissions
> (`finance.read`, `support.manage`, …) are UX seams ready for granular roles;
> they are NOT security controls.

## Enforced access by resource

| Resource | Unauthenticated | Patient / Partner (non-admin) | Admin |
| --- | --- | --- | --- |
| Consultations list | ❌ 401 | Own rows only (`list_consultations` role-scope) | All rows |
| Consultation detail | ❌ 401 (main route + reminders alias after SEC-1) | Participant only | ✅ |
| Consultation mutations (status/accept/cancel/…) | ❌ 401 | Participant only (service-level ForbiddenError for admins — CG-1) | ❌ read-only by design |
| Payment detail / receipt | ❌ 401 | Owner only | ✅ |
| Payments list | ❌ 401 | Own rows | All rows |
| Payment stats / reconcile | ❌ 401 | ❌ 403 | ✅ |
| Refund (`POST /payments/{id}/refund`, `POST /payments/refund`) | ❌ 401 | ❌ 403 (SEC-4 fixed) | ✅ (SEC-5 fixed: state+amount validated) |
| Paystack OTP/PIN relay | ❌ 401 (SEC-6 fixed) | ✅ auth'd | ✅ |
| Wallet (own) | ❌ 401 | Self only (`_resolve_and_verify_wallet_access`) | ✅ any |
| Wallet credit/debit | ❌ 401 | ❌ 403 | ✅ |
| Withdrawals pending list / approve / reject | ❌ 401 | ❌ 403 | ✅ |
| Withdrawal request/cancel | ❌ 401 | Self (PIN + row-lock) | ✅ |
| Lab bookings feed (admin) | ❌ 401 | ❌ 403 | ✅ (serializer strips patient PII at dashboard parse; backend fix PL-3 requested) |
| Lab samples / results / offerings | ❌ 401 | Lab-role only (PL-2) | ❌ (no admin branch) |
| Pharmacy order detail/history/fulfillment | ❌ 401 | Patient-or-pharmacy (PL-1) | ❌ (PL-1 — admin access requested) |
| Prescriptions list/detail | ❌ 401 | Participant-scoped | ✅ detail (dashboard gates clinical fields behind `prescriptions.clinical` + audit) |
| Disputes feed / resolve | ❌ 401 | ❌ 403 | ✅ (resolve audited) |
| Support tickets | ❌ 401 | Own tickets only | ✅ single-ticket read via staff flag (no admin feed — FS-3) |
| System settings read | ❌ 401 | ❌ 403 | ✅ |
| System settings update | ❌ 401 | ❌ 403 | ✅ (audited server-side with old/new values) |
| Audit logs read | ❌ 401 | ❌ 403 | ✅ (append-only; no mutation endpoints exist) |
| Audit logs create (client events) | ❌ 401 | ✅ any user (server sanitizes action/resource) | ✅ |
| Users list / status update | ❌ 401 | ❌ 403 | ✅ |
| Broadcast notification | ❌ 401 | ❌ 403 | ✅ |
| Announcements publish | ❌ 401 | ❌ 403 | ✅ |
| Feature flags | ✅ public | Role-aware values | Read-only everywhere (no mutation endpoint — PS-8) |
| App config / health | ✅ public | ✅ | ✅ |
| Reminders/preferences/tasks/SMS relay | ❌ 401 (SEC-2/3 fixed) | Self-scoped only | ✅ |

## Admin sub-permission seams (frontend UX only)

`finance.read`, `finance.refund`, `finance.reconcile`, `finance.withdrawal.review`,
`support.read`, `support.manage`, `prescriptions.read`, `prescriptions.clinical`,
`pharmacy.read`, `laboratory.read`, `verification.read`, `trust_safety.read`,
`documents.read`, `documents.download`, `audit.read`, `settings.read`, `users.read`,
`partners.read`, `appointments.read`, `consultations.read` — all granted to the
single `ADMIN` role today; each maps to a backend capability that is itself
admin-gated server-side.

## Mutations that require confirmation (§57, shipped)

| Mutation | Control |
| --- | --- |
| Withdrawal approve | ConfirmDialog + typed phrase `APPROVE` |
| Withdrawal reject | ConfirmDialog + required reason |
| Dispute resolve | Modal + required ≥10-char resolution (audited) |
| System setting update | Edit modal + server-side audit with old/new values |

## Privileged actions audited (§69/§70)

Server-side (`log_to_audit_trail`): settings updates, dispute resolution,
refund initiation (`PAYMENT_REFUND_INITIATED` — SEC-5), consultation refund
(`PAYMENT_REFUNDED`), verification decisions, user status changes, client audit
events (`POST /admin/audit-logs`).
