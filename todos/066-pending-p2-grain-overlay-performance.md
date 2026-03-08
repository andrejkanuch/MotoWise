---
status: pending
priority: p2
issue_id: "066"
tags: [code-review, performance, web, css]
---

# Grain overlay mix-blend-mode causes paint storms

## Problem Statement

The grain texture overlay uses `mix-blend-mode: overlay` on a full-viewport `::after` pseudo-element with SVG feTurbulence. This forces the browser to composite every frame on scroll, causing paint storms on lower-end devices.

**File:** `apps/web/src/app/globals.css` (`.grain-overlay::after`)

## Findings

- Performance-oracle rated this as critical
- `mix-blend-mode` triggers compositing on every repaint
- The grain is purely decorative and should not impact performance
- Alternative: bake a static noise PNG tile and use `background-repeat`

## Proposed Solutions

1. **Static noise PNG** (Recommended)
   - Generate a small (~4KB) noise tile PNG
   - Replace SVG feTurbulence + mix-blend-mode with `background: url(noise.png) repeat`
   - Use `opacity` instead of `mix-blend-mode` for the overlay effect
   - **Effort:** Small | **Risk:** Low

2. **Reduce to hero only**
   - Scope grain to `.hero-section::after` instead of full page
   - Reduces compositing area significantly
   - **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] No paint storms on scroll (verify with Chrome DevTools Paint Profiler)
- [ ] Grain texture still visible as subtle decorative element
- [ ] No layout shift from the change
