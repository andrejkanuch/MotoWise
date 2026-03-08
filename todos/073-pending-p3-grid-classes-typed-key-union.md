---
status: complete
priority: p3
issue_id: "073"
tags: [code-review, web, typescript]
---

# GRID_CLASSES should use typed key union

## Problem Statement

`GRID_CLASSES` is typed as `Record<string, string>` which allows any string key. Should use a union of the actual feature keys for type safety.

**File:** `apps/web/src/components/marketing/features-grid.tsx`

## Findings

- Kieran-typescript-reviewer flagged as a type safety issue
- Current type allows typos like `GRID_CLASSES['dlag']` without error

## Proposed Solutions

1. **Extract key union from FEATURES** (Recommended)
   - `type FeatureKey = typeof FEATURES[number]['key']`
   - `const GRID_CLASSES: Record<FeatureKey, string>`
   - **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Invalid keys cause TypeScript compile errors
