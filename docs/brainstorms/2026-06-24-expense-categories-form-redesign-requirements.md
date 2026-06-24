# Expense Categories & Add-Expense Form Redesign — Requirements

> Date: 2026-06-24
> Status: Decision-ready proposal
> Scope: (1) expand/restructure expense categories, (2) add an optional structured "item name" field, (3) make photo-attach work *during* the add flow.

---

## TL;DR / Recommendation

- **Ship the quick win today (Phase 0, ~30 min):** the 5 "missing" categories already exist in the data model — they're just not rendered. Replace the hardcoded `MAIN_CATEGORIES` array in `add-expense.tsx` with the full list (or primary chips + an "All" chip). This alone makes the user-facing reachable set jump from 6 → all categories. No migration, no API, no codegen.
- **Stay FLAT, don't go two-level.** A subcategory column is real schema cost (it forces a redesign of the dashboard aggregate path) for marginal benefit. The depth the user wants comes from a free-text **item name** field, not a taxonomy tree.
- **Expand to a curated flat list of 14 keys** (current 11 → add `accessories`, `taxes_fees`, `other`; relabel `maintenance`→"Service", `modifications`→"Mods"). This directly solves the top-case (→ `accessories`) and ownership-transfer (→ `taxes_fees`) pains. **No renames of existing DB keys** = empty backfill = low risk.
- **Add one new column: `item_name TEXT` (≤120 chars, optional).** This is the highest-leverage change for "I want to be explicit I bought a GPR-Tech Alpi-Tech 55L." It's a *noun* (the product), distinct from `description` (context/notes).
- **Photos: stage locally, upload on save.** The FK requires an `expenseId`, so we keep photos in in-memory form state during entry (thumbnails render immediately from local URI) and upload them in parallel right after the expense is created. Partial failures never roll back the expense.
- **Form: move to `fullScreenModal`, "simple by default, deep on demand."** Amount + category chips + date visible; item name, notes, photos, odometer, service-link all live behind an "Add details" expander.
- **Establish a single source of truth for categories** in `packages/types` (a metadata-carrying `as const`). Today the taxonomy is duplicated in 5 places — drift is guaranteed.
- **Refactor `MonthlyBucket` from 11 hardcoded Float fields to a generic `categories: [CategoryTotal]` array** — but only in the photo/dashboard phase. Verified: those 11 fields are *dead data* (no consumer reads them), so this is a low-risk subtractive change.

---

## Problem

The founder hit three concrete walls logging real expenses:

1. **"Only 6 categories, not enough."** In truth 11 categories exist in the model, but the add-expense form only renders 6 as chips (`MAIN_CATEGORIES`). The other 5 (`registration`, `tolls`, `parking`, `modifications`, `training`) are unreachable in the UI. This is a rendering bug, not a data-model gap.
2. **Bought a top case** ("GPR-Tech Alpi-Tech 55L aluminium") — no category fits, and no way to record the *specific product name*.
3. **Paid a motorbike ownership-transfer fee** — no category fits.
4. **Photo attach only appears after save**, gated behind `savedExpenseId` (the MOT-143 workaround), which is confusing while adding.
5. **Wants the form simple by default**, with optional depth — not a wall of fields.

Constraints: EU + Americas markets only; dark-first mobile design system (copper #D4622E, warm neutrals, Plus Jakarta Sans, `borderCurve:'continuous'`, reanimated v4 <300ms, expo-haptics, palette tokens only); prefer `fullScreenModal` over `formSheet`; no magic strings, no endless if/else, date-fns; types flow packages → apps; run `pnpm generate` after `.graphql`/resolver changes.

---

## Recommended Category Taxonomy (final)

**Flat, 14 keys.** Renames in **bold** (label only — DB key unchanged), new keys in _italic_. Keeping existing keys means an **empty backfill** and the lowest-risk migration.

| key | label | What goes here | Solves |
|---|---|---|---|
| `fuel` | Fuel | Petrol, diesel, EV charging, oil top-up at pump | |
| `maintenance` | **Service** | Scheduled/labour maintenance, dealer shop work | |
| `parts` | Parts | Brake pads, filters, plugs, chain & sprocket, battery, bulbs | |
| `tires` | Tires | Tires + fitting/balancing, puncture repair, valve stems | |
| `gear` | Gear | Helmet, jacket, gloves, boots, comms headset | |
| _`accessories`_ | _Accessories_ | **Top case, panniers, racks, phone mount, USB charger, heated grips, crash bars** | **Pain #2** |
| `modifications` | **Mods** | Performance/cosmetic upgrades (exhaust, ECU flash, suspension) | |
| `insurance` | Insurance | Premium, instalment, breakdown cover, gear/luggage cover | |
| `registration` | Registration | Annual reg / road tax / vignette (EU), plates/tabs (US), inspection/MOT/TÜV | |
| _`taxes_fees`_ | _Taxes & Fees_ | **Ownership transfer, title, DMV/notary, sales/import tax** | **Pain #3** |
| `tolls` | Tolls | Motorway/bridge/tunnel tolls, congestion charge, ferry | |
| `parking` | Parking | City parking, paid garage, winter storage | |
| `training` | Training | Rider courses, track-day instruction | |
| _`other`_ | _Other_ | Escape hatch — rental bike, towing/recovery, club membership | |

### Why this resolves the disagreement between sections

The taxonomy expert proposed folding ownership-transfer into a relabelled `registration` ("Registration & Taxes") and folding `training` into `other`, with `accessories` added — 12 keys, but with **two DB-key renames** (`maintenance`→`service`, `modifications`→`mods`).

The technical analysis showed the renames touch the brittle `MonthlyBucket` columns and force a row backfill for no functional gain, since labels are what users see.

**Decision (adopted):** Take the technical path — **keep all existing DB keys**, relabel `maintenance`→"Service" and `modifications`→"Mods" in the UI only, and **separate** transfer/title into its own `taxes_fees` key rather than overloading `registration`. Rationale:

- A dedicated `taxes_fees` is *more* discoverable than burying transfer fees under "Registration & Taxes," and it cleanly separates one-off ownership/tax events from recurring road-tax/registration. This matters in both EU (Ummeldung/immatriculation transfer vs annual road tax) and US/Canada (title transfer vs annual tabs).
- Keeping `training` as a top-level key (now reachable) costs nothing and avoids re-promotion churn later.
- Zero DB-key renames → empty backfill → the migration cannot put any existing row in violation of the new CHECK.

**Rejected:** two-level category+subcategory (schema cost, second required picker fights "simple by default", marginal analytics value); a `tags TEXT[]` column (defer — not needed this iteration).

### Market naming (EU + Americas)

Single neutral key set; **localise labels per market via i18n**, never fork the taxonomy.

| Concept | EU | US / Canada | Bucket |
|---|---|---|---|
| Annual legal-to-drive fee | Road tax / VED / Kfz-Steuer | Registration renewal, plate sticker | `registration` |
| Periodic safety/emissions test | MOT / TÜV / CT / ITV / STK | State inspection / smog | `registration` |
| Road-use sticker | Vignette (AT/CH/CZ/SK/HU) | Toll transponder | `registration` (the sticker) |
| **Ownership change** | Re-registration / change of keeper | **Title transfer**, DMV title fee | **`taxes_fees`** |
| Per-trip road charge | Motorway toll, congestion charge | E-ZPass toll | `tolls` |

---

## New "Item / Product Name" Field — Decision: **YES, add it**

A structured, optional, single-line field distinct from notes. This is the single highest-leverage change for pain #2.

| Property | Spec |
|---|---|
| DB column | `item_name TEXT NULL`, CHECK `char_length(item_name) <= 120` |
| GraphQL/TS | `itemName?: string` |
| Zod | `z.string().trim().min(1).max(120).optional()` (empty → undefined) |
| Optionality | Optional everywhere — the simple path is never blocked |

Why separate from `description`:
- **Different jobs.** `item_name` = *what you bought* (a noun, the product). `description`/notes = *context* ("fits OEM rack," "service at 12,400 km"). Conflating them is exactly why the single 200-char field feels inadequate.
- **Structured value.** A clean item name powers future per-item search, "all accessories I've bought," warranty/return tracking, resale summaries — none of which free-text notes can support.
- **Category-aware placeholder** via a dispatch table (no if/else): `accessories` → "e.g. GPR-Tech Alpi-Tech 55L top case", `parts` → "e.g. EBC front brake pads", `gear` → "e.g. Shoei NXR2 helmet". For `fuel`/`tolls`/`insurance` the field is de-emphasised (a tank of fuel needs no product name).

Keep `description` as-is (relabel "Notes," 200-char limit).

---

## Add-Expense Form Redesign

### Thesis
Logging an expense should take **under 8 seconds** for the 80% case (fuel, service, a part). Depth lives one tap away. Move from `formSheet` to **`fullScreenModal`** (per team memory: avoids the duplicate-content artifact on dark sheets, and gives progressive disclosure the vertical room it needs).

### Default (simple) state — what loads first

```
┌─────────────────────────────────────────┐
│  ✕                          Log expense   │   ← fullScreenModal header
├─────────────────────────────────────────┤
│                                           │
│            €  __0.00__                     │   ← hero amount, autofocused
│                EUR ⌄                       │
│                                           │
│  Category                                 │
│  ┌────┐┌─────┐┌─────┐┌────┐┌────┐┌────┐ │
│  │Fuel││Servc││Parts││Tire││Gear││ ▦  │ │   ← primary chips + "All"
│  └────┘└─────┘└─────┘└────┘└────┘└All─┘ │
│                                           │
│  Date                                     │
│  ┌────────┐                               │
│  │ Today ⌄│                               │
│  └────────┘                               │
│                                           │
│  ┌───────────────────────────────────┐   │
│  │  + Add details                   ⌄ │   │   ← progressive disclosure
│  └───────────────────────────────────┘   │
│                                           │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐   │
│  │           Save expense            │   │   ← copper, pinned
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- **Amount** is the hero, autofocused, currency-prefixed (user default, tappable to change).
- **Category** is a usage-ranked primary chip row (`PRIMARY_CATEGORIES`, data-driven, not hardcoded) + a trailing **"All" chip** that opens the grouped picker. **The "All" chip is the structural fix for the unreachable-categories bug — every category is always one tap away.**
- **Date** defaults to "Today"; pill reads Today/Yesterday (date-fns `isToday`/`isYesterday`) else `d MMM`.
- Save is gated only on amount + category.

### Progressive disclosure — "Add details"

Tapping "Add details" animates a section in (reanimated v4 `FadeInUp` + `Layout.duration(220)`, <300ms), swaps the chevron, fires a selection haptic. Revealed, in order:

1. **Item / product name** — single-line, category-aware placeholder ("e.g. GPR-Tech Alpi-Tech 55L top case").
2. **Notes** — multiline, 200-char counter (maps to existing `description`).
3. **Receipt photos** — staged gallery (see below).
4. **Odometer** — numeric, shown only for mileage-relevant categories (`fuel`, `maintenance`, `tires`) via a `CATEGORY_SHOWS_ODOMETER` dispatch table.
5. **Link to service** — opens a picker of the bike's maintenance tasks (`maintenance_task_id`).

```
┌─────────────────────────────────────────┐
│            €  __189.00__                  │
│                EUR ⌄                      │
│  Category                                 │
│  ┌────┐┌─────┐┌─────┐┌────┐┌────┐┌────┐ │
│  │Fuel││Servc││Parts││Tire││Gear││ ▦  │ │
│  Date   ┌────────┐                        │
│         │ Today ⌄│                        │
│  ┌───────────────────────────────────┐   │
│  │  – Hide details                  ⌃ │   │
│  └───────────────────────────────────┘   │
│   Item name                               │
│   ┌─────────────────────────────────┐    │
│   │ GPR-Tech Alpi-Tech 55L top case │    │
│   └─────────────────────────────────┘    │
│   Notes                                   │
│   ┌─────────────────────────────────┐    │
│   │ Powder-coated, fits OEM rack    │    │
│   └─────────────────────────────────┘    │
│                              23 / 200     │
│   Receipt                                 │
│   ┌────┐┌────┐┌ + ┐                       │
│   │ 📷 ││ 📷 ││add│                        │
│   └────┘└────┘└───┘                       │
│   Odometer  (hidden: category=parts)      │
│   Link to service        Not linked  ›    │
│  ┌───────────────────────────────────┐   │
│  │           Save expense            │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Category picker — recommended: top chips inline + grouped "All" bottom sheet

Weighed and **rejected**: wrap-all chips (visual noise, kills "simple by default"); searchable sheet (11 items don't warrant search); grouped sheet as the *only* picker (adds a tap to the 80% case). **Chosen:** fast inline path for common categories + a grouped bottom sheet behind "All" for completeness.

The "All" sheet is grouped by rider mental model:

```
   ─── All categories ────────────────── ✕
   RUNNING COSTS
     ⛽  Fuel
     🛣  Tolls
     🅿  Parking
   SERVICE & PARTS
     🔧  Service
     🧩  Parts
     ◎   Tires
     ⚙   Mods
   GEAR & TRAINING
     🧥  Gear
     🎓  Training
   ACCESSORIES
     📦  Accessories     Top case, panniers, mounts
   PAPERWORK
     🛡  Insurance
     📄  Registration    Road tax, plates, inspection
     🏛  Taxes & Fees    Ownership transfer, title, sales tax
   OTHER
     …   Other
```

- Tap "All" → bottom sheet rises (`SlideInUp`, ~240ms) over a dimmed scrim; medium-impact haptic.
- Section headers: muted warm-neutral, uppercase, Geist Mono small.
- Selecting a row promotes that category into the inline chip row (`FadeIn`) and dismisses the sheet (selection haptic).
- When category ∈ {parts, gear, tires, mods, accessories}, auto-expand "Add details" and focus the item-name field (`CATEGORY_PROMPTS_ITEM_NAME` dispatch table) — for physical goods the rider almost always wants to name the thing.

---

## Photo-During-Add Solution

**Constraint:** `expense_photos` rows need an `expenseId` FK; files live at `{userId}/expenses/{expenseId}/{ts}.webp`. So we cannot upload during typing.

**Solution: stage locally, upload on save.**

- Picking/shooting a photo (existing `pickImage`/`takePhoto`) appends `{ localUri }` to in-memory form state (`stagedUris`, capped at 3 = FK limit). Thumbnails render immediately from the local URI — no network yet.
- The Receipt section renders **always** (remove the `savedExpenseId &&` gate). Empty state: a dashed "+ Add receipt" tile with helper *"Photos save when you save the expense."*
- On **Save**: `logExpense` → get `expenseId` → fire `uploadExpensePhoto` + `addExpensePhoto` for each staged photo **in parallel** (`Promise.allSettled`), transitioning each tile staged → uploading (copper progress ring) → done/error.

```
EMPTY                         STAGED (2) + room for 1
┌───────────────┐             ┌────┐┌────┐┌ + ┐
│  ┌─────────┐  │             │📷 ×││📷 ×││add│
│  │  📷  +  │  │             └────┘└────┘└───┘
│  │Add recpt│  │
│  └─────────┘  │             UPLOADING        ERROR
│ saves on save │             ┌────┐           ┌────┐
└───────────────┘             │◔ 📷│           │⚠ ↻ │  "Tap to retry"
                              └────┘           └────┘
```

**Partial-success policy:** the expense is the primary record — **never roll it back** on a photo failure. Surface a non-blocking toast (*"Expense saved. 1 photo didn't upload — tap to retry."*) and hand failed tiles to the post-save `ExpensePhotoGallery` (server-backed, already supports delete + retry). This kills the old MOT-143 "keep the screen open" workaround — on full success we dismiss and toast *"Expense saved."*

---

## Technical Plan

### Verified findings that shape the plan

1. **The RPC is NOT brittle.** `expense_dashboard_aggregates` (migration `00147:37-49`) already aggregates generically via `jsonb_object_agg(category, cat_total)` and returns an open `{category: total}` map. **Adding a category needs zero SQL changes.**
2. **The 11 per-category `MonthlyBucket` Float fields are dead data.** The web consumer (`garage-dashboard.tsx:867-879`) reads only `bucket.total` + the separate `categoryTotals[]`. Grep found no mobile/web reader of `bucket.fuel`/`bucket.maintenance`/etc. Refactoring `MonthlyBucket` to a generic array is therefore low-risk and subtractive.
3. **The category quick-win is a ~6-line change.** `add-expense.tsx` already builds `CATEGORY_META` for all 11; the bug is the single `MAIN_CATEGORIES` array used at the render site.

### Single source of truth

Today the taxonomy is duplicated in 5 places (`packages/types` Zod, mobile `expense-constants.ts`, `add-expense.tsx`'s own array, the DB CHECK, `scripts/seed-expenses.ts`). Create one metadata-carrying `as const` in `packages/types/src/constants/expense-categories.ts` exporting `EXPENSE_CATEGORY_META` (label, `colorToken` *string key* — not an imported palette value, since packages must not depend on design-system runtime — `icon` string, `primary` boolean), with `EXPENSE_CATEGORIES` and `ExpenseCategory` derived from it. Mobile `expense-constants.ts` becomes a thin layer that resolves `colorToken`→`palette` and labels→`t()`. The DB CHECK is the only unavoidable duplication (SQL can't import TS) — guard it with a CI parity test.

### Migration (`00150_expense_categories_v2_and_item_name.sql`)

```sql
BEGIN;
-- No backfill needed: no existing keys are renamed/removed.
ALTER TABLE public.expenses DROP CONSTRAINT chk_expenses_category;
ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_category
  CHECK (category IN (
    'fuel','maintenance','parts','tires','gear','accessories','modifications',
    'insurance','registration','taxes_fees','tolls','parking','training','other'
  ));
ALTER TABLE public.expenses
  ADD COLUMN item_name text
  CONSTRAINT chk_expenses_item_name_len
  CHECK (item_name IS NULL OR char_length(item_name) <= 120);
COMMIT;
NOTIFY pgrst, 'reload schema';
```

Keep CHECK (not a Postgres enum): the API is already category-agnostic, and CHECK makes future renames easier. Follow the CLAUDE.md sequence: migration → `npx supabase db push` → `pnpm generate:types` → Zod → NestJS → `pnpm generate`.

### File-by-file change list

| # | File | Change | Phase |
|---|---|---|---|
| QW | `apps/mobile/.../add-expense.tsx:49,256` | render all categories (primary chips + "All") instead of `MAIN_CATEGORIES` | **0** |
| 1 | `supabase/migrations/00150_*.sql` | new migration (above); `db push` | 1 |
| 2 | `packages/types/src/database.types.ts` | regenerated via `pnpm generate:types` (`item_name`) | 1 |
| 3 | `packages/types/src/constants/expense-categories.ts` | **new** single source + meta map | 1 |
| 4 | `packages/types/src/validators/expense.ts` | import `EXPENSE_CATEGORIES` from #3; add `itemName` to Log/Update schemas | 1 |
| 5 | `packages/types/src/index.ts` | export new constants | 1 |
| 6 | `apps/api/.../dto/log-expense.input.ts` | add `@Field({nullable:true}) itemName?: string` | 1 |
| 7 | `apps/api/.../models/expense.model.ts` | add `itemName` field | 1 |
| 8 | `apps/api/.../models/expense-dashboard.model.ts` | replace 11 Floats on `MonthlyBucket` with `categories: [CategoryTotal]` | 3 |
| 9 | `apps/api/.../expenses.service.ts:279-294` | simplify `mapMonthlyBucket`; map `item_name`↔`itemName` | 1/3 |
| 10 | — | `pnpm generate` (after #6–#9) | 1/3 |
| 11 | `apps/mobile/.../expense-dashboard.graphql` | swap 11 fields for `categories { category total }`; `pnpm generate` | 3 |
| 12 | `apps/web/.../expense-dashboard.graphql` | same; `pnpm generate` | 3 |
| 13 | `apps/mobile/src/lib/expense-constants.ts` | derive colors/labels/`PRIMARY_CATEGORIES` from meta; export `MAX_EXPENSE_PHOTOS` | 1 |
| 14 | `apps/mobile/.../add-expense.tsx` | itemName input (P1); staged photos + save flow + ungate receipts (P2) | 1/2 |
| 15 | `apps/mobile/src/components/expense-photo-gallery.tsx` | accept retry/staged props; promote `MAX_PHOTOS`→shared const | 2 |
| 16 | `apps/mobile/.../add-ride-expense.tsx` | align categories to `PRIMARY_CATEGORIES` | 1 |
| 17 | `apps/web/.../garage-dashboard.tsx:867-879` | verify (no logic change); add labels for new categories | 3 |
| 18 | `scripts/seed-expenses.ts` | import `EXPENSE_CATEGORIES` instead of hand-typed union | 1 |
| 19 | i18n | add `category_accessories`, `category_taxes_fees`, `category_other`, `itemName*`, photo/partial-success keys to ALL locales (pre-push i18n ratchet blocks en-only keys) | 1/2 |
| 20 | tests | update `expenses.service.spec`/`resolver.spec` for `categories[]` + `itemName`; add `expense-categories.spec` CHECK↔TS parity guard | 1/3 |

**MonthlyBucket field-removal caveat:** removing GraphQL fields is breaking for any stale build still selecting them. Keep `total` + add `categories` and drop the 11 in the **same release** the mobile/web queries stop selecting them.

---

## Phasing

**Phase 0 — Quick win (~30 min, ship today).** Surface all existing categories in `add-expense.tsx` (delete `MAIN_CATEGORIES`, render primary chips + "All"). No migration, no API, no codegen. Resolves the bulk of pain #1 immediately.

**Phase 1 — New categories + item name + single source of truth (~1 day).** Migration (`accessories`, `taxes_fees`, `other` + `item_name`) → push → `generate:types` → new `expense-categories.ts` → Zod/DTO/model/service `itemName` plumbing → mobile item-name input → seed + ride-expense alignment → i18n → `pnpm generate` → tests. Resolves pains #2, #3 and completes #1.

**Phase 2 — Photo-during-add (~1 day).** Staged-photo save flow with `Promise.allSettled` partial-success; ungate the receipts section. Resolves pain #4.

**Phase 3 — Form redesign + MonthlyBucket refactor (~1–1.5 days).** Full `fullScreenModal` "simple by default" rebuild with progressive disclosure and grouped "All" sheet; bundle the `MonthlyBucket`→generic-array refactor here (same dashboard codegen pass, removes dead fields, coordinate field removal in one release). Resolves pain #5.

Phases 1 and 2 are independent and can be parallelised once the `expense-categories.ts` source-of-truth file exists.

---

## Open Questions for the Founder

1. **`taxes_fees` vs folding into `registration`:** this proposal keeps them separate (clearer for one-off transfer/title events). Agree, or prefer one combined "Registration & Taxes"?
2. **`training` and `other`:** keep both as top-level categories? `training` is low-frequency; `other` risks becoming a dumping ground. Acceptable trade-off?
3. **Primary chip set:** default to `['fuel','maintenance','parts','tires','gear']` (PostHog-ranked)? Or include `accessories` in the primary row given it's a new headline category?
4. **Odometer field:** is capturing odometer on fuel/service/tire expenses in scope now, or defer? (It's a small add but not in the original pain list.)
5. **MonthlyBucket refactor timing:** comfortable shipping the GraphQL field removal coordinated with a mobile build/OTA bump, or keep the dead fields one extra release to be safe?
6. **Localised category labels:** roll EU/US label variants into this work, or ship neutral English labels first and localise in a follow-up i18n pass?
