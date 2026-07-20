# Feature: Receipt-Scan Structure Redesign — Deep Maintenance History

## Context

- **Problem/goal:** A scanned multi-line service invoice collapses into one opaque maintenance record: line items are discarded, `completed_mileage` is null, VAT is silently hidden in a misc `cost` bucket, the auto-expense is mis-dated, and the Maintenance-vs-Expense distinction is invisible to the rider. Redesign so a scanned invoice produces a **well-structured, per-service-type maintenance history** with an honest money model.
- **Design doc:** `docs/plans/receipt-scan-structure-redesign-2026-07-20.md` (findings) — this plan supersedes it.
- **Ground truth:** verified in prod (`tpsoneenbrmdwvzcbifw`) against a real Honda Africa Twin service invoice (8 lines, €241.46, 37,505 km, base €199.55 + 21% IVA €41.91).

### Integration points found (real files)
- API service (orchestration + save saga): `apps/api/src/modules/receipt-scan/receipt-scan.service.ts` (`writeMaintenanceRecord`, `buildResult`, `maybeApplyOdometer`)
- API constants: `apps/api/src/modules/receipt-scan/receipt-scan.constants.ts`
- Extraction AI + prompt: `apps/api/src/modules/receipt-scan/receipt-scan-ai.service.ts`, `prompts/receipt-extraction.prompt.ts`
- Maintenance service (already supports `completedMileage`/`partsNeeded`): `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` (`create`, `createAutoExpenseIfNeeded`, `createNextRecurrence`, `mapRow`)
- Auto-expense (date/category bug): `apps/api/src/modules/expenses/expenses.service.ts` (`createFromTask`)
- Task model / DTOs: `apps/api/src/modules/maintenance-tasks/models/maintenance-task.model.ts`, `.../dto/`
- Canonical enums (single source of truth): `packages/types/src/constants/enums.ts` + Gql mirror `apps/api/src/common/enums/graphql-enums.ts` (with `_*Sync` compile-time guards — the pattern that caught the recent drift)
- Zod schemas: `packages/types/src/validators/receipt-scan.ts` (`ReceiptExtractionSchema`, `SaveReceiptScanInputSchema`), `RECEIPT_SCAN_SCHEMA_VERSION`
- OEM catalog (taxonomy source): table `oem_maintenance_schedules` (1,028 rows, 45 free-text `task_name`s, heavy synonymy; top 10 ≈ 90%), module `apps/api/src/modules/oem-schedules/`
- Review UI + flow (overflow, toggle, line editing): `apps/mobile/src/features/receipt-scan/review-card.tsx`, `receipt-scan-flow.tsx`, `scan-flow-constants.ts`
- Mobile GraphQL ops: `apps/mobile/src/graphql/{mutations,queries}/*.graphql`; generated types `@motovault/graphql`
- DataLoader precedent (N+1-safe resolve fields): `apps/api/src/modules/maintenance-tasks/task-photos.loader.ts`

### Out of scope (deferred)
- **No backfill** of the one existing mis-saved record — fix-forward only.
- **No fuzzy auto-matching** of scanned lines to existing pending OEM tasks (owner rejected).
- Per-type reminder *projection*/advancement is a final optional phase (P7), gated behind the canonical taxonomy; it never auto-closes future-due occurrences and stays user-confirmed.
- Enum fix for `MaintenanceTaskSource` is already on `main` (commit `08d117b9`); P0 is deploy+verify only.

### Cross-cutting conventions
`as const` enums only (no TS `enum`); both Zod + inferred type exported; types flow packages→apps; snake_case→camelCase mapped at the service layer; every new table gets RLS; run `pnpm generate` after schema/resolver/`.graphql` edits; no magic strings; follow CLAUDE.md Update Sequence for DB changes.

---

## Phase 0: Ship & verify the enum fix (no code)

- [ ] Task 0.1: Deploy API to Render and confirm the existing scanned task renders
  - Files: none (deploy of `main` @ `08d117b9`)
  - Acceptance:
    - `MANUAL` Render deploy of the api service succeeds on the commit containing the `MaintenanceTaskSource` enum fix.
    - `DEVICE` On the Africa Twin bike detail, the completed "Revisión mantenimiento…" task appears in maintenance history (no 500); Sentry `MOTO-VAULT-REACT-NATIVE-1J` stops recurring.

## Phase 0 Checkpoint
- `MANUAL` Confirm the "maintenance not visible" symptom is resolved by the deploy alone (baseline before structural work).

---

## Phase 1: Canonical `service_type` taxonomy (foundation)

- [ ] Task 1.1: Define `MaintenanceServiceType` as the app's canonical service taxonomy
  - Files: `packages/types/src/constants/enums.ts` (new `as const` + type), `packages/types/src/constants/index.ts` (export)
  - Details: ~16 members covering the OEM top ~90% — `OIL_CHANGE, OIL_FILTER, BRAKE_FLUID, TRANSMISSION_OIL, COOLANT, VALVE_CLEARANCE, AIR_FILTER, SPARK_PLUG, FORK_OIL, CHAIN, TIRE, BRAKE_PADS, FINAL_DRIVE, BELT, BATTERY, GENERAL_SERVICE, OTHER`.
  - Acceptance:
    - `TYPE` `MaintenanceServiceType` value type exported alongside the `as const` object.
    - `GATE` `pnpm precheck` green.

- [ ] Task 1.2: Mirror into GraphQL enum with a compile-time sync guard
  - Files: `apps/api/src/common/enums/graphql-enums.ts` (add `GqlMaintenanceServiceType` + `registerEnumType` + `_serviceTypeSync: Record<MaintenanceServiceType, GqlMaintenanceServiceType>`)
  - Acceptance:
    - `TYPE` Removing/adding a member on either side fails typecheck (guard proven by the `Record` mapping).
    - `GATE` `pnpm precheck` green; `apps/api/schema.graphql` regenerated with the enum after `pnpm generate:schema`.

- [ ] Task 1.3: Free-text → `service_type` classifier helper (deterministic, shared)
  - Files: new `packages/types/src/…/service-type-classify.ts` (pure fn: normalized string → `MaintenanceServiceType`, synonym table derived from the OEM name distribution; unknown → `OTHER`) + unit test
  - Acceptance:
    - `TEST` The 10 OEM top names + the invoice's Spanish lines ("filtro de aceite", "ultra dot 4 brake fluid", "aceite motor 10w-30", "cambio DCT") classify to the expected types; unknown → `OTHER`.
    - `TYPE` Return type is `MaintenanceServiceType`.

## Phase 1 Checkpoint
- `GATE` `pnpm precheck` passes.
- `MANUAL` Taxonomy reviewed as the single source of truth (no parallel string sets introduced).

---

## Phase 2: Tax-wrapper data model + line-item table (migration)

- [ ] Task 2.1: Migration — task financial wrapper columns
  - Files: `supabase/migrations/00169_maintenance_financial_wrapper.sql`
  - Details: add to `maintenance_tasks`: `total_amount numeric` (authoritative gross paid), `tax_amount numeric null`, `tax_rate numeric null`. Keep `cost`/`parts_cost`/`labor_cost` (parts/labor = net). Backfill `total_amount = coalesce(cost,0)+coalesce(parts_cost,0)+coalesce(labor_cost,0)` for existing completed rows so reads stay consistent (data migration only — not a receipt-scan record edit).
  - Acceptance:
    - `TYPE` `pnpm generate:types` updates `database.types.ts` with the new columns.
    - `GATE` `pnpm precheck` green; migration reconciled per CLAUDE.md (pick next number above highest live on prod).

- [ ] Task 2.2: Migration — `maintenance_task_line_items` table + RLS
  - Files: same or `00170_maintenance_task_line_items.sql`
  - Details: columns `id, task_id (FK → maintenance_tasks, on delete cascade), user_id, service_type text, label text, part_ref text null, quantity numeric null, unit_price numeric null, line_total numeric null, sort_order int, created_at`. RLS: own-user (`auth.uid() = user_id`) SELECT + owner writes; `service_type` CHECK against the canonical set.
  - Acceptance:
    - `TYPE` `database.types.ts` includes the new table.
    - `GATE` RLS enabled (no table without RLS); `pnpm precheck` green.
    - `TEST` (api) RLS smoke: a user cannot read another user's line items.

## Phase 2 Checkpoint
- `GATE` `pnpm precheck` passes; migrations applied to a branch/staging first, then prod per Update Sequence.

---

## Phase 3: API — persist structure + honest money on save

- [ ] Task 3.1: Extend maintenance task create to accept total/tax + line items
  - Files: `apps/api/src/modules/maintenance-tasks/maintenance-tasks.service.ts` (`create` input + insert), `models/maintenance-task.model.ts` (add `totalAmount`, `taxAmount`, `taxRate`, `lineItems` field), `mapRow`
  - Acceptance:
    - `TEST` Creating a completed task with `totalAmount`, `taxAmount`, and N line items persists all of them and maps snake→camel.
    - `TYPE` Model exposes the new fields; `lineItems` typed to the line-item model.

- [ ] Task 3.2: Auto-expense mirrors the wrapper total, correct date + category
  - Files: `apps/api/src/modules/expenses/expenses.service.ts` (`createFromTask` — add `date` param = `completedAt`; use a valid in-set expense category, not `'maintenance'`)
  - Acceptance:
    - `TEST` Auto-expense `date` equals the task `completed_at` (not today) and `category` is a member of `EXPENSE_CATEGORIES`.
    - `TEST` Amount equals the task `total_amount` (single source of money truth).

- [ ] Task 3.3: Rewrite `writeMaintenanceRecord` to the wrapper model
  - Files: `apps/api/src/modules/receipt-scan/receipt-scan.service.ts`, `receipt-scan.constants.ts`
  - Details: pass `completedMileage` (converted odometer) + line items + `totalAmount` (= receipt total) + `taxAmount` (explicit; **remove** the `cost = total − parts − labor` VAT hack) + `partsCost`/`laborCost` net. Relax the invariant: if `parts+labor+tax` doesn't reconcile to total, **fall back to total-only** (do not throw `SAVE_FAILED`, do not fabricate a bucket). Keep the compensating-saga rollback (line items deleted on rollback with the task).
  - Acceptance:
    - `TEST` Saving the Africa-Twin fixture creates: 1 task (`total_amount 241.46`, `tax_amount 41.91`, parts 110.45, labor 89.10, `completed_mileage 37505`, ≥5 typed line items) + 1 expense (241.46, correct date) and NO misc `cost` VAT.
    - `TEST` A non-reconciling breakdown saves as total-only instead of failing.
    - `TEST` Rollback path removes created line items (no orphans).

- [ ] Task 3.4: Resolve `lineItems` on the task via request-scoped DataLoader
  - Files: new `apps/api/src/modules/maintenance-tasks/task-line-items.loader.ts` (mirror `task-photos.loader.ts`), resolver `@ResolveField`
  - Acceptance:
    - `TEST` Fetching a list of tasks issues one line-item query (no N+1).
    - `TYPE` `MaintenanceTask.lineItems` resolves to `[MaintenanceTaskLineItem]`.

## Phase 3 Checkpoint
- `GATE` `pnpm precheck` passes.
- `TEST` (api) End-to-end save test on the fixture asserts the full wrapper + line-item + expense shape.

---

## Phase 4: Extraction — structured line items, tax, date hardening

- [ ] Task 4.1: Extend `ReceiptExtractionSchema` + prompt
  - Files: `packages/types/src/validators/receipt-scan.ts`, `apps/api/src/modules/receipt-scan/prompts/receipt-extraction.prompt.ts`, bump `RECEIPT_SCAN_SCHEMA_VERSION`
  - Details: add `lineItems: { label, serviceType?, partRef?, quantity?, unitPrice?, lineTotal? }[]`, `taxAmount?`, `taxRate?`. Prompt: itemize + classify to `service_type`; capture tax; keep grand-total/parts/labor rules. `payloadToResult`/`buildResult` carry the new fields; `isValidFieldConfidence` unchanged.
  - Acceptance:
    - `TEST` Parser round-trips a fixture completion with line items + tax; unknown `serviceType` tolerated (server re-classifies via Task 1.3).
    - `TYPE` Schema + inferred type both exported; version bumped.

- [ ] Task 4.2: Date hardening
  - Files: `receipt-scan.service.ts` (`buildResult` needsCheck), prompt
  - Details: always add `date` to `needsCheck` for `type === maintenance`; flag when extracted year differs from current year beyond a threshold (surface amber, never silently accept — the 2022@conf-1.0 case).
  - Acceptance:
    - `TEST` A maintenance extraction always returns `needsCheck` containing `date`; a far-off year is flagged.

## Phase 4 Checkpoint
- `GATE` `pnpm precheck` passes.
- `MANUAL` Re-run the real invoice through the spike/staging; confirm line items + tax + correct year extraction.

---

## Phase 5: Review card UI — line items, tax, toggle clarity, overflow

- [ ] Task 5.1: Fix the overflow (safe-area top inset)
  - Files: `apps/mobile/src/features/receipt-scan/receipt-scan-flow.tsx`
  - Details: replace fixed `paddingTop: 12` with `useSafeAreaInsets().top` (+ margin).
  - Acceptance:
    - `DEVICE` On a notched device, the "Review your receipt" title clears the status bar; ITEM field + Save are fully visible.

- [ ] Task 5.2: Maintenance-vs-Expense in-context explainers
  - Files: `review-card.tsx` (`TypeChips`), `scan-flow-constants.ts`, locale `en.json` (+ ratchet-safe keys)
  - Details: Maintenance = "adds to service history AND expenses"; Expense = "logs a cost only"; default detected service invoices to Maintenance.
  - Acceptance:
    - `DEVICE` Each toggle shows its explainer; a service invoice defaults to Maintenance.
    - `GATE` `pnpm check:i18n` passes (new keys in all locales).

- [ ] Task 5.3: Line-item review + tax display
  - Files: `review-card.tsx` (new line-item list w/ per-line label + service_type + amount, editable/removable), amount breakdown shows parts / labor / tax / total
  - Details: total is the authoritative hero; parts/labor/tax shown only when reconciled, else total-only. Send line items + tax in `ReceiptReviewPayload` → `SaveReceiptScanInput` (update `save-receipt-scan.graphql`, DTO, Zod).
  - Acceptance:
    - `DEVICE` Rider sees the extracted services as editable lines and a total = parts+labor+tax when reconciled.
    - `TEST` Payload carries line items + tax to the mutation; `pnpm generate` types updated.

## Phase 5 Checkpoint
- `GATE` `pnpm precheck` passes (incl. i18n ratchet, router, arch).
- `E2E`/`DEVICE` Maestro `receipt-scan` flow updated: scan fixture → review shows lines + tax → save → confirmation names both effects.

---

## Phase 6: Service-history display of line items

- [ ] Task 6.1: Show line items + mileage + tax on the bike maintenance history
  - Files: bike-detail / maintenance history mobile components + the `maintenanceTasks` / history `.graphql` selections (add `lineItems { serviceType label lineTotal }`, `totalAmount`, `taxAmount`, `completedMileage`)
  - Acceptance:
    - `DEVICE` The Africa-Twin service shows its individual services, done-at mileage (37,505 km) and total; per-type lines are legible.
    - `TEST` Query selections typecheck against generated types.

## Phase 6 Checkpoint
- `GATE` `pnpm precheck` passes.
- `DEVICE` Full loop: scan → save as maintenance → open bike → structured history visible.

---

## Phase 7 (optional/later): OEM normalization + per-type reminder projection

- [ ] Task 7.1: Normalize the OEM catalog to `service_type`
  - Files: migration adding `oem_maintenance_schedules.service_type` + a one-time classify backfill using Task 1.3
  - Acceptance:
    - `TEST` ≥90% of the 1,028 OEM rows map to a non-`OTHER` type; remainder logged.

- [ ] Task 7.2: Per-type "last done" + user-confirmed next reminder
  - Files: maintenance service (derive last completion per `service_type` from history incl. scans), review/post-save "remind me for the next <type>?" (user picks interval; creates a recurring pending task) — **never** auto-closes existing future-due occurrences.
  - Acceptance:
    - `TEST` Given a completed typed service, a user-confirmed reminder creates a recurring pending task of that type with the chosen interval; no existing pending task is mutated without confirmation.
    - `DEVICE` Rider can opt into a next-service reminder from a saved scan.

## Phase 7 Checkpoint
- `GATE` `pnpm precheck` passes.
- `MANUAL` Confirm no fuzzy auto-matching path exists; all schedule advancement is user-confirmed.

---

## Requirements traceability (informal)
- Structure: P1–P3, P5–P6 (line items + typed history).
- Honest money / tax wrapper: P2 (schema), P3 (save + auto-expense).
- Visibility: P0 (deploy), P6 (history display).
- Toggle clarity: P5.2. Overflow: P5.1. Date correctness: P4.2.
- Deep per-type history + reminders: P1 (taxonomy), P7 (projection).

Next: `/phase-start 1 Receipt-scan`.
