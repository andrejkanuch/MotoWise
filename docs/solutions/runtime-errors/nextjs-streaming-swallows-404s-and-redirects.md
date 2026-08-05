---
title: A loading.tsx above a route turns every notFound() and redirect() into a cached HTTP 200
category: runtime-errors
date: 2026-08-05
tags: [nextjs, app-router, soft-404, seo, isr, force-static, streaming, suspense, loading-tsx, notfound, permanentredirect, gsc, sentry]
affected_modules: [web/app/loading, web/trips, web/explore, web/blog, web/guides, web/api/revalidate]
---

## Problem

Every unknown URL on the marketing routes returned **HTTP 200 with not-found content** —
a soft-404. Google indexed them as real, thin pages: ~1k "Not found (404)" entries in
GSC plus 284 duplicate-canonical, and Sentry `MOTOVAULT-WEB-Q` (74 events), `-P` (55),
`-R` (25).

```
$ curl -I https://motovault.app/trips/us/mt/beartooth-highway-2
HTTP/2 200
x-nextjs-prerender: 1
x-vercel-cache: HIT
```

Silently, the same mechanism had also disabled the page's `permanentRedirect()` calls:
`/trips/us/ca/pacific-coast-highway` returned 200 with not-found content in production
and **never** a 308, for as long as those redirects existed.

It hid for ~2 months across two PRs. Three separate investigation passes each asserted
something the next disproved.

## Root Cause

**`apps/web/src/app/loading.tsx`** — a 3px navigation progress bar at the app root.

A `loading.tsx` creates a **Suspense boundary for its entire subtree**. Because it sat at
`app/`, it was above *every* page. The shell therefore streams before the page resolves,
and per the Next.js `not-found` reference a response that has begun streaming **can only
carry HTTP 200** — the status line is already on the wire. Same for a 3xx. So
`notFound()` rendered the not-found UI, and the response went out as 200. Under ISR that
200 was then *cached* and re-baked identically on every revalidation.

`force-static` was blamed twice and is **not** the culprit. Isolated with two production
builds differing only in that one file:

| Variant | `force-static` | `generateStaticParams` | root `loading.tsx` | bogus slug | real slug | rendering |
|---|---|---|---|---|---|---|
| Original | yes | yes + `dynamicParams=false` | present | 404 (router) | 200 | SSG, 1,278 prerenders |
| V2 | **no** | no | present | **200** | 200 | `ƒ` Dynamic |
| V4 | no | no | **absent** | **404** | 200 | `ƒ` Dynamic |
| **V5 (shipped)** | **yes** | **no** | **absent** | **404** | **200** | `○` Static + ISR |

V2 vs V4 is the isolation: the only difference is `loading.tsx`, and it flips a bogus slug
between 200 and 404. Note V2 — removing `force-static`, the "obvious fix", still returns
200.

### Why the obvious fix was not available

`apps/web/src/app/layout.tsx` (2026-06-15) documents the constraint: `getLocale()` /
`getMessages()` in the **root** layout read request headers, forcing every route dynamic.
The root layout sits above `[locale]`, so it cannot call `setRequestLocale()`, and Next 16
`next/root-params` only exposes segments *preceding* the root layout. `force-static` on
the marketing routes is the workaround. Removing it would have traded the soft-404 bug for
loss of static rendering on the highest-traffic SEO pages — and per V2, would not have
fixed the 404 anyway.

## Solution

Delete the streaming boundaries; keep `force-static`.

1. **Deleted** `app/loading.tsx`, `app/explore/loading.tsx`, `app/route/loading.tsx`,
   `app/routes/loading.tsx`. (`route/` and `routes/` are redirect-only pages, where a
   boundary broke the redirect and the loading UI was pointless anyway.) `app/pro/loading.tsx`
   stays — nothing beneath it calls `notFound()` or `redirect()`.
2. **Kept** `dynamic = 'force-static'` and `revalidate` on trips/explore. Both statuses now
   carry `x-nextjs-prerender: 1` and
   `Cache-Control: s-maxage=86400, stale-while-revalidate=31449600` — the 404 is itself
   cached, which is correct, and no manual `Cache-Control` work is needed.
3. **Deleted** the `generateStaticParams` / `dynamicParams = false` apparatus added for the
   wrong diagnosis, along with `lib/seo/trip-static-params.ts` (a minimum-count floor guard),
   the `requestRedeploy` deploy-hook call in `api/revalidate/route.ts`, its
   `VERCEL_DEPLOY_HOOK_URL` env var, and the Vercel deploy hook itself. All of it existed
   only to survive `dynamicParams = false`, which required prerendering the complete
   1,278-page set — a build that failed on a single transient `GraphQL 502`.
4. **Restored** the bare-slug 301s. In-page `permanentRedirect()` emits a real 308 again
   (measured: `HTTP/1.1 308` + `x-nextjs-prerender: 1` under `force-static`), so
   `findBareSlugRedirect` is wired back into the trip page. Renamed slugs stay in
   `LEGACY_TRIP_REDIRECTS` in `next.config.ts` — a config redirect needs no render and no
   GraphQL round-trip.

Result: real 404s, static rendering preserved, CDN cache headers intact, new content live
without a rebuild, and an 834-page build in 5.3s instead of 1,278 pages that could fail on
an upstream blip.

### Related fix: never let a transient error become a 404

`resolveRegion` used `.catch(() => [])` on its existence inputs. That converts an API blip
into `notFound()`, and under ISR **caches a 404 over a region that exists** — the failed
build logged `[soft-404] explore-region` for `th/th-77`, `jp/jp-20`, `sg/sg-02` while dying
on a GraphQL 502, and all three have published trips. Added
`definitiveOrThrow(promise, absent)` in `lib/graphql-server.ts`: resolve to `absent` only on
a definitive not-found (HTTP 200 + non-empty `errors[]`), re-throw everything else so Next
renders an uncached, retried error instead. Presentation-only fetches keep a plain `.catch()`.

## Diagnostic signature

A not-found body served with **`x-nextjs-prerender: 1`** and **`x-vercel-cache: HIT`**.
If you see those on a URL that should 404, the response was cached as a successful render.

## Gotchas

- **Dev mode cannot reproduce any of this.** It does no ISR and streams differently. A dev
  probe returning 404 sent three separate passes down wrong paths. Verify only with
  `pnpm --filter web build && (cd apps/web && PORT=3100 pnpm start)`.
- **No unit test can observe a prerender's HTTP status.** That is precisely why this was
  invisible. Two guards exist:
  - `apps/web/src/app/__tests__/not-found-contract.test.ts` — static tripwire, runs in CI on
    every PR: fails if any `loading.tsx` sits above a page calling `notFound()`/`redirect()`.
  - `scripts/check-404-contract.sh <url>` — end-to-end, needs a real server. Encodes route
    families (bogus → 404, real → 200, legacy → 308) and verifies the target's `<title>`
    first, because port 3000 is often held by an unrelated local app.
- **Do not use `localhost:3000` for measurement.** IPv6 resolution reached an unrelated vite
  app on `[::1]:3000` and produced a false conclusion twice. Use `127.0.0.1:3100`.
- `vercel.json`'s `ignoreCommand` **overrides** the dashboard "Ignored Build Step". A custom
  command set in the dashboard is dead config while that key exists.
- A local prod build needs `apps/web/.env.local` with `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_BASE_URL` (matching the port you serve on — something server-side fetches it),
  and `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` for the blog to resolve.

## If you want the progress bar back

Do **not** reintroduce `loading.tsx`. Implement it as a client component driven by
navigation events (`usePathname`/`useRouter` transitions) rendered inside the layout — that
creates no Suspense boundary, so it cannot affect response status.

## References

- Plan + full measurement log: `docs/plans/2026-08-05-001-fix-web-soft-404-rendering-strategy-plan.md`
- Next.js `not-found` reference — 404 for non-streamed responses, 200 for streamed ones
- Next.js streaming guide — perform existence checks before any Suspense boundary
- Next.js internals `response-cache/index.ts` — a rendered 404 is persisted when a
  `cacheControl` value exists, so with `revalidate` set the 404 is cached for that duration
- `apps/web/src/app/layout.tsx` — the root-layout constraint that makes `force-static` load-bearing
- PR #193
