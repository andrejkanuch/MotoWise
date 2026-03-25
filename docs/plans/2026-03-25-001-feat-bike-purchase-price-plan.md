---
title: "feat: Add purchase price field to motorcycles"
type: feat
status: completed
date: 2026-03-25
---

# feat: Add Purchase Price Field to Motorcycles

## Overview

Add a `purchase_price` field to motorcycles so users can record how much they paid for their bike. This value displays in the bike detail screen and can be edited in the edit-bike screen. The existing `purchase_date` column in the DB is already present but unexposed — expose it alongside the new price field.

## Problem Statement / Motivation

Users have no way to record what they paid for their motorcycle. This is useful for tracking total cost of ownership (purchase + expenses), resale value comparison, and personal records. The user indicated they'd log purchase price as a "parts" expense as a workaround — a dedicated field is cleaner.

## Proposed Solution

Add `purchase_price DECIMAL(10,2)` column to the `motorcycles` table. Expose both `purchasePrice` and the existing (but hidden) `purchaseDate` through the full type pipeline. Add input fields to the edit-bike screen and display in the bike detail screen.

## Technical Approach

### Phase 1: Database + Types

#### 1.1 Migration

Create `supabase/migrations/00052_add_purchase_price.sql`:

```sql
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2)
  CHECK (purchase_price IS NULL OR (purchase_price >= 0 AND purchase_price <= 999999.99));

COMMENT ON COLUMN public.motorcycles.purchase_price IS 'Price paid for the motorcycle (user-entered, in user currency)';
```

Note: `purchase_date DATE` already exists in the table (migration 00005) but is completely unexposed.

#### 1.2 Regenerate types

```bash
npx supabase db push
pnpm db:types  # or supabase gen types --linked
```

#### 1.3 Update Zod schemas

File: `packages/types/src/validators/motorcycle.ts`

Add to `UpdateMotorcycleSchema`:
```typescript
purchasePrice: z.number().min(0).max(999999.99).nullable().optional(),
purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
```

### Phase 2: API Layer

#### 2.1 NestJS Motorcycle model

File: `apps/api/src/modules/motorcycles/models/motorcycle.model.ts`

```typescript
@Field(() => Float, { nullable: true })
purchasePrice?: number;

@Field({ nullable: true })
purchaseDate?: string;
```

#### 2.2 UpdateMotorcycleInput DTO

File: `apps/api/src/modules/motorcycles/dto/update-motorcycle.input.ts`

```typescript
@Field(() => Float, { nullable: true })
purchasePrice?: number;

@Field({ nullable: true })
purchaseDate?: string;
```

#### 2.3 Motorcycle service

File: `apps/api/src/modules/motorcycles/motorcycles.service.ts`

- `mapRow()`: add `purchasePrice: row.purchase_price ? Number(row.purchase_price) : undefined` and `purchaseDate: row.purchase_date ?? undefined`
- `update()`: add `if (input.purchasePrice !== undefined) payload.purchase_price = input.purchasePrice` and same for `purchaseDate`
- `findByUser` select: add `purchase_price, purchase_date` to the column list
- `mapRow` Pick type: add `'purchase_price' | 'purchase_date'`

#### 2.4 GraphQL operations + regenerate

File: `apps/mobile/src/graphql/queries/my-motorcycles.graphql` — add `purchasePrice` and `purchaseDate`
File: `apps/mobile/src/graphql/mutations/update-motorcycle.graphql` — add to input and response

```bash
pnpm generate
```

### Phase 3: Mobile UI

#### 3.1 Edit bike screen — add purchase price input

File: `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx`

Add a new "Purchase Info" section between "Odometer" and "Settings" sections:
- Purchase Price: currency-aware input (use `getCurrencySymbol()` + `formatCurrencyInput()` from `expense-constants.ts`)
- Purchase Date: optional date picker (same `DateTimePicker` pattern as add-expense)

On save, include `purchasePrice` and `purchaseDate` in the `updateMotorcycle` mutation input.

#### 3.2 Bike detail screen — display purchase price

File: `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`

Add `InfoRow` entries in the collapsible "Details" section:
- "Purchase Price": formatted with `formatCurrency(purchasePrice, currency)` using the `useCurrency` hook
- "Purchase Date": formatted with `toLocaleDateString()`

Only show these rows if the values are set (not null).

## Acceptance Criteria

- [ ] New `purchase_price DECIMAL(10,2)` column on `motorcycles` table with CHECK constraint
- [ ] Existing `purchase_date` column exposed through API (was hidden)
- [ ] Both fields in Zod `UpdateMotorcycleSchema`
- [ ] Both fields in NestJS model, DTO, service mapRow/update
- [ ] GraphQL operations updated + types regenerated
- [ ] Edit bike screen has "Purchase Info" section with price input + optional date
- [ ] Bike detail screen shows purchase price (formatted with user's currency) and date when set
- [ ] Purchase price input uses `getCurrencySymbol()` and `formatCurrencyInput()` for currency awareness
- [ ] Full pipeline passes: `pnpm generate && pnpm lint && pnpm build`

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| `purchase_price` stored without currency context | Display uses user's currency preference (same as expenses). Per-record currency not needed for a single static value |
| `purchase_date` column exists but was never used | Safe to expose — no data inconsistency risk since all values are NULL |
| Edit bike form getting long | Group purchase fields in a collapsible "Purchase Info" section |

## Sources & References

### Internal References

- Motorcycles table: `supabase/migrations/00005_enrich_motorcycles_users_articles.sql` (purchase_date at line 18)
- Motorcycle model: `apps/api/src/modules/motorcycles/models/motorcycle.model.ts`
- Motorcycle service: `apps/api/src/modules/motorcycles/motorcycles.service.ts`
- Update DTO: `apps/api/src/modules/motorcycles/dto/update-motorcycle.input.ts`
- Zod schemas: `packages/types/src/validators/motorcycle.ts`
- Edit bike: `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx`
- Bike detail: `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`
- Currency formatting: `apps/mobile/src/lib/expense-constants.ts` (formatCurrency, getCurrencySymbol, formatCurrencyInput)

### Institutional Learnings

- `docs/solutions/architecture/currency-preference-full-stack-implementation.md` — full-stack field addition pattern, Zod validation is critical
- `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — explicit column lists, .limit() on queries
