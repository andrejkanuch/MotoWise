---
status: pending
priority: p2
issue_id: "083"
tags: [code-review, agent-native, api, graphql]
dependencies: []
---

## Problem Statement

Subscription status (tier, isPro, trial info) is not exposed in the GraphQL User type. Non-mobile clients (web, admin, agents) cannot determine a user's subscription status programmatically. The server already reads this data in PremiumGuard.

## Proposed Solutions

### Option A: Add subscriptionTier to User GraphQL type + mySubscription query
- Expose `subscriptionTier` on the `User` @ObjectType
- Add a `mySubscription` query returning tier, trial status, expiry
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] `subscriptionTier` exposed on User GraphQL type
- [ ] Web/admin clients can query subscription status
