# Clinical Operations — Phase 7 Pre-Implementation Audit

> Phase 7 §4 first task. Every claim verified against bloom-backend source on
> 2026-09-24. Sections marked **Backend dependency** are capabilities the spec asks
> for but the backend does not expose to admins — documented, never faked.

---

## 1. The appointment model reality

There is **no standalone appointment entity**. "Appointments" are `Consultation`
rows (consultations/models.py); laboratory bookings and pharmacy orders are separate
entities with their own admin feeds (`/admin/lab-bookings`, `/admin/pharmacy-orders`).
Spec sections about a unified appointment lifecycle map to the Consultation model
(dependency **CG-3** documents the mapping). A Flutter-facing alias
(`GET /appointments`, `GET /appointments/{id}` in reminders_router.py) reads the same
rows.

## 2. Backend endpoints (consultations/router.py — prefix `/consultations`)

Admin access rule: `require_consultation_access` admits the `admin` role to **every**
consultation endpoint (participants + DoctorProfile fallback for everyone else).
`GET /consultations` list: patients see their own, doctors see theirs (+profile-id
rows), **admins see all** (with `status` + `patient_id` filters, pagination). The
admin dashboard currently uses `GET /admin/consultations` (same shape, admin-only).

| Endpoint | Method | Admin? | Notes |
| --- | --- | --- | --- |
| `/consultations` | GET | ✅ all rows | filters: `status`, `patient_id`; page/page_size |
| `/consultations/{id}` | GET | ✅ | `ConsultationResponse` (includes clinical fields — see §5) |
| `/consultations/{id}/events` | GET | ✅ | bare array of `SessionEvent` — **the operational timeline** |
| `/consultations/{id}/room` | GET | ✅ | `ConsultationRoom` presence (404 when no room) |
| `/consultations/{id}/status` | PATCH | ❌ participant-only | service rejects non-participants (`update_status`) |
| `/accept`, `/reject`, `/reschedule`, `/cancel`, `/ready`, `/no-show`, `/end`, `/complete`, `/telehealth/interrupt`, `/telehealth/resume` | POST | ❌ participant-only | role rules inside service methods |
| `/consultations/{id}/join`, `/telehealth/join`, `/token`, `/refresh-token` | POST/GET | ⚠️ admin passes dependency | mints Agora tokens — dashboard must never call (§32/§35) |

**Consequence (§10/§46):** the dashboard has **no administrative mutation** over the
clinical lifecycle. Cancellations, reschedules, no-shows, readiness — all executed by
participants in their own apps. Admin override is a backend policy change
(dependency **CG-1**). The UI therefore renders states, timelines, presence, and
links — and no action buttons.

## 3. The actual state machines (authoritative)

`ConsultationStatus`: `pending → confirmed → ready → in_progress → interrupted →
documentation_pending → completed`, plus `cancelled`, `no_show`, `rescheduled`.
`update_status` enforces `VALID_TRANSITIONS` server-side (BadRequest on illegal
moves). `RoomStatus`: `waiting → active → ended`. Full diagrams:
`docs/admin/appointment-state-machine.md`, `docs/admin/consultation-state-machine.md`.

Timeline events (`SessionEventType`): created, confirmed, room_created,
consultation_ready, patient_waiting, provider_joined, patient_joined,
provider_left, patient_left, session_started, session_interrupted, session_resumed,
session_ended, documentation_started, consultation_completed, cancelled, no_show,
rescheduled, payment_received, token_generated — written by the service during
lifecycle transitions (spec §19 is satisfiable from real data).

## 4. Telehealth / Agora

- Tokens minted server-side (`generate_agora_token`, 2 h publisher tokens); rooms
  carry `agora_channel` + `agora_token` **columns** and the room response serializes
  `agora_token` — a leak surface for participant clients; the dashboard schema
  **drops it** (§32) and never renders channel names.
- Presence: `provider_online`, `patient_online`, `last_activity` on the room —
  real data for §34/§36.
- Interrupt/resume endpoints + `SESSION_INTERRUPTED`/`SESSION_RESUMED` events exist.
- Admin joining live sessions: technically possible (`require_consultation_access`
  passes admins on `/join`); **the dashboard will not provide any join affordance**
  (§35: operational visibility ≠ clinical participation).

## 5. PHI / clinical-content boundary (§30)

`ConsultationResponse` includes clinical content: `notes`, `suffering_description`,
`consultation_notes` (SOAP notes live in a separate `ClinicalNote` model returned by
its own endpoints). The dashboard zod schemas define **operational fields only** —
zod strips the clinical keys on parse, so they never reach components or cache.
DOB/gender are also excluded (not needed for operations). Patient name, IDs,
schedule, status, payment, duration, presence, and timeline are the operational set.

## 6. Payments relationship (§16/§17/§40)

`payment_status` enum (pending/paid/refunded/failed/waived) + `payment_reference`
on the consultation; completion triggers escrow earning release server-side. Refund
eligibility is computed by the payments module (`refund_service.py`) — the dashboard
only displays state and links to Finance. Nothing client-side ever infers payment
success.

## 7. Notifications & reminders (§48/§49)

- Real: `NotificationService.create`, `ReminderTask` (status/channels/attempt_count),
  `NotificationQueue` (queued/processed/failed), a reminders worker.
- Admin-visible: **none**. The reminders_router endpoints are Flutter-facing stubs
  (`GET /reminders/tasks` returns `[]`; queue endpoints are worker APIs). Delivery
  status for admins is dependency **CG-6**.

## 8. Realtime (§53)

WebSockets deliver per-user events (`send_json_to_user`) to **participants**;
`broadcast_to_role` is an **empty stub** — no admin-channel events exist. The
dashboard therefore uses interval refetching (feed 60 s, room presence 15 s while
active) and post-action invalidation. Admin realtime is dependency **CG-7**.

## 9. Frontend implementation today (duplication check)

- `src/features/appointments/{service,hooks}.ts`: `fetchConsultations` →
  `GET /admin/consultations` (paginated, status param) — the single feed source.
- `/appointments` page: table (patient, scheduled, status, payment, type, amount) +
  **status filter whose options include `scheduled` — a value that does not exist in
  `ConsultationStatus` and would 500 server-side** (fixed in Phase 7).
- `/consultations` page: re-exports `/appointments` (kept — §5 forbids duplicates).
- No detail page existed; no timeline, presence, or telehealth view.

## 10. Missing capability register (backend dependencies)

| ID | Capability (spec §) | Status | Blocks |
| --- | --- | --- | --- |
| CG-1 | Admin lifecycle mutations: cancel/reschedule/no-show on behalf of ops (§38/§41/§43/§46) | Participant-only in service layer | Exception resolution, admin cancellation |
| CG-2 | Server-side search (IDs/names/reference), date ranges, payment/type filters, sort params on the admin feed (§7/§20–§22) | Only `status` + `patient_id` | Full queue management |
| CG-3 | Unified appointment entity spanning doctor/lab/pharmacy services (§3/§15) | Consultation is doctor-only; lab/pharmacy have separate feeds | Cross-type appointment center |
| CG-4 | Operational exception model (§24/§25) | None — closest are status filters (interrupted/no_show) | Exception queue |
| CG-5 | No-show dispute workflow (§45) | One-way `mark_no_show`; disputes are generic Support rows | Dispute loop |
| CG-6 | Admin notification/reminder delivery status (§48/§49) | Reminder/queue endpoints are Flutter-facing stubs | Notification failure view |
| CG-7 | Admin realtime channel (§53) | `broadcast_to_role` is a stub; per-user only | Live invalidation |
| CG-8 | Cancellation source attribution (§38: who cancelled) | `cancellation_reason` + CANCELLED event exist but actor attribution is in event metadata only | Cancellation detail |
| CG-9 | Waiting-room metrics (§34) | Room presence is per-consultation; no aggregate | Aggregate views |

## 11. Security review

- ✅ Admin read access is explicit and narrow; mutations are participant-only.
- ✅ Agora secrets stay server-side; config hardcoding (Agora creds in
  `app/config.py` ~101–102) remains flagged for rotation from Phase 1.
- ⚠️ `GET /appointments/{appointment_id}` (reminders_router alias) has **no auth
  dependency at all** — unauthenticated consultation read. Flagged to the backend
  team as a P1 fix (dashboard does not use this route).
- ⚠️ Room responses expose `agora_token` to any participant caller — recommend
  removal from the serialized model (dashboard-side schema drops it).

## 12. Phase 7 implementation decisions

1. **Extend, don't duplicate:** `/appointments` stays the Appointment Center
   (fixed filters to the real enum + URL-persisted status); `/consultations` keeps
   re-exporting it. New: `/appointments/[id]` (detail + timeline + presence + links),
   `/telehealth` (active-session operations: ready/in-progress/interrupted).
2. **Read-only administration:** zero mutation affordances; every state change
   happens in participant apps; dependency CG-1 documented everywhere an admin
   might look for an action.
3. **Timeline from `SessionEvent`** — actor, event, timestamp; no clinical content.
4. **Presence polling (15 s)** only while a session is active; feed polls 60 s.
5. **PHI minimization** enforced at the schema boundary (clinical fields stripped).
