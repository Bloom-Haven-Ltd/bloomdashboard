# Appointment State Machine

> Phase 7 §9/§79. Documents the **actual** backend model. There is no standalone
> appointment entity — appointments are `Consultation` rows (see
> `clinical-operations-audit.md` §1); lab bookings and pharmacy orders have their
> own feeds. `update_status` enforces the transitions below server-side
> (`VALID_TRANSITIONS`; illegal moves are rejected with 400 before any write).

## 1. ConsultationStatus (the appointment lifecycle)

```
pending ──► confirmed ──► ready ──► in_progress ──► documentation_pending ──► completed
   │            │                       │  ▲
   │            │                       │  └── session_resumed
   │            │                       ▼
   │            │                  interrupted
   │            │
   └──► cancelled          no_show          rescheduled
```

| State | Meaning (operational) | Set by |
| --- | --- | --- |
| `pending` | Requested; awaiting partner acceptance | Patient booking |
| `confirmed` | Partner accepted the appointment | `POST /{id}/accept` |
| `ready` | Room prepared / participants signaled readiness | `POST /{id}/ready` |
| `in_progress` | Live session; `consultation_start_time` stamped | `PATCH /{id}/status` / telehealth join |
| `interrupted` | Session dropped; resumable | `POST /{id}/telehealth/interrupt` |
| `documentation_pending` | Session ended; provider must finish documentation | End-session flow |
| `completed` | Final; escrow earning released server-side | `POST /{id}/complete` |
| `cancelled` | Terminated before start; `cancellation_reason` recorded | `POST /{id}/cancel` |
| `no_show` | Backend-determined non-attendance (§44 — never client-inferred) | `POST /{id}/no-show` |
| `rescheduled` | Moved; `reschedule_reason` + new `date_time` | `POST /{id}/reschedule` |

## 2. Supporting enums

- `RoomStatus`: `waiting → active → ended` (ConsultationRoom).
- `SessionEventType`: created, confirmed, room_created, consultation_ready,
  patient_waiting, provider_joined, patient_joined, provider_left, patient_left,
  session_started, session_interrupted, session_resumed, session_ended,
  documentation_started, consultation_completed, cancelled, no_show, rescheduled,
  payment_received, token_generated — this is the §19 operational timeline.
- `PaymentStatus`: pending / paid / refunded / failed / waived (per consultation).
- `ConsultationType`: routine / follow_up / urgent / emergency.
- `ConsultationMode`: video / audio / chat / in_person.
- `UrgencyLevel`: low / medium / high / critical.

## 3. Dashboard rendering rule

`consultationStatusConfig` in `src/constants/status.ts` maps exactly these values;
unknown values render as neutral "Unknown" via `getStatusConfig`. The dashboard
invents no states and no transitions — it observes; participants mutate; the
backend re-validates every mutation (dependency CG-1 covers admin-side actions).
