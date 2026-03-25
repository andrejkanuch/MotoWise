---
title: "Currency Preference — Full-Stack Implementation Pattern"
category: architecture
date: 2026-03-25
tags: [currency, intl, zustand, graphql, supabase, onboarding, preferences, formatToParts, hermes]
module: users, expenses, onboarding, profile
symptom: "All expense values hardcoded to USD ($) — non-US users see wrong currency symbol"
root_cause: "No currency preference existed; Intl.NumberFormat was a hardcoded USD singleton"
---

# Currency Preference — Full-Stack Implementation

## Problem

All monetary values (expenses, dashboard totals, maintenance costs) were hardcoded to USD via a single `Intl.NumberFormat('en-US', { currency: 'USD' })` singleton in `expense-constants.ts`. Non-US users saw dollar signs on their locally-entered amounts.

## Root Cause

No user currency preference existed anywhere in the system — DB, API, or mobile client.

## Solution

Added currency preference following the `measurement_system` column pattern, with per-expense currency tracking for data integrity.

### Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Storage | Dedicated `currency TEXT` column on `users` table | Mirrors `measurement_system` pattern; queryable, CHECK-constrained |
| Per-expense tracking | `currency` column on `expenses` table | Preserves data truth when user changes preference |
| Conversion | Display-only (no FX conversion) | Users enter amounts in their currency; we just show the right symbol |
| Server sync | Via `updateUser` mutation + `me` query hydration | Consistent across devices; also fixed pre-existing `measurementSystem` local-only gap |
| Symbol lookup | Static `CURRENCY_SYMBOLS` map in packages/types | `Intl.NumberFormat.formatToParts()` is broken on iOS Hermes |
| Formatter | Cached `Intl.NumberFormat` per currency code | Construction is expensive (~0.5-1ms); Map cache gives O(1) reuse |

### Implementation Layers

**DB migration** (`00051_add_currency_preference.sql`):
- Named CHECK constraints (`chk_users_currency`, `chk_expenses_currency`) for easy future modification
- `complete_onboarding` RPC: must DROP old overload before CREATE new one (PostgreSQL function overloading — same trap as migration 00040)
- Defense-in-depth: validate currency in RPC body + CHECK constraint + Zod schema

**Types** (`packages/types`):
- `Currency` as `as const` object + type (never TS `enum`)
- `CURRENCY_SYMBOLS: Record<Currency, string>` — static map because `formatToParts()` broken on iOS Hermes
- Zod: use `z.enum(Object.values(Currency) as [string, ...string[]])` — NOT `z.nativeEnum()` (codebase convention)

**API** (NestJS):
- `User.currency` is non-nullable (`@Field()`) because DB has `NOT NULL DEFAULT 'USD'`
- `createFromTask` must look up user's currency before inserting (otherwise defaults to USD)
- Add `currency` to Zod `UpdateUserSchema` — the `ZodValidationPipe` strips unrecognized keys, so missing it = silent data loss

**Mobile** (Expo):
- `formatCurrency(amount, currency)` with `Map<string, Intl.NumberFormat>` cache
- `getCurrencySymbol(currency)` reads from static `CURRENCY_SYMBOLS` map
- `useCurrency()` hook: `useCallback`-wrapped formatter + Zustand selector for minimal re-renders
- Hydration in `NavigationGate`: merged single `useEffect`, validates with `in` check, guards against no-op writes (prevents unnecessary AsyncStorage serialization on every app-focus)

### Critical Gotchas Discovered

1. **`formatToParts()` broken on iOS Hermes** — returns `undefined`. Use a static symbol map instead. This is NOT fixed as of RN 0.83/Expo 54.

2. **PostgreSQL function overloading trap** — `CREATE OR REPLACE FUNCTION` with a new parameter creates a NEW overload, not a replacement. Must `DROP FUNCTION IF EXISTS` the old signature first (pattern from migration 00040).

3. **`ZodValidationPipe` strips unknown keys** — if `currency` is in the NestJS DTO but NOT in the Zod schema, it gets silently removed before reaching the service. This was also a pre-existing bug for `measurementSystem`.

4. **Zustand `persist` writes on every `set()` call** — even if the value hasn't changed. Guard hydration effects with `!== state.current` check to avoid unnecessary AsyncStorage writes on every app-focus refetch.

5. **Onboarding store version bump** — adding `currency` to the persisted onboarding store requires bumping the version (2 → 3) and adding migration logic, or users mid-onboarding get `undefined` state.

6. **`getLocales()[0]?.currencyCode` returns `null` on iOS Simulator** — always provide a USD fallback.

7. **`createFromTask` was a hidden gap** — auto-generated expenses from maintenance task completion silently used the DB default (USD) instead of the user's preference. Caught by 4 independent review agents.

## Prevention

- When adding any user preference column, always update ALL three validation layers: Zod schema + NestJS DTO + DB constraint
- When modifying Supabase RPC functions, always DROP the old overload first
- When storing per-record metadata (like currency on expenses), also update `createFromTask` and any other non-UI creation paths
- Never use `formatToParts()` on Hermes — use static maps for symbol extraction
- Always guard Zustand hydration effects against no-op writes

## Related

- `docs/solutions/architecture/measurement-system-and-ride-feature-design.md` — identical pattern for metric/imperial
- `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md` — codegen pipeline
- `docs/solutions/security-issues/expense-rls-idor-motorcycle-ownership.md` — RLS pattern
- PR #36: `feat/currency-preference`
