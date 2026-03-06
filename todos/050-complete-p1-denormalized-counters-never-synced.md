---
status: complete
priority: p1
issue_id: "050"
tags: [code-review, data-integrity, database]
---

# Denormalized counters never incremented (view_count, flag_count, quiz_best_score)

## Problem Statement

Three denormalized values are never updated by application code:
1. `articles.view_count` — always 0, no increment on article read
2. `articles.flag_count` — always 0, no increment on flag creation
3. `learning_progress.quiz_best_score` / `quiz_completed` — never updated after quiz submission

## Findings

- `articles.service.ts:findBySlug()` reads but never increments view_count
- `content-flags.service.ts:create()` inserts flag but never increments articles.flag_count
- `quizzes.service.ts:submitAttempt()` inserts quiz_attempt but never updates learning_progress
- Schema docs claim: "updated atomically via `UPDATE SET view_count = view_count + 1`" — code doesn't exist

## Proposed Solution

**Option A — DB triggers (recommended for flag_count):**
```sql
CREATE FUNCTION update_flag_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE articles SET flag_count = flag_count + 1 WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER on_flag_created AFTER INSERT ON content_flags
  FOR EACH ROW EXECUTE FUNCTION update_flag_count();
```

**Option B — Application code:**
- Add `recordView(articleId)` method to ArticlesService
- Add flag_count increment in ContentFlagsService.create()
- Add learning_progress update in QuizzesService.submitAttempt()

## Effort
Medium — triggers or service changes + tests

## Acceptance Criteria
- [ ] flag_count increments when a flag is created
- [ ] view_count increments when an article is read
- [ ] quiz_completed and quiz_best_score update after quiz submission
