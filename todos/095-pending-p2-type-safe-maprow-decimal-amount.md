---
status: pending
priority: p2
issue_id: "095"
tags: [code-review, typescript, type-safety, api]
dependencies: []
---

# Type-safe mapRow using database.types.ts + explicit Number() for DECIMAL amount

## Problem Statement

Two related issues in `ExpensesService.mapRow()`:

1. **Unsafe casts:** Uses `Record<string, unknown>` with `as` casts. If a column name changes, this silently produces `undefined` values.
2. **DECIMAL precision:** `amount` is `DECIMAL(10,2)` in DB (returned as string by Supabase) but `Float` in GraphQL. `row.amount as number` could produce NaN. GraphQL Float (IEEE 754) can cause `19.99` → `19.990000000000002`.

**Known Pattern:** `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — "Never use SELECT *", "always use typed mapRow".

## Findings

- **TypeScript Reviewer:** CRITICAL-1 (mapRow casts) + CRITICAL-2 (Float/Decimal mismatch)
- **Security Sentinel:** LOW-3 (floating-point for financial totals)
- **Learnings Researcher:** Prior fix for mapRow uses any type

## Proposed Solutions

1. Use `Database['public']['Tables']['expenses']['Row']` from `database.types.ts` as the parameter type
2. Add explicit `Number()` conversion + rounding for amount: `Math.round(Number(row.amount) * 100) / 100`
3. Select explicit columns instead of `SELECT *`

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] `mapRow` uses typed row from `database.types.ts`
- [ ] `amount` explicitly converted with `Number()` and rounded to 2 decimal places
- [ ] No `as` casts on `unknown` remain
- [ ] Query uses explicit column selection instead of `SELECT *`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | TS reviewer + security sentinel + learnings flagged |
