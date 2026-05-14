---
status: complete
priority: p2
issue_id: "158"
tags: [code-review, security, api]
dependencies: []
---

# PostgREST .or() string interpolation is fragile

## Problem Statement

The `.or()` filter in `oem-schedules.service.ts:28-29` uses template literals with the `year` parameter. Currently safe (GraphQL Int type guarantees a number), but a future caller passing an untrusted string could inject additional PostgREST filter operators.

## Findings

- **Security Sentinel:** `oem-schedules.service.ts:28-29` — fragile pattern, defense-in-depth missing

## Proposed Solutions

### Option A: Add explicit Number.isFinite() guard (Recommended)
```typescript
const safeYear = Number(year);
if (!Number.isFinite(safeYear)) throw new BadRequestException('Invalid year');
```
- Effort: Trivial
- Risk: None

## Acceptance Criteria

- [ ] `year` validated as finite number before interpolation into `.or()` filter
