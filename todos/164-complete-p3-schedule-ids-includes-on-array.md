---
status: complete
priority: p3
issue_id: "164"
tags: [code-review, performance, api]
dependencies: ["152"]
---

# scheduleIds.includes() uses O(n*m) linear scan

## Problem Statement

`users.service.ts:256` — `scheduleIds.includes(s.id)` is O(n) per call. Convert to `Set` for O(1) lookups.

## Fix

```typescript
const acceptedIds = new Set(scheduleIds);
const accepted = allSchedules.filter((s) => acceptedIds.has(s.id));
```
