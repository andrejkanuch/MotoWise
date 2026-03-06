---
status: pending
priority: p2
issue_id: "052"
tags: [code-review, performance, database]
---

# Missing composite indexes for common query patterns

## Problem Statement

Several query patterns in NestJS services cannot use existing single-column indexes for both filtering and sorting, requiring in-memory sorts that degrade at scale.

## Findings

1. **Articles listing** — `.eq('is_hidden', false).order('generated_at', { ascending: false })` has no covering index
2. **Learning progress** — `.eq('user_id', userId).order('last_read_at', { ascending: false })` sorts in memory
3. **Diagnostics by user** — `.eq('user_id', userId).order('created_at', { ascending: false })` sorts in memory
4. **Content flags** — RLS `auth.uid() = user_id` has no `user_id` index
5. **Diagnostics related_article_id** — FK with `ON DELETE SET NULL` but no index (locks on article delete)

## Proposed Solution

New migration:
```sql
-- Articles listing (covers filter + sort + cursor pagination)
CREATE INDEX idx_articles_visible_generated ON public.articles (generated_at DESC) WHERE is_hidden = false;

-- Learning progress (replaces idx_learning_progress_user_id)
DROP INDEX idx_learning_progress_user_id;
CREATE INDEX idx_learning_progress_user_read ON public.learning_progress (user_id, last_read_at DESC NULLS LAST);

-- Diagnostics (replaces idx_diagnostics_user_id)
DROP INDEX idx_diagnostics_user_id;
CREATE INDEX idx_diagnostics_user_created ON public.diagnostics (user_id, created_at DESC);

-- Content flags user lookup
CREATE INDEX idx_content_flags_user_id ON public.content_flags (user_id);

-- Diagnostics FK for article deletion
CREATE INDEX idx_diagnostics_related_article ON public.diagnostics (related_article_id) WHERE related_article_id IS NOT NULL;
```

## Effort
Small — single migration file

## Acceptance Criteria
- [ ] All 5 indexes created
- [ ] Redundant single-column indexes dropped
