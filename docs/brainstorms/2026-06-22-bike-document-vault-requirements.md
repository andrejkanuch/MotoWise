---
date: 2026-06-22
topic: bike-document-vault
---

# Bike Document Vault — Requirements

## Summary

A per-bike document vault: riders store photos and PDFs of their insurance, registration, title, service records, manuals and the like, organized by category. Each document can carry an optional expiry date that drives renewal reminders, and key documents are reachable fast. It lives as a Documents section on each bike's detail screen, with expiry alerts surfacing in the garage alongside maintenance. v1 delivers two jobs end-to-end — organized storage and renewal reminders; fast roadside retrieval is online-only for now, and the share/hand-over pack is foundational (enabled) rather than shipped.

---

## Problem Frame

A rider's bike paperwork is scattered: the insurance certificate sits in an email attachment, the registration card is a photo buried in the camera roll, the purchase receipt is in a drawer, the owner's manual is a PDF somewhere. There is no single place that says "this is *my* bike, and here is everything that proves it and keeps it legal."

The cost shows up at the worst moments — pulled over and fumbling for proof of insurance, at a border without registration, realizing insurance lapsed a week ago, or selling a bike and scrambling to assemble its history for a buyer. MotoVault already holds the bike's identity, mileage, maintenance and expenses; the documents that anchor ownership are a gap it doesn't yet cover, and they are exactly the things a rider least wants to lose or be caught without. (This frames a hypothesis, not a measured demand — see the adoption assumption under Dependencies.)

---

## Key Decisions

- **Expiry behavior is decoupled from categories.** Reminders key off a document's expiry date, not its category label. Categories are user-editable (rename, hide, add); tying renewal reminders to a mutable label would make them silently fragile. The expiry date is a property of the document.
- **Private storage, not the existing public photo path.** These documents carry personal data (title, insurance with name/policy/address). They must live in private, RLS-enforced storage and must not reuse the world-readable `maintenance-photos` bucket.
- **Photos and PDFs, not photos only.** The canonical insurance/registration artifact is the PDF an insurer emails. Forcing riders to screenshot it loses fidelity and the "this is the real document" trust the feature promises. This requires a new file path that does not lossily re-compress PDFs.
- **The vault enables a hand-over pack but does not ship it.** Holding everything in one organized place is what *makes* a sell/hand-over bundle possible; the one-tap share/export action is deferred. v1 organizes and stores; sharing comes later.

---

## Requirements

### Document model & capture

- R1. A document belongs to exactly one bike and consists of one or more files (e.g. front and back of a card) plus a user-visible title.
- R2. Supported file types are images (camera capture or photo library) and PDFs (file picker / shared in from another app such as email). A document holds up to 10 files; images are capped at 5 MB and PDFs at 20 MB each.
- R3. A document carries an optional expiry date and an optional free-text note. For expiry-bearing categories (Insurance, Registration, Inspection), the add flow prompts for an expiry date rather than leaving it silently blank; if such a document is saved without one, it is visibly flagged "no reminder set" in the Documents list so the never-lapse gap is never silent.
- R4. The original file is stored without lossy re-compression of PDFs — a stored PDF remains a readable PDF.

### Organization & categories

- R5. Each document is filed under exactly one category.
- R6. The app ships these seeded categories: Insurance, Registration, Title/Ownership, Inspection, Service Records, Manual, Warranty, Receipts.
- R7. Riders can add their own categories and can rename or hide any category, seeded or custom.
- R8. Hiding a category never loses the documents filed under it — they remain accessible and recoverable.

### Expiry & reminders

- R9. Renewal reminders are driven by a document's expiry date, independent of its category, so renaming or hiding a category never affects an existing reminder.
- R10. When a document has an expiry date, the rider receives renewal reminders ahead of it, reusing the existing maintenance-reminder cadence.
- R11. Documents nearing or past expiry surface both as alerts in the garage/tasks summary (alongside maintenance reminders) and as expiry status within the Documents section on the bike detail screen (R12).

### Surfacing & retrieval

- R12. Each bike's detail screen has a Documents section listing documents grouped by category, showing counts and expiry status.
- R13. A rider can open and view a document (image or PDF) within the app using a native or sandboxed viewer with JavaScript execution disabled (an emailed PDF is untrusted input).
- R14. A rider can pin/favorite documents for one-tap fast retrieval (e.g. insurance, registration).
- R15. Fast retrieval works online in v1; pinned documents are the basis for later offline support.

### Privacy & lifecycle

- R16. Documents are stored privately and accessible only to the owning rider (RLS-enforced); they are never world-readable.
- R17. Documents follow their bike's lifecycle — a soft-deleted bike's documents are hidden but retained and recoverable (matching the bike's own reversible soft-delete); storage is purged only at hard delete (R22).
- R18. Deleting a document removes its underlying file(s) from storage (storage-first; see R23).

### Security & file handling

- R19. Documents are served only via short-lived, server-generated signed URLs; the public-URL pattern used by the existing photo buckets is never used, signed URLs are not persisted, and they expire quickly (≤60s for in-app display, ≤5min for an explicit download).
- R20. Uploads are restricted to an explicit MIME allowlist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), enforced at both the Storage bucket and the application layer.
- R21. Storage paths are rooted at the owning user (`{userId}/{motorcycleId}/{documentId}/…`) so the folder-prefix RLS pattern protects every object.
- R22. Document files are purged only at hard delete — the account hard-delete sweep (the vault bucket is added to its bucket list) and any future bike hard-delete — never on a recoverable soft-delete. Postgres cascade deletes DB rows only, so storage objects must be removed explicitly at that point.
- R23. Deletion is storage-first (remove the file, then the row) to avoid orphaned PII; no decrypted document bytes are persisted on-device in v1 (in-session/in-memory only).
- R24. Per-user vault storage is capped, and uploads and signed-URL generation are rate-limited, to bound abuse and storage cost (no app-wide rate limiting exists today).
- R25. The share-extension intake path (R2) verifies an authenticated session before accepting a file; with no valid session it rejects the file and prompts the rider to open and sign in to the app.

---

## Key Flows

- F1. Add a document
  - **Trigger:** Rider taps "Add" in a bike's Documents section.
  - **Steps:** Pick a category (or create one) → capture/choose images or pick a PDF → set a title and optional expiry date/note → save.
  - **Outcome:** The document appears under its category; if an expiry date was set, a reminder is scheduled.
  - **Covered by:** R1, R2, R3, R5, R9.

- F2. Insurance renewal reminder
  - **Trigger:** A document with an expiry date approaches that date.
  - **Steps:** The app fires reminders on the standard cadence → the document also shows as an expiring alert in the garage summary.
  - **Outcome:** The rider renews before lapse; updating the document with a new expiry date reschedules reminders.
  - **Covered by:** R9, R10, R11.

- F3. Roadside retrieval
  - **Trigger:** Rider needs to show insurance/registration quickly (stop, border, incident).
  - **Steps:** Open the pinned documents (or the bike's Documents section) → tap the document → it opens full-screen.
  - **Outcome:** The rider presents the document. (Requires signal in v1; offline deferred.)
  - **Covered by:** R12, R13, R14, R15.

---

## Acceptance Examples

- AE1. Category rename doesn't break reminders. **Given** an Insurance document with an expiry date and a scheduled reminder, **when** the rider renames the "Insurance" category to "Cover", **then** the reminder still fires unchanged. **Covers R7, R9.**
- AE2. Expiry surfaces as a garage alert. **Given** a document expiring in 12 days, **when** the rider opens the garage summary, **then** it lists the document as expiring soon alongside maintenance reminders. **Covers R10, R11.**
- AE3. Hiding a category preserves its documents. **Given** a custom category with two documents, **when** the rider hides the category, **then** the two documents remain accessible (not deleted). **Covers R8.**
- AE4. Emailed PDF stays a PDF. **Given** an insurance PDF shared in from email, **when** the rider stores it and later opens it, **then** it opens as the original readable PDF, not a downscaled image. **Covers R2, R4, R13.**

---

## Scope Boundaries

**Deferred for later**

- Encrypted on-device caching of pinned documents for true zero-signal offline retrieval.
- One-tap share/export "hand-over pack" (assembling ownership + history for a buyer, mechanic, or insurer).
- Auto-linking documents to expense entries (the `insurance` and `registration` expense categories already exist).
- OCR auto-extraction of expiry dates from uploaded documents.

**Out of scope**

- Multi-bike or multi-user (fleet) document sharing.
- More than one category per document (single-category filing only).

---

## Dependencies / Assumptions

- Builds on the existing reminder/notification system, but this is net-new work, not a flag flip: today's reminders are client-local (`expo-notifications`), keyed by task id, with maintenance-shaped actions ("Mark Done"/"Snooze") and a shared iOS 64-notification budget. Document expiry reminders need their own id-namespacing, notification copy/actions, and a rescheduling story within that budget.
- Requires a new private Storage bucket with RLS for documents; both existing photo buckets (`bike-photos`, `maintenance-photos`) are public-read, so no existing bucket is suitable.
- Requires a PDF/file picker (document picker is not currently used in the app) and a native/sandboxed PDF viewer.
- Assumes one category per document is sufficient for v1 (no multi-tag).
- **Adoption assumption (load-bearing, unvalidated):** riders will trust the app with sensitive legal documents and bother to upload them. PostHog-validated priority today is expenses > maintenance > rides; this feature has no comparable demand signal. Falsification signal: a low document-upload rate among active users in the first weeks. Worth a cheap validation before committing the full private-storage build.
- **Jurisdiction assumption:** the roadside/border value assumes officials in target markets accept phone-displayed insurance/registration; acceptance varies across Europe and the Americas. Frame the feature as fast access to *your copy*, not a legal substitute for the original, until coverage is confirmed.

---

## Outstanding Questions

**Resolve before planning**

- Hidden-category handling for R8: do documents move to an "Uncategorized" view, or stay filed under the hidden category but out of the main list?
- Beyond the prompted set in R3, should any other seeded category default to prompting for an expiry date?
- Adoption-validation gate: define a cheap probe for the load-bearing adoption assumption (e.g. measure document-upload rate after a lightweight prompt) to run before committing the full private-storage build — or explicitly accept building on the unvalidated bet.

**Deferred to planning**

- Whether the reminder cadence is fixed (e.g. 30/7/1 days) or configurable per document.

**Design & interaction (resolve in design phase)**

- Category management: where add/rename/hide of a category lives (no surface/gesture/screen is specified yet) — F1 only covers create-during-add.
- Empty state for a bike with zero documents (this sets the first impression of the whole feature).
- Upload states: in-progress and failure handling (PDFs are large on mobile; a silent failure breaks the trust promise).
- Visual treatment of near-expiry and expired documents, consistent across the list row and the garage alert.
- Where pinned documents live — the retrieval surface for the roadside flow (F3) is undefined.
- Document viewer behavior: multi-file navigation (front/back of a card), zoom/pan, enter/exit.
- Add-document shortcut from a garage expiry alert (tap "Insurance expiring" → upload the renewal).
- Document edit/delete paths (update title, change category, set expiry; destructive-delete confirmation).

**Scope challenges raised in review (v1 weight check)**

- scope-guardian argues custom categories (R7/R8) could ship in v2, seeding the eight fixed categories for v1. The hybrid-categories decision was deliberate; revisit only if v1 feels heavy.
- scope-guardian argues garage alerts (R11) could be deferred since the push reminder (R10) alone delivers never-lapse. Garage surfacing was a deliberate choice.
- scope-guardian argues pin/favorite (R14/R15) is not v1-necessary since F3 also works via the Documents section. Pinning underpins the roadside/offline direction.

---

## Sources / Research

- Bike detail screen and sections — `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`; motorcycle model — `apps/api/src/modules/motorcycles/models/motorcycle.model.ts`. The Documents section slots alongside the existing Maintenance/Expenses sections.
- Existing upload path is image-only and compresses to WebP — `apps/mobile/src/lib/image-upload.ts`. Documents need a new path that supports PDFs and skips lossy compression.
- Storage buckets — `bike-photos` and `maintenance-photos` are **both public-read** (`bike-photos` was made public in `supabase/migrations/00042_make_bike_photos_bucket_public.sql`); neither is suitable for documents, so a new private bucket is required.
- Photo-attachment precedent (per-row file metadata + app-layer count caps) — `expense_photos` (`supabase/migrations/00076_expense_photos.sql`) and `maintenance_task_photos` tables; a similar `documents` table + RLS is the natural shape.
- Reminder-cadence precedent — maintenance task reminders (`remind30d`/`remind7d`/`remind1d`) on the maintenance-tasks model.
- User-driven taxonomy precedent — `condition_tags` JSONB array on trips (`supabase/migrations/00065_route_reviews_saves_waitlist.sql`), the closest existing example of user-extensible categorization.
