---
title: "Web Landing Page: 10 Code Review Findings Resolution"
category: ui-bugs
tags:
  - code-review
  - performance
  - security
  - simplification
  - maintainability
  - web
  - nextjs
  - css
  - csp
  - seo
module: web
date: 2026-03-08
pr: "#10"
---

# Web Landing Page: 10 Code Review Findings Resolution

Ten code review findings (todos 065-074) resolved for the Next.js 16 marketing landing page.

## Performance (3 findings)

**065 - Replace Motion library with CSS scroll-driven animations**
- Removed `motion/react` dependency (~30-50KB gzipped)
- Replaced `useScroll`/`useTransform` with CSS `animation-timeline: scroll()`
- Hero converted from Client Component to Server Component
- `@media (prefers-reduced-motion: reduce)` replaces `useReducedMotion`

**066 - Grain overlay paint storms**
- Removed `mix-blend-mode: overlay` causing forced compositing on every scroll frame
- Added `will-change: auto` and `isolation: isolate` for layer promotion

**068 - Enable Next.js 16 features**
- `cacheComponents: true` (Partial Pre-Rendering)
- `reactCompiler: true` (automatic memoization)

## Security (2 findings)

**067 - CSP tightening**
- Removed `unsafe-eval` from production CSP (kept for dev only, conditional on `NODE_ENV`)
- `style-src 'unsafe-inline'` retained (required for Tailwind/inline styles)

**070 - JSON-LD escape pattern**
- Added `.replace(/</g, '\\u003c')` to `JSON.stringify(data)` preventing `</script>` breakout XSS

## Simplification (2 findings)

**072 - FAQ dual rendering YAGNI**
- Consolidated ~150 LOC dual desktop/mobile layouts into ~90 LOC single responsive accordion

**074 - Social links placeholder hashes**
- Removed footer social links section with `#` placeholder URLs

## Maintainability (3 findings)

**069 - Navbar `<a>` to `<Link>`** — Already fixed (was using `<Link>` from `@/i18n/navigation`)

**071 - Hardcoded base URL** — Extracted to `NEXT_PUBLIC_BASE_URL` env var with `BASE_URL` constant in `apps/web/src/lib/constants.ts`

**073 - GRID_CLASSES typed key union** — Changed `Record<string, string>` to `Record<FeatureKey, string>` for compile-time safety

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| CSS `animation-timeline: scroll()` | Replace JS scroll animation libraries for Server Component compatibility |
| Conditional CSP | `unsafe-eval` only in dev via `NODE_ENV` check in `next.config.ts` |
| JSON-LD XSS prevention | `.replace(/</g, '\\u003c')` on `dangerouslySetInnerHTML` content |
| Derived union types | `type Key = typeof DATA[number]['key']` for typed Record keys |

## Prevention Checklist

- [ ] Audit JS dependencies — prefer CSS for scroll animations and transitions
- [ ] Never use `mix-blend-mode` on full-viewport decorative elements
- [ ] Never ship `unsafe-inline`/`unsafe-eval` in production CSP
- [ ] Always escape `dangerouslySetInnerHTML` in script tags
- [ ] Always use `<Link>` for internal navigation (repeat finding from todo 034)
- [ ] Extract constants at first use, not after review
- [ ] Use derived types for Record keys, never `Record<string, ...>`
- [ ] Try single responsive component before building separate mobile/desktop variants
- [ ] Never ship placeholder `#` links

## Related

- [Monorepo Code Review Multi-Category Fixes](../integration-issues/monorepo-code-review-multi-category-fixes.md) — Previous 34-finding resolution; `<a>` to `<Link>` is a repeat
- [Parallel Agent GraphQL Contract Drift](../integration-issues/parallel-agent-graphql-contract-drift.md) — Same PR, different category of findings
- PR #10, PR #5 (design system), PR #9 (TanStack migration)
