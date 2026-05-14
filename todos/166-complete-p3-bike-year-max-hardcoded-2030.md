---
status: complete
priority: p3
issue_id: "166"
tags: [code-review, validation, types]
dependencies: []
---

# bikeYear max hardcoded to 2030

## Problem Statement

`packages/types/src/validators/onboarding-input.ts:43` — `.max(2030)` will need updating in 4 years.

## Fix

Use `new Date().getFullYear() + 2` at runtime, or increase to a more generous static bound (e.g., 2035).
