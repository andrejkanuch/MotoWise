---
status: pending
priority: p2
issue_id: "096"
tags: [code-review, architecture, nestjs, separation-of-concerns]
dependencies: []
---

# Move auto-expense logic from resolver to service + remove forwardRef

## Problem Statement

Two related architectural issues:

1. **Business logic in resolver:** The auto-expense creation (cost calculation, `expensesService.createFromTask()`) lives in `MaintenanceTasksResolver.completeMaintenanceTask()`. Per CLAUDE.md: "Resolvers are thin — business logic in services."

2. **Unnecessary forwardRef:** `maintenance-tasks.module.ts` uses `forwardRef(() => ExpensesModule)` but there is no circular dependency — `ExpensesModule` does not import `MaintenanceTasksModule`.

## Findings

- **Architecture Strategist:** HIGH (forwardRef) + MEDIUM (business logic in resolver)
- **TypeScript Reviewer:** HIGH-6 + HIGH-7
- **Simplicity Reviewer:** forwardRef is defensive code for a non-existent circular dependency

## Proposed Solutions

1. Inject `ExpensesService` into `MaintenanceTasksService` instead of the resolver
2. Move cost calculation + `createFromTask` call into a `complete()` method on the service
3. Replace `forwardRef(() => ExpensesModule)` with plain `ExpensesModule` import

- Effort: Medium
- Risk: Low

## Acceptance Criteria

- [ ] Auto-expense logic in `MaintenanceTasksService`, not resolver
- [ ] Resolver only calls `this.maintenanceTasksService.complete()`
- [ ] `forwardRef` removed, plain `ExpensesModule` import used
- [ ] Existing behavior preserved (auto-expense on task completion with cost)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from code review | Architecture + TS reviewer flagged |
