---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, security, architecture]
dependencies: []
---

# ArticlesResolver Queries Use SUPABASE_USER Without Auth Guard

## Problem Statement

Neither `searchArticles` nor `articleBySlug` in `ArticlesResolver` has `@UseGuards(GqlAuthGuard)`. These queries use `SUPABASE_USER` (per-request client) in the service, but without the guard, `request.accessToken` is never set. The Supabase client gets `Bearer undefined` as Authorization, making behavior undefined.

## Findings

- **Source:** Architecture Strategist (CRITICAL #1), TypeScript Reviewer (I6)
- **File:** `apps/api/src/modules/articles/articles.resolver.ts`
- Every other resolver in the API is guarded
- If intentionally public, should use SUPABASE_ADMIN or a dedicated anonymous client

## Proposed Solutions

### Option A: Make Public — Use SUPABASE_ADMIN for Article Reads
If articles are publicly browsable (likely for SEO/growth), use the admin client for reads.
- **Effort:** Small
- **Risk:** Low (RLS still filters `is_hidden`)

### Option B: Add Auth Guard
If articles require authentication, add `@UseGuards(GqlAuthGuard)`.
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Decision made: public or authenticated
- [ ] If public: service uses admin client with explicit `is_hidden = false` filter
- [ ] If authenticated: `@UseGuards(GqlAuthGuard)` added to both queries
- [ ] No `Bearer undefined` sent to Supabase

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | Architecturally incoherent — user client without auth guard |
