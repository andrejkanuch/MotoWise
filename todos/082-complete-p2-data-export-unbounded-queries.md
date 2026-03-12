---
status: pending
priority: p2
issue_id: "082"
tags: [code-review, performance, api, gdpr]
dependencies: []
---

## Problem Statement

`compileAndSendExport` queries 7 tables with `select('*')` and no pagination/limits. Uses `JSON.stringify(exportData, null, 2)` (pretty-printed, doubles memory). Runs as fire-and-forget on the event loop — large synchronous stringify blocks the thread.

## Proposed Solutions

### Option A: Add safety limits and remove pretty-print
- Add `.limit(10000)` to each query
- Use `JSON.stringify(exportData)` without pretty-print
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] All export queries have `.limit()` safety cap
- [ ] No pretty-printing in JSON.stringify
- [ ] Remove try/catch around expenses query (table exists via migration)
