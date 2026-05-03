---
title: "Architecture Review — Explore Funnel & Monetization Plan"
type: review
status: review
date: 2026-05-03
reviews: docs/specs/explore-monetization-implementation-plan.md
verdict: GO with corrections — 4 plan claims contradicted by the codebase, 7 new issues to address
---

# Architecture Review — Explore Funnel & Monetization Plan

## TL;DR

The plan is solid and reflects substantial diligence. The deepening review caught the most dangerous structural issues (the entire `countries` table mirage, async `can()`, REST-bypassing-auth, the fetch-vs-fetcher drift). I would ship Track 1 + Track 5 + Track 7 starting tomorrow if the corrections below are folded in.

But four facts in the "RESOLVED" decision table are **wrong against the actual schema**, and the plan has roughly seven architectural blind spots that are not yet flagged. None are catastrophic; all are the kind of thing that costs three days of debugging in production if not addressed up front.

Confidence: **high** that the corrections in this review reflect the current codebase as of 2026-05-03 (verified file-by-file, see appendix).

---

## What the plan gets right

These are worth calling out so the team doesn't relitigate them:

- **Keeping `can()` synchronous + per-request tier resolution** is the correct call. The current implementation in `entitlements.service.ts:30` already returns synchronously and unconditionally true; flipping it to read `GATING_MATRIX[user.tier][feature]` from request context is a one-day change with high leverage. The proposed location of the tier fetch (in `GqlAuthGuard.canActivate()`) is also correct.
- **Feature flag `ENTITLEMENTS_ENFORCED` defaulting to false** is the right rollout shape. Lets you deploy code Monday, audit reconciliation Tuesday, flip Wednesday, and roll back Thursday by env-var change rather than re-deploy.
- **GPX export staying in GraphQL** (BC-2) is the correct call. `routes.service.ts:435-486` already has the `exportRouteGPXWithEntitlement` pattern with quota consumption *before* signed URL — fail-closed semantics are good. Reuse it.
- **Pre-computing `elevation_profile` as a backfill script, not a migration** (BC-8) is right. Network-dependent migrations are how you get a database that won't migrate during a Mapbox outage.
- **CHECK constraints on JSONB columns** in 00125 are good defensive programming and follow the established pattern.
- **Combined-FeatureCollection map optimization** for /explore is the single highest-leverage perf change in the plan. 122 sources → 1 source is a 10-100x improvement on map mount.

---

## Plan claims contradicted by the codebase

These are stated as RESOLVED in the Open Decisions table but the underlying premise is wrong. Each one has a concrete impact.

### CR-1: `users.subscription_status` DOES exist

Plan says (D-7): *"No such column exists. Derive from `subscription_tier` + `subscription_expires_at`."*

**Reality**: `subscription_status` was added in `00023_subscription_status.sql` and is `NOT NULL` per `00031_revenuecat_webhook_processing.sql`. The `process_revenuecat_event` RPC writes it on every webhook (lines 42-99 of 00031), with values `active | trialing | cancelled | expired | past_due`.

**Impact**: The pre-deploy reconciliation query in §1.2 is incomplete — it only checks `subscription_tier = 'pro' AND expires_at < NOW()`. A user with `tier='pro', status='past_due', expires_at=future` is currently allowed Pro features by the RPC contract but the plan's reconciliation won't surface them. Add `AND subscription_status = 'active'` to the gating predicate **everywhere** that derives entitlement, or pick one source of truth and stick to it.

**Fix**: Update the reconciliation query and the per-request tier resolver:

```sql
-- Reconciliation
SELECT id, subscription_tier, subscription_status, subscription_expires_at
FROM users
WHERE subscription_tier = 'pro'
  AND (subscription_status NOT IN ('active','trialing')
       OR subscription_expires_at < NOW()
       OR subscription_expires_at IS NULL);
```

```typescript
// In GqlAuthGuard
const effectiveTier =
  data.subscription_tier === 'pro'
  && ['active','trialing'].includes(data.subscription_status)
  && data.subscription_expires_at > new Date()
    ? 'pro' : 'free';
```

### CR-2: `users.handle` ALSO exists (alongside `public_username`)

Plan says (D-6): *"It's `public_username`. PRD/brainstorm incorrectly called it `handle`."*

**Reality**: Both columns exist. `public_username TEXT` (added 00057) and `handle CITEXT UNIQUE` (added 00097). The `public_profiles` view exposes both. They are not the same column.

**Impact**: This is mostly a documentation hazard but has a real consequence: the `/u/[handle]` route URL parameter and what column it queries. If you query by `public_username` but the editor's vanity URL is set in `handle`, lookups fail silently.

**Fix**: Pick one as the canonical URL handle (recommend `handle` since it's CITEXT and unique) and document the relationship between the two. Also: since `/u/[handle]` is being deferred to v2, **remove the `/u/[handle]` link from the curator credit** in Track 2A — otherwise you ship dead links from day 1.

### CR-3: `SaveRouteButton` already uses the trips system

Plan says (Pre-Implementation Discoveries): *"`SaveRouteButton` uses old routes system, not trips. Need a new SaveTripButton using saveTrip/unsaveTrip mutations."*

**Reality**: `apps/web/src/components/save-route-button.tsx` calls `saveRouteToCollection` / `unsaveRouteFromCollection`. These mutation names are ambiguous (the word "route" is in them), but verify what they actually mutate before duplicating. If they already write to `trip_saves`, building a parallel `SaveTripButton` is just code duplication. If they write to a `collection_routes` legacy table, that's a real data integrity problem worth its own remediation track.

**Action**: 30-minute verification: trace the resolver behind `saveRouteToCollection` and report which DB table it writes. Decide unify-vs-duplicate based on result. Do this in week 1, not week 3.

### CR-4: There are 4+ explore pages, not 2

Plan says (Pre-Implementation Discoveries): *"Two parallel explore pages exist (i18n marketing + primary)."*

**Reality**: `/explore/page.tsx`, `/explore/[country]/page.tsx`, `/explore/[country]/[region]/page.tsx`, `/explore/search/page.tsx`, plus the i18n marketing variants under `[locale]/(marketing)/explore/`. That's 7 routes touched by Track 3.

**Impact**: The Track 3 estimate ("apps/web/src/app/explore/page.tsx + [country]/page.tsx") undercounts the surface area. The filter component must be reused across all variants, and the canonical-tag logic in `generateMetadata` must be added to each. The `[region]` page also needs the same treatment.

**Fix**: Add `[country]/[region]/page.tsx` and `/explore/search/page.tsx` to Track 3 scope. Decide whether the i18n marketing pages get the new filter UI now or stay frozen until i18n re-platforming. I'd freeze them — don't expand i18n scope mid-monetization-push.

---

## New issues not flagged in the deepening review

### NI-1: BC-2 contradicts Track 1.5 — pick one

The blocking corrections say *"Keep GPX export in GraphQL, not REST"* but **Track 1.5 still describes a `trips.controller.ts` with `GET /trips/:slug/gpx.gpx` and `GET /trips/:slug/gpx-preview.json` REST routes**. As of today `trips.controller.ts` does not exist.

This is an internal contradiction that will resurface in implementation as "but the plan said..." Resolve it explicitly:

- **Recommended**: Delete Track 1.5's REST design entirely. Add a `exportTripGPXWithEntitlement(slug: String!)` GraphQL mutation that mirrors the existing route pattern. The "preview" doesn't need a server endpoint at all — see NI-3.
- **If REST is kept**: Add a `JwtRestAuthGuard` in the same module and document why this exception exists. Make sure the controller is wired through the GqlAuthGuard pattern's tier resolution.

### NI-2: `routes` and `trips` co-existence is ambient tech debt

The legacy `routes` table is still alive (00064), and `user_gating_events.route_id` FKs to it. The plan adds `trip_id` to `user_gating_events` (BC-7), creating a metering table with two parallel FKs to two parallel "trip-like" tables. Going forward you'll have:

- Old GPX exports → `route_id` filled, `trip_id` null
- New GPX exports → `trip_id` filled, `route_id` null
- A user's "exports this month" count must `COUNT(*) WHERE feature = 'DOWNLOAD_GPX'` regardless of which FK is set

This works but obscures intent. A future engineer reading this table will not understand why both columns exist. Either:

- **Option A** (cheap): Add a `CHECK ((route_id IS NOT NULL)::int + (trip_id IS NOT NULL)::int <= 1)` and a comment explaining the legacy/unified split.
- **Option B** (proper): Schedule the deprecation of the legacy `routes` table in a follow-on track. The trip-unification migrations (00112, 00117–00119) suggest you're already on this path.

### NI-3: The blurred GPX preview as a server-side endpoint is over-engineered

The plan oscillates between "CSS blur on existing static map image" (in Simplifications) and "GET /trips/:slug/gpx-preview.json — first 20% of polyline + first 3 waypoints (public)" (in Track 1.5). Pick one and stick to it.

**Recommended**: The static map image already exists for every trip (via the existing Mapbox static API path). Render it client-side with `backdrop-filter: blur(12px)` over 80% of the area + a CSS gradient mask to fade the visible 20%. No server endpoint, no polyline truncation logic, no possibility of a free user reverse-engineering 100% of the polyline by hitting the preview endpoint repeatedly.

The cosmetic-only preview is acceptable here because **the actual GPX file** is server-truncated by the entitlement check on download — the preview blur is just visual gating, not security gating.

### NI-4: `@ResolveField` strategy on Trip causes N+1 without DataLoader

Plan says (Performance Optimizations): *"Trip detail: 4+ GraphQL queries → Keep at 1 query — use @ResolveField for elevation, reviews, similar trips, save status."*

`@ResolveField`s on a single Trip are fine. But the same field resolvers fire on `similarTrips: [Trip!]!` (6 trips × 4 fields = 24 sub-queries) and on the explore page's trip cards (50 trips × save_status = 50 sub-queries). Without DataLoader batching this is exactly the N+1 pattern the plan claims to avoid.

**Fix**: Either (a) explicitly batch the per-list ResolveFields via NestJS DataLoader (e.g., `@nestjs-modules/dataloader`), or (b) keep the resolver "skinny" for trip cards (compute saveStatus and reviewCount in the trip-list query directly via a JOIN), and only use ResolveField on the singular trip-detail page.

I'd take (b). It's simpler and the trip-list query already has rating/review_count denormalized in the `trips` table per 00117.

### NI-5: Webhook idempotency is not addressed

RevenueCat retries webhooks on 5xx with exponential backoff. The plan describes the success-page polling for race-on-arrival but doesn't address idempotency of the webhook itself.

If `process_revenuecat_event` is called twice with the same `event_id`, what happens? Looking at 00031, the RPC does `UPDATE users SET ...` — idempotent for tier writes, but if you also fire PostHog "subscribe" events from the controller layer (per Track 1.7), you'll double-count subscriptions on retries.

**Fix**:

- Persist `revenuecat_processed_events(event_id, processed_at)` and `INSERT ... ON CONFLICT DO NOTHING` before firing analytics. If conflict, return 200 immediately without re-processing.
- Or: rely on PostHog's `event.uuid` deduplication if you're confident in it. Confirm before relying.

### NI-6: PostHog initial_referrer is a client-side property and won't work in SSR

Plan says (1.8 Attribution Gate): *"Use PostHog person properties only: check first-touch referrer for `apps.apple.com` / `play.google.com`. Simplified per code simplicity review: just check PostHog `$initial_referrer`."*

`$initial_referrer` is set by `posthog-js` on first session and stored in the browser. The `/pro/checkout` page is server-rendered (it's a Next.js page). Reading PostHog person properties **on the server** requires a PostHog server-side query (`/api/projects/:id/persons/`), which:

- Costs an extra round trip with PostHog API rate limits
- Requires a PostHog API key in the server env (worth a security review)
- Has latency the user will see on the gate

**Fix**: Either (a) read PostHog properties via the client SDK in a `useEffect` and conditionally render the gate (acceptable; a flash-of-checkout is not a security issue), or (b) add a `signup_source` column to `users` populated at signup from the request's `Referer` header. (b) is what most of the team's institutional patterns suggest doing eventually anyway.

### NI-7: Builder share-link durability is undefined

Plan mentions "Share generates working token URL" but does not specify:

- Token format and revocability (signed JWT vs DB row in `trip_share_tokens`?)
- What happens when the creator deletes the trip (404? Show last-known snapshot?)
- What happens when the creator's Pro expires (Resolution table says "View-only access remains; editing/sharing/export re-gated behind Pro" — but does the *recipient* viewing a shared link still see the route?)
- What happens when the creator is admin-deleted

Without these answered, "Share" will ship with surprising behavior. Recommend: a `trip_share_tokens` table with `token, trip_id, created_by, expires_at, revoked_at`, server-validated on each render. The recipient's view is read-only and continues to work even if the creator's Pro lapses (the trip is still in the DB; sharing is a public-readability override, not a Pro-locked feature).

---

## Open architectural questions worth resolving before week 1

### Q1: Builder auto-save vs server-side Pro gate

Plan adds debounced auto-save (good) and a server-side Pro gate on `createTripWithWaypoints` (good). What's the autosave wire format?

- If autosave calls `createTripWithWaypoints` every 2s with `status='draft'`, and the user's Pro expires mid-session, autosave starts failing silently. Need a clear UX for "your Pro lapsed, save your work."
- Alternatively: autosave to localStorage; commit to DB only on explicit "Save" button. This survives Pro lapse but loses cross-device.

Pick one and write it into the spec.

### Q2: Annual price decision (D-1) blocks RC offering setup

The plan leaves D-1 OPEN. But: every day the team waits, more web-billing events accumulate against whatever RC offering is currently live. If you change offerings later, RC's "migrate to new offering" flow has to handle existing customers.

Recommended: pick 30% (no change to RC) before flipping `ENTITLEMENTS_ENFORCED`. Save the 40% experiment for after first 100 paid web subs, when you have enough data to A/B price.

### Q3: $5K MRR target vs organic-only $900 MRR forecast

The plan acknowledges this gap and calls Track 8 "the traffic engine." But the implementation schedule allocates Track 8 to weeks 4-5 with only 3 launch articles (per Simplifications). 3 articles produce roughly 2-5% of the traffic delta needed to bridge $900 → $5K.

This is a strategy concern, not an architecture concern, but it belongs in the doc: either revise the target to organic-realistic ($1.5-2K MRR by month 6 with 3 guides), or commit to a paid-acquisition track with a stated budget. Don't ship an "active" plan with a target nobody on the team believes.

### Q4: filterCounts at scale

Plan says client-side filtering is fine "at 122 routes." Define the threshold: when `trips_published > 500`, switch to server-side. Add a TODO with that condition rather than letting it become accidental tech debt when the catalog grows.

### Q5: `/u/[handle]` deferred but linked from trip detail

If `/u/[handle]` is deferred to v2 (per Simplifications), the trip-detail "TripCuratorCredit" component (Track 2A) cannot link to `/u/[handle]`. Either:

- Ship a stub `/u/[handle]` route that 404s gracefully or shows a coming-soon banner, **or**
- Remove the link from TripCuratorCredit until v2.

The current plan ships dead links.

---

## Recommended sequencing changes

The current week-by-week schedule is reasonable. Two adjustments:

1. **Move `SaveRouteButton` audit (CR-3) to week 1.** It's a 30-minute verification that may save a 3-day duplicate-implementation track. Cheap to do early.
2. **Move `/u/[handle]` decision (Q5) to week 1.** If you're not shipping the page, you need to know now so Track 2A can render the curator credit without a link.
3. **Move attribution-gate strategy decision (NI-6) to week 1.** This determines whether `users` needs a `signup_source` column, which would be a Track 1 migration concern, not a Track 5 frontend concern. If you defer, you'll discover the migration need three weeks late.

Everything else can stay where the plan has it.

---

## Bottom line

**Recommendation: GO with corrections.**

The 12-agent deepening review caught the structurally dangerous issues. The four codebase-contradicted claims (CR-1 to CR-4) and seven new issues (NI-1 to NI-7) are tractable and most are 1-2 hour fixes if addressed at plan time. None of them block the week-1 work (Track 1 + Track 5 attribution + Track 7) — they affect tracks 2A/2B/3/4.

The strategic concern is Q3 (the $5K MRR vs $900 organic gap). That's the conversation worth having with whoever owns the revenue target before kickoff.

Total estimated impact of corrections: ~16-24 hours of additional engineering, mostly in Track 5 (NI-6 attribution rework if you decide to add `signup_source`) and Track 2B (Q1 builder autosave UX, NI-7 share token design).

---

## Appendix: Verification log

These claims were verified directly against the codebase on 2026-05-03:

| Claim source | Verification | Result |
|---|---|---|
| BC-1 — no `countries` table | `grep CREATE TABLE countries supabase/migrations/` | confirmed: no such table |
| BC-3 — GATING_MATRIX missing BUILDER_ACCESS | `entitlements.types.ts:16-44` | confirmed |
| BC-4 — `can()` is currently sync | `entitlements.service.ts:30-35` | confirmed (sync, returns true unconditionally) |
| BC-7 — `user_gating_events.route_id` FK to routes | `00101_user_gating_events.sql` | confirmed; no `trip_id` column |
| BC-9 — trip detail uses raw `fetch()` | `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx:18-34` | confirmed |
| D-9 — `day_index` is 0-based | `00075_trip_waypoint_day_index.sql` | confirmed |
| Pre-impl: ElevationChart exists with hover sync | `apps/web/src/components/elevation-chart.tsx` | confirmed (lines 17, 34, 36) |
| Pre-impl: JsonLdGraph escapes `<` | `apps/web/src/components/marketing/json-ld-graph.tsx:18` | confirmed |
| Pre-impl: gpx-download-button links to App Store | `gpx-download-button.tsx:244` | confirmed |
| Pre-impl: blog.ts uses gray-matter | `apps/web/src/lib/blog.ts:3` | confirmed; does NOT use next-mdx-remote |
| Pre-impl: PPR disabled | `apps/web/next.config.ts:11` | confirmed (`cacheComponents: false`) |
| D-7 — no `subscription_status` column | `00023, 00031` | **REFUTED** — column exists, written by RPC |
| D-6 — only `public_username`, no `handle` | `00057, 00097` | **REFUTED** — both columns exist |
| Pre-impl: SaveRouteButton uses old routes | `save-route-button.tsx` | **AMBIGUOUS** — uses `saveRouteToCollection`; need to trace resolver |
| Pre-impl: two parallel explore pages | `apps/web/src/app/explore/`, `[locale]/(marketing)/explore/` | **REFUTED** — 4+ primary routes |

Reviewer: Claude (sonnet, system-design skill)
