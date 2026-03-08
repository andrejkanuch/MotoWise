---
status: complete
priority: p2
issue_id: "065"
tags: [code-review, performance, web, bundle-size]
---

# Replace Motion library with CSS scroll-driven animations

## Problem Statement

The hero component imports `motion/react` (30-50KB gzipped) for only 4 scroll-linked effects (`useScroll`, `useTransform`, `useReducedMotion`). Modern CSS `animation-timeline: view()` and `scroll()` can achieve the same parallax effects with zero JavaScript.

**File:** `apps/web/src/components/marketing/hero.tsx`

## Findings

- Performance-oracle rated this as critical for landing page LCP
- CSS `animation-timeline: scroll()` has ~85% browser support (2026)
- The hero is the only component using Motion — removal eliminates the entire dependency
- `useReducedMotion` can be replaced with CSS `@media (prefers-reduced-motion: reduce)`
- Features grid already uses CSS `animation-timeline: view()` successfully

## Proposed Solutions

1. **Full CSS migration** (Recommended)
   - Replace `useScroll`/`useTransform` with CSS `animation-timeline: scroll()`
   - Replace `useReducedMotion` with `@media (prefers-reduced-motion: reduce)`
   - Remove `motion` from `apps/web/package.json`
   - Hero becomes a Server Component (no `'use client'`)
   - **Effort:** Medium | **Risk:** Low

2. **Dynamic import with fallback**
   - `next/dynamic` with `ssr: false` for hero parallax
   - CSS-only for non-JS browsers
   - Keeps Motion but defers loading
   - **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Hero parallax works without JavaScript library
- [ ] Bundle size reduced by ~30-50KB
- [ ] `prefers-reduced-motion` still respected
- [ ] No visual regression on hero scroll effects
