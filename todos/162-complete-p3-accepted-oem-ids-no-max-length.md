---
status: complete
priority: p3
issue_id: "162"
tags: [code-review, validation, api]
dependencies: []
---

# No .max() on acceptedOemScheduleIds array

## Problem Statement

`packages/types/src/validators/onboarding-input.ts:48` — `z.array(z.string().uuid()).optional()` has no upper bound. A malicious client could send thousands of UUIDs.

## Fix

Add `.max(50)` — no motorcycle has more than ~20 OEM schedule items.
