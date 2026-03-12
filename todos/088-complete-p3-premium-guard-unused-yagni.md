---
status: pending
priority: p3
issue_id: "088"
tags: [code-review, quality, yagni, api]
dependencies: ["084"]
---

## Problem Statement

`PremiumGuard` (54 lines) is defined but no resolver uses `@UseGuards(PremiumGuard)`. All pro gating is client-side (`useProGate`) or via `AiBudgetService`. The guard also caches on untyped `req._subscriptionTier` property.

## Proposed Solutions

### Option A: Wire it into resolvers that need server-side enforcement (see todo 084)
If server-side free tier enforcement is added, use PremiumGuard there.
- Effort: Small

### Option B: Remove until needed (YAGNI)
Delete the file and add it when a resolver actually needs it.
- Effort: Small

## Acceptance Criteria

- [ ] Either wired into resolvers or removed
- [ ] If kept, type the `_subscriptionTier` property properly
