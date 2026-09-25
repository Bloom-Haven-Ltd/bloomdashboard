# Pharmacy Order State Machine (authoritative)

> Source: `bloom-backend/app/modules/pharmacy/models.py` (`OrderStatus`) and
> `app/modules/pharmacy/service.py` (`VALID_ORDER_TRANSITIONS`, L39). The
> backend rejects illegal transitions with a 400 listing allowed targets —
> the dashboard renders states; it never computes or validates them (§9).

## States (11)

| State | Meaning |
| --- | --- |
| `pending` | Placed, awaiting pharmacy acceptance. |
| `confirmed` | Pharmacy accepted the order. |
| `preparing` | Items being picked/packed (fulfillment workspace). |
| `ready` | Packed and available for pickup or dispatch. |
| `out_for_delivery` | Dispatched with the delivery channel. |
| `delivered` | Delivered; awaiting final completion. |
| `completed` | Terminal — fulfilled and closed. |
| `cancelled` | Terminal — cancelled (patient or pharmacy). |
| `rejected` | Terminal — pharmacy rejected the order. |
| `returned` | Terminal — returned to the pharmacy. |
| `failed` | Delivery/fulfillment failure — **retryable**. |

## Transition map (server-enforced)

```
pending       → confirmed | cancelled | rejected
confirmed     → preparing | cancelled | rejected
preparing     → ready | cancelled
ready         → out_for_delivery | delivered | completed | cancelled
out_for_delivery → delivered | completed | returned | failed
delivered     → completed | returned
completed     → (terminal)
cancelled     → (terminal)
rejected      → (terminal)
returned      → (terminal)
failed        → pending        ← the only backward edge (retry)
```

Rendering rules:
- `failed` renders as danger with a "retry pending" caveat — the backend may
  legally move it back to `pending`; a `failed` row is not necessarily final.
- `ready → completed` is a legal direct path (in-person pickup completion) —
  do not assume `out_for_delivery` precedes `completed`.
- `cancellation_reason` / `rejection_reason` carry the operator narrative
  (§39-style disclosure); `tracking_number` and `estimated_delivery_time`
  appear on dispatch-path orders.

## Cancellation semantics

Cancellations/rejections release inventory reservations backend-side
(service.py Phase 7 note). The dashboard never infers refund eligibility from
a cancellation — `payment_status: refunded` on the row is the only
authoritative refund signal (§32).
