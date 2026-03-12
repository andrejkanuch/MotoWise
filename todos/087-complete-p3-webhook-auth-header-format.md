---
status: pending
priority: p3
issue_id: "087"
tags: [code-review, security, api, revenuecat]
dependencies: []
---

## Problem Statement

`RevenueCatWebhookController` compares the full `Authorization` header against `REVENUECAT_WEBHOOK_SECRET`. If RevenueCat sends the secret with a `Bearer ` prefix, the comparison needs to strip it first. The exact format should be verified against RevenueCat's documentation.

Also, the `safeCompare` function uses a hardcoded HMAC key `'webhook-compare-key'` which is not a vulnerability but looks odd.

## Proposed Solutions

- Verify RevenueCat's Authorization header format
- Strip `Bearer ` prefix if present before comparison
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] Webhook auth comparison handles the correct header format
- [ ] Tested with actual RevenueCat webhook payload
