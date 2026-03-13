---
status: pending
priority: p2
issue_id: "099"
tags: [code-review, compliance, app-store, paywall]
dependencies: []
---

# Verify RevenueCat paywall includes ToS/Privacy Policy links

## Problem Statement

The old paywall screen had Terms of Service and Privacy Policy links (to `motovault.app/terms` and `motovault.app/privacy`). The new screen delegates entirely to RevenueCat's native paywall. If the RevenueCat paywall does not include these links, this could be an **App Store compliance issue** — Apple requires ToS/Privacy links to be accessible before purchase.

## Findings

- **TypeScript Reviewer:** HIGH-8 — removed ~540 lines of custom paywall including ToS/Privacy links

## Proposed Solutions

1. Check RevenueCat dashboard — verify the remote paywall template includes ToS/Privacy links
2. If not, configure them in RevenueCat or add fallback links in the paywall.tsx wrapper

- Effort: Small
- Risk: Medium (App Store rejection risk)

## Acceptance Criteria

- [ ] ToS and Privacy Policy links are accessible before purchase
- [ ] Verified in RevenueCat dashboard or added to paywall wrapper

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | TS reviewer flagged |
