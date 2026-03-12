---
status: complete
priority: p3
issue_id: "072"
tags: [code-review, web, simplification]
---

# FAQ has dual rendering (desktop + mobile) — 60 LOC YAGNI

## Problem Statement

The FAQ component renders two completely separate layouts — a desktop two-column view and a mobile accordion — totaling ~150 lines. A single responsive layout could achieve the same result in ~90 lines.

**File:** `apps/web/src/components/marketing/faq.tsx`

## Findings

- Code-simplicity-reviewer identified this as the biggest YAGNI violation
- The desktop and mobile versions share identical data, state, and toggle logic
- A single accordion layout with responsive CSS could replace both

## Proposed Solutions

1. **Single responsive accordion**
   - Use one FAQ layout that adapts via CSS (grid/flex responsive)
   - Desktop: wider layout with side-by-side question/answer
   - Mobile: stacked accordion (same component, different CSS)
   - **Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] Single FAQ component handles both breakpoints
- [ ] Visual result matches current desktop and mobile designs
- [ ] Reduced from ~150 LOC to ~90 LOC
