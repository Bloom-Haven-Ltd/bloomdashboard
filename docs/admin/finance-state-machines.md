# Withdrawal & Payment State Machines (authoritative)

> Sources: `app/modules/payments/state_machine.py` (`VALID_PAYMENT_TRANSITIONS`),
> `app/modules/payments/models.py` (enums), `app/modules/wallets/models.py`
> (`WithdrawalStatus`), `app/modules/wallets/service.py` (transition guards).
> The dashboard renders states and never computes or validates transitions (§15).

## Payment states (9)

| State | Meaning |
| --- | --- |
| `INITIATED` | Created server-side; provider session not yet confirmed. |
| `PENDING` | Awaiting provider/authorisation. |
| `PROCESSING` | Provider confirms charge in flight. |
| `SUCCESS` | Verified and fulfilled. |
| `FAILED` | Terminal. |
| `ABANDONED` | Terminal; never completed by the patient. |
| `REVERSED` | Terminal; funds reversed. |
| `REFUNDED` | Fully refunded. |
| `PARTIALLY_REFUNDED` | Partially refunded; may become `REFUNDED`. |

Transitions (server-enforced, `InvalidPaymentStateTransition` otherwise):

```
INITIATED  → PENDING | FAILED | ABANDONED
PENDING    → PROCESSING | SUCCESS | FAILED | ABANDONED
PROCESSING → SUCCESS | FAILED | ABANDONED
SUCCESS    → REVERSED | REFUNDED | PARTIALLY_REFUNDED
PARTIALLY_REFUNDED → REFUNDED | PARTIALLY_REFUNDED
```

Amounts are integers in pesewas; the API also returns `amount_ghs` (main units).
Refund statuses (`RefundStatus`): `REQUESTED → PROCESSING → SUCCESS | FAILED`.

## Withdrawal lifecycle

`WithdrawalStatus`: `pending | approved | completed | rejected | cancelled`.

```
pending ──approve──▶ approved ──Paystack transfer.success──▶ completed
pending ──reject───▶ rejected        (also from approved)
pending ──cancel───▶ cancelled       (partner-initiated only)
```

Guards (service layer):
- `approve_withdrawal` requires `PENDING`; creates the Paystack transfer
  recipient, initiates the transfer, reserves funds.
- `complete_withdrawal` fires only from the `transfer.success` webhook.
- `transfer.failed` / `transfer.reversed` webhooks auto-**reject** with the
  provider reason; reserved balance returns to available.
- All wallet movements are row-locked (`with_for_update`) — concurrent admin
  approvals cannot double-spend (§56).
