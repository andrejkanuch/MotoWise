# maintenance-sourcing (plan U2)

Developer-run persistence for the Africa Twin DCT maintenance-extraction pilot. This module turns
**already-validated** extraction drafts into DRAFT rows (`is_verified = false`) for the human
verification gate (U4) to approve. It is **not** a user-facing GraphQL endpoint — there is no
resolver. The PDF ingestion and OpenAI extraction step that produces the drafts is **out of scope
this session** (no PDF parsing, no OpenAI call here).

## Developer-run flow

1. **U2 pre-flight (do this BEFORE extracting):**
   - Confirm the owner's manual actually **contains** each targeted `spec_type`. Torque and
     valve-clearance depth is frequently **service-manual-only**, and service manuals are deferred.
     If the owner's manual lacks a spec_type, **narrow the pilot scope honestly** — do not persist
     empty or guessed rows.
   - Record the source's `market_applicability` (the es-edition's market). Note the working
     assumption that es-edition values apply to the EN/US-facing article.
   - Capture a **page number AND a context snippet** for every value (intake vs exhaust, hot vs
     cold, DCT vs MT) so the U4 reviewer can confirm the value is for the right spec.

2. **Register the source** — `registerSource()` creates/finds one `maintenance_data_sources` row:
   `source_type='owner_manual'`, `edition_language='es'`, `market_applicability`,
   `reference='35MLN610'`, `source_url` (Storage path if uploaded), `retrieved_at`.

3. **Extract upstream** (not in this module): produce `ExtractedScheduleDraft[]` /
   `ExtractedSpecDraft[]`, each Zod-validated against `@motovault/types`. Parse every numeric spec
   value **once** with `parseMetricValue()` (decimal-comma → dot-decimal) to build `value_numeric`,
   keeping the verbatim manual string as `value_display`.

4. **Persist** — `persistDrafts()`:
   - stamps `make='HONDA'`, `model='CRF1100'`, `variant='DCT'`, `source_id`, `is_verified=false`;
   - sets **`is_safety_critical` server-side** via `isSafetyCriticalName(taskName/specName)` from the
     `SAFETY_CRITICAL_ALLOWLIST` — **never** from model output;
   - **rejects** any spec failing `isSpecValueInRange` (out-of-physical-range fabrications) before
     insert;
   - writes `value_numeric` (number) + `value_display` (verbatim) for specs;
   - is **idempotent** (re-running updates the existing row, see below);
   - logs the run to `content_generation_log` with `content_type='maintenance_extraction'`.

## Why select-then-dedup instead of `.upsert(onConflict)`

The natural-key unique indexes in migration `00149` are **COALESCE-expression indexes**
(`UNIQUE (make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), …)`).
supabase-js `.upsert(..., { onConflict })` only accepts a **bare column list** and resolves it to a
constraint/index over those columns — it cannot target an expression index. Passing
`onConflict: 'make,model,variant,…'` would not match, so the upsert would fail or fall back to a
plain insert that violates the index. The plan explicitly permits the fallback: **select-then-
insert/update dedup** keyed on the same columns the COALESCE index covers (NULLs compared with
`.is(col, null)`), which reproduces the index semantics from the app layer and keeps re-extraction
idempotent.

## KTD 8 — the central rule

`is_safety_critical` is **server-set from the allowlist**, never trusted from the LLM. This
deliberately does **not** replicate `articles/article-generator.service.ts:233`, which derives
`is_safety_critical` from LLM-output keyword matching. The extraction draft types in
`@motovault/types` carry no `is_safety_critical` field at all — the only source of truth is
`isSafetyCriticalName()`.

## Orchestrator wiring

`MaintenanceSourcingModule` must be added to the `imports` array in
`apps/api/src/app.module.ts` (alphabetical neighbor: after `MaintenanceTasksModule`). It was left
unedited here per the orchestrated-build directory constraint.
