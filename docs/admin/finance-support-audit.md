# Finance, Reconciliation & Support — Capability Audit (Phase 9)

> Audited: `bloom-backend/app/modules/{payments,wallets,support,admin}` and
> `bloomdashboard/src/{app/(dashboard)/{finance,support},features/{finance,support}}`.
> Every endpoint, enum and state machine below was read from source. The dashboard
> builds only on what the backend actually exposes; everything else is recorded
> here as a dependency (FS-…), never faked.

---

## 1. Source-of-truth matrix (§5)

| Financial domain | Authoritative source | Dashboard surface |
| --- | --- | --- |
| Payment record & state | FastAPI `payments.Payment` (+ strict state machine) | Read-only payments center + detail |
| Paystack transaction | FastAPI `PaystackProvider` | Provider references displayed as-is |
| Payment verification | Backend `PaymentService.verify_payment` | Not triggerable from dashboard |
| Webhook processing | Backend (HMAC SHA512 + `ProcessedWebhookEvent` idempotency) | Not visible (no events endpoint — FS-2) |
| Refund | Backend `RefundService` / `Refund` entity | **Not wired** (no admin read; mutations broken — FS-1/FS-9) |
| Wallet balance | Backend `ProviderWallet` | Not browsable (no enumerate endpoint — FS-5) |
| Wallet transactions | Backend `WalletTransaction` | `/admin/finance/transactions` feed |
| Partner earnings | Backend `WalletService` | Not aggregated for admin (FS-11) |
| Withdrawals | Backend `WithdrawalRequest` + approve/reject endpoints | Pending queue + audited approve/reject |
| Settlements | **Does not exist** (`SettlementAccount` = payout destinations only) | No page (FS-6) |
| Ledger | Backend `LedgerEntry` (double-entry) | Not exposed to admin (no endpoint) |
| Reconciliation | Backend `ReconciliationService` ×2 | Trigger + display report; results not persisted for reads (FS-12) |
| Financial audit trail | Backend `audit_trail` via `log_to_audit_trail` | Existing `/audit-logs` page |
| Support tickets | Backend `SupportTicket` | **No admin feed exists** (FS-3); disputes instead |
| Support disputes | Backend `SupportDispute` + resolve endpoint | `/support` page (existing, kept) |

## 2. Payment state machine (authoritative)

`app/modules/payments/state_machine.py` — `VALID_PAYMENT_TRANSITIONS`, enforced with
`InvalidPaymentStateTransition`:

```
INITIATED  → PENDING | FAILED | ABANDONED
PENDING    → PROCESSING | SUCCESS | FAILED | ABANDONED
PROCESSING → SUCCESS | FAILED | ABANDONED
SUCCESS    → REVERSED | REFUNDED | PARTIALLY_REFUNDED
PARTIALLY_REFUNDED → REFUNDED | PARTIALLY_REFUNDED
FAILED / ABANDONED / REVERSED / REFUNDED   (terminal)
```

States are UPPER_SNAKE in the API (`status.value`). Amounts are integers in
pesewas (`amount_ghs = amount / 100` provided by the backend).

Refund statuses: `REQUESTED → PROCESSING → SUCCESS | FAILED` (no admin read
endpoint exists for `Refund` rows — they are only written server-side).

## 3. Withdrawal state machine (authoritative)

`WithdrawalStatus`: `pending → approved → completed`, `pending → rejected`,
`pending|approved → rejected` (reject refunds reserved balance), `pending →
cancelled` (partner-initiated). Service guards: `approve_withdrawal` requires
`PENDING` (creates Paystack transfer recipient + initiates transfer);
`complete_withdrawal` fires from `transfer.success` webhook;
`transfer.failed/reversed` webhook auto-rejects with reason.

## 4. Admin-relevant endpoints (verified)

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /payments` | any user; **admins get all rows** | `page`, `page_size≤100`, `status`, `service_type` only. No search/date filters. |
| `GET /payments/{id}` | owner **or admin** (`get_payment_by_id` role check) | Full payment incl. `paid_at/failed_at/abandoned_at`. |
| `GET /payments/{id}/receipt` | owner **or admin** | Server-built receipt incl. customer name. |
| `GET /payments/admin/stats` | admin | All-time totals: revenue, refunds, net + success/pending/failed/refunded counts. No date ranges (FS-11). |
| `POST /payments/{id}/refund` | admin | **Broken**: calls `RefundService(db, provider)` but the constructor is `RefundService(db)` → TypeError at runtime (FS-9). |
| `POST /payments/admin/reconcile` | admin | Compares recent `limit≤200` payments against Paystack live; returns report inline (matched/mismatch items with bloom vs gateway status/amount). Not persisted for later reads (FS-12). |
| `GET /admin/finance/transactions` | admin | Global `WalletTransaction` feed, `page/page_size≤200`, `type` filter only. |
| `GET /withdrawals/pending` | admin | Limit ≤500. **Response includes full `bank_account_number`** (FS-10). |
| `POST /withdrawals/{id}/approve` | admin | Paystack transfer recipient + transfer initiation. Audited via wallet flow. |
| `POST /withdrawals/{id}/reject` | admin | Requires rejection reason; releases reserved funds. |
| `POST /wallets/reconcile` | admin | Wallet↔ledger reconciliation run (`MANUAL_ADMIN`); returns `FinancialReconciliationRecord` (total_checked, matched, mismatched, discrepancies). |
| `GET /admin/disputes` | admin | `SupportDispute` feed, `status` filter. |
| `PATCH /admin/disputes/{id}/resolve` | admin | Resolution text + status; audited `RESOLVE_DISPUTE`. |

## 5. Dependency register (backend gaps — documented, not faked)

| ID | Finding | Dashboard disposition |
| --- | --- | --- |
| FS-1 | No admin endpoint lists `Refund` entities; refunds invisible to admins | No refunds page. Refund totals only via `/payments/admin/stats`. |
| FS-2 | `PaymentEvent` (webhook timeline) has no admin read endpoint | Payment detail shows lifecycle timestamps, not event log. |
| FS-3 | `GET /support/tickets` is strictly user-scoped; no admin ticket feed | No tickets page. Disputes are the admin support queue. |
| FS-4 | No internal-note concept; `is_staff` messages are returned to the ticket owner | Nothing to build; flagged for backend design before any staff reply UI. |
| FS-5 | No enumerate-all-wallets endpoint (admin needs a known `provider_id`) | No wallets browse page. |
| FS-6 | No settlement-batch entity (only payout destination accounts) | No settlements page. |
| FS-7 | No ticket assignment / priority-update endpoints | N/A while FS-3 stands. |
| FS-8 | **P1**: legacy `POST /payments/refund` requires only `get_current_user` — any authenticated user can refund any consultation payment (`RefundService.process_refund` has no role check) | Dashboard never calls it; backend fix requested (gate to admin + role check in service). |
| FS-9 | **P1**: admin refund route passes 2 ctor args to a 1-arg `RefundService` → runtime TypeError; admin refunds are broken today | Dashboard stays read-only on refunds until fixed + re-audited. |
| FS-10 | `WithdrawalResponse` serializes full `bank_account_number` | Dashboard masks at the zod parse boundary (last 4 only). Backend masking requested. |
| FS-11 | `/payments/admin/stats` is all-time; no date-range KPIs | KPI cards labeled "all time"; no fabricated period math. |
| FS-12 | Reconciliation reports are returned inline, never persisted/listable | Reconciliation page triggers + displays a run; no history view. |
| FS-13 | Legacy `POST /payments/consultation` accepts client-supplied amounts (MOCK path) | Not used by dashboard; backend cleanup requested. |
| FS-14 | No admin realtime (per Phase 7 CG-7) | 30–60s interval refetching on operational queues. |

## 6. Security review (§13/§20/§52/§54)

- **No Paystack secrets in the dashboard** — all provider calls are backend-side; the dashboard only consumes derived fields (`amount_ghs`).
- **Bank data minimisation**: withdrawal account numbers masked at parse time (FS-10 backend fix requested). Settlement-account masking exists backend-side (`accountNumberMasked`).
- **Mutations from the dashboard**: only withdrawal approve/reject and dispute resolve — each admin-gated server-side, reason-captured, and re-fetch-authoritative after mutation (no optimistic financial state).
- **Idempotency/concurrency**: webhooks deduplicated via `ProcessedWebhookEvent` + `provider_event_id` unique; withdrawals row-lock wallets (`with_for_update`); refund over-refund guarded (`total_refunded <= original`). The dashboard adds ConfirmDialog + reason capture for its two mutations.
- **Refund safety (§20)**: dashboard never renders a refund button (FS-1/FS-9).
- **Client-side financial math prohibition (§22)**: no `balance = earnings − withdrawals` anywhere; every amount displayed comes from the backend field.

## 7. Frontend baseline (existing, kept)

- `/finance` — wallet-transaction feed table (`formatGhs`, `financeTransactionSchema`).
- `/support` — disputes feed + resolve modal (min 10-char resolution, audited).
- Permissions already catalogued: `finance.read`, `finance.refund`, `finance.reconcile`, `finance.withdrawal.review`, `support.read`, `support.manage` (single ADMIN role holds all today; seams ready for granular roles).
- `paymentStatusConfig` covers lower/UPPER casings; `supportStatusConfig` covers dispute states; withdrawal config added this phase.
