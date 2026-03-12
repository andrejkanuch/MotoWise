---
status: pending
priority: p3
issue_id: "090"
tags: [code-review, quality, mobile]
dependencies: []
---

## Problem Statement

`subscription.store.ts` uses Zustand's `persist` middleware with AsyncStorage. The CLAUDE.md states tokens should use expo-secure-store (never AsyncStorage). While subscription state isn't a secret token, persisting `isPro` to AsyncStorage means a user could tamper with local Pro status. The store is also hydrated from RevenueCat on every launch, making persistence unnecessary.

## Proposed Solutions

Remove the `persist` middleware entirely. The store defaults to `isPro: false` until RevenueCat confirms on each launch. Server-side PremiumGuard enforces the real tier.
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] Subscription store no longer persists to AsyncStorage
- [ ] Pro status correctly hydrated from RevenueCat on launch
