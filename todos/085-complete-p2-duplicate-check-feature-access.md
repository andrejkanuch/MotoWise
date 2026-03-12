---
status: pending
priority: p2
issue_id: "085"
tags: [code-review, quality, mobile]
dependencies: []
---

## Problem Statement

`checkFeatureAccess` is duplicated identically in `subscription.ts` and `useProGate.ts`. The `subscription.ts` version is dead code (never imported). Additionally, `useProGate`'s `featureMap` uses `Record<string, ProFeature>` instead of `keyof typeof FREE_TIER_LIMITS` for type safety.

## Proposed Solutions

- Delete `checkFeatureAccess` from `subscription.ts`
- Type `featureMap` key as `keyof typeof FREE_TIER_LIMITS`
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] Single source of `checkFeatureAccess` in `useProGate.ts`
- [ ] `featureMap` uses typed keys
