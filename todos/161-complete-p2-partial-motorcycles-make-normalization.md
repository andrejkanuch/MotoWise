---
status: complete
priority: p2
issue_id: "161"
tags: [code-review, database, data-integrity]
dependencies: ["151"]
---

# Partial motorcycles table make normalization — only Ducati

## Problem Statement

Migration 00128 normalizes `Ducati` → `DUCATI` in the `motorcycles` table but ignores other mixed-case user entries (e.g., `bmw`, `Bmw`, `honda`). This leaves inconsistent make values that won't match OEM schedules or aggregate correctly in `get_make_stats()`.

## Findings

- **Data Integrity Guardian:** `supabase/migrations/00128:35` — only one targeted UPDATE, not a blanket normalization

## Proposed Solutions

### Option A: Blanket UPPER normalization (Recommended)
```sql
UPDATE public.motorcycles SET make = UPPER(make) WHERE make != UPPER(make);
```
- Effort: Trivial
- Risk: Low — idempotent, preserves all data

## Acceptance Criteria

- [ ] All `motorcycles.make` values are ALL CAPS after migration
- [ ] No mixed-case makes remain in the table
