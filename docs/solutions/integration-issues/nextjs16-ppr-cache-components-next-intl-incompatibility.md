---
title: "Next.js 16 cacheComponents (PPR) incompatible with next-intl cookie-based locale detection"
category: "integration-issues"
tags: [next-js-16, ppr, next-intl, cacheComponents, partial-pre-rendering, cookies, static-generation]
module: "apps/web"
symptom: "Build error 'Uncached data was accessed outside of <Suspense>' on all routes during next build"
root_cause: "next-intl getLocale() reads cookies per-request; PPR (cacheComponents: true) treats all cookie/header access as uncached runtime data requiring Suspense boundaries, but root layout cannot be wrapped in Suspense"
date_solved: "2026-03-08"
severity: "high"
---

# Next.js 16 PPR (cacheComponents) Incompatible with next-intl

## Problem

Enabling `cacheComponents: true` (Partial Pre-Rendering) in Next.js 16 causes the production build to fail on **every route** with:

```
Error: Route "/[locale]/privacy": Uncached data was accessed outside of <Suspense>.
This delays the entire page from rendering, resulting in a slow user experience.
```

All 16 routes fail — marketing pages, admin pages, and login — even those that don't directly use next-intl.

## Investigation Steps

1. **Added `setRequestLocale(locale)` to every page and `generateMetadata`** — The recommended next-intl approach for static rendering. Every page component and metadata function received the call. Build still failed.

2. **Added `generateStaticParams()` returning all locales to every page** — Attempted to pre-generate all locale variants so Next.js wouldn't need runtime locale detection. Still failed.

3. **Tried `export const dynamic = 'force-dynamic'` on root layout** — Next.js rejected this outright: "not compatible with cacheComponents". PPR and force-dynamic are mutually exclusive.

4. **Tried wrapping root layout in `<Suspense>`** — Invalid because `<html>` must be the document root element. You cannot place a React `<Suspense>` boundary above or around the `<html>` tag.

5. **Tried removing `getLocale()` from root layout and using a client component `LocaleHtmlLang` with `useEffect` to set `document.documentElement.lang`** — Partially addressed the root layout, but admin/login pages still failed because the next-intl plugin (`createNextIntlPlugin()`) globally injects locale detection into the webpack/turbopack pipeline.

6. **Set `cacheComponents: false`** — Build succeeds. All 19 routes generate correctly.

## Root Cause

The incompatibility is architectural and cannot be worked around at the application level:

- **next-intl's `createNextIntlPlugin()`** wraps the entire Next.js application. Its `i18n/request.ts` configuration reads `requestLocale`, which resolves from cookies and/or headers on every request.
- **PPR (`cacheComponents: true`)** treats ANY cookie or header access as "uncached runtime data" that must occur inside a `<Suspense>` boundary.
- **The root layout's `<html>` element** cannot be wrapped in `<Suspense>` because it must be the document root.
- **The plugin injects globally** — there is no per-route opt-out. Even if you remove all explicit `getLocale()` calls, the plugin's internal middleware still accesses request headers/cookies.

## Working Solution

In `apps/web/next.config.ts`, set `cacheComponents` to `false`:

```typescript
const nextConfig: NextConfig = {
  cacheComponents: false,  // PPR disabled — incompatible with next-intl cookie-based locale detection
  reactCompiler: true,
  // ... rest of config
};
```

This disables Partial Prerendering while keeping the React Compiler enabled.

## What Didn't Work

| Approach | Why It Failed |
|---|---|
| `setRequestLocale()` on every page | Plugin still injects header/cookie reads globally |
| `generateStaticParams()` on every page | Doesn't prevent runtime locale detection by the plugin |
| `dynamic = 'force-dynamic'` | Explicitly rejected by Next.js when `cacheComponents` is enabled |
| `<Suspense>` around root layout | `<html>` must be the document root; cannot be a Suspense child |
| Client-side `LocaleHtmlLang` component | Removed direct `getLocale()` from layout, but plugin's global injection still reads cookies/headers |

## Prevention Strategies

### Comment in Config

Always document why PPR is disabled directly in `next.config.ts`:

```typescript
// PPR (cacheComponents) disabled — next-intl cookie-based locale detection
// creates a dynamic dependency that breaks the static shell.
// Re-evaluate when next-intl supports PPR natively.
```

### Feature-Flag Approach

Use an environment variable to toggle PPR for easy re-testing:

```typescript
cacheComponents: process.env.ENABLE_PPR === 'true',
```

### CI Canary Job

Add an optional CI step that tests PPR compatibility:

```yaml
- name: Build web (PPR on) — canary
  continue-on-error: true
  run: ENABLE_PPR=true pnpm --filter web build
```

When this starts passing, it's safe to re-enable.

## Alternative Approaches if PPR is Critical

1. **URL-prefix locale routing** — Use `localePrefix: 'always'` (e.g., `/en/dashboard`, `/es/dashboard`). Locale becomes fully deterministic from URL path, no cookies needed. PPR works cleanly.
2. **Edge middleware redirect** — Middleware detects locale from cookie and redirects to locale-prefixed URL. Pages only read locale from the URL segment (static). Cookie provides persistence without being read during render.

## When to Re-evaluate

Check monthly or when upgrading `next-intl` or `next`:

| Signal | Where to Check |
|--------|---------------|
| next-intl PPR support | `github.com/amannn/next-intl/issues` — search "PPR" or "cacheComponents" |
| next-intl changelog | `github.com/amannn/next-intl/blob/main/CHANGELOG.md` |
| Next.js PPR stabilization | `github.com/vercel/next.js` — PPR tracking issue |
| Community reports | `github.com/amannn/next-intl/discussions` |

**Quick re-test:** Update next-intl → set `ENABLE_PPR=true` → run `pnpm --filter web build`.

## Related Files

- `apps/web/next.config.ts:19` — `cacheComponents: false`
- `apps/web/src/i18n/request.ts` — next-intl request config (reads requestLocale from cookies)
- `apps/web/src/app/layout.tsx` — Root layout with `getLocale()` for `<html lang>`
- `apps/web/src/app/[locale]/layout.tsx` — Locale layout with `setRequestLocale()`
- `todos/068-pending-p2-enable-nextjs16-features.md` — Original todo recommending PPR
- `docs/plans/2026-03-08-feat-web-i18n-localization-plan.md` — i18n implementation plan

## Environment

- Next.js 16.1.6 (Turbopack)
- next-intl v4.x
- Node.js on macOS
- Branch: `feat/stunning-landing-page`
