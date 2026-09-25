# Consultation Session State Machine

> Phase 7 §28/§33/§79. Telehealth session states as actually implemented
> (consultations/models.py + telehealth endpoints). The dashboard renders these
> only; session tokens are minted server-side and are never exposed here.

## 1. Room lifecycle (ConsultationRoom.status — RoomStatus)

```
waiting ──► active ──► ended
```

| State | Presence meaning |
| --- | --- |
| `waiting` | Room exists; at least one participant not yet joined (`provider_online` / `patient_online` flags show who) |
| `active` | Live telehealth session |
| `ended` | Session closed (end-session flow; duration recorded) |

## 2. Session event timeline (the operational source)

The room status is a snapshot; the **timeline** is `GET /consultations/{id}/events`
(`SessionEvent` rows): room_created → patient_waiting → provider_joined /
patient_joined → session_started → session_interrupted → session_resumed →
session_ended → documentation_started → consultation_completed. Failure-shaped
events (cancel/no_show) and payment_received/token_generated also land here.

Dashboard rendering (`/appointments/[id]`):
- Presence panel: provider/patient online flags + `last_activity` — polled every
  15 s **only while status is `ready` or `in_progress`**; static otherwise.
- Timeline panel: events ascending with actor (system events have no actor) and
  Africa/Accra timestamps; event metadata is **not** rendered (may carry
  technical/clinical payload).

## 3. Join/telehealth security boundary (§31–§35)

- `/telehealth/join`, `/{id}/join`, `/{id}/token`, `/{id}/refresh-token` mint Agora
  credentials for **participants**. Admin passes the access dependency technically,
  but the dashboard provides **no join affordance**: operational visibility
  (presence, timeline, duration) is strictly separated from clinical participation.
- Room payloads include `agora_channel`/`agora_token`; the dashboard zod schemas
  include only `status`, presence flags, and `last_activity` — tokens/channels are
  dropped at the parse boundary (§32).
