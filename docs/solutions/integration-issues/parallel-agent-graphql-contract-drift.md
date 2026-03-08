---
title: "Parallel Agent GraphQL Contract Drift: AI Content Pipeline + Photo Diagnostic"
category: integration-issues
tags:
  - nestjs
  - graphql
  - expo
  - react-native
  - claude-api
  - tanstack-query
  - zod
  - codegen
  - parallel-agents
  - typescript
module: articles, diagnostics
symptom: "Parallel agents produced mismatched GraphQL field names, wrong mutation documents, wrong variable types, and TypeScript 'never' errors between API resolvers and mobile client operations"
root_cause: "Concurrent development of API (NestJS resolvers) and Mobile (Expo screens/GraphQL operations) by separate agents without running codegen as a synchronization check — generated types lagged behind resolver changes"
date: 2026-03-08
pr: "#10"
linear: MOT-8, MOT-9, MOT-12, MOT-13
---

# Parallel Agent GraphQL Contract Drift

## Context

Two parallel swarm agents (API + Mobile) built an AI content pipeline and photo diagnostic system simultaneously. The API agent created NestJS resolvers/services while the Mobile agent built Expo screens. Without a shared codegen sync point, five integration issues emerged.

## Problems and Solutions

### 1. Wrong GraphQL Field Name

The mobile agent wrote `articleBySlug` but the API resolver was named `articleBySlugFull`.

```graphql
# BEFORE (broken)
query ArticleBySlugFull($slug: String!) {
  articleBySlug(slug: $slug) { ... }
}

# AFTER (fixed)
query ArticleBySlugFull($slug: String!) {
  articleBySlugFull(slug: $slug) { ... }
}
```

### 2. Wrong Mutation Document Import

Mobile used `CreateDiagnosticDocument` but the API mutation was named `submitDiagnostic`, producing `SubmitDiagnosticDocument` after codegen.

```typescript
// BEFORE
import { CreateDiagnosticDocument } from '@motolearn/graphql';
// AFTER
import { SubmitDiagnosticDocument } from '@motolearn/graphql';
```

### 3. Wrong GraphQL Variable Type (`ID!` vs `String!`)

The `.graphql` file used `$id: ID!` but the NestJS resolver declared `@Args('id') id: string` which maps to `String!`.

```graphql
# BEFORE (runtime validation error)
query DiagnosticById($id: ID!) { ... }
# AFTER
query DiagnosticById($id: String!) { ... }
```

**Key insight for this codebase:** Supabase UUIDs are `String!` in NestJS code-first GraphQL, not `ID!`.

### 4. TypeScript `never` Type from Hardcoded Null

The mobile agent wrote a fallback `resultJson: null` since the API wasn't ready. TypeScript narrowed conditional blocks to `never`.

```typescript
// BEFORE (TypeScript error: property 'part' does not exist on type 'never')
const resultJson = diagnostic?.resultJson ?? null;

// AFTER (explicit interface + cast)
interface DiagnosticResult {
  part?: string;
  issues?: Array<{ description: string; probability?: number }>;
  toolsNeeded?: string[];
  difficulty?: string;
  nextSteps?: string[];
  confidence?: number;
  relatedArticleId?: string | null;
}
const resultJson = (diagnostic?.resultJson ?? null) as DiagnosticResult | null;
```

### 5. Data Access Mismatch After GraphQL Fix

After fixing the `.graphql` file, the component still accessed the old field name.

```typescript
// BEFORE (undefined — field doesn't exist on generated type)
const article = data?.articleBySlug;
// AFTER
const article = data?.articleBySlugFull;
```

## Verification

After all fixes:
1. `pnpm generate` — regenerates types from updated `.graphql` files against API schema
2. `pnpm typecheck` — catches any remaining mismatches at compile time
3. `pnpm test` — all 13 tests pass

## Root Cause

All five issues stem from **parallel development without codegen synchronization**. The generated `packages/graphql/src/generated/` output is the single source of truth for the API contract. When agents bypass it by guessing names/types, drift occurs.

## Prevention

### Contract-First Development

Before splitting into parallel tracks:
1. Write resolver signatures + `.graphql` operation files together
2. Run `pnpm generate` and commit the generated output
3. Both agents code against the committed TypedDocumentNode types

### Sequencing for Shared Contracts

| Phase | Who | What |
|-------|-----|------|
| 1 | Single agent | Define resolvers, write `.graphql` files, run codegen, commit |
| 2 | Parallel | API implements internals, Mobile builds screens against generated types |
| 3 | Integration | Merge, `pnpm generate && pnpm typecheck`, fix mismatches |

### Integration Checklist

After parallel agent work, run sequentially:

- [ ] `pnpm generate` — no codegen errors
- [ ] `pnpm typecheck` — no type errors (especially `never` errors)
- [ ] Verify all GraphQL imports come from `@motolearn/graphql`
- [ ] Verify `.graphql` variable types match resolver args (`String!` not `ID!` for UUIDs)
- [ ] For JSON fields, verify Zod parse step exists before component usage
- [ ] Trace data access: `data?.fieldName` matches generated type exactly

### Automated Checks

1. **Stale codegen CI check**: `pnpm generate && git diff --exit-code packages/graphql/src/generated/`
2. **Turborepo dependency**: Make `typecheck` depend on `generate:graphql` so types are always fresh
3. **Import discipline**: Never manually type a `*Document` name — always import from `@motolearn/graphql`

## Related

- [Monorepo Code Review Multi-Category Fixes](../integration-issues/monorepo-code-review-multi-category-fixes.md) — Previous parallel agent review that deleted the AI service stubs now rebuilt
- PR #8 — Established the codegen pipeline these operations extend
- PR #9 — TanStack Query migration that replaced urql (the data fetching layer)
- PR #10 — The current PR containing all fixes
