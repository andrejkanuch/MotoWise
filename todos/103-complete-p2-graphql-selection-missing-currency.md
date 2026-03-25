---
status: complete
priority: p2
issue_id: "103"
tags: [code-review, graphql, currency]
dependencies: []
---

# GraphQL queries missing currency in selection sets

## Problem Statement

Two GraphQL operations don't include `currency` in their response selection sets:
1. `expenses-by-motorcycle.graphql` — expense items don't return currency
2. `complete-onboarding.graphql` — response doesn't confirm saved currency

## Findings

- `apps/mobile/src/graphql/queries/expenses-by-motorcycle.graphql` — expenses nested in categories select `id, amount, category, description, date, createdAt` but omit `currency`
- `apps/mobile/src/graphql/mutations/complete-onboarding.graphql` — returns `{ id, preferences, createdAt, updatedAt }` without `currency`

## Proposed Solutions

Add `currency` to both selection sets, run `pnpm generate`.
- **Effort**: Small (2 lines + regenerate)
- **Risk**: None

## Acceptance Criteria

- [ ] `expenses-by-motorcycle.graphql` includes `currency` in expense fields
- [ ] `complete-onboarding.graphql` includes `currency` in response
- [ ] `pnpm generate` runs successfully after changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-24 | Identified during agent-native review | |
