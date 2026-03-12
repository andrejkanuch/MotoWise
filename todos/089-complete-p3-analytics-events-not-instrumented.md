---
status: pending
priority: p3
issue_id: "089"
tags: [code-review, agent-native, mobile, analytics]
dependencies: []
---

## Problem Statement

`AnalyticsEvent` constants define events like `QUIZ_STARTED`, `QUIZ_COMPLETED`, `PAYWALL_VIEWED`, `PURCHASE_STARTED`, etc., but no `trackEvent` calls exist in the new screens (quiz, upgrade, privacy, diagnose). The analytics infrastructure was added but not instrumented.

## Proposed Solutions

Add `trackEvent` calls at key interaction points:
- Quiz: start, complete, score
- Upgrade: paywall viewed, purchase started/completed/cancelled
- Privacy: data export requested, account deletion requested
- Effort: Medium | Risk: Low

## Acceptance Criteria

- [ ] Key user actions emit analytics events
- [ ] Events include relevant metadata (quiz score, feature name, etc.)
