---
status: complete
priority: p3
issue_id: "106"
tags: [code-review, typescript, currency]
dependencies: []
---

# Redundant CurrencyCode type alias + minor cleanups

## Problem Statement

Several minor TypeScript cleanups identified across the currency feature.

## Findings

1. `apps/mobile/src/app/(onboarding)/currency.tsx` line 16: `type CurrencyCode` re-derives the `Currency` type that's already imported
2. `apps/mobile/src/stores/auth.store.ts` line 48: `'USD' as Currency` cast is unnecessary — `'USD'` is already assignable
3. `apps/mobile/src/app/_layout.tsx` lines 102, 106: `as Currency` / `as MeasurementSystem` casts should validate with `in` check first
4. `apps/mobile/src/lib/expense-constants.ts` line 43: `ZERO_DECIMAL_CURRENCIES` Set with single entry — simplify to `=== 'JPY'`
5. `apps/mobile/src/app/(onboarding)/currency.tsx` line 31: `useState` should use lazy initializer to avoid unnecessary `getLocales()` call

## Proposed Solutions

Apply all fixes in one pass.
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Redundant `CurrencyCode` type alias removed
- [ ] Unnecessary `as Currency` cast on store default removed
- [ ] Hydration casts validate with `in` check before casting
- [ ] `ZERO_DECIMAL_CURRENCIES` simplified to direct comparison
- [ ] `useState` uses lazy initializer form
