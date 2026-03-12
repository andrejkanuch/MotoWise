---
status: pending
priority: p2
issue_id: "080"
tags: [code-review, architecture, api]
dependencies: ["077"]
---

## Problem Statement

`UsersService` now handles user CRUD, onboarding, GDPR data export (compilation + storage upload + signed URL), and account deletion with RevenueCat API calls. These are four distinct concerns. The `compileAndSendExport` method alone is ~80 lines.

## Proposed Solutions

### Option A: Extract DataExportService and move RevenueCat calls
- Extract `DataExportService` for GDPR export logic
- Move `cancelRevenueCatSubscription` into existing `RevenueCatService` or new `SubscriptionService`
- Effort: Medium | Risk: Low

## Acceptance Criteria

- [ ] `UsersService` delegates export to `DataExportService`
- [ ] RevenueCat API calls live in a subscription-focused service
- [ ] Both new services are properly injectable
