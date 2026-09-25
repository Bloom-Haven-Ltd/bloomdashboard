# Users & Partners — Capability Audit (Phase 5, §4/§5.1–5.4)

## Verified backend capabilities

| Capability | Endpoint | Notes |
|---|---|---|
| List users | `GET /users` (admin) | Server-side pagination; `role`, `search` (email/first/last name) filters. **No** sort/date/status params. |
| User detail | `GET /users/{id}` | Admin or self; full `UserResponse` (identity, contact, states, timestamps). |
| Suspend / reactivate | `PATCH /admin/users/{id}/status` | Backend-authoritative; audited server-side. |
| Verification queue | `GET /admin/verifications/pending` | Doctors (via user.is_verified), labs + pharmacies (`is_verified=false` / `PENDING`). Includes `license_number` and `documents` (JSONB metadata, labs/pharmacies). |
| Approve / reject verification | `PATCH /admin/verify/{role}/{profile_id}` | `is_verified` + `rejection_reason`. Backend validates role + state. |
| Doctor profiles | `GET /doctors`, `GET /doctors/{id}` (public) | Rich: specialty, experience, bio, fee, languages, hours, availability, license, education, certifications, rating, joined user names. |
| Laboratory profiles | `GET /labs`, `GET /labs/{id}` (public) | Name, services, verification, rating. |
| Pharmacy profiles | `GET /pharmacies`, `GET /pharmacies/{id}` (public) | Name, license, type, `status` (PharmacyStatus), contact, address/GPS, services, hours, delivery config, rating. |
| Account states | `User.is_active`, `PharmacyStatus`, `is_verified` (bool) | **No** PENDING/LOCKED/RESTRICTED/DEACTIVATED states exist — not invented (§11). Suspension = `is_active=false`. |

## Missing capabilities (backend dependencies — documented, not faked)

| Gap | Spec ref | Required backend work |
|---|---|---|
| Secure document viewing (short-lived signed URLs + access logging) | §23/§24 | `GET /admin/partners/{role}/{id}/documents/{doc_id}` issuing expiring URLs; uploads module is upload-only today. Until then the dashboard shows document **metadata only** and never renders permanent Cloudinary URLs. |
| Status / registration-date / last-active filters + sorting on user list | §7/§8/§9 | Extend `list_users` query params. |
| User relationship views (appointments/orders/payments per user) | §10/§35 | Admin-scoped aggregates per user. |
| Partner operational-status control (pause/unpause) | §29/§30 | No admin endpoint exists; PharmacyStatus has no PAUSED state. |
| Bulk actions / exports | §40/§41 | Backend generation + audit + rate limits required first. |
| Verification multi-state workflow (NEEDS_CORRECTION, EXPIRED, reviewer, timestamps) | §21/§28 | Backend models verification as boolean + queue only. |

## Security review (§55)

- Client-side authorization is UX-only; all mutations backend-enforced (verified `get_current_admin` on every admin route).
- BOLA/IDOR: `GET /users/{id}` restricted to self/admin server-side; partner profiles are public marketing data by design (no PHI).
- PHI: user list/detail expose identity + contact only — no clinical records on management pages (§57).
- Documents: no public rendering of storage URLs (see dependency above).
- No mock data anywhere; every field rendered traces to a verified response field.
