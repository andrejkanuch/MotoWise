---
status: complete
priority: p2
issue_id: "068"
tags: [code-review, web, nextjs, performance]
---

# Enable Next.js 16 features: cacheComponents, reactCompiler

## Problem Statement

Next.js 16 introduces several performance features that are not enabled in the current config: `cacheComponents` (PPR), `reactCompiler`, and `turbopackFileSystemCacheForDev`.

**File:** `apps/web/next.config.ts`

## Findings

- Best-practices-researcher recommended enabling these features
- `cacheComponents: true` enables Partial Pre-Rendering for automatic static/dynamic splitting
- `reactCompiler: true` enables automatic memoization (replaces manual useMemo/useCallback)
- `turbopackFileSystemCacheForDev` speeds up dev server restarts

## Proposed Solutions

1. **Enable all three** (Recommended)
   - Add `cacheComponents: true` to experimental config
   - Add `reactCompiler: true` (requires `babel-plugin-react-compiler`)
   - Add `turbopackFileSystemCacheForDev: true`
   - Test that marketing pages render correctly with PPR
   - **Effort:** Small | **Risk:** Low-Medium (PPR may need testing)

## Acceptance Criteria

- [ ] `cacheComponents` enabled and marketing pages render correctly
- [ ] `reactCompiler` enabled and no hydration mismatches
- [ ] Dev server uses filesystem cache
- [ ] Build succeeds with all features enabled
