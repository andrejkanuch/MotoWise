# PRD: Explore Funnel & Monetization Strategy

**Author:** Andrej (with Claude)
**Status:** Draft v3.1 — brainstorm-validated, cross-checked, single-shot implementation, ready for plan
**Date:** 2026-05-03
**Pages in scope:** `/explore`, `/explore/[country]`, `/explore/[country]/[region]`, `/trips/[country]/[region]/[slug]` (URL flattening to `/trips/[country]/[slug]` is OQ-1 below)

---

## TL;DR

MotoVault has a paid mobile entitlement (`MotoWise Pro` via RevenueCat) but no web revenue surface, weak `/explore` filtering, and an upgraded trip detail page that doesn't render the data we already have (no interactive map, no review text, no elevation). This PRD activates Pro on web with **a two-tier CTA model** (Free vs Pro+App, collapsed from the panel-rejected three-tier split), upgrades the trip detail surface as the conversion-driving shipping-first track, leads with the **multi-day trip builder** as the real Pro anchor (not GPX/PDF), and ships **content-density safeguards** (noindex thin pages, progressive filter disclosure, hide zero-result dimensions) so the 122-route catalog doesn't look thin under a six-dimension filter UI. PDF roadbook is demoted to v2. Revenue target is recalibrated to **$5K MRR by month 6, $15K by month 12** based on panel feedback that the original $15K-by-month-6 number implied 75K engaged sessions/month — an 18-month, not 6-month, traffic profile.

---

## What changed in v3 (brainstorm integration)

A 5-agent parallel review (Monetization Strategist, Motorbike Travel Expert, Software Architect, Growth PM ex-AllTrails/Komoot, SEO Content Strategist) graded the v2 PRD a B+ and surfaced the changes below. All 10 are integrated into this version.

| # | Change | Driver |
|---|---|---|
| C1 | Three-tier CTA → **two-tier (Free vs Pro+App)** | Panel consensus: three-tier creates decision paralysis; "Offline (App)" vs "GPX (Pro)" confuses identical user intent |
| C2 | $15K MRR by month 6 → **$5K by m6, $15K by m12** | $15K/m6 implies 75K engaged sessions/mo, 615 sessions/route/month — aspirational without traffic data |
| C3 | Free GPX quota: 3/mo → **1/mo** | Tighter conversion lever; "taste, then convert" |
| C4 | PDF roadbook → **v2** | Panel: "Who prints roadbooks in 2026?" 2 dl/user/mo target unsupported by motorcycle-tour behavior |
| C5 | Multi-day builder elevated from Track 5 to **Track 2** | This is the actual Pro anchor; lead with it, don't bury it |
| C6 | Bike-type % bar → **bike names inline on review cards** | "A single review saying 'Did this on a Street Triple, tight but doable' beats any chart" |
| C7 | NEW: **Blurred GPX preview + Pro overlay** | Highest-ROI conversion lever (AllTrails / Komoot pattern) |
| C8 | NEW: **Email capture at save #2-3** ("Keep saves across devices") | Re-engagement channel for anon savers — v2 had no loop |
| C9 | NEW: **Content density safeguards** | 122 routes × 6 filter dimensions = mostly empty result sets without progressive disclosure |
| C10 | NEW: **App Store policy guardrail** | Web checkout via RC Web Billing avoids 30% cut but Apple/Google forbid promoting it to app users |
| C11 | NEW: **Schema additions** — FAQ, BreadcrumbList, full TouristTrip | Low-effort SEO wins; PAA capture; 20–30% SERP CTR uplift typical |
| C12 | NEW: **Social proof signals** — "X saved", "Last ridden 3w ago" | Already have `view_count`, `clone_count` denormalized; just render them |
| C13 | Tracks reordered: **Trip detail + Builder ship together first** | Pro must have a reason to exist at launch; trip detail is the conversion surface |
| C14 | NEW: **`/guides/` content layer** (5 long-form SEO articles at launch) | SEO panel: "60–80% of organic traffic comes from informational queries"; product pages alone can't generate the sessions the revenue math requires |
| C15 | **Bike-type suitability matrix corrected** — touring/expert-mixed → X (was maybe); dirt_bike/easy-paved → maybe (was X) | Moto travel expert: "A Gold Wing on expert mixed is a hard no; a DR650 on highway is not fun but works" |
| C16 | NEW: **Canonical tags on filtered URL states** | SEO panel: filter params generate duplicate content; canonicalize to unfiltered parent |

---

## Problem Statement

`/explore` is a high-quality SEO surface that draws riders planning their next trip but converts neither toward revenue nor toward sustained app usage. Three concrete gaps:

1. **Explore is shallow.** Filters are Country + Duration only. No map view, no sort, no save-without-login, no personalization. A rider hunting for "a 2-day mixed-surface coastal loop in southern Spain on a dual-sport" cannot express that query.
2. **The new trip detail page leaves data on the table.** Reviews exist with text and `condition_tags` but `/trips/[country]/[region]/[slug]/page.tsx` shows only `{trip.reviewCount} verified rides logged` — no interactive map, no elevation, no review text, no per-review bike type, no photos, no social proof.
3. **Pro is mobile-only on the bill.** The entitlement `MotoWise Pro` exists in RevenueCat and gates server-side mobile features (`unlimited_bikes`, `full_ai_diagnostics`, `gpx_export`, `offline_trips`, `trip_assistant`). On web, the checkout pages are scaffolded but no feature is actually behind the gate. Engaged web visitors can't download a GPX or build a custom multi-day trip, and we capture no revenue from them.

Underneath all three, the panel surfaced a fourth: **content density is an existential risk**. 122 routes is fine for editorial discovery; layered with six filter dimensions and country/region pages, most combinations return 0–3 results. Country pages with three routes look broken, not authoritative. The PRD must ship density safeguards alongside the new surface.

---

## Goals

1. **Activate the existing `MotoWise Pro` entitlement on web.** One subscription, both surfaces. Web users paying Pro get unrestricted mobile features; mobile Pro users get unrestricted web features. Same RC entitlement, same offerings.
2. **Lift `/trips/*` → App install rate by 30%** (90 days post-launch — recalibrated from +40% pending baseline read in week 1).
3. **Convert ≥1.5% of engaged `/trips/*` sessions to Pro within 6 months** (recalibrated from 2%; revisit in month 4).
4. **Increase `/explore` → trip-detail CTR by 25%** by shipping six-dimension filters, sort, and a Mapbox map view — with progressive disclosure that hides empty dimensions.
5. **Reduce `/trips/*` bounce rate by 25%** by rendering an interactive map, elevation profile, real review text with bike names, condition tags, social proof, and a "similar trips" footer.
6. **Hit $5K Pro web MRR by month 6, $15K by month 12.**

---

## Non-Goals

1. **Not rebranding `MotoWise Pro`.** Even though the repo is MotoVault, the RC entitlement key is `MotoWise Pro`. UI copy says "MotoVault Pro"; the entitlement constant stays untouched.
2. **Not switching payment vendor.** RevenueCat is the system of record; web uses **RevenueCat Web Billing** (`NEXT_PUBLIC_REVENUECAT_WEB_API_KEY` already in `.env.example`). No Stripe direct.
3. **Not adding social/community features in this phase.** Reviews-with-text yes, full social no.
4. **Not gating existing free editorial.** Every published trip stays free to view. Pro unlocks *new* power features only.
5. **Not localizing Pro pricing per market.** Match mobile RC offering identifiers verbatim.
6. **Not rebuilding the editorial voice or visual design.** Structure only.
7. **NEW: PDF roadbook is out of v1.** Demoted to v2 after panel review — engineering effort doesn't match expected usage.
8. **NEW: Community route submissions are out of v1.** Wikiloc-style UGC is a tempting density solver but introduces moderation overhead. Solve density first via editorial selection + progressive disclosure.
9. **NEW: Multilingual content is out of v1.** URL structure should not block it (so `/[locale]` prefix architecture stays viable) but no translation work in this scope.
10. **NEW: Cell coverage overlay, luggage-impact difficulty, browser push notifications — all v2+.**

---

## App Store Policy Guardrail (CRITICAL)

RevenueCat Web Billing avoids Apple's 30% cut and Google's 15–30% cut. **This is a benefit, not a marketing strategy.** Apple's App Store Review Guidelines (3.1.3 "Other Purchase Methods" + 3.1.1 "In-App Purchase") and Google Play's Payments Policy forbid app developers from promoting alternative billing channels to users acquired through the stores. Recent enforcement (Epic v Apple, etc.) has been narrow but app reviewers are sensitive to in-app or attributed-email funnels pointing at cheaper web checkout.

**Constraints (must be honored in implementation):**

1. **No "subscribe on web for cheaper" messaging anywhere.** Web Pro and mobile Pro must publish identical price points.
2. **No in-app links pointing to web checkout.** The mobile app continues to use the RC native paywall exclusively. Period.
3. **No email funnel to web checkout for users attributed to mobile installs.** If a user signed up through `app_store_click` → install → account creation, that user's email must not receive a "subscribe on web" CTA.
4. **No referrer-leak from web checkout.** If a user lands on `/pro/checkout` and their session attributes them to a paid mobile-app campaign (Meta/Google ad), don't auto-complete checkout on web; show a soft prompt to use the app instead.
5. **Web pricing page is freely indexable and discoverable from organic search.** Users finding it via Google = OK. Users being pushed to it from inside the app = not OK.

The implementation needs an attribution-aware gate on `/pro/checkout` (track 5.7, new). Source-of-truth for "is this user app-attributed?" is the existing PostHog `$device_type` + first-touch `app_store_click` + Meta CAPI install confirmation. If app-attributed, soft-redirect to "Open in App to subscribe."

This applies *only* to subscription. Free product (saves, browsing, GPX-1-free) can be promoted across surfaces freely.

---

## Content Density Strategy

The single biggest existential risk identified by every agent: **122 routes is too thin to support the proposed information architecture without active mitigations.** Six filter dimensions × ~50 trips per popular country produces empty result sets in most combinations. Country pages with three routes look broken.

Five mitigations ship in v1:

1. **Progressive filter disclosure.** Render filter pills only for dimensions that return ≥1 result given the current filter state. As the user narrows, filter dimensions vanish — the user never sees a dropdown that contains nothing. (Pattern: Airbnb's filter chip behavior.)
2. **Empty-state framing.** Zero-result combinations show "No matches yet — these are close" with the closest 3–5 trips by relaxed-filter score. Never a blank page.
3. **`noindex` region and country pages with <8 published trips.** Robots meta tag + omission from sitemap. Prevents Google's thin-content / doorway-page penalties from staining the whole subdomain. Re-index dynamically as content grows.
4. **Launch-country shortlist of 6–8.** US, IT, FR, ES, AT, NO, CH, AR (the ones with ≥10 routes today). Other countries' pages stay live but un-indexed and visually deprioritized in the country grid until they cross the threshold.
5. **"Suggest a route" CTA on thin country pages.** Logged-in users see a prompt to submit a route they've ridden. Doubles as a lightweight content-density solver and authentic engagement loop. (Submitted routes go to an editorial review queue — not auto-published. Out of scope for v1 backend; v1 ships the CTA collecting form responses to a `route_suggestions` table for later editorial work.)

Density is also the reason multi-day builder ships in Track 2: a builder turns one route into N user-customized variants, each shareable as a slug. If 100 Pro users build 5 variants each, the catalog effectively expands to 622 trips — without editorial cost. (Variants stay private by default; users can opt to publish.)

---

## CTA Model: Two Tiers (collapsed from three)

The v2 three-tier (Free / App / Pro) split was rejected by the panel. Replacement model:

### Tier 1 — Free (anonymous + signed-in)
- View any trip detail page in full
- Save to localStorage (anonymous) or `trip_saves` table (auth)
- Share trip URL
- Read first 5 reviews
- Download 1 GPX file per signed-in user per month (was 3)
- Read country / region pages

### Tier 2 — Pro+App ("MotoVault Pro")
- Unlimited GPX downloads
- Multi-day trip builder (drag/drop, fuel-range planner)
- Premium curated collections
- Garmin / TomTom / RideWithGPS one-click export
- Personalized recommendations
- "Pro on the road (in the app)": offline maps, AI diagnostics, live tracking, Garage limits removed, Clone-to-planner, full ride summaries

The trip-detail CTA is presented as a single Pro card with mixed bullets:

> **MotoVault Pro — $X.XX/mo or $XX/yr**
> ✓ Download GPX (unlimited)
> ✓ Build custom multi-day trips
> ✓ Export to Garmin / TomTom / RideWithGPS
> ✓ Premium collections (Andean Crossings, Iceland F-Roads…)
> ✓ Track rides offline in the app
> ✓ AI bike diagnostics in the app
> ✓ Unlimited bikes in your Garage
>
> [Start free trial]

Plus a secondary "Open in app" button below the Pro card for mobile-attributed visitors who should be sent to the native paywall. The "App" features are merchandised as part of Pro, not as a separate path. This eliminates the decision paralysis the panel flagged and makes the value of Pro feel substantive ("look at all this") rather than chopped up.

---

## What's Already Built (Anchor Points)

So the spec is grounded:

- **RevenueCat (mobile)**: `apps/mobile/src/lib/subscription.ts`, single entitlement `REVENUECAT_ENTITLEMENT_PRO = 'MotoWise Pro'` (`packages/types/src/constants/subscription.ts`). Pro feature catalog in `packages/types/src/constants/limits.ts` (`PRO_FEATURES`).
- **RC webhook**: `apps/api/src/modules/webhooks/revenuecat.controller.ts` → `RevenueCatService.processEvent` → Postgres RPC `process_revenuecat_event` (`supabase/migrations/00031_revenuecat_webhook_processing.sql`). Idempotent via `revenuecat_webhook_events`. Fires Meta CAPI `Subscribe`/`StartTrial`.
- **DB columns on `users`**: `subscription_tier`, `subscription_status`, `subscription_expires_at`, `trial_started_at`, `revenuecat_id`.
- **Server entitlements**: `apps/api/src/modules/entitlements/entitlements.service.ts` — defines `READ_FULL_ROUTE`, `READ_ALL_REVIEWS`, `DOWNLOAD_GPX`, `SAVE_ROUTE`. `can()` currently returns `true` for any authenticated user (Phase-1 stub). 2–4 hours to flip to real tier check.
- **Trip data model**: All filter dimensions present — `difficulty (easy|moderate|challenging|expert)`, `surface_type`, `distance_m`, `elevation_gain_m`, `estimated_duration_minutes`, `country_code`, `region_code`, `polyline`. Denormalized `view_count`, `clone_count`, `average_rating`, `review_count`. Search via `search_tsv`.
- **Waypoints**: `trip_waypoints(trip_id, sort_order, type, name, notes, lat, lng, day_index, period_of_day)`. Type enum: `start, end, fuel, food, scenic, overnight, photo, mechanical, ferry, pass_summit, rally_point`.
- **Reviews with text**: `trip_reviews(rating, text 1-500 chars, condition_tags JSONB, bike_id)`. Condition tag vocabulary: *Good Surface, Gravel Hazard, Construction, Low Traffic, Heavy Traffic, Scenic, Technical Curves*.
- **Bike taxonomy**: `motorcycle_type` enum — `cruiser, sportbike, standard, touring, dual_sport, dirt_bike, scooter, other` (`00005`).
- **Public profiles**: `users.handle` (CITEXT UNIQUE, backfilled), `display_name`, `bio`, `city`, `avatar_url`, `is_public`, `show_saved_publicly`, `follower_count`, `following_count` (`00057` + `00097`). View `public_profiles` exposes safe columns to anon; RLS policy `"Anon read public profile by handle"` permits direct lookup. **No new column needed** for curator credit.
- **Mapbox**: `apps/web/src/components/map-hero-interactive.tsx` (mapbox-gl from CDN, v3.21.0). Used on `/route/*`, not yet on `/trips/.../[slug]`. Static fallback in `apps/web/src/lib/map/static-image-provider.ts`.
- **Web Pro shell**: `apps/web/src/app/pro/checkout/page.tsx`, `…/success`, `…/cancel` exist. RC Web Billing key in `.env.example:36`.
- **Analytics**: PostHog (web + mobile) + Meta CAPI (server). Web events relevant: `explore_page_viewed`, `explore_country_viewed`, `explore_region_viewed`, `trip_detail_viewed`, `gpx_download_clicked`, `route_saved_web`, `app_store_click`, `open_in_app_clicked`, `pricing_page_viewed`, `checkout_initiated/completed/cancelled`.
- **Architect verdict**: ~30–50 hours of new engineering beyond what already exists. Biggest single new build is the **elevation chart (~8–16h)**. Everything else is wiring.

---

## Answers to Original Open Questions (Q1–Q10)

(Carried forward from v2 with light edits where the brainstorm sharpened the answer.)

### Q1 — `/trips/*` → App install conversion baseline today
**Answer:** Pull from PostHog week 1. We already fire `trip_detail_viewed` and `app_store_click` (web) plus install attribution via Meta CAPI. Run the funnel `trip_detail_viewed → app_store_click → install_attributed` over the last 60 days, segmented by source (organic / paid / direct). This is also the gate for committing to the +30% target. Owner: data; **week 1**, before any track ships.

### Q2 — Stripe entity setup
**Not relevant.** RevenueCat Web Billing is the path. RC handles tax, invoicing, and entity routing. Web checkout pages already scaffolded. 30-min RC dashboard task to confirm offering grants `MotoWise Pro` on web identical to mobile.

### Q3 — Pro pricing
**Match mobile, don't A/B at launch.** App Store policy guardrail above makes asymmetric pricing unsafe even if it were attractive. Read live RC offerings (`pro_monthly`, `pro_annual` package identifiers) and use them on web verbatim. **The annual plan must include the same ~40% discount vs monthly that's standard in the category** (confirm this is already configured in RC; if not, set it before launch — the 35% annual-share target depends on a meaningful pricing wedge). A/B is a v2 question once we have ≥1k web subs.

### Q4 — Offline maps on web
**Defer to phase 2; offline stays app-only via existing `offline_trips` Pro feature.** Mapbox commercial terms for offline web tiles are pricier than tile reads at our scale. The web "offline" equivalent is the v2 PDF roadbook (now demoted) — replaced for v1 by the multi-day builder which produces shareable, savable trip plans instead.

### Q5 — Photos
**Rider submissions in app first, surface to web in a follow-up.** v1: editorially set `cover_image_url` on the top 50 trips (2 days of curation work, sourced from Unsplash + curator submissions). v2: `trip_photos` table + `trip-photos` Storage bucket + review-time photo upload. Out of v1 implementation scope.

### Q6 — Review text volume
**Data is there; gate on per-trip volume.** `trip_reviews.text` exists 1–500 chars. Render top 5 reviews above the fold; bike name shown inline on each card (per panel C6, replacing the bike-type % bar). For trips with <5 reviews, empty state with "Log a ride in the app to be the first" CTA. No migration needed.

### Q7 — Affiliate partner mix
**Booking.com first with inventory check (per panel OQ-5: show only when inventory exists), curated indie list as v2 fallback for `is_motovault_pick` trips.** EagleRider rentals at trip start point. RevZilla gear (US-first); Touratech as EU expansion when non-US traffic crosses 30%.

### Q8 — "MotoVault Pro" naming
**Keep RC entitlement key `MotoWise Pro`, present as "MotoVault Pro" in UI.** Renaming a live RC entitlement risks breaking subscribers in the wild. Add `PRO_ENTITLEMENT_DISPLAY = 'MotoVault Pro'` constant for UI copy. Cleanup when we can push a version bump that retires legacy app builds.

### Q9 — Curator credit
**Reuse existing public-profile system. No new column.** `public.users.handle` (CITEXT UNIQUE, backfilled), `display_name`, `bio`, `avatar_url`, `is_public` flag, and the `public_profiles` VIEW + anon RLS already exist (`00057` + `00097`). Curator block on trip page = `LEFT JOIN public_profiles ON public_profiles.id = trips.organiser_user_id`. Author page at `/u/[handle]` reads the view. Editorial team uses `motovault-editorial` account with `is_public = true`.

### Q10 — Bike-type taxonomy
**Reuse `motorcycle_type` enum** (cruiser, sportbike, standard, touring, dual_sport, dirt_bike, scooter, other). Suitability lookup table in code, not DB. **Matrix corrected per moto-travel expert review (v3.1):**

| Bike type   | Easy paved | Moderate paved | Mixed | Off-road | Expert mixed |
|-------------|------------|----------------|-------|----------|--------------|
| cruiser     | yes        | yes            | maybe | no       | no           |
| sportbike   | yes        | yes            | no    | no       | no           |
| standard    | yes        | yes            | yes   | maybe    | no           |
| touring     | yes        | yes            | yes   | maybe    | **no** *(was maybe — Gold Wing / heavyweight touring is a hard no on expert mixed; only adventure-touring qualifies, and that's `dual_sport` in our taxonomy)* |
| dual_sport  | yes        | yes            | yes   | yes      | yes          |
| dirt_bike   | **maybe** *(was no — DR650s ride highways across Patagonia; not optimal but functional)* | yes | yes | yes | yes |
| scooter     | yes        | maybe          | no    | no       | no           |
| other       | (no filter)| (no filter)    | (no filter) | (no filter) | (no filter) |

---

## New Open Questions from Brainstorm (OQ-1 to OQ-6)

| # | Question | Resolution path |
|---|---|---|
| OQ-1 | **Flatten trip URLs to `/trips/[country]/[slug]`** (drop `[region]`)? | Pull GSC indexed-page report. If <500 trip URLs indexed, do the redirect now. If >500, keep `[region]` and add canonical tags. **Decision in week 1.** |
| OQ-2 | **What's actual current monthly organic traffic to `/explore` and `/trips/*`?** All revenue math depends on this | PostHog week 1. Same data pull as Q1. |
| OQ-3 | **Ship community "Rider routes" to solve content density?** | Defer. Solve via editorial + progressive disclosure + builder-generated variants first. Revisit at month 4 if density still insufficient. |
| OQ-4 | **Best-season widget: climate heuristic or manual editorial?** | **Manual editorial.** Panel-flagged safety risk: Stelvio in July ≠ Stelvio in October, and the difference is altitude-dependent. Climate-by-region heuristic is unsafe. Add `trips.best_season_months` (INT[] or BITMASK) populated editorially per trip; render heatmap from data. Lightweight migration. |
| OQ-5 | **Booking.com widget: show-if-inventory or always-show?** | **Show-if-inventory.** Panel: "A Booking embed at a remote Patagonia waypoint showing zero results makes the product look broken." Server-side check via Booking affiliate API; render only if ≥1 result. Static cache per (lat, lng, date_range_proxy) for 24h. |
| OQ-6 | **Border crossing info: in-scope or v2?** | **v2.** Highest moto-expert-rated content gap, but it's pure content creation, not engineering. Add to editorial backlog post-v1. v1 ships the data shape (`trips.border_crossings` JSONB) so the surface is ready. |

---

## Single-Shot Implementation Plan (REORDERED per panel)

User direction: **all tasks in one take.** Tracks 1–7 are parallel; the reordering vs v2 puts trip detail + builder first and pushes Pro checkout to land alongside, not before.

### Track 1 — Backend & DB (week 1–2)

| # | Task | Files / migrations |
|---|---|---|
| 1.1 | ~~`users.is_public_curator`~~ — **dropped, reuse existing `is_public` + `handle` + `public_profiles`** | none |
| 1.2 | Flip `EntitlementsService.can(user, 'DOWNLOAD_GPX')` from `true` to actual `subscription_tier === 'pro'` check | `apps/api/src/modules/entitlements/entitlements.service.ts` |
| 1.3 | Resolver: `tripReviews(slug, limit, offset)` returning text + rating + condition_tags + **bike (display name like "Triumph Street Triple R" not aggregated %)** + curator profile | `apps/api/src/modules/trips/trips.resolver.ts` + `.graphql` doc |
| 1.4 | Resolver: `similarTrips(slug, limit)` matching country + difficulty + duration band | same module |
| 1.5 | GPX endpoint: `GET /trips/:slug/gpx.gpx` — generates from polyline + waypoints. Free-tier metering: 1 download/month per signed-in user via existing `user_gating_events`. Pro = unlimited | `apps/api/src/modules/trips/trips.controller.ts` |
| 1.6 | **Blurred GPX preview endpoint**: returns first 3 waypoints + truncated polyline (first 20% of points) for unauthenticated/free users; full file requires auth + Pro | same controller |
| 1.7 | Migration: `trips.best_season_months SMALLINT[]` (1=Jan…12=Dec) — populated editorially | new migration `00118_trips_best_season.sql` |
| 1.8 | Migration: `trips.border_crossings JSONB` (shape only, content is v2) | same migration as 1.7 |
| 1.9 | New table `route_suggestions(id, user_id, country_code, name, description, source_url, status DEFAULT 'pending', created_at)` for the "Suggest a route" CTA on thin country pages | new migration `00119_route_suggestions.sql` |
| 1.10 | Confirm RC Web Billing offering grants `MotoWise Pro` (RC dashboard) | RC console |
| 1.11 | Webhook telemetry: add `purchase_source: 'web'\|'ios'\|'android'` attribute to PostHog event fired from RC webhook | `apps/api/src/modules/webhooks/revenuecat.service.ts` |
| 1.12 | **Attribution gate** for `/pro/checkout`: lambda returns `is_app_attributed: bool` based on PostHog cohort + Meta CAPI; web checkout page checks before allowing flow | new `apps/web/src/lib/attribution.ts` |
| 1.13 | Audit `discover_trips` → unified `trips` migration completion — confirm all routes live in `trips` | data team |

### Track 2 — Trip detail upgrade + Multi-day builder (week 1–4) **TWO PARALLEL STREAMS, SHIP TOGETHER**

#### Track 2A — Trip detail
| # | Task | Files |
|---|---|---|
| 2A.1 | Replace static map with `MapHeroInteractive` (already exists on `/route/*`); pass polyline + waypoints + layer toggles (fuel/lodging/photo/scenic/overnight/pass_summit) | port `apps/web/src/components/map-hero-interactive.tsx` to `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx` |
| 2A.2 | **ElevationProfile component** (Chart.js, biggest new build per architect — 8–16h). Annotate pass names + summit altitude inline. Hover tooltip shows distance/elevation/grade | new `apps/web/src/components/elevation-profile.tsx` |
| 2A.3 | Render review text — top 5 above fold; **bike name inline on each card (not aggregated %)**; "Read all (count)" gated to sign-in | new `apps/web/src/components/trip-reviews-section.tsx` |
| 2A.4 | **Social proof block**: "X riders saved this · Y cloned this route · Last ridden Z weeks ago" — pulled from `view_count`, `clone_count` (existing denormalized), latest `trip_reviews.created_at` | new `apps/web/src/components/trip-social-proof.tsx` |
| 2A.5 | **Best-season heatmap** (12-month strip) — reads `trips.best_season_months` from track 1.7 | new `apps/web/src/components/trip-best-season.tsx` |
| 2A.6 | Cover image hero (`trips.cover_image_url`, fallback to existing static map) | same page |
| 2A.7 | Curator credit block — `LEFT JOIN public_profiles ON public_profiles.id = trips.organiser_user_id`; render avatar + display_name + link to `/u/[handle]` when row present | new `apps/web/src/components/trip-curator-credit.tsx` |
| 2A.8 | New page `apps/web/src/app/u/[handle]/page.tsx` — public author page reading from `public_profiles` view; lists user's published trips, reviews, public saves | new file |
| 2A.9 | **Two-tier CTA card** ("MotoVault Pro" with mixed Pro+App bullets, single "Start free trial" button) | new `apps/web/src/components/trip-cta-stack.tsx` |
| 2A.10 | **Blurred GPX preview**: small map showing first 20% of route + first 3 waypoints, with "Unlock full GPX with Pro" overlay | embedded in CTA component |
| 2A.11 | Similar trips footer (4–6 cards by country + difficulty + duration band) | reuse existing trip card |
| 2A.12 | Sticky mobile app CTA (deep-link to `motovault://trips/[slug]`); dismissable; respects safe-area; **app-attributed users see this prominent, web-organic users see Pro card prominent** | new `apps/web/src/components/sticky-app-cta.tsx` |
| 2A.13 | **Schema additions**: full `TouristTrip` (already partial); `BreadcrumbList`; `FAQPage` populated from auto-generated Q&A ("Best season for…", "How long does … take?", "What bike for …?") | `apps/web/src/app/trips/[country]/[region]/[slug]/page.tsx` |

#### Track 2B — Multi-day builder (Pro anchor — **ship at v1 launch, not phase 2**)
| # | Task | Files |
|---|---|---|
| 2B.1 | New page `/builder` — Pro-gated; soft-prompt sign-up + Pro upgrade for free users | new `apps/web/src/app/builder/page.tsx` |
| 2B.2 | Drag-and-drop waypoints onto a route polyline; reorder; assign to `day_index` | new components in `apps/web/src/components/builder/*` |
| 2B.3 | Fuel-range planner: takes `motorcycle_type` from user's primary bike (Garage), uses heuristic range table (lookup in code, not DB), surfaces "Add fuel stop here" warnings when consecutive waypoints exceed range | same |
| 2B.4 | Save as user-owned trip via existing `trips` table (`is_template=false`, `organiser_user_id=current`, default `status='draft'`) | existing `trips` table; reuse mutation |
| 2B.5 | Share builder output via existing `trip_share_tokens` (already in `00086`) | existing |
| 2B.6 | Export builder output to GPX (same endpoint as track 1.5) | existing |
| 2B.7 | "Start from this trip" CTA on every trip detail page that opens the builder pre-populated with the trip's waypoints (Pro-gated) | trip detail CTA stack |

### Track 3 — Web `/explore` upgrade (week 2–4, parallel)

| # | Task | Files |
|---|---|---|
| 3.1 | **Filter panel with progressive disclosure**: Difficulty · Surface · Distance range · Duration · Best season · Bike type. Filter pills only render for dimensions with ≥1 result given current state | new `apps/web/src/components/explore-filters.tsx` |
| 3.2 | Sort dropdown: Top rated · Most ridden · Distance ↑/↓ · Recently added | embedded in filters |
| 3.3 | Map view toggle (List/Map) — Mapbox GL, polylines colored by difficulty, viewport-driven list, **clustering for >50 polylines in viewport** | new `apps/web/src/components/explore-map-view.tsx` |
| 3.4 | **Anonymous save (localStorage)** + sync to `trip_saves` on auth | new `apps/web/src/lib/anonymous-saves.ts` + update `apps/web/src/components/save-route-button.tsx` |
| 3.5 | **Email capture modal** triggered at save #2 or #3: "Keep your saves across devices — drop your email" → creates passwordless magic-link account via Supabase Auth | new `apps/web/src/components/anon-email-capture-modal.tsx` |
| 3.6 | `/saved` page rendering anonymous + auth saves merged | new `apps/web/src/app/saved/page.tsx` |
| 3.7 | "Continue planning" rail above fold for users with ≥1 saved (anon or auth) | update `apps/web/src/app/explore/page.tsx` |
| 3.8 | Replace hardcoded "2,340 routes" curated counts with real aggregates | same page |
| 3.9 | Server-side filter args on `TripTemplatesDocument` (already exists per architect — verify and extend) | `apps/api/src/modules/trips/trips.resolver.ts` |
| 3.10 | **Empty-state framing** — zero-result combination shows "No matches yet — closest 3" with relaxed-filter score | filter component |
| 3.11 | **Exit-intent save prompt** ("You viewed 3 routes — save them?") | new `apps/web/src/components/exit-intent-prompt.tsx` |
| 3.12 | **Canonical tags on filtered URL states** — any `/explore?difficulty=...&surface=...` URL emits `<link rel="canonical" href="/explore">` (or `/explore/[country]` when country-scoped). Prevents filter permutations from creating duplicate content in Google's index | `apps/web/src/app/explore/page.tsx` + `apps/web/src/app/explore/[country]/page.tsx` |

### Track 4 — Country & region pages (week 3–5, parallel)

| # | Task | Files |
|---|---|---|
| 4.1 | Migration: `countries.editorial_md TEXT` + `countries.has_sufficient_routes BOOLEAN GENERATED` (computed: `published_route_count >= 8`) | new migration `00120_country_editorial.sql` |
| 4.2 | Editorial intro module rendered per country (top 6–8 only at launch: US, IT, FR, ES, AT, NO, CH, AR) | `apps/web/src/app/explore/[country]/page.tsx` |
| 4.3 | **Robots meta `noindex` on countries with `has_sufficient_routes = false`** + omission from sitemap | same page + `apps/web/src/app/sitemap.ts` |
| 4.4 | Country-level interactive map (all routes in country, clustered) | reuse `explore-map-view.tsx` |
| 4.5 | Same filter panel, country-scoped | reuse |
| 4.6 | **"Suggest a route in [Country]" CTA** on thin country pages — writes to `route_suggestions` (track 1.9) | new component |
| 4.7 | Best-season heatmap (months × top regions) | new component |
| 4.8 | "Riders also explored" cross-link footer | new component |
| 4.9 | Two CTAs near hero: "Plan a trip in [Country] (Builder)" + "Open in app" | new component |
| 4.10 | Same structure for `/explore/[country]/[region]`; **noindex region pages with <8 routes** | parallel page |
| 4.11 | **FAQ + BreadcrumbList schema** on country and region pages | both |

### Track 5 — Pro web activation (week 3–5)

| # | Task | Files |
|---|---|---|
| 5.1 | Wire `/pro/checkout` to RC Web Billing SDK with `pro_monthly` / `pro_annual` packages (same identifiers as mobile) | `apps/web/src/app/pro/checkout/page.tsx` |
| 5.2 | Post-purchase: RC webhook (already wired) writes `subscription_tier=pro`; success page polls `/api/me` until tier reflects | `apps/web/src/app/pro/success/page.tsx` |
| 5.3 | **Attribution gate** before checkout: if app-attributed, soft-redirect to "Open in App to subscribe" — see App Store Policy Guardrail above | uses track 1.12 |
| 5.4 | Pro feature unlocks on web: GPX download (unlimited), builder access, Garmin/TomTom/RideWithGPS export | trip page CTA + builder page |
| 5.5 | Garmin / TomTom / RideWithGPS export via same GPX endpoint, different content-disposition / format hints | trips controller |
| 5.6 | `/pricing` page updates: one Pro tier across surfaces, "What you unlock on web" + "What you unlock in the app" callouts (within Pro card, not separate tiers) | `apps/web/src/app/pricing/page.tsx` |
| 5.7 | Free GPX download metering: 1/month per signed-in user via `user_gating_events` (existing pattern from mobile) | trips controller |

### Track 6 — Affiliate (week 5–6)

| # | Task | Files |
|---|---|---|
| 6.1 | Booking.com affiliate signup + ID provisioning | partnerships task |
| 6.2 | **Booking.com widget with inventory pre-check** at each `overnight` waypoint — server-side check, render only if ≥1 result, 24h cache | new `apps/web/src/components/trip-lodging-widget.tsx` |
| 6.3 | EagleRider rental CTA at trip start point | same component family |
| 6.4 | **RevZilla gear affiliate** placement on trip pages (US-only initially) — bike-type-targeted gear recommendations | new `apps/web/src/components/trip-gear-widget.tsx` |
| 6.5 | Affiliate click tracking → PostHog `affiliate_click` event with partner/waypoint/bike-type context | analytics |

### Track 7 — Analytics & instrumentation (week 1–2 + ongoing)

| # | Task | Files |
|---|---|---|
| 7.1 | **Pull baseline funnel** `trip_detail_viewed → app_store_click → install` (last 60d) — answers Q1 + OQ-2 | data team |
| 7.2 | Add events: `filter_applied`, `sort_changed`, `map_view_toggled`, `route_saved_anonymous`, `email_captured_post_save`, `gpx_download_attempted`, `gpx_preview_shown`, `pro_cta_clicked`, `builder_opened`, `builder_saved`, `affiliate_click`, `exit_intent_save_shown`, `exit_intent_save_taken` | `apps/web/src/lib/analytics.ts` |
| 7.3 | PostHog dashboards: Explore Engagement · Trip Detail Engagement · Pro Funnel (web) · Pro Funnel (app) · Affiliate revenue · Anon-save email-capture funnel · Builder usage | PostHog console |
| 7.4 | Survey hook on `gpx_download_attempted` for free users to understand willingness-to-pay | analytics + existing `posthog-survey-tracking-plan` |
| 7.5 | **Cohort definition for app-attributed users** (used by attribution gate, track 1.12) | PostHog console |

### Track 8 — SEO guides content layer (week 3–6, parallel)

The SEO panel's strongest recommendation: at 122 routes, product pages alone cannot generate the organic traffic the revenue math requires. Informational queries ("best motorcycle routes in Europe", "motorcycle trip packing list", "riding in Patagonia guide") drive 60–80% of organic traffic in travel verticals. Five long-form guides at launch create the top-of-funnel that feeds the explore → trip → convert pipeline.

| # | Task | Files |
|---|---|---|
| 8.1 | New route `/guides/[slug]` with MDX rendering, `BreadcrumbList` + `Article` schema, internal links to relevant `/trips/*` and `/explore/[country]` pages | new `apps/web/src/app/guides/[slug]/page.tsx` |
| 8.2 | `/guides` index page listing all published guides, sorted by recency | new `apps/web/src/app/guides/page.tsx` |
| 8.3 | Guide content storage: MDX files in `apps/web/src/content/guides/` (git-tracked, no CMS in v1) | new directory |
| 8.4 | **Launch set — 5 guides** (editorial, not AI-generated; target 1,500–2,500 words each with embedded trip cards): | content team |
|     | (a) "Best Motorcycle Routes in Europe — 2026 Guide" | links to IT, FR, ES, AT, NO, CH trips |
|     | (b) "Motorcycle Trip Planning: The Complete Checklist" | links to builder, GPX, gear |
|     | (c) "Patagonia by Motorcycle: Routes, Seasons & Border Crossings" | links to AR trips |
|     | (d) "Alpine Passes: The Definitive Riding Guide" | links to AT, CH, IT mountain trips |
|     | (e) "What Bike for What Route? A Rider's Guide to Surface & Difficulty" | links to bike-type filter, suitability matrix |
| 8.5 | Internal linking: every trip detail page gets a "Related guides" section if a guide references that trip; every country page links to relevant guides | trip detail page + country page |
| 8.6 | Sitemap inclusion for `/guides/*` | `apps/web/src/app/sitemap.ts` |

---

## Requirements (consolidated)

All P0 — single-shot. Anything not listed is out of scope.

| ID | Requirement | Acceptance criteria |
|---|---|---|
| R1 | Explore filter panel with progressive disclosure | Six filter dimensions; pills hide when current state would zero them out; URL state synced; result count updates live; **filtered URLs carry `<link rel="canonical">` pointing to the unfiltered parent page** to prevent duplicate content indexing |
| R2 | Explore map view with clustering | Toggle list/map; Mapbox; polylines colored by difficulty; viewport-driven list; clusters above 50 polylines |
| R3 | Explore sort | Top rated / Most ridden / Distance ↑/↓ / Recently added; default Top rated |
| R4 | Anonymous save | localStorage write; soft sign-in prompt on first save; on auth, migrate to `trip_saves` |
| R5 | Email capture at save #2-3 | Modal triggers at second or third save event; passwordless magic-link Supabase Auth flow; conversion event fires |
| R6 | Exit-intent save prompt | Triggered after 3+ trip card views; "Save these routes — drop email" |
| R7 | Country page editorial intro (top 6–8 launch countries) | `countries.editorial_md` rendered as markdown; thin countries `noindex`'d |
| R8 | Country/region `noindex` for thin pages | Robots meta + sitemap exclusion when `published_route_count < 8` |
| R9 | "Suggest a route" CTA on thin country pages | Writes to `route_suggestions` table for editorial review |
| R10 | Country page best-season heatmap | Months × Top regions grid from manually-edited `trips.best_season_months` |
| R11 | Country page interactive map | Mapbox renders all routes in country |
| R12 | Trip detail interactive map | `MapHeroInteractive` ported with full polyline + waypoints + layer toggles |
| R13 | Trip detail elevation profile | Chart.js line chart with hover tooltip; pass names + summit altitude annotated inline |
| R14 | Trip detail review text with bike names | Top 5 reviews rendered with text, rating, condition_tags, **bike name inline (e.g., "Triumph Street Triple R")**, ride date; "Read all" gated to sign-in |
| R15 | Trip detail social proof | "X viewed · Y cloned · Last ridden Z weeks ago" — sourced from `view_count`, `clone_count`, latest `trip_reviews.created_at` |
| R16 | Trip detail similar trips | 4–6 cards by country + difficulty + duration band |
| R17 | Trip detail curator credit | When `public_profiles` row exists for `organiser_user_id`, render avatar + display_name + link to `/u/[handle]` |
| R17b | Public author page `/u/[handle]` | Reads from `public_profiles` view; lists user's published trips, reviews, public saves; SEO-indexable |
| R18 | Two-tier CTA card on trip detail | Single Pro card with mixed bullets (Pro web + Pro app features); secondary "Open in app" for mobile-attributed |
| R19 | Blurred GPX preview | First 3 waypoints + 20% polyline visible; "Unlock with Pro" overlay |
| R20 | RC web checkout → Pro entitlement | Web checkout → RC webhook → `users.subscription_tier='pro'` → web Pro features enabled within 60s |
| R21 | Attribution-aware checkout gate | App-attributed users soft-redirected to "Open in App to subscribe"; web-organic users see web checkout |
| R22 | GPX download (Pro) | Server endpoint generates valid GPX from polyline + waypoints; free quota = 1/month/user, Pro = unlimited |
| R23 | Multi-day trip builder (Pro anchor — ships at v1 launch) | Drag/drop waypoints; fuel-range planner; save to `trips`; share via `trip_share_tokens`; export GPX; "Start from this trip" CTA on detail page |
| R24 | Garmin / TomTom / RideWithGPS export | Same GPX endpoint, format hints; Pro-gated |
| R25 | Booking.com lodging widget (inventory-checked) | Renders only when ≥1 result; 24h cache; affiliate ID present |
| R26 | EagleRider rental CTA | At trip start point |
| R27 | RevZilla gear placement (US-first) | Bike-type-targeted; affiliate disclosure visible |
| R28 | Sticky mobile app CTA | Deep-link to `motovault://trips/[slug]`; dismissable; safe-area respected |
| R29 | Schema additions | Full `TouristTrip` (existing) + `FAQPage` (auto-generated Q&A) + `BreadcrumbList` on every trip / country / region page |
| R30 | Curator opt-in | No new flag — reuse existing `users.is_public` toggle from Settings → Profile |
| R31 | Analytics events + dashboards | All events from Track 7.2 firing; dashboards live before launch |
| R32 | App Store policy compliance | No web-checkout promotion to app-attributed users in any surface (in-app, email, paid retargeting) |
| R33 | SEO guides content layer | 5 long-form guides at launch; `/guides/[slug]` route with MDX; `Article` + `BreadcrumbList` schema; internal links to trips + country pages; sitemap included |
| R34 | Canonical tags on filtered URLs | All `/explore` and `/explore/[country]` filter-state URLs emit `<link rel="canonical">` to unfiltered parent |

---

## Success Metrics

### Leading (weekly post-launch)

| Metric | Baseline | Target (90d) | Stretch |
|---|---|---|---|
| Filter usage rate (sessions applying ≥1 filter) | 0% | 35% | 50% |
| `/explore` → trip-detail CTR | TBD week 1 | +25% | +40% |
| Anonymous save events / session | 0 | 0.4 | 0.7 |
| Email captured per anon save | 0% | 12% | 20% |
| App install rate from `/trips/*` | TBD week 1 | +30% | +50% |
| Pro web checkout-initiated rate (engaged trip sessions) | 0% | 3% | 5% |
| Builder open rate (Pro users / month) | n/a | 40% | 60% |
| GPX download events / Pro user / month | n/a | 6 | 12 |
| Blurred GPX preview → Pro CTR | 0% | 8% | 15% |

### Lagging (6-month evaluation)

| Metric | Target |
|---|---|
| Pro web paid conversion of engaged `/trips/*` sessions | ≥1.5% (was 2% in v2) |
| Pro M1 retention (web) | ≥80% |
| Pro annual share of new web subs | ≥35% |
| Trip-detail bounce rate | −25% vs baseline |
| Affiliate revenue / month | ≥$2K by month 6 (was $3K) |
| **Pro web MRR by month 6** | **≥$5K** (was $15K — recalibrated) |
| **Pro web MRR by month 12** | **≥$15K** |
| `/explore/[country]` organic traffic (top 6–8 countries) | +60% YoY |
| Indexed thin pages (regions <8 routes) | 0 (`noindex` enforced) |
| App Store policy compliance (web-promo to app users) | 0 incidents |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Content density** — 122 routes feels thin under filters | Progressive disclosure (R1), `noindex` thin pages (R8), launch-country shortlist, builder-generated variants, "Suggest a route" CTA, **5 long-form guides (R33) drive top-of-funnel organic traffic that product pages alone cannot generate** |
| **App Store review** flags web-checkout funneling | Strict attribution gate (R21), no in-app web-promo (R32), identical web/mobile pricing |
| Web Pro cannibalizes mobile installs | One sub, both surfaces — paying web users *are* Pro app users; track combined ARPU not per-surface |
| Reviews look thin on long-tail trips | Empty state with "be first" CTA; seed 5–10 reviews on top 50 trips before launch |
| RC web entitlement misconfigured grants free Pro | RC Web Billing test mode + staging webhook + manual entitlement audit before flipping production |
| `MotoWise Pro` legacy entitlement key confuses ops | Document in `CLAUDE.md`; ship `PRO_ENTITLEMENT_DISPLAY` constant for UI |
| Mapbox cost spike from interactive map | Clustering above 50 polylines (R2); Mapbox alerting at 50% of free tier |
| Booking.com inventory weak in remote spots | Show-if-inventory only (R25); curated indie list as v2 fallback |
| Climate-by-region "best season" gives unsafe advice | Manual editorial `best_season_months` (OQ-4) — no algorithmic heuristic |
| Email-capture modal feels spammy | Trigger at save #2-3 (proven engagement), not save #1; dismissable; honor "no thanks" with localStorage flag |
| Builder produces unsharable / low-quality user trips | Default `status='draft'`; published variants require explicit user opt-in; no auto-publishing |
| GPX-1-free quota too tight, drives churn instead of conversion | Track GPX denial events in week 1-2; willingness-to-pay survey on denial; relax to 2/mo if conversion <1% at month 2 |

---

## Document History

- **v1 (2026-05-03)** — Initial draft based on web audit only.
- **v2 (2026-05-03)** — Codebase audit complete; 10 questions answered; phased plan collapsed to single-shot; aligned with existing `MotoWise Pro` RC entitlement; replaced Stripe assumption with RC Web Billing.
- **v3 (2026-05-03)** — 5-agent panel review integrated. Three-tier CTA → two-tier (Pro+App). MRR target recalibrated ($5K m6, $15K m12). PDF roadbook deferred to v2; multi-day builder elevated to launch track. Bike-type % bar → bike names on review cards. Added: blurred GPX preview, email capture at save #2-3, content density safeguards (progressive disclosure, noindex thin pages, launch-country shortlist), App Store policy guardrail with attribution-aware checkout gate, schema additions (FAQ, BreadcrumbList), social proof block, "Last ridden" badge, manual editorial best-season data, Booking.com inventory check, RevZilla gear affiliate. Six new open questions surfaced (OQ-1 through OQ-6).
- **v3.1 (2026-05-03)** — Cross-check patch. Added Track 8: `/guides/` SEO content layer (5 long-form articles at launch — SEO panel flagged this as the organic traffic engine the revenue math depends on). Corrected bike-type suitability matrix (touring/expert-mixed → no; dirt_bike/easy-paved → maybe). Added canonical tags on filtered URL states (R34). Fixed social proof data source ("Y cloned" replaces "Y planning this month" which had no backing metric). Added annual pricing wedge note to Q3.
