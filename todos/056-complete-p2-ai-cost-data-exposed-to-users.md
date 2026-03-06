---
status: complete
priority: p2
issue_id: "056"
tags: [code-review, security, database]
---

# AI cost/model data exposed to end users via RLS

## Problem Statement

The `content_generation_log` SELECT policy lets users read their own logs including `input_tokens`, `output_tokens`, `model`, `cost_cents`, and `error_message` — business-sensitive and potentially security-relevant data.

## Findings

- `supabase/migrations/00006_content_generation_log.sql:27-28` — user SELECT policy
- Leaks: internal AI model identifiers, per-request costs, error messages with potential system details

## Proposed Solution

Either remove user-facing SELECT policy entirely (serve via curated NestJS endpoint), or create a view with restricted columns:

```sql
DROP POLICY "Users read own generation logs" ON public.content_generation_log;
-- Or create a restricted view and apply RLS to it
```

## Effort
Small

## Acceptance Criteria
- [ ] Users cannot see cost_cents, model, or error_message directly
