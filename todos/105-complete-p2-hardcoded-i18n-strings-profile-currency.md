---
status: complete
priority: p2
issue_id: "105"
tags: [code-review, i18n, currency]
dependencies: []
---

# Hardcoded strings in profile currency picker section

## Problem Statement

Three strings in the profile currency picker are not passed through `t()` for localization, breaking the pattern used by every other section on the profile screen.

## Findings

- `apps/mobile/src/app/(tabs)/(profile)/index.tsx`:
  - `"Currency"` (section header)
  - `"Select Currency"` (modal title)
  - `"Done"` (dismiss button)

## Proposed Solutions

Wrap in `t()` with defaultValue: `t('profile.currency', { defaultValue: 'Currency' })` etc.
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] All three strings use `t()` translation function
