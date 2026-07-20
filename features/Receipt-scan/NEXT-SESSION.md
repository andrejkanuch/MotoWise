# Receipt-Scan Structure Redesign — Next-Session Prompt

Continue the receipt-scan → maintenance structure redesign. Everything goes into the
existing PR (no follow-up split).

## Where things are
- Branch: `feat/receipt-scan-structure` (check it out; base `main`). PR **#173**.
- Plan: `features/Receipt-scan/EXECUTION_PLAN.md` (phases + acceptance criteria).
- Findings/design: `docs/plans/receipt-scan-structure-redesign-2026-07-20.md`.
- Prod Supabase project id: `tpsoneenbrmdwvzcbifw` (user kanuchandrej@gmail.com,
  Africa Twin bike `29a0e837-f452-4724-a07c-2d6f7efd0410`).

## Done (committed + pushed on the branch)
- **P0** GraphQL `MaintenanceTaskSource` enum fix — live on prod.
- **P1** canonical `MaintenanceServiceType` (17 types) in `@motovault/types` +
  `GqlMaintenanceServiceType` mirror + `_serviceTypeSync` compile-time guard +
  `classifyServiceType` (accent-insensitive EN/ES dispatch-table classifier).
- **P2** migrations **already applied to prod** (`00169` maintenance_tasks
  `total_amount`/`tax_amount`/`tax_rate`; `00170` `maintenance_task_line_items`
  table + own-user RLS + `service_type` CHECK). Reconciled to 00169/00170.
- **P3** API save path: `writeMaintenanceRecord` → total-owning wrapper
  (`total_amount` authoritative, explicit `tax_amount`, parts/labor NET,
  reconcile-or-total-only never throws), `completed_mileage` from the receipt
  odometer, line items with server-classified `service_type`; `createFromTask`
  now dated on `completedAt`; `TaskLineItemsLoader` + `lineItems` ResolveField.
- Code-review fixes: `getSpendingSummary` now sums `effectiveTaskTotal`
  (`total_amount ?? cost+parts+labor`); TS↔SQL CHECK drift-guard spec;
  `softDelete` purges line items; classifier keyword tightening; ParseUUIDPipe
  consistency. Mobile maintenance queries already select
  `totalAmount/taxAmount/taxRate/lineItems`.

## Remaining work (do all of it, into PR #173)

### P4 — Extraction: structured line items + tax + date hardening
- Add `lineItems: { label, serviceType?, partRef?, quantity?, unitPrice?, lineTotal? }[]`,
  `taxAmount?`, `taxRate?` to `ReceiptExtractionSchema`
  (`packages/types/src/validators/receipt-scan.ts`); bump `RECEIPT_SCAN_SCHEMA_VERSION`.
- Update the prompt (`apps/api/src/modules/receipt-scan/prompts/receipt-extraction.prompt.ts`)
  to itemize + classify `service_type` and capture tax. Carry the new fields
  through `buildResult`/`payloadToResult` in `receipt-scan.service.ts`.
- Date hardening: always add `date` to `needsCheck` for `type === 'maintenance'`,
  and flag when the extracted year is far from the current year (the real invoice
  was mis-read as 2022 vs 2026 at confidence 1.0).

### P5 — Review-card UI (mobile)
- **Overflow fix** (`apps/mobile/src/features/receipt-scan/receipt-scan-flow.tsx`):
  the root uses a fixed `paddingTop: 12` with no top safe-area inset → the
  "Review your receipt" title collides with the status bar. Use
  `useSafeAreaInsets().top`.
- Maintenance-vs-Expense **in-context explainers** in `review-card.tsx` `TypeChips`:
  Maintenance = "adds to service history AND expenses"; Expense = "logs a cost
  only". Default a detected service invoice to Maintenance. i18n across locales.
- Line-item review: editable list (label + service_type + amount), tax display;
  total hero authoritative; parts/labor/tax shown only when reconciled. Send
  `lineItems` + `taxAmount`/`taxRate` in `ReceiptReviewPayload` → the
  `SaveReceiptScanInput` mutation (API side already accepts them). Run `pnpm generate`.

### P6 — Bike service-history display (the owner's original ask)
- Show the completed scan task's line items + `completed_mileage` + total in bike
  detail / maintenance history (`apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`,
  `components/bike-hub/*`). Render money as `totalAmount ?? cost+partsCost+laborCost`.
  Query fields are already selected.

### P7 — OEM normalization + user-confirmed reminders (optional/last)
- Migration: add `oem_maintenance_schedules.service_type` + one-time classify
  backfill via `classifyServiceType` (1,028 rows / 45 free-text names, ~90%
  should map non-OTHER).
- Per-type "last done" from history (incl. scans); offer a **user-confirmed**
  "remind me for the next <type>?" that creates a recurring task. NEVER fuzzy
  auto-match or auto-close existing pending OEM tasks.

### Architecture refactor (maintenance-tasks module — owner requested, into this PR)
Per the pasted review. No behavior change unless flagged:
- Split `maintenance-tasks.service.ts` (~850 LOC) into `services/`
  (crud+find+mapRow, photos, line-items, recurrence, spending) + `loaders/`.
- Move `completeMaintenanceTask`'s next-occurrence orchestration out of the
  resolver into a service method (thin resolver).
- Typed internal create input (`CreateMaintenanceTaskInternal = CreateMaintenanceTask
  & { source?; totalAmount?; taxAmount?; taxRate?; completedMileage?; ... }`) so
  receipt-scan-only fields don't widen the public GQL create input.
- Prefer `unwrap()` (`apps/api/src/common/supabase/unwrap.ts`) over manual
  `{data,error}`; explicit column selects + typed rows over `select('*')`.
- Stop seeding `photos: []`/`lineItems: []` in `mapRow` (or drop the dead
  `length > 0` short-circuit in the ResolveFields) — match `expenses`.
- Move loaders under `loaders/`.
- Consider Relay/cursor pagination on list queries (or document as deferred if it
  would change mobile query contracts — don't silently break them).
- Reference modules: `apps/api/src/modules/expenses/` and `apps/api/src/modules/trips/`.

## Locked decisions (do not re-litigate)
- Line items = real child table (Option B). Deep per-type history is the goal.
- Tax = total-owning wrapper (task holds authoritative gross + optional explicit
  tax; reconcile-or-total-only; never fabricate a bucket; never block save).
- NO fuzzy OEM auto-match; reminders are user-confirmed only.
- NO backfill of the one existing mis-saved prod record — fix-forward only.
- `'maintenance'` IS the canonical expense-category key (label "Service") — correct,
  not a bug.

## Conventions / gotchas
- `pnpm precheck` must stay green. Pre-commit runs GraphQL codegen — after any
  `.graphql`/resolver/schema change run `pnpm generate` and stage
  `packages/graphql/src/generated/{graphql.ts,gql.ts}`.
- `database.types.ts` regen works via `npx supabase gen types typescript --linked
  --schema public,graphql_public` from `packages/types` (bare `supabase` not on PATH).
- New migrations: next number above the highest live on prod; after `apply_migration`
  reconcile the timestamp version → `00NNN` via UPDATE on
  `supabase_migrations.schema_migrations`.
- `as const` not TS enum; types flow packages→apps; snake_case→camelCase at service
  layer; no magic strings; Biome only.
- Deploy constraint: don't ship the API money-wrapper change to prod without the
  mobile readers using `totalAmount` (low risk today — per-task cost isn't rendered
  yet, money surfaces via the auto-expense — but P5/P6 must land in the same release).
