---
title: "fix: Onboarding currency validation crash (MOTO-VAULT-REACT-NATIVE-H)"
type: fix
status: completed
date: 2026-05-17
---

# fix: Onboarding currency validation crash

## Enhancement Summary

**Deepened on:** 2026-05-17
**Research agents used:** 6 (currency learning, measurement system pattern, DB migration safety, zero-decimal currencies, RPC signature, security review)

### Key Improvements from Research
1. Use `CREATE OR REPLACE FUNCTION` instead of DROP+CREATE — signature is unchanged, avoids overload risk
2. Found 4 additional files with hardcoded `currency === 'JPY'` checks that need `ZERO_DECIMAL_CURRENCIES` Set
3. Security finding: `CompleteMaintenanceTaskSchema` uses `z.string().length(3)` instead of enum — a validation bypass
4. Hidden sync point: `auto_create_fuel_expense` trigger (migration 00081) depends on `chk_expenses_currency` expansion
5. `UpdateUserSchema` auto-derives currency enum from `Object.values(Currency)` — no manual update needed

---

## Overview

`completeOnboarding` mutation returns BAD_REQUEST when `detectCurrency()` returns a currency code not in the 15-value Currency enum. **522 occurrences, 12 users blocked from completing onboarding.** Sentry issue: `MOTO-VAULT-REACT-NATIVE-H` (regressed, first seen 2026-04-26).

## Root Cause

`detectCurrency()` in `apps/mobile/src/lib/locale-detection.ts:13` blindly casts `getLocales()[0]?.currencyCode` to `Currency` without validating against the supported set. For Serbian locale, `currencyCode` returns `"RSD"` which fails Zod validation at `CompleteOnboardingInputSchema.currency`.

## Proposed Solution

### 1. Expand Currency enum + CURRENCY_SYMBOLS

**File:** `packages/types/src/constants/enums.ts` (lines 164-200)

Add 9 currencies for Europe + Americas target markets:

| Code | Name | Symbol | Region |
|------|------|--------|--------|
| RSD | Serbian Dinar | din. | Europe |
| CZK | Czech Koruna | Kc | Europe |
| HUF | Hungarian Forint | Ft | Europe |
| RON | Romanian Leu | lei | Europe |
| BGN | Bulgarian Lev | лв | Europe |
| COP | Colombian Peso | $ | Americas |
| ARS | Argentine Peso | $ | Americas |
| CLP | Chilean Peso | $ | Americas |
| PEN | Peruvian Sol | S/. | Americas |

Update both `Currency` const object and `CURRENCY_SYMBOLS` map.

### 2. Fix `detectCurrency()` — validate against supported set

**File:** `apps/mobile/src/lib/locale-detection.ts` (line 11-13)

Import `SUPPORTED_CURRENCIES` from `apps/mobile/src/lib/currencies.ts` and validate:

```ts
export function detectCurrency(): Currency {
  const locale = getLocales()[0];
  const code = locale?.currencyCode ?? '';
  if (SUPPORTED_CURRENCIES.has(code)) return code as Currency;
  return 'EUR';
}
```

Fallback is `EUR` (not USD) because target market is Europe-first. DB default remains `USD` — no conflict since auto-detection always runs before the DB default is relevant.

### Research Insight: The `as Currency` cast is safe ONLY because the `has()` check guarantees membership. Without the guard, it's a lie to the type system.

### 3. Consolidate duplicate `detectCurrency()` in currency.tsx

**File:** `apps/mobile/src/app/(onboarding)/currency.tsx` (lines 17-23)

Replace the inline `detectCurrency()` with an import from `locale-detection.ts`. Eliminates the duplicate implementation.

### 4. Update `CURRENCY_LIST` in currencies.ts

**File:** `apps/mobile/src/lib/currencies.ts`

Add name entries for all 9 new currencies. The `SUPPORTED_CURRENCIES` Set auto-derives from `CURRENCY_SYMBOLS` keys, so it updates automatically.

### 5. Database migration — expand CHECK constraints + RPC validation

**New migration file:** `supabase/migrations/00XXX_expand_currency_support.sql`

Three sync points in the DB:
- `chk_users_currency` CHECK constraint on `users.currency`
- `chk_expenses_currency` CHECK constraint on `expenses.currency`
- PL/pgSQL `complete_onboarding` function's allowlist validation

#### Research Insight: Use CREATE OR REPLACE, not DROP+CREATE

The function signature is unchanged (still 18 params with same types). `CREATE OR REPLACE FUNCTION` cleanly replaces the body without risk of:
- Creating a second overload (past incident: migration 00040 fixed PGRST203 from overloads)
- A window where the function is missing
- Signature mismatch errors

```sql
-- 1. Drop and recreate users CHECK
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_currency;
ALTER TABLE users ADD CONSTRAINT chk_users_currency
  CHECK (currency IN ('USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
                       'SEK','NOK','DKK','PLN','TRY',
                       'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN'));

-- 2. Drop and recreate expenses CHECK
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS chk_expenses_currency;
ALTER TABLE expenses ADD CONSTRAINT chk_expenses_currency
  CHECK (currency IN ('USD','EUR','GBP','JPY','CAD','AUD','CHF','INR','BRL','MXN',
                       'SEK','NOK','DKK','PLN','TRY',
                       'RSD','CZK','HUF','RON','BGN','COP','ARS','CLP','PEN'));

-- 3. Replace complete_onboarding function body (signature unchanged)
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_preferences JSONB,
  p_bike_make TEXT DEFAULT NULL,
  p_bike_model TEXT DEFAULT NULL,
  p_bike_year INTEGER DEFAULT NULL,
  p_bike_type motorcycle_type DEFAULT NULL,
  p_bike_mileage INTEGER DEFAULT NULL,
  p_bike_nickname TEXT DEFAULT NULL,
  p_bike_photo_url TEXT DEFAULT NULL,
  p_annual_repair_spend TEXT DEFAULT NULL,
  p_maintenance_reminders BOOLEAN DEFAULT NULL,
  p_reminder_channel TEXT DEFAULT NULL,
  p_seasonal_tips BOOLEAN DEFAULT NULL,
  p_recall_alerts BOOLEAN DEFAULT NULL,
  p_weekly_summary BOOLEAN DEFAULT NULL,
  p_last_service_date TEXT DEFAULT NULL,
  p_mileage_unit TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL
)
-- ... full body with expanded 24-currency allowlist in the IF check
```

#### Migration Safety Notes
- Supabase `db push` wraps each migration in a transaction — DROP+ADD constraint is atomic
- All existing rows satisfy the new (superset) constraint — no validation failures
- `fuel_logs.currency` uses regex `'^[A-Z]{3}$'` which already accepts all new codes — no change needed
- `maintenance_tasks.currency` also uses regex — no change needed
- **Hidden dependency:** `auto_create_fuel_expense` trigger (migration 00081) inserts into `expenses` using user's currency — works correctly as long as `chk_expenses_currency` is expanded (which we do)

### 6. Handle zero-decimal currencies (CLP)

**Export a shared Set** in `apps/mobile/src/lib/expense-constants.ts`:

```ts
export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'CLP']);
```

#### Research Insight: 4 additional files with hardcoded `currency === 'JPY'`

The `formatCurrencyInput()` fix is necessary but not sufficient. Three input screens and the PDF export also hardcode JPY checks:

| File | What to change |
|------|---------------|
| `apps/mobile/src/lib/expense-constants.ts:58` | Extract `ZERO_DECIMAL_CURRENCIES` Set, use in `formatCurrencyInput()` |
| `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` | Replace `currency === 'JPY'` with `ZERO_DECIMAL_CURRENCIES.has(currency)` for placeholder + keyboardType |
| `apps/mobile/src/app/(tabs)/(garage)/complete-task.tsx` | Same pattern |
| `apps/mobile/src/app/(modals)/add-ride-expense.tsx` | Same pattern |
| `apps/mobile/src/lib/pdf-template.ts:126-134` | `formatCost()` uses `maximumFractionDigits: 2` — add zero-decimal handling |

The `formatCurrency()` display function (line 39) uses `Intl.NumberFormat` which auto-detects zero-decimal currencies — no change needed there.

### 7. Fix `CompleteMaintenanceTaskSchema` validation bypass

**Security finding:** `packages/types/src/validators/maintenance-task.ts` line 55:

```ts
// BEFORE (weak — accepts any 3-letter string like "ZZZ")
currency: z.string().length(3).optional(),

// AFTER (validates against Currency enum)
currency: z.enum(currencyValues).optional(),
```

Also fix `MaintenanceTaskCostSchema` on line 46 if it has the same pattern.

### 8. Update tests

**File:** `apps/mobile/src/__tests__/onboarding-v2.test.ts` (lines 139-207)

- Add test: Serbian locale (`currencyCode: 'RSD'`) returns `'RSD'` (now supported)
- Add test: unsupported locale (e.g., `currencyCode: 'KWD'`) falls back to `'EUR'`
- Update Zod validation test to include new currency codes

**File:** `packages/types/src/validators/__tests__/onboarding-input.test.ts`

- Add test case for new currency codes in `CompleteOnboardingInputSchema`

### 9. Regenerate types

Run `pnpm generate` to regenerate the full pipeline after all changes.

## Implementation Order

1. `packages/types/src/constants/enums.ts` — expand `Currency` + `CURRENCY_SYMBOLS` (all downstream Zod schemas auto-update)
2. `apps/mobile/src/lib/currencies.ts` — expand `CURRENCY_LIST`
3. `apps/mobile/src/lib/locale-detection.ts` — fix `detectCurrency()` with `SUPPORTED_CURRENCIES` guard
4. `apps/mobile/src/app/(onboarding)/currency.tsx` — replace inline `detectCurrency()` with import
5. `apps/mobile/src/lib/expense-constants.ts` — extract `ZERO_DECIMAL_CURRENCIES` Set
6. `apps/mobile/src/app/(tabs)/(garage)/add-expense.tsx` — use `ZERO_DECIMAL_CURRENCIES.has()`
7. `apps/mobile/src/app/(tabs)/(garage)/complete-task.tsx` — same
8. `apps/mobile/src/app/(modals)/add-ride-expense.tsx` — same
9. `apps/mobile/src/lib/pdf-template.ts` — zero-decimal handling in `formatCost()`
10. `packages/types/src/validators/maintenance-task.ts` — fix `z.string().length(3)` → `z.enum(currencyValues)`
11. `supabase/migrations/00XXX_expand_currency_support.sql` — DB constraints + RPC
12. Tests — update locale detection + Zod validation tests
13. `pnpm generate` — regenerate types pipeline

## Acceptance Criteria

- [x] Currency enum expanded to 24 values (15 existing + 9 new)
- [x] `CURRENCY_SYMBOLS` map has entries for all 24 currencies
- [x] `CURRENCY_LIST` in currencies.ts has entries for all 24 currencies
- [x] `detectCurrency()` validates against `SUPPORTED_CURRENCIES`, falls back to EUR
- [x] Duplicate `detectCurrency()` in `currency.tsx` replaced with import
- [x] DB migration expands `chk_users_currency`, `chk_expenses_currency`, and RPC validation
- [x] CLP handled as zero-decimal currency in `formatCurrencyInput()` and all 4 input screens
- [x] PDF export `formatCost()` handles zero-decimal currencies
- [x] `CompleteMaintenanceTaskSchema` uses `z.enum(currencyValues)` not `z.string().length(3)`
- [x] Tests cover: supported locale detection, unsupported locale fallback, new Zod enum values
- [x] `pnpm precheck` passes
- [ ] Sentry issue MOTO-VAULT-REACT-NATIVE-H resolved

## Out of Scope (accepted tech debt)

- **Data remediation for 12 affected users**: The `personalizing.tsx` fallback button already lets users escape locally via `setOnboardingCompleted(true)`. After this fix ships, any user re-attempting onboarding will succeed. If needed, a manual DB script can set `onboarding_completed_at` for the 12 users.
- **`UpdateUserInput` Zod validation for currency**: `UpdateUserSchema` already auto-derives from `Object.values(Currency)` — the expansion auto-propagates. The DB CHECK is the safety net for direct API callers.
- **`fuel_logs` / `maintenance_tasks` DB CHECK tightening**: Both use regex `^[A-Z]{3}$` which is more permissive but not causing issues. Zod validation catches invalid values at the API layer.
- **Removing INR from enum**: INR is in the enum despite "Europe + Americas only" target. Removing it would break existing users who selected INR.
- **`meta-events.service.ts` hardcoded USD fallback**: Line 79 uses `currency ?? 'USD'` — cosmetic issue for Meta CAPI attribution, not a crash.

## Sources

- Sentry: [MOTO-VAULT-REACT-NATIVE-H](https://lominic.sentry.io/issues/MOTO-VAULT-REACT-NATIVE-H)
- Institutional learning: `docs/solutions/architecture/currency-preference-full-stack-implementation.md`
- Key sync points: TS enum → CURRENCY_SYMBOLS → CURRENCY_LIST → DB CHECK × 2 → PL/pgSQL RPC → `auto_create_fuel_expense` trigger
