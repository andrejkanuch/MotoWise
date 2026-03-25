# Currency Preference Brainstorm

**Date:** 2026-03-24
**Status:** Ready for planning

## What We're Building

A user-configurable currency preference that controls how all monetary values (expenses, repair costs, dashboard totals) are displayed throughout the app. Users select their currency during onboarding and can change it anytime in their profile settings.

This is a **display symbol preference** — no currency conversion. Users enter and see amounts in their chosen currency with the correct symbol/formatting.

## Why This Approach

- **Display-only (no conversion)**: Keeps it simple. Users already think in their local currency — they just need the right symbol. Conversion adds API dependencies, staleness issues, and rounding confusion for zero real benefit in a personal tracker.
- **DB column on users table**: Mirrors the existing `measurement_system` column pattern exactly. Single source of truth, syncs across devices, queryable.
- **Per-user scope**: One currency for the whole account. Multi-bike-multi-currency is an edge case that adds significant complexity.
- **Popular currencies (~15)**: Covers the vast majority of users without overwhelming the picker UI.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Conversion vs display | Display symbol only | No API deps, no rounding issues, users enter in their currency |
| Currency list scope | ~15 popular currencies | Covers 95%+ of users, simple picker UI |
| Onboarding placement | New screen after metric/imperial | Groups unit preferences together, natural flow |
| Storage approach | `currency TEXT DEFAULT 'USD'` column on `users` | Mirrors `measurement_system` pattern, syncs across devices |
| Preference scope | Per-user (global) | Simple, covers 99% of use cases |
| Default | USD | Most common, overridden during onboarding |

## Supported Currencies

| Code | Symbol | Name |
|------|--------|------|
| USD | $ | US Dollar |
| EUR | € | Euro |
| GBP | £ | British Pound |
| JPY | ¥ | Japanese Yen |
| CAD | C$ | Canadian Dollar |
| AUD | A$ | Australian Dollar |
| CHF | CHF | Swiss Franc |
| INR | ₹ | Indian Rupee |
| BRL | R$ | Brazilian Real |
| MXN | MX$ | Mexican Peso |
| SEK | kr | Swedish Krona |
| NOK | kr | Norwegian Krone |
| DKK | kr | Danish Krone |
| PLN | zł | Polish Zloty |
| TRY | ₺ | Turkish Lira |

## Scope of Changes

### Database
- New migration: add `currency TEXT DEFAULT 'USD'` to `users` table
- Update `complete_onboarding` RPC to accept `p_currency` parameter

### API (NestJS)
- Add `currency` field to User model/resolver
- Accept `currency` in `CompleteOnboardingInput` and `UpdateUserInput`
- Expose in `me` query response

### Types (packages/types)
- Add `Currency` const object + type to enums
- Add currency list with code, symbol, name
- Update onboarding input schema

### Mobile — Onboarding
- New screen after metric/imperial: currency picker (scrollable list with flag/symbol)
- Store selection in onboarding store, pass to `completeOnboarding` mutation

### Mobile — Profile
- Add currency picker in profile settings (same UI as onboarding picker)
- Update via `UpdateUser` mutation

### Mobile — Expense Display
- Create `formatCurrency(amount, currencyCode)` utility
- Update: add-expense screen, expense-dashboard, any summary cards
- Use `Intl.NumberFormat` with the user's currency code for proper symbol placement and decimal formatting

### Mobile — Auth Store
- Add `currency` to Zustand auth state (cache of server value)
- Sync from `me` query response

## Open Questions

None — all key decisions resolved.
