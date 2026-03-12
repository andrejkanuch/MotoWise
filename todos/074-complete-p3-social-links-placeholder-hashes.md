---
status: complete
priority: p3
issue_id: "074"
tags: [code-review, web, content]
---

# Social links and footer links point to # placeholders

## Problem Statement

Footer social links (Twitter, GitHub, Discord) and some navigation links point to `#` placeholder URLs. These should either have real URLs or be removed.

**File:** `apps/web/src/components/marketing/footer.tsx`

## Findings

- Code-simplicity-reviewer flagged placeholder links as incomplete
- Shipping `#` links to production is poor UX

## Proposed Solutions

1. **Add real URLs or remove** (Recommended)
   - Replace with actual social media URLs if they exist
   - Remove social links section entirely if no accounts exist yet
   - **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] No `#` placeholder links in production
