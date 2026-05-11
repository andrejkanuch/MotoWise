# Brainstorm: Explore Funnel & Monetization Strategy

**Date:** 2026-05-03
**Status:** Brainstorm complete — ready for plan
**Input:** PRD v2 (`docs/specs/explore-monetization-prd.md`)
**Method:** 5-agent parallel review (Monetization Strategist, Motorbike Travel Expert, Software Architect, Growth PM, SEO Content Strategist)

---

## What We're Building

Activate the existing `MotoWise Pro` entitlement on web, upgrade `/explore` with real filters + map view, enrich `/trips/[slug]` detail pages with interactive map + reviews + elevation, and turn country pages into destination guides — all driving toward Pro subscription conversion and app installs.

---

## Agent Panel Summary

| Agent | Grade/Verdict | #1 Concern |
|---|---|---|
| Monetization Strategist | Sound architecture, aggressive targets | $15K MRR requires 75K engaged sessions/mo — likely 12-18mo, not 6 |
| Motorbike Travel Expert | "Would use trip detail + builder, wouldn't pay for GPX/PDF" | 122 routes will feel emptier with filters, not richer |
| Software Architect | Codebase validates 90%+ of PRD claims | Elevation chart is biggest new-build (~8-16hrs); everything else is wiring |
| Growth PM (ex-AllTrails/Komoot) | Funnel grade: B+ | No re-engagement loop for anonymous savers; content density is existential |
| SEO Content Strategist | URL structure solid, schema underutilized | Thin region pages at 122 routes risk doorway-page penalties |

---

## Consensus Findings (All 5 Agents Agree)

### 1. Content Density Is the #1 Existential Risk

Every agent flagged 122 routes as insufficient to support the proposed filter/map/country-page infrastructure. With 6 filter dimensions, most combinations return 0-3 results. Country pages with 3-8 routes look embarrassing, not authoritative.

**Decisions needed:**
- Progressive disclosure: hide filter dimensions that return zero results per-country
- `noindex` region pages with <8 routes
- Gate thin countries behind "Coming soon" rather than showing sparse pages
- Consider community-submitted "Rider routes" (unverified) alongside curated "MotoVault Picks" to inflate density
- Prioritize 6-8 countries with 10+ routes for launch

### 2. Three-Tier CTA Creates Decision Paralysis

The Free / App / Pro split forces riders to understand three value propositions simultaneously. "Offline" (App tier) vs "GPX download" (Pro tier) confuses riders wanting the same outcome — riding the route without signal.

**Decision:** Collapse to **two tiers**: Free (view/save/share) and Pro+App (everything else). App-only features shown as "Pro includes..." bullets, not a separate lane.

### 3. Revenue Targets Need Recalibration

$15K web MRR by month 6 requires ~1,500 paying web subscribers at ~$10/mo = 75,000 engaged sessions/month. At 122 routes, that's 615 engaged sessions per route per month — aggressive for a motorcycle niche.

**Decision:** Target $5K MRR by month 6, $15K by month 12. Validate with actual PostHog traffic data in week 1 before committing.

### 4. No Value Preview Before the Pro Gate

AllTrails shows blurred GPX preview + partial elevation. Komoot shows first 2km of turn-by-turn. MotoVault gates GPX/PDF with zero preview — riders who've never exported GPX have no reason to pay.

**Decision:** Add "Preview GPX" showing first 3 waypoints + truncated elevation profile with Pro unlock overlay. Add a sample PDF roadbook for one flagship trip.

### 5. Technical Foundation Is Solid

The software architect verified that 90%+ of PRD claims match the codebase:
- `EntitlementsService.can()` returns `true` for all users (confirmed) — flipping to Pro check is 2-4 hours
- Trip data model has all fields needed for filters + elevation
- `MapHeroInteractive` exists, well-isolated, ready to port (4-6 hours)
- RevenueCat webhook pipeline is solid (HMAC, idempotency, Meta CAPI)
- GraphQL filter inputs already exist server-side — just no UI
- `trip_reviews` has text + condition_tags + bike_id (confirmed)

**Biggest new-build:** Elevation chart component (~8-16 hours). Everything else is integration work.

---

## Divergent Opinions (Agent Disagreements)

### PDF Roadbook: Kill or Keep?

- **Moto Travel Expert:** "Who prints roadbooks in 2026? Cut to v2." Target of 2 downloads/user/month is aspirational. Rally riders get theirs from organizers; touring riders use phone mounts.
- **Monetization Strategist:** Keeps it but doesn't flag it as high-value.
- **Growth PM:** Doesn't mention it as a conversion driver.

**Recommendation:** Demote PDF roadbook to v2. It's engineering effort for ~2% of Pro users. The multi-day builder is the real Pro anchor.

### Multi-Day Builder: When to Ship?

- **Moto Travel Expert:** "This is your actual killer Pro feature — but it's buried as item 5.4. Lead with this, not GPX/PDF."
- **Monetization Strategist:** Doesn't call it out specifically.
- **Growth PM:** Comparison/list-building features drive engagement depth that converts.

**Recommendation:** Elevate the builder to Track 2 (parallel with trip detail), not Track 5 (week 4-6). It's the Pro conversion anchor — ship it early.

### Bike-Type Breakdown Bar

- **Moto Travel Expert:** "Riders don't think in percentages. A single review saying 'Did this on a Street Triple, tight but doable' is worth more than any chart."
- **Growth PM:** Social proof signals like "347 riders saved this route" are more effective.

**Recommendation:** Replace the percentage bar with bike names shown inline on each review card. Surface save/view/clone counts as social proof instead.

---

## New Ideas From the Panel

### High-Value Additions (Recommended for v1)

| Idea | Source | Effort | Impact |
|---|---|---|---|
| **Blurred GPX preview + Pro overlay** | Monetization + Growth | Low | Highest-ROI conversion lever |
| **Email capture at save #2-3** ("Keep saves across devices") | Growth PM | Low | Re-engagement channel for anon savers |
| **FAQ schema on every trip + country page** | SEO | Low | PAA box captures, zero editorial effort |
| **`TouristTrip` schema markup** | SEO | Low | Almost no moto site uses this; Google supports it |
| **Social proof: "X riders saved this" / "Y riders planning this month"** | Growth PM | Low | Already have view_count + clone_count |
| **"Last ridden: 3 weeks ago" badge on trip cards** | Moto Expert | Low | Makes condition tags trustworthy |
| **Pass names + open-season labeled on elevation profile** | Moto Expert | Medium | "Stelvio Pass (2,757m) - June-Oct" is planning gold |
| **BreadcrumbList schema on every page** | SEO | Trivial | 20-30% SERP CTR improvement |

### Medium-Value Additions (Consider for v1, OK for v2)

| Idea | Source | Effort | Impact |
|---|---|---|---|
| **Flatten trip URLs to `/trips/[country]/[slug]`** — drop `[region]` | SEO | Medium (redirects) | Simpler, fewer redirect debt long-term |
| **Border crossing info for international routes** | Moto Expert | Medium (content) | #1 thing riders research before multi-country trips |
| **5-10 long-form guides** ("/guides/best-motorcycle-routes-europe") | SEO | High (content) | 60-80% of organic traffic comes from informational queries |
| **Exit-intent save prompt** ("You viewed 3 routes — save them?") | Growth PM | Low | Standard in travel, measurable lift |
| **"Suggest a route" CTA on thin country pages** | Growth PM | Low | Turns content gap into engagement |
| **RevZilla gear affiliate placement** | Monetization | Medium | Mentioned in PRD but has no implementation task |

### Deferred (v2+)

| Idea | Source | Reason to Defer |
|---|---|---|
| **Cell coverage overlay on map** | Moto Expert | Data source complexity |
| **Luggage/load impact on difficulty** | Moto Expert | Requires new data model |
| **Browser push notifications for anon savers** | Monetization | Low opt-in rates; email capture first |
| **Multilingual content (ES, PT, DE)** | SEO | URL structure should not block it, but not v1 |
| **Community route submissions** | Growth PM | Needs moderation pipeline; solve content density differently first |

---

## Key Decisions Made

1. **Two-tier CTA, not three.** Free (view/save/share) vs Pro+App (everything else).
2. **MRR target: $5K by month 6**, $15K by month 12.
3. **Reduce free GPX quota from 3/month to 1/month.** Enough to taste, tight enough to convert.
4. **Demote PDF roadbook to v2.** Builder is the real Pro anchor.
5. **Elevate multi-day builder to earlier track.** Ship as the Pro conversion anchor.
6. **Replace bike-type % bar with bike names on review cards.** Real rider context > aggregated stats.
7. **Add blurred GPX preview + Pro overlay.** Highest-ROI conversion hook.
8. **Add email capture at save #2-3.** Re-engagement for anonymous savers.
9. **`noindex` region pages with <8 routes.** Prevent thin content penalties.
10. **Add FAQ + TouristTrip + BreadcrumbList schema.** Low-effort SEO wins.

---

## Open Questions

| # | Question | Context |
|---|---|---|
| OQ-1 | **Should we flatten trip URLs to `/trips/[country]/[slug]`?** SEO agent recommends dropping `[region]` to reduce redirect debt. But existing indexed pages may need 301s. How many trip pages are currently indexed? | SEO risk vs migration cost |
| OQ-2 | **What's the actual current monthly organic traffic to `/explore` and `/trips/*`?** Revenue math depends on this. All agents need this number to validate targets. | Pull from PostHog week 1 |
| OQ-3 | **Should we ship community "Rider routes" to solve content density?** Growth PM recommends it (Wikiloc bootstrapped this way). But it requires moderation, quality control, and UX for submission. | Content density vs quality bar |
| OQ-4 | **Best-season widget: climate heuristic or manual editorial?** Moto expert warns climate-by-region is "dangerously incomplete without altitude data" — Stelvio in July vs October is life-or-death. Heuristic could give bad advice. | Safety vs automation |
| OQ-5 | **Booking.com widget: show-if-inventory or always-show?** Moto expert: "A Booking.com embed at a remote waypoint in Patagonia showing zero results makes the product look broken." | UX polish vs implementation complexity |
| OQ-6 | **Border crossing info: in-scope or v2?** Moto expert says it's the #1 thing riders research for multi-country routes. But it's a content creation effort, not a code task. | Content scope |

---

## Technical Readiness (Architect Summary)

| Component | Status | Effort to Ship |
|---|---|---|
| Entitlements Pro gating | Flip `can()` from `true` to tier check | 2-4 hrs |
| Trip data model (filters, elevation, surface) | All fields exist | 0 (done) |
| MapHeroInteractive on trip detail | Component ready, not wired | 4-6 hrs |
| RevenueCat webhook pipeline | Solid, battle-tested | 0 (done) |
| GraphQL filter inputs | Backend exists, no UI | 6-10 hrs (UI build) |
| Trip reviews (text + tags + bike) | Full schema + RLS | 0 (done) |
| Elevation chart | **Not built** — biggest gap | 8-16 hrs |
| Polyline decoder | Library import needed | 1-2 hrs |
| Data migration (discover_trips -> trips) | Needs audit | 2-4 hrs validation |

**Total new engineering for v1 core:** ~30-50 hours of backend/frontend work beyond the PRD's existing estimates.

---

## Revised Track Priorities

Based on agent feedback, suggested reordering:

1. **Week 1:** Pull PostHog traffic baseline (validates all targets). Audit data migration. Import polyline decoder.
2. **Week 1-2:** Trip detail upgrade (interactive map, elevation chart, reviews with bike names, social proof counts, blurred GPX preview). This is the conversion surface — ship it first.
3. **Week 2-3:** Multi-day builder (Pro anchor feature). Ship alongside trip detail so Pro has a reason to exist at launch.
4. **Week 2-3:** Explore filters UI (progressive disclosure, hide zero-result dimensions) + map view. Backend already done.
5. **Week 3-4:** Pro checkout (RC Web Billing) + entitlements flip + GPX endpoint. Gate on builder + GPX, not PDF.
6. **Week 3-5:** Country pages (editorial for top 6-8 countries only, `noindex` the rest). FAQ + TouristTrip schema.
7. **Week 5-6:** Affiliate integration (Booking.com with inventory check, EagleRider). Analytics instrumentation.
8. **v2:** PDF roadbook, community routes, border crossing info, multilingual, remaining country pages.

---

## Store Policy Guardrail (Monetization Agent Flag)

RC Web Billing avoids Apple/Google's 30% cut. The PRD must explicitly document:

> **Policy constraint:** Web checkout must never be promoted to users who arrived via the mobile app or app-attributed channels. No "subscribe on web for cheaper" messaging. No email funnels to web checkout for existing app users. Violation risks App Store review rejection.

---

## Next Steps

Run `/ce:plan` to convert this brainstorm into an implementation plan with task dependencies, file-level assignments, and test criteria.
