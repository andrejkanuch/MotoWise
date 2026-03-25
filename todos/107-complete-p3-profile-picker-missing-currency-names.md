---
status: complete
priority: p3
issue_id: "107"
tags: [code-review, ux, currency]
dependencies: []
---

# Profile currency picker inconsistency — missing currency names

## Problem Statement

The onboarding currency picker shows symbol + code + human-readable name (e.g., "$ USD US Dollar"), but the profile currency picker only shows symbol + code (e.g., "$ USD"). This is inconsistent.

## Proposed Solutions

Use `CURRENCY_LIST` from `currencies.ts` in the profile picker (same as onboarding), or add names inline.
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Profile currency picker shows currency name alongside code and symbol
