---
status: complete
priority: p2
issue_id: "053"
tags: [code-review, data-integrity, nestjs]
---

# Users.update() sends undefined as null, erasing existing data

## Problem Statement

`UsersService.update()` always sends all three fields to Supabase `.update()`. If only `fullName` is provided, `avatar_url` and `years_riding` are sent as `undefined` which Supabase serializes as `null`, overwriting existing values.

## Findings

- `apps/api/src/modules/users/users.service.ts:34-39` — all fields always sent
- Calling `update(id, { fullName: 'New' })` sets avatar_url and years_riding to NULL

## Proposed Solution

```typescript
const payload: Record<string, unknown> = {};
if (input.fullName !== undefined) payload.full_name = input.fullName;
if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
if (input.yearsRiding !== undefined) payload.years_riding = input.yearsRiding;
```

## Effort
Small

## Acceptance Criteria
- [ ] Partial updates preserve unmodified fields
