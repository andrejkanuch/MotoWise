---
status: complete
priority: p3
issue_id: "061"
tags: [code-review, security, database]
---

# Quiz answers world-readable via PostgREST

## Problem Statement

RLS policy `"Anyone reads quizzes" USING (true)` makes all quiz data including `questions_json` (with `correctIndex` values) readable by any user. If clients use Supabase's anon key directly, they can query PostgREST to extract correct answers, bypassing the NestJS API.

## Findings

- `supabase/migrations/00003_rls_indexes_triggers_storage.sql:79` — `USING (true)`
- Quiz model correctly omits correctIndex from GraphQL, but PostgREST exposes the raw JSONB

## Proposed Solution

Restrict to authenticated users: `USING (auth.uid() IS NOT NULL)`, or ensure PostgREST is not directly accessible from clients.

## Effort
Small
