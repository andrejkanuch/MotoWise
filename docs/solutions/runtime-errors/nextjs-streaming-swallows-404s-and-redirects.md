---
title: A loading.tsx above a route turns every notFound() and redirect() into a cached HTTP 200
category: runtime-errors
date: 2026-08-05
tags: [nextjs, app-router, soft-404, seo, isr, force-static, streaming, suspense, loading-tsx, notfound, permanentredirect, gsc, sentry]
affected_modules: [web/app/loading, web/trips, web/explore, web/blog, web/guides, web/api/revalidate]
---

## Problem

Every unknown URL on the marketing routes returned **HTTP 200 with not-found content** —
a soft-404. Sentry `MOTOVAULT-WEB-Q` (74 events), `-P` (55), `-R` (25).

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

### What the actual harm was — corrected against GSC data

The original write-up (and PR #193) claimed Google was **indexing these as real, thin
pages**. The GSC URL Inspection API says otherwise. Checked 2026-08-05, right after the fix
deployed, on the exact URL from the bug report:

```
url:              /trips/us/mt/beartooth-highway-2
coverage_state:   Excluded by ‘noindex’ tag
indexing_state:   BLOCKED_BY_META_TAG
page_fetch_state: SUCCESSFUL          <- Google did get a 200
last_crawl_time:  2026-08-02
referring_urls:   /route/us/mt/beartooth-highway-2
```

Next's `notFound()` automatically emits `<meta name="robots" content="noindex">`, still
visible on the live 404 page. So Google fetched a 200 and then **excluded** the URL. The
noindex tag prevented the index pollution the write-up asserted. **Do not repeat that
claim.** The soft-404s were semantically wrong, not index-polluting.

The real costs, in order of how much they mattered:

1. **Lost redirect equity — the genuine damage.**
   `/trips/us/ca/pacific-coast-highway` is linked from `/explore` and, instead of a 308 to
   the renamed slug, served a dead-end noindex 200 (last crawled 2026-05-03). Google saw a
   dead end where it should have seen a redirect, so that link's signal was discarded rather
   than consolidated onto the canonical trip. Same for the ~28 bare dedup-hash slugs.
2. **Wasted crawl budget.** A 200 keeps Google re-fetching indefinitely; a 404 lets it drop
   the URL and stop.
3. **GSC and Sentry noise** — `reportSoftNotFound` events, and a coverage report cluttered
   with "Excluded by noindex" rows that should have been clean 404s.

The fix is unchanged and still correct — 404 is the right status and the redirects are
restored (verified: production now returns `308 → /trips/us/ca/pacific-coast-highway-big-sur`).
Only the stated *rationale* was wrong.

Note the ~1k "Not found (404)" and 284 duplicate-canonical figures quoted in the original
write-up came from the GSC **UI**, which the API does not expose, so their composition was
never verified against these URLs. They plausibly counted genuinely-404ing URLs such as the
dead `/explore/{country}/{region}/{slug}` pattern PR #177 addressed — a different problem.
Treat those numbers as unattributed.

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
  - `scripts/check-404-contract.sh <url>` (`pnpm check:404`) — end-to-end, needs a real
    server. Encodes route families (bogus → 404, real → 200, legacy → 308) and verifies the
    target's `<title>` first, because port 3000 is often held by an unrelated local app.
    Wired into CI via `.github/workflows/check-404-contract.yml`, which fires on
    `deployment_status` — the only moment a real server exists. Production is probed at
    `motovault.app`; previews need `VERCEL_AUTOMATION_BYPASS_SECRET` because Deployment
    Protection is scoped `all_except_custom_domains`, and the job emits a notice and skips
    rather than failing if that secret is absent. It exits non-zero when the target is
    unreachable, so it can never silently pass.
- **Do not use `localhost:3000` for measurement.** IPv6 resolution reached an unrelated vite
  app on `[::1]:3000` and produced a false conclusion twice. Use `127.0.0.1:3100`.
- `vercel.json`'s `ignoreCommand` **overrides** the dashboard "Ignored Build Step". A custom
  command set in the dashboard is dead config while that key exists.
- A local prod build needs `apps/web/.env.local` with `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_BASE_URL` (matching the port you serve on — something server-side fetches it),
  and `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` for the blog to resolve.

## The progress bar, rebuilt without a boundary

`apps/web/src/components/navigation-progress.tsx` replaces the deleted `loading.tsx`. It is a
client component in the root layout, so it creates no Suspense boundary and cannot affect
response status. **Do not reintroduce `loading.tsx` for this.**

Neither Next primitive gives a global indicator on its own: `useLinkStatus()` reports the
pending state of the `<Link>` it is rendered *inside* (so one sensor per link), and
`onNavigate` fires only for `<Link>` clicks — not `router.push()` or back/forward. So the
component listens on the capture phase for the click that starts a same-origin navigation and
clears when `usePathname()` changes.

Two details that matter:

- Use `usePathname()`, **never `useSearchParams()`** — the latter opts a statically rendered
  route into needing a Suspense boundary, which is this exact bug again.
- A bare programmatic `router.push()` shows no bar; there is no client navigation event to
  observe without monkey-patching the router. Visitor-initiated navigation on the marketing
  pages all goes through links.

## References

- Plan + full measurement log: `docs/plans/2026-08-05-001-fix-web-soft-404-rendering-strategy-plan.md`
- Next.js `not-found` reference — 404 for non-streamed responses, 200 for streamed ones
- Next.js streaming guide — perform existence checks before any Suspense boundary
- Next.js internals `response-cache/index.ts` — a rendered 404 is persisted when a
  `cacheControl` value exists, so with `revalidate` set the 404 is cached for that duration
- `apps/web/src/app/layout.tsx` — the root-layout constraint that makes `force-static` load-bearing
- PR #193
