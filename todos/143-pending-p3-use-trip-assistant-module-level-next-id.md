---
status: pending
priority: p3
issue_id: "143"
tags: [code-review, typescript, testability]
dependencies: []
---

# use-trip-assistant: module-level mutable `nextId` leaks across hook instances and tests

## Problem Statement

`use-trip-assistant.ts` declares `let nextId = 1;` at module scope and increments it inside `makeId`. This leaks across hook instances in the same app session and across Vitest files that share the module, making snapshots and deterministic tests fragile.

## Findings

- **Kieran TypeScript Reviewer:** `apps/mobile/src/hooks/use-trip-assistant.ts:49-50` — module-level mutable counter

## Proposed Solutions

### Option A: expo-crypto UUID (Recommended)
```ts
import * as Crypto from 'expo-crypto';
const makeId = () => `m_${Crypto.randomUUID()}`;
```
Stateless, collision-free, test-friendly.
- Effort: Small

### Option B: per-hook ref
`const nextId = useRef(0);` — keeps the numeric shape but scopes state per hook instance.
- Effort: Small

## Technical Details

- **Affected files:** `apps/mobile/src/hooks/use-trip-assistant.ts`

## Acceptance Criteria

- [ ] No module-level mutable state in the file
- [ ] IDs are unique across hook instances
- [ ] Existing tests unchanged or simpler

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer |
