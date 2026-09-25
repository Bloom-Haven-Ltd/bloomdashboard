# Trust & Safety Center — Scope & Backend Dependencies

> Phase 6 §79. Phase 6 keeps **verification and trust & safety conceptually separate**
> (§39). What the backend actually supports today determines what this area contains.

## 1. What exists and is rendered

| Capability | Backend source | Dashboard surface |
| --- | --- | --- |
| Partner verification decisions | `PATCH /admin/verify/{role}/{id}` | `/verification` (Verification Center) |
| Account suspension / reactivation | `PATCH /admin/users/{id}/status` (`is_active`) | `/users/[id]` (Phase 5; the only restriction lever — audit BG-5) |
| Disputes (closest case analog) | `GET/PATCH /admin/disputes` | `/support` (Phase 3) |
| Audit trail (append-only) | `GET /admin/audit-logs` | `/audit-logs` (§46–§47: no edit/delete affordances anywhere) |

## 2. What does not exist — deliberately absent from the UI

Trust & Safety **cases** (§31–32), restriction **types** (§35–37), risk
signals/scores (§33–34), security **events** (§58–59), reports with reporter-privacy
(§40–41), escalation routing (§42), and four-eyes approvals (§50) have **no backend
model** (dependency register BG-4…BG-7, BG-12 in `trust-safety-audit.md` §8).

Per §6/§19/§81, none of these are faked:

- Navigation shows a disabled **"Trust & Safety Cases"** placeholder
  (`trust_safety.read`) so the intended IA is visible; it leads nowhere because there
  is nothing authoritative to show.
- **"Security Events"** remains a placeholder (BG-7).
- No page implies that a verification failure equals fraud (§39). The Verification
  Center's copy separates "submitted information has not yet been verified" from any
  misconduct claim.

## 3. Emergency actions posture (§38)

The only emergency lever the backend exposes is `is_active` suspension, which:
requires an audited reason + typed confirmation on the user detail page, is
re-authorized server-side, and (via `session_version`/`is_active` enforcement)
revokes access. It is presented as an **account lifecycle action** (Phase 5), not a
trust-case action, because no case model exists to hang it on.

## 4. When the backend adds cases

Required before the dashboard builds a case center (all registered): case model with
types/status/assignment/escalation (BG-4), restriction vocabulary (BG-5), risk
source (BG-6), security-event feed (BG-7), role separation (BG-12). The feature
would live in `src/features/trust-safety/` per §78, consuming backend enums only.
