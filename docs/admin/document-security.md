# Document Security

> Phase 6 §79. Governs how the dashboard interacts with partner verification
> documents. Status: **metadata-only until the backend provides signed access**.

## 1. Current reality (verified)

- Uploads: `POST /upload` (uploads/router.py) accepts JPG/PNG/PDF ≤ 10 MB from any
  authenticated user and returns a **permanent, public Cloudinary `secure_url`**.
  Partner apps store these URLs inside the `documents` JSONB on `LabProfile` and
  `Pharmacy`. `DoctorProfile` has **no documents field**.
- There is **no endpoint that issues short-lived signed URLs**, and no
  private/restricted bucket configuration (audit **BG-2**). There is no per-document
  model, status, or expiry (audit **BG-3**).

## 2. Dashboard policy (in force now)

1. The dashboard **never fetches, renders, logs, or transmits** Cloudinary URLs.
2. `documents` is rendered as **metadata only**: key names (humanized) and field
   counts — see `DocumentsMetadata` on the verification review page and the partner
   detail page.
3. Every document panel states inline why files are not viewable, with a pointer to
   the dependency register (BG-2) — reviewers are never left guessing.
4. No document data appears in URLs, query strings, client logs, or analytics.
5. Document preview / zoom / download (§16–§17) are **not implemented**; they are
   listed in `docs/admin/verification.md` §3 as blocked on backend work.

## 3. Required target architecture (backend dependency — BG-2/BG-3)

```
Admin clicks preview
      ↓ permission check (documents.read / documents.download)
FastAPI authorizes admin + record ownership
      ↓
Short-lived signed URL minted (e.g. Cloudinary authenticated delivery, ~60s TTL)
      ↓ access audited server-side (VIEW/DOWNLOAD_PRIVATE_DOCUMENT)
Secure preview/download in dashboard
      ↓ URL never persisted client-side; discarded on render teardown
```

Backend prerequisites: private/restricted storage mode for verification documents,
a documents table (type, status, expiry, reviewer state), signed-URL issuance
endpoint, per-document audit events, and expiry computation (BG-3). Only after all
of these exist will the dashboard add a document viewer — the permission catalog
already reserves `documents.read` / `documents.download` for that moment.

## 4. Logging rules

Never log: document contents, storage URLs, presigned URLs, identity-document
images, or full metadata payloads. Audit events carry **IDs only**
(`resource: <profile-id>`), matching `lib/auth/auditClient` (§76).
