---
status: complete
priority: p2
issue_id: "060"
tags: [code-review, data-integrity, database]
---

# Diagnostics created with empty result_json, no status tracking

## Problem Statement

Diagnostics are inserted with `result_json: {}` and `severity: NULL`. No subsequent code populates these fields. Clients receive empty objects with no way to distinguish "pending AI analysis" from "completed with empty results."

## Findings

- `apps/api/src/modules/diagnostics/diagnostics.service.ts:35` — `result_json: {}`
- `supabase/migrations/00002_tables_and_constraints.sql:69` — `severity` is nullable with no update path
- No `updateDiagnosticResult()` method visible in any service

## Proposed Solution

Add a `status` column to diagnostics:
```sql
ALTER TABLE public.diagnostics
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
```

Add service method to update result after AI processing completes.

## Effort
Medium

## Acceptance Criteria
- [ ] Diagnostics have a status column distinguishing pending/completed
- [ ] Clients can determine if a diagnostic is awaiting AI results
