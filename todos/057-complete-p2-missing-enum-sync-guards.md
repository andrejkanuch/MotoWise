---
status: complete
priority: p2
issue_id: "057"
tags: [code-review, architecture, type-safety]
---

# Missing compile-time sync guards for 6 of 7 enum pairs

## Problem Statement

Only `SupportedLocale`/`GqlSupportedLocale` has a compile-time sync guard (`_localeSync`). The other 6 enum pairs (ArticleDifficulty, ArticleCategory, UserRole, FlagStatus, DiagnosticSeverity, MotorcycleType) have no equivalent. Adding a value to `enums.ts` but forgetting `graphql-enums.ts` would only surface at runtime.

## Findings

- `apps/api/src/common/enums/graphql-enums.ts:80-84` — `_localeSync` pattern exists only for locales
- 6 other enum pairs are unguarded

## Proposed Solution

Add sync guards for all enum pairs:
```typescript
const _difficultySync: Record<ArticleDifficulty, GqlArticleDifficulty> = {
  beginner: GqlArticleDifficulty.beginner,
  intermediate: GqlArticleDifficulty.intermediate,
  advanced: GqlArticleDifficulty.advanced,
};
// ... repeat for all 6 enum pairs
```

## Effort
Small — one-time, ~30 lines

## Acceptance Criteria
- [ ] All 7 enum pairs have compile-time sync guards
- [ ] Adding a new enum value to one side without the other causes a TS error
