---
status: pending
priority: p2
issue_id: "036"
tags: [code-review, testing]
dependencies: []
---

# ArticlesService.search Filter and Cursor Branches Untested

## Problem Statement

The `search` method has 4 conditional branches: `input.category`, `input.difficulty`, `input.query` (textSearch), and `input.after` (cursor-based pagination with base64 decoding). Tests only call `search({})` and `search({ first: 2 })`. None of the filter branches or cursor logic are exercised.

## Findings

- **Source**: Test Analyzer (criticality 8/10)
- **File**: `apps/api/src/modules/articles/articles.service.spec.ts`
- **Production code**: `apps/api/src/modules/articles/articles.service.ts` (lines 33-41)
- Cursor-based pagination with base64 encoding/decoding is error-prone

## Proposed Solutions

### Option A: Add 4 test cases for each conditional branch
- Test with `category` filter
- Test with `difficulty` filter
- Test with `query` (textSearch)
- Test with `after` cursor (verify base64 decode + range call)
- **Effort**: Medium (30 min)
- **Risk**: None

## Acceptance Criteria

- [ ] Test covers category filter branch
- [ ] Test covers difficulty filter branch
- [ ] Test covers textSearch query branch
- [ ] Test covers cursor-based pagination with base64 after param
- [ ] All tests pass
