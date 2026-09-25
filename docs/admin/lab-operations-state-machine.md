# Laboratory Operations State Machine (authoritative)

> Source: `bloom-backend/app/modules/labs/models.py` (enums) and
> `app/modules/labs/service.py`. Unlike pharmacy orders, lab booking status
> changes are **not transition-validated** server-side (PL-B4); samples and
> results carry stronger governance. The dashboard renders states without
> assuming legality (§9).

## Booking lifecycle — `LabBookingStatus`

```
pending → confirmed → completed
   ↓          ↓
cancelled   no_show
```

States: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`.
`booking_type`: `walk_in` | `home_service` (home service carries `address` —
PII, stripped in dashboard parsing, PL-3).
No `VALID_TRANSITIONS` map is enforced — the partner app can set any status.
The dashboard therefore never renders a booking state as "illegal" or
"impossible".

## Sample lifecycle — `LabSampleStatus`

```
requested → collected → received → accepted → processing → completed
                ↓           ↓
          (re-collect)  rejected → recollection_required
```

States: `requested`, `collected`, `received`, `accepted`, `processing`,
`completed`, `rejected`, `recollection_required`, `cancelled`.
Every status change writes an immutable **`LabSampleEvent`** (previous → new
status, actor, role, reason). Exceptions surface as `rejected` /
`recollection_required` rows with `rejection_reason` (§25 vocabulary: the
backend stores free-text reasons, not an exception enum — dashboard does not
invent one).

## Result governance — `LabResultStatus`

```
draft → entered → review_pending → validated → released
                                                 ↓
                                              amended (v+1, previous_version_id)
```

Every mutation (create/update/review/validate/release/amend) is written to
**`LabResultAudit`**. Results are doctor/patient-visible only after explicit
`release` (escrow release hooks fire backend-side). Admin access to result
content: none (`/labs/results/{id}/view` forbids non-doctor/patient) — the
dashboard never renders `result_value`, `structured_items`, or report URLs
(§26/§39, PL-2).

## Request pipeline — `LabRequestStatus`

`pending → accepted | rejected | cancelled` (lab decides). A booking hangs
off an accepted request (`LabRequest.booking`, 1:1).
