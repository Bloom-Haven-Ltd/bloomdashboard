# Pharmacy & Laboratory Operations — Phase 8 Pre-Implementation Audit

> Phase 8 §4 first task. Every claim verified against bloom-backend source on
> 2026-09-24. Sections marked **Backend dependency** are capabilities the spec
> asks for but the backend does not expose to admins — documented, never faked.
> Companion docs: `order-state-machine.md`, `lab-operations-state-machine.md`.

---

## 1. What the spec asks vs. what the backend exposes

The Phase 8 spec imagines full pharmacy/laboratory command centers (§7–§29).
The backend exposes to the `admin` role a **narrow but real** surface, and a
much richer one that is **strictly partner-scoped**. The dashboard therefore
ships:

- Global order + booking feeds (paginated, **no filters**)
- Public pharmacy/lab profile + inventory/catalog data
- Prescription list + detail (admin-bypassed service)
- Everything else: documented as a dependency, not simulated

## 2. Admin-authoritative endpoints (usable today)

| Endpoint | Filters | Notes |
| --- | --- | --- |
| `GET /admin/pharmacy-orders` | page, page_size only | `OrderResponse` — flat; `items`/`fulfillment`/`history` default `[]`/null in the global feed |
| `GET /admin/lab-bookings` | page, page_size only | `LabBookingResponse` — embeds `patient` (PL-3) and `request` (PL-4) |
| `GET /prescriptions?page&page_size&patient_id` | patient_id | role `admin` hits the `else: filter_cond = true()` branch → **all rows** |
| `GET /prescriptions/{id}` | — | `_verify_prescription_access` returns early for `role == "admin"` (PL-5) |
| `GET /pharmacies?page&page_size&search` | search | **public** — works for admins |
| `GET /pharmacies/{id}` | — | public |
| `GET /pharmacies/inventory/search?search&category` | search, category | **public global inventory** — three-tier stock (physical / reserved / available) |
| `GET /labs?city&search&is_verified&page&page_size` | city, search, is_verified | public |
| `GET /labs/{id}` | — | public |
| `GET /labs/catalog?category&search` | category, search | public — platform test catalog with TAT |

## 3. Admin-BLOCKED endpoints (verified ForbiddenError / role guards)

| Endpoint | Block |
| --- | --- |
| `GET /pharmacy-orders/{id}` | patient / pharmacy owner / active staff only (Bug #11 fix) — **admins get 403** (PL-1) |
| `GET /pharmacy-orders/{id}/history` | patient or pharmacy owner only — admins 403 (PL-1) |
| `GET /pharmacy-orders/{id}/fulfillment` | patient or pharmacy owner only — admins 403 (PL-1) |
| All order mutations (`/pick`, `/pack`, `/dispense`, `/dispatch`, `/collect`, `/deliver`, PATCH `/status`) | `get_approved_pharmacy` dependency |
| `GET /labs/me/samples`, `GET /labs/me/results`, `GET /labs/me/dashboard` | `get_approved_lab` |
| `GET /labs/samples/my-samples`, `/results/my-results` | patient-only |
| `GET /labs/results/{id}/view` | doctor or patient explicitly; all other roles raise ForbiddenError |
| All result mutations (draft/review/validate/release/amend) | `get_approved_lab` |
| All booking mutations (create/patch status) | patient / `get_approved_lab` |

**Consequence (§10/§23/§25/§26):** the dashboard cannot render per-order
fulfillment detail or sample/result detail. No detail pages for orders or
bookings exist in this phase; the feeds carry all the operational signal the
backend permits. Order detail, sample operations, and result workflow are
PL-1/PL-2 dependencies.

## 4. Actual state machines (authoritative enums)

Pharmacy `OrderStatus` (11 states) and its enforced `VALID_ORDER_TRANSITIONS`
map (service.py L39) — including `failed → pending` retry and `ready →
completed` direct path — are documented in `order-state-machine.md`.

Lab enums (models.py):
- `LabBookingStatus`: pending, confirmed, completed, cancelled, no_show —
  **no transition validation server-side** (PL-B4: partner app can set any
  status; dashboard renders without assuming legality).
- `LabSampleStatus`: requested, collected, received, accepted, processing,
  completed, rejected, recollection_required, cancelled. Every change writes
  an immutable `LabSampleEvent` row (previous_status → new_status, actor,
  reason).
- `LabResultStatus`: draft → entered → review_pending → validated → released,
  plus `amended` (versioned v+1 with `previous_version_id`). Full mutation
  governance (draft/review/validate/release/amend) with `LabResultAudit`.
- `LabRequestStatus`: pending, accepted, rejected, cancelled.

Prescription `PrescriptionStatus`: pending, sent_to_pharmacy, approved,
fulfilled, cancelled. `fulfilled_at` set on fulfillment. No transition map
enforced.

## 5. Cross-domain relationships (§30)

- Prescription → PharmacyOrder via `PharmacyOrder.prescription_id` (nullable,
  `SET NULL`); `OrderType.PRESCRIPTION` flags the link.
- LabOrder (doctor) → LabRequest (patient→lab) → LabBooking (1:1 via
  `LabRequest.booking`). LabBooking embeds `request` (tests) in its response.
- Payment: `payment_status` + `payment_reference` on both orders and bookings.
  Refunds are backend-computed; dashboard displays only (§31/§32).
- Consultation: `Prescription.consultation_id` is a bare UUID column (no FK) —
  still links to the Phase 7 appointment center (PL-7).

## 6. Privacy findings

- **PL-3 (security, medium):** `GET /admin/lab-bookings` embeds
  `LabBookingPatientSummary` — patient **email, phone_number, gender** — and
  includes home-service `address` (delivery_address equivalent). The dashboard
  strips email/phone/gender/address at the zod parse boundary (§38 PHI
  minimization) but the backend should add an admin serializer that omits
  these fields entirely.
- **PL-4 (backend bug, medium):** `LabBookingResponse.patient/request` are
  uneager-loaded relationships serialized by `model_validate` in the global
  feed. This can emit `DetachedInstanceError`/500s or inconsistent
  serialization under concurrency. Backend fix: eager-load (`selectinload`)
  or drop the embeds from the admin serializer (preferred — see PL-3).
- Order rows expose `delivery_address` + `delivery_instructions` in the feed —
  operational necessity for deliveries; treated as PII, never rendered
  verbatim in this phase's UI, stripped from detail payloads.
- Prescription clinical content: `diagnosis`, medication `instructions` —
  surfaced only on the controlled prescription detail route behind
  `prescriptions.read` + CLINICAL_RECORD_ACCESSED audit (§13).

## 7. Security review (§54/§60)

- No admin role is admitted by any pharmacy/lab mutation guard (verified all
  `Depends(get_approved_pharmacy|get_approved_lab)`).
- `GET /labs/results/{id}/report-url` issues short-lived signed URLs but only
  to doctor/patient/lab — admins excluded (good: §39 satisfied by omission).
- No pharmacy/lab secrets in the dashboard repo; no service-account files
  (checked §60).
- Dashboard-side: all new reads pass through zod schemas that strip PHI and
  clinical content before cache/render (§38).

## 8. Dependency register

| ID | Spec asks | Backend reality | Dashboard disposition |
| --- | --- | --- | --- |
| PL-1 | Order detail + timeline + fulfillment (§10/§11/§14) | `/pharmacy-orders/{id}` + `/history` + `/fulfillment` are patient/pharmacy-only; admins 403 | Feed-only rendering; links to Finance; dependency documented |
| PL-2 | Sample + result operations (§25–§27) | samples/results are lab-scoped only | Not built; catalog + bookings cover available surface |
| PL-3 | Lab booking detail (§23) | feed embeds patient email/phone/gender + address | Parsed fields stripped at boundary; backend serializer requested |
| PL-4 | Reliable lab feed | uneager-loaded `patient`/`request` embeds risk serialization faults | Tolerant parse (embeds optional); eager-load fix requested |
| PL-5 | Prescription detail (§13) | EXISTS — admin-bypassed `get_by_id` | Built: `/prescriptions/[id]` operational view, clinical fields gated + audited |
| PL-6 | Pharmacy/lab KPI dashboards (§7/§20) | stats endpoints are partner-scoped (`/pharmacies/{id}/stats`, `/labs/me/dashboard`) | "Unavailable" markers, no fabricated metrics (§7.1/§64) |
| PL-7 | Prescription→consultation navigation (§30) | `consultation_id` exists on prescription (no FK) | Links to `/appointments/{id}` when present |
| PL-8 | Exceptions queues (§15/§28) | no exception entity anywhere | Derived indicators (failed/rejected/cancelled rows) only |
| PL-9 | Inventory mutation (§16) | inventory endpoints are `get_approved_pharmacy` | Read-only public inventory search; no mutations (§16 forbids) |
| PL-10 | Delivery tracking (§18) | no courier entity; `tracking_number`/fulfillment fields are partner-visible only | Tracking fields parsed from feed when present; no third-party integration |
| PL-11 | Substitution workflow visibility (§17) | `PharmacyPrescriptionSubstitution` exists; endpoints are pharmacy/patient-only | Documented; no surface (admins cannot read substitutions) |
| PL-12 | Filters/search on feeds (§8/§21) | admin global feeds take page/page_size only | Client-side search over loaded page, labeled as such (CG-2 pattern) |
| PL-13 | Realtime (§34) | no admin WebSocket channel (CG-7) | Refresh-on-demand; no polling theatre on low-traffic feeds |
| PL-14 | Notification failure visibility (§33) | no admin notification queue (CG-6) | Not represented |

## 9. Frontend existing capability (pre-Phase 8)

- `/orders`, `/lab-bookings`: read-only paginated feeds (feature layer moved to
  `src/features/operations` in Phase 7) — no search, no links.
- `/pharmacies`: partner list (Phase 5) + `/partners/pharmacy/[id]` detail.
- Status configs: `orderStatusConfig` (all 11 order states), `labBookingStatusConfig`,
  `paymentStatusConfig`, `partnerStatusConfig` already reconciled to backend enums.
- RBAC scaffold: single `ADMIN` role, permission catalog already contains
  `pharmacy.read`, `laboratory.read`, `prescriptions.read`.
- Audit client: `AuditActions` registry — extended with PHARMACY_ORDER_VIEWED,
  LAB_BOOKING_VIEWED, PRESCRIPTION_VIEWED (§40).
