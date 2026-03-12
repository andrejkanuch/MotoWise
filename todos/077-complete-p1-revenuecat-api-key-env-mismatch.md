---
status: pending
priority: p1
issue_id: "077"
tags: [code-review, security, api, revenuecat]
dependencies: []
---

## Problem Statement

`cancelRevenueCatSubscription` in `users.service.ts` reads `process.env.REVENUECAT_API_KEY` directly, but the validated env schema defines `REVENUECAT_SECRET_API_KEY`. This means:
1. The env var name doesn't match — subscription cancellation on account deletion silently fails
2. Bypasses NestJS ConfigService and validation

## Findings

- **Security Sentinel**: HIGH H1 — deleted user's subscription remains active, continuing charges
- **TypeScript Reviewer**: HIGH — violates NestJS patterns, untestable
- **Architecture Strategist**: P1 — use ConfigService instead of process.env

## Proposed Solutions

### Option A: Use ConfigService with correct env var name
Inject `ConfigService` and use `this.configService.get<string>('REVENUECAT_SECRET_API_KEY')`.
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] `cancelRevenueCatSubscription` uses ConfigService
- [ ] Env var name matches `REVENUECAT_SECRET_API_KEY` from env.validation.ts
- [ ] Account deletion properly cancels RevenueCat subscription
