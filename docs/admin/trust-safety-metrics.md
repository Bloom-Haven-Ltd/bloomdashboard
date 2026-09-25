# Trust & Safety Metrics — Definitions & Limitations

> Phase 6 §55/§79. Every metric below is either **implemented from an authoritative
> source** or **explicitly listed as unavailable**. No metric is approximated in the
> frontend (§81: no fake trust metrics).

## 1. Implemented metrics

| Metric | Definition | Source | Calculation | Time range / timezone |
| --- | --- | --- | --- | --- |
| Pending reviews | Partner submissions awaiting a decision | `GET /admin/stats` → `pending_verifications` | Backend-computed count of unverified doctors + labs + PENDING pharmacies | Current (live query) |
| Doctors waiting | Pending doctor submissions | `GET /admin/verifications/pending` | `entries.filter(role='doctor').length` over the authoritative array | Current (live query) |
| Laboratories waiting | Pending lab submissions | Same | `role='lab'` count | Current |
| Pharmacies waiting | Pending pharmacy submissions | Same | `role='pharmacy'` count | Current |

Notes: the type breakdown is a **client-side count of the backend's own queue
array** — no aggregation logic is invented; if the backend array is the truth, its
length per role is the truth. Timezone: the dashboard renders timestamps in
Africa/Accra (§77); counts are point-in-time and timezone-independent.

Known limitations: `pending_verifications` and the queue array are two queries taken
at slightly different moments; the metric cards show the stats value while the queue
table shows the array. They converge on refetch (60 s poll + post-decision
invalidation).

## 2. Unavailable metrics (dependency BG-13)

Not rendered anywhere, because the backend computes or stores nothing for them:

| Metric | Missing primitive |
| --- | --- |
| Approved / rejected today | No decision timestamps other than `Pharmacy.approved_at`; no per-day aggregation |
| Average / median review duration | No review-started/submitted-lifecycle timestamps |
| Approval / correction / rejection / document-rejection rates | Requires decision history + multi-state workflow |
| Expired / expiring documents | No document model or expiry fields (BG-3) |
| Cases escalated / resolved / resolution time | No case model (BG-4) |

Each becomes implementable when the backend exposes it (ideally server-computed,
per §7). The command center will add cards only from authoritative endpoints.
