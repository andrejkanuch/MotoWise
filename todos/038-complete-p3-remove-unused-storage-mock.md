---
status: pending
priority: p3
issue_id: "038"
tags: [code-review, yagni, testing]
dependencies: []
---

# Remove Unused Storage Mock from Supabase Mock Factory

## Problem Statement

`createMockSupabaseClient` includes a `storage` mock (from/upload/getPublicUrl) that is never used by any test.

## Findings

- **Source**: Code Simplicity Reviewer
- **File**: `apps/api/test/helpers/supabase-mock.ts` (lines 76-81)

## Proposed Solutions

### Option A: Remove the storage property
- Delete lines 76-81
- **Effort**: Small (2 min)
- **Risk**: None

## Acceptance Criteria

- [ ] `storage` property removed from mock factory
- [ ] All tests pass
