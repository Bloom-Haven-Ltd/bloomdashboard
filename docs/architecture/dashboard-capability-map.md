# Dashboard Capability Map

Every command-center metric mapped to its **verified** backend source (§4/§6). Metrics without a real source are listed as backend dependencies — they are **never simulated** in the UI (§5).

## Implemented (real data)

| Dashboard metric / section | Backend source | Notes |
|---|---|---|
| Platform health (API/Database/Cache) | `GET /health` (public) | Measured truth only; auto-refresh 60s (§11). §15: no infrastructure internals rendered. |
| Overall platform state | derived from `/health` | Presentation-only derivation (§4 allows). |
| Pending verifications (attention) | `GET /admin/stats.pending_verifications` | Drill-down → `/verification`. |
| Open disputes (attention) | `GET /admin/stats.total_disputes` | Drill-down → `/support`. |
| Active consultations (attention + KPI) | `GET /admin/stats.active_consultations` | Drill-down → `/consultations`. |
| Patients / total accounts | `GET /admin/stats.total_patients`, `total_users` | Drill-down → `/users?role=patient`. |
| Partner distribution (doctors/labs/pharmacies) | `GET /admin/stats.total_doctors/total_labs/total_pharmacies` | Donut (§42: small categorical set). |
| Pharmacy orders (KPI) | `GET /admin/stats.total_orders` | Drill-down → `/orders`. |
| Gross payment volume | `GET /admin/stats.total_revenue` | **Labeled by definition** (§37): backend `total_revenue`; not "revenue" without context. |
| Activity trend (24h series) | `GET /admin/analytics/performance?period=24h` | `users`/`consultations`/`orders` per bucket. |
| Recent activity feed | `GET /admin/audit-logs` | Human-readable feed; the audit system itself is untouched (§47). |

## Backend dependencies (documented gaps — not built in UI)

| Missing capability | Needed for | Suggested backend work |
|---|---|---|
| Per-status state-machine breakdowns (appointments today by status, orders by status, lab bookings by status) | §20/§21/§24/§32/§34 sections | Aggregate `GROUP BY status` endpoints per domain with optional date range. |
| Date-range filtering on stats (`from`/`to`) | §9 global date range | Query parameters on `/admin/stats` + validation. |
| Period-over-period comparison data | §43 trend labels | Backend returns current vs previous window deltas. |
| Failed payments / refunds / withdrawal counts | §36/§40 finance snapshot | Extend finance transactions aggregate (sources exist per-record). |
| Reconciliation exceptions count | §40 | Backend reconciliation service exposes exception list/count. |
| Failed notification deliveries | §16 | Notification delivery-status aggregate. |
| Verification turnaround / SLA aging | §30/§31 | Timestamps exist per submission; needs aggregation + configurable SLA threshold (§31: no hardcoded business assumption). |
| Pharmacy inventory signals (low/out/expiring) | §33 | Inventory aggregate endpoint. |
| Average acceptance/waiting/completion/cancellation/no-show rates | §25 | Derived aggregates with explicit definitions (§26). |
| Live consultation widgets | §24 | WebSocket events exist (`websockets_router`); needs an authorized snapshot endpoint or event → invalidation wiring (§12). |

## Rules enforced by this page

1. A section renders only if its backend source is verified (§13).
2. Aggregates derive only from backend-provided numbers — never sums over client-fetched rows (§4).
3. Health services without a signal are omitted, never "operational" by assumption (§13/§15).
4. Financial figures carry their definition in the label/comparison text (§37).
5. All timestamps render in `Africa/Accra` (§10).
