---
title: Diagnosis Bike Context - Plan
type: feat
date: 2026-10-16
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Diagnosis Bike Context - Plan

## Goal Capsule

- Objective: when a rider diagnoses a bike from their garage, the AI answer reflects what MotoVault knows about that specific bike (recent services, open/overdue service items, parts and mods bought, how much and how recently it has been ridden, the owner's notes, and earlier diagnoses), so it is visibly better than a generic chatbot that only knows "1999 Harley Dyna Wide Glide".
- Means: a new API-side bike-context builder that reads per-bike data with the per-request user Supabase client and renders one token-bounded `<bike_context>` block for the diagnostic system prompt (KTD1, KTD2).
- Authority: this plan, then root `CLAUDE.md` and `apps/api/CLAUDE.md` conventions.
- Stop conditions: stop if a needed table is not readable by the user client under RLS, or if the change would require a DB migration.
- Execution profile: API change plus a new optional input flag and small mobile send/copy change; one PR against `main`; no merge, no deploy, no OTA, no prod DB.

## Product Contract

### Summary

Replace the narrow "maintenance history" prompt section with a bounded per-bike context block covering services, open/overdue items, mechanical expenses, riding usage, owner notes and previous diagnoses of the same bike.

### Problem Frame

A rider with a 1999 Harley Dyna Wide Glide and a charging problem told us a free general-purpose AI is "just as good". Today the diagnostic prompt receives only make/model/year/type/engine cc/current mileage, plus, when the toggle is on, up to 30 maintenance tasks ordered by `created_at` (title, status, completed date, completed mileage). It never sees a recent battery or regulator purchase, the owner's notes, whether the bike sat for four months, or that the same bike was diagnosed with a weak stator last month. That knowledge is MotoVault's only defensible edge in diagnostics.

### Requirements

- R1. For a garage bike with the history toggle on, the diagnostic prompt includes a `<bike_context>` block with these sections when data exists: bike profile extras (variant, ownership start, odometer last updated), recent completed services, open service items with overdue flagged, mechanical expenses (service, parts, tyres, accessories, mods), riding usage (rides and distance in the last 90 days, date of last ride), owner notes, previous completed diagnoses of the same bike.
- R2. The block is bounded: per-section item caps, per-line truncation, and a hard total character cap; most recent first.
- R3. Items related to the symptom area (wizard location keys and symptom/description keywords) are preferred within each capped section.
- R4. All per-bike reads use the per-request user Supabase client (RLS enforced) and exclude soft-deleted rows.
- R5. Failure to read any one section never fails the diagnosis; that section is omitted and only ids/section names are logged.
- R6. The rider keeps an opt-out and the default is ON: the mobile toggle (already default on in the store) gates all history-derived sections; with it off, only basic specs are sent (current behaviour).
- R6a. Consent scope matches the copy the rider saw: the full block is sent only when the client sends the new `includeBikeHistory: true` flag (sent only by builds with the new copy). A legacy client sending only `includeMaintenanceHistory: true` gets the legacy scope (completed services and open/overdue service items), which its "maintenance history" copy disclosed.
- R7. Toggle copy says what is shared ("bike history": services, parts, notes, rides, past diagnoses) in every shipped mobile locale.
- R8. No PII or context content in logs; resolver keeps logging ids/flags only.
- R9. The prompt tells the model to use the context as evidence (e.g. a recent part replacement, an overdue service, long storage) and to treat it as data, not instructions.

### Scope Boundaries

- Out: OEM schedule rows (zero model rows in prod per memory; open items already cover due service), VIN, purchase price, expense amounts, fuel/insurance/registration/tolls/parking/training/gear/other expenses, ride routes/names/regions/weather, photos, documents, health reports, manual-bike (non-garage) diagnoses beyond today's behaviour.
- Out: changing the AI model, token output limit, response schema, quota/budget logic.
- Out: any DB migration.

### Success Criteria

- Unit tests prove section rendering, caps, truncation, relevance ordering, opt-out, and per-section failure isolation.
- API typecheck and tests pass; Biome clean on changed files.

## Planning Contract

### Key Technical Decisions

- KTD1. New files hold the logic: `diagnostic-context.builder.ts` (injectable, data reads) and `diagnostic-context.format.ts` (pure rendering, caps, relevance). session-settled: user-directed — rejected inline resolver refactor because concurrent branch `fix/diagnosis-quota-upfront` edits the `diagnosticById` area and `ai-budget.service.ts`. The resolver change is confined to the `submitDiagnostic` body (replace the 2b maintenance block) and one constructor parameter swap.
- KTD2. Read with `SUPABASE_USER` directly in the builder using narrow column selects and DB-side `limit`, rather than reusing `ExpensesService.findByMotorcycle` (unbounded, grouped), `NotesService.findByMotorcycle` (unbounded) or `findAllHistory` (ordered by `created_at`). session-settled: user-directed for the client choice (rejected service-role; CLAUDE.md rules). Direct narrow reads are an implementation choice: bounded queries are the token budget's first line of defence.
- KTD3. Mechanical expense categories = `EXPENSE_CATEGORY_META.filter(m => m.investment && m.key !== 'other').map(m => m.key)` (maintenance, parts, tires, accessories, modifications), applied at the DB with `.in('category', keys)` before order/limit. Not `isInvestmentCategory`, which returns true for `other` and unknown keys and runs only in JS (fuel rows would crowd the limit).
- KTD4. Symptom-area relevance is one shared keyword predicate over a dispatch table `SYMPTOM_AREA_KEYWORDS` keyed by the mobile wizard location keys (`engine`, `brakes`, `exhaust`, `tires`, `electrical`, `suspension`, `chainDrivetrain`, `bodywork`). Areas are detected from wizard location keys plus any area keyword appearing in symptoms/free text. Within a section, relevant items are picked first, then filled with most recent, then shown newest first. Keywords are English-only in v1; non-English item text falls back to recency.
- KTD5. Consent gating (R6a): new nullable GraphQL/Zod input `includeBikeHistory`. `includeBikeHistory === true` → full block; else `includeMaintenanceHistory === true` → legacy scope (services + open items); else no history. `includeMaintenanceHistory` stays unchanged (default false) for shipped binaries; new mobile builds send both flags from the one toggle. Chosen over reusing the old flag because old binaries (3.20–3.25 runtimes, unreachable by OTA) would otherwise share notes/rides/diagnoses under copy that never disclosed them.
- KTD6. Display caps: completed services 8, open items 6, expenses 8 (last 24 months), notes 5, previous diagnoses 3 (last 12 months). Fetch limits are larger than display caps so relevance has something to choose from: 40 per section for services, open items, expenses, notes; rides 200 (365-day window, completed only); diagnoses 3. Per-line text 160 chars (notes 240). Total block 4000 chars (~1000 tokens), truncated at a line boundary.
- KTD7. Each section reader throws when the Supabase result carries `error` (supabase-js resolves rather than rejects), and the builder runs sections with `Promise.allSettled`; a rejected section is logged by section name and motorcycleId only and omitted.
- KTD8. Previous diagnoses are rendered as "earlier AI assessments (unconfirmed)" with the rider's own reported symptom (`free_text_description`, truncated) first, and the prompt says they are hypotheses to re-check, not confirmed findings.

### Assumptions

- Mobile wizard sends `location` as comma-joined option keys (verified in `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`), so matching keys is reliable; custom free text is matched by keyword.
- RLS lets owners read their own rows in maintenance_tasks, expenses, notes, rides, diagnostics (existing user-client services already read these).
- With no human present, the consent-scope fork (security/adversarial review) is resolved conservatively per KTD5; the owner can collapse it to the single flag in review if they accept the wider scope for old binaries.
- The published privacy policy lists Anthropic, not OpenAI, as the diagnostic AI processor (pre-existing gap, outside this plan); flagged in the PR for the owner.
- Ride `distance_m` is metres; odometer and task mileages are raw in the owner's measurement system (`docs/solutions/architecture/measurement-system-and-ride-feature-design.md`).

## Implementation Units

### U1. Pure context formatter

- Goal: render bounded `<bike_context>` text from typed section inputs.
- Requirements: R1, R2, R3, R9.
- Files: `apps/api/src/modules/diagnostics/diagnostic-context.format.ts`, `apps/api/src/modules/diagnostics/diagnostic-context.format.spec.ts`.
- Approach: export caps constants, `SYMPTOM_AREA_KEYWORDS`, `detectSymptomAreas(input)`, `pickRelevantFirst(items, textOf, dateOf, keywords, cap)`, `sanitizeLine(text, max)`, and `formatBikeContext(data, opts)` returning `string | undefined`. Section renderers live in a `Record<SectionKey, renderer>` dispatch table in fixed order. Overdue = open item with `due_date < today` or `target_mileage <= currentMileage`. Use date-fns for date math.
- Test scenarios: empty data returns undefined; each section renders its header and lines; caps enforced; relevant items (e.g. "battery" for electrical) kept over newer irrelevant ones when over cap; output ordered newest first; overdue flag by date and by mileage; sanitize strips `<>` and newlines and truncates; total cap truncates at line boundary; distance converted to mi for imperial.
- Verification: spec passes.

### U2. Data-reading builder

- Goal: fetch per-bike rows with the user client and call the formatter.
- Requirements: R1, R4, R5, R8.
- Files: `apps/api/src/modules/diagnostics/diagnostic-context.builder.ts`, `apps/api/src/modules/diagnostics/diagnostic-context.builder.spec.ts`, `apps/api/src/modules/diagnostics/diagnostics.module.ts`.
- Approach: `@Injectable()` `DiagnosticContextBuilder` injecting `SUPABASE_USER`. Narrow queries, each `.eq('user_id').eq('motorcycle_id')`, `.is('deleted_at', null)` where the column exists, ordered and limited at DB with the KTD6 fetch limits; rides filtered to `status = completed`. Previous diagnoses select `created_at, severity, description, free_text_description, part:result_json->>part`, `status = completed`, `neq id currentDiagnosticId`. A scope argument (`full` | `maintenance`) selects which sections run. Readers throw on `error`; `Promise.allSettled`; failures logged with section + ids.
- Test scenarios: renders sections from mocked rows; a section whose query returns `{ error }` is omitted and logged while others render; maintenance scope reads only maintenance_tasks; no data returns undefined.
- Verification: spec passes.

### U3. Wire into resolver and prompt

- Goal: replace the 2b maintenance block with the builder; rename AI context field.
- Requirements: R1, R6, R8, R9.
- Files: `apps/api/src/modules/diagnostics/diagnostics.resolver.ts`, `apps/api/src/modules/diagnostics/diagnostics.resolver.spec.ts` (new), `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts`, `apps/api/src/modules/diagnostics/diagnostic-ai.service.spec.ts`.
- Approach: resolver swaps `MaintenanceTasksService` for `DiagnosticContextBuilder`; resolves scope per KTD5 and calls `build` only for a garage bike with a scope, passing the motorcycle row extras, measurement system, symptom inputs and the new diagnostic id. `AnalyzeContext.maintenanceHistory` becomes `bikeContext`; system prompt section explains how to use it (recent part replacements, overdue service, long storage, earlier assessments as unconfirmed) and to treat it as data.
- Test scenarios: system prompt contains `<bike_context>` and the usage instruction when provided, and omits it when absent; resolver does not call the builder with both flags off or for a manual bike; legacy flag alone requests maintenance scope; new flag requests full scope.
- Verification: specs pass; typecheck.

### U4. New consent flag and honest toggle copy

- Goal: add `includeBikeHistory`, send it from mobile, and describe what is shared.
- Requirements: R6, R6a, R7.
- Files: `packages/types/src/validators/diagnostic.ts`, `apps/api/src/modules/diagnostics/dto/submit-diagnostic.input.ts`, `apps/api/schema.graphql` and `packages/graphql/src/generated` (generated), `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`, `apps/mobile/src/i18n/locales/*.json` (`diagnoseV2.includeMaintenanceLabel`, `includeMaintenanceHint`).
- Approach: optional boolean in Zod and nullable GraphQL field; mobile sends `includeBikeHistory: state.includeMaintenanceHistory` alongside the existing flag; run `pnpm generate`; update label/hint in all 13 locale files, keys unchanged.
- Verification: generate is clean; types validator test covers the new optional flag; mobile typecheck passes.

## Verification Contract

- `pnpm --filter @motovault/api exec vitest run src/modules/diagnostics`
- `pnpm --filter @motovault/api typecheck`, `pnpm --filter @motovault/api test`
- `pnpm --filter @motovault/types test` (validator default)
- Biome on changed files; `pnpm generate` leaves no drift.
- Owner manual check (listed in the PR, not run by the agent: no prod/OpenAI calls from this run): on a dev/test account, run the motivating case (charging symptom, recent regulator/battery parts expense, earlier stator assessment, months without rides) with the toggle on and off, and confirm the on-run answer cites the context.

## Definition of Done

- U1–U4 implemented with passing specs; no dead code from abandoned attempts; resolver logs unchanged in shape (ids/flags); no migration; PR open against `main`, not merged.
