---
status: pending
priority: p3
issue_id: "039"
tags: [code-review, testing, duplication]
dependencies: []
---

# Extract Shared Resolver Decorator Metadata Test Helpers

## Problem Statement

Every resolver spec has a `describe('decorator metadata')` block with 15+ lines of copy-pasted guard/pipe metadata checks. This pattern is duplicated across 7 files (~140 lines of boilerplate).

## Findings

- **Source**: Code Simplicity Reviewer
- **Files**: All 7 `*.resolver.spec.ts` files in `apps/api/src/modules/`

## Proposed Solutions

### Option A: Create shared helpers
Create `apps/api/test/helpers/metadata.ts` with:
- `expectHasGuard(Resolver, method, Guard)`
- `expectHasPipe(Resolver, method, Pipe)`
- **Effort**: Small (20 min)
- **Risk**: None
- **Impact**: ~100 LOC saved

## Acceptance Criteria

- [ ] Shared helpers created in test/helpers/
- [ ] All 7 resolver specs refactored to use helpers
- [ ] All tests pass
