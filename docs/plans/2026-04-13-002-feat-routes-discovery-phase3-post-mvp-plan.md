---
title: "feat: Routes Discovery Phase 3 — Post-MVP"
type: feat
status: active
date: 2026-04-13
---

# Routes Discovery Phase 3 — Post-MVP

## Overview

25 tickets across 7 epics building on the Phase 1 MVP foundation. Phase 3 adds freemium gating enforcement, saved routes with lists, interactive maps with elevation sync, GPX download flow with quotas, moto-specific differentiation features, Pro subscription plumbing (RevenueCat/Stripe), and mobile search parity.

## Dependency Graph & Wave Execution

```
WAVE A ─┬─ MOT-157 (mobile search) ◄─ MOT-155 ✅
         ├─ MOT-166 (resolver gating) ◄─ MOT-165 ✅
         ├─ MOT-167 (paywall modal) ◄─ MOT-165 ✅
         ├─ MOT-169 (users.handle) ◄─ MOT-153 ✅
         ├─ MOT-174 (static map polish) ◄─ MOT-159 ✅
         ├─ MOT-178 (GPX entitlement) ◄─ MOT-165 ✅
         └─ MOT-183 (surface reports) ◄─ none

WAVE B ─┬─ MOT-168 (review soft-wall) ◄─ MOT-166
         ├─ MOT-170 (route_lists table) ◄─ MOT-169
         ├─ MOT-175 (interactive map) ◄─ MOT-174, MOT-168
         ├─ MOT-179 (GPX quota reset) ◄─ MOT-178
         └─ MOT-184 (fuel range) ◄─ MOT-182 ✅

WAVE C ─┬─ MOT-171 (savedRoutes queries) ◄─ MOT-169, MOT-170
         ├─ MOT-176 (elevation chart) ◄─ MOT-175
         ├─ MOT-180 (web GPX flow) ◄─ MOT-179
         └─ MOT-186 (subscriptions table) ◄─ MOT-168, MOT-179

WAVE D ─┬─ MOT-172 (web /u/[handle]/saved) ◄─ MOT-170
         ├─ MOT-173 (mobile saved tab) ◄─ MOT-170
         ├─ MOT-177 (mobile map parity) ◄─ MOT-176
         ├─ MOT-181 (mobile GPX share) ◄─ MOT-180
         ├─ MOT-185 (moto filters) ◄─ MOT-182, MOT-183, MOT-184
         └─ MOT-187 (RC webhook) ◄─ MOT-186

WAVE E ─┬─ MOT-188 (web checkout) ◄─ MOT-186, MOT-187
         ├─ MOT-189 (mobile paywall) ◄─ MOT-186, MOT-187
         └─ MOT-190 (affiliate slots) ◄─ MOT-186, MOT-187
```

**Maximum parallelism per wave:** A: 7 | B: 5 | C: 4 | D: 6 | E: 3

**Critical paths:**
1. MOT-166 → MOT-168 → MOT-186 → MOT-187 → MOT-188/189 (paywall → subscription)
2. MOT-169 → MOT-170 → MOT-171 → MOT-172/173 (saved routes)
3. MOT-174 → MOT-175 → MOT-176 → MOT-177 (maps)
4. MOT-178 → MOT-179 → MOT-180 → MOT-181 (GPX)

## Epic Summary

### E2 — Mobile Search (1 ticket)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-157 | Mobile search screen + typeahead | Mobile (Expo) |

### E4 — Freemium Gating (3 tickets)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-166 | Resolver gating + PublicRoute @ObjectType | Backend |
| MOT-167 | Shared paywall modal (web + mobile) | Web + Mobile |
| MOT-168 | Review soft-wall (3 visible, rest blurred) | Web + Backend |

### E5 — Saved Routes & Profile (5 tickets)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-169 | users.handle column + public profile URL | Backend + DB |
| MOT-170 | route_lists table migration | DB |
| MOT-171 | savedRoutes query + mutations | Backend |
| MOT-172 | Web /u/[handle]/saved page | Web |
| MOT-173 | Mobile profile Saved tab | Mobile |

### E6 — Map Preview UX Polish (4 tickets)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-174 | Anonymous static map hero polish | Web |
| MOT-175 | Authenticated interactive Mapbox GL JS | Web |
| MOT-176 | Elevation chart with hover sync | Web |
| MOT-177 | Mobile map parity | Mobile |

### E7 — GPX Gating & Download Flow (4 tickets)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-178 | Wire exportRouteGPX to EntitlementService | Backend |
| MOT-179 | Monthly GPX quota reset and tracking | Backend |
| MOT-180 | Web GPX download flow and paywall | Web |
| MOT-181 | Mobile GPX share sheet and notifications | Mobile |

### E8 — Moto Differentiation (3 tickets)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-183 | Crowd-sourced surface reports | Full-stack |
| MOT-184 | Fuel-range overlay per bike tank size | Full-stack |
| MOT-185 | Moto-specific filters on search | Full-stack |

### E9 — Pro Subscription Plumbing (5 tickets)
| Ticket | Title | Layer |
|--------|-------|-------|
| MOT-186 | subscriptions table + entitlement wiring | Backend + DB |
| MOT-187 | RevenueCat webhook handler | Backend |
| MOT-188 | Web checkout page (Stripe via RC Web Billing) | Web |
| MOT-189 | Mobile paywall + RevenueCat SDK wiring | Mobile |
| MOT-190 | Affiliate & sponsored slot scaffolding | Full-stack |

## Key Technical Decisions

### From AllTrails Research (MOT-144)
- **Maps NOT blurred** for anonymous — show full interactive map
- **Save is FREE** — no paywall on bookmarking
- **Review soft-wall at 3** — more aggressive than AllTrails (they show all), but defensible for conversion
- **Paywall is soft** — contextual, skippable, not blocking core discovery

### Migration Numbering
- Phase 1 used 00092-00094
- Phase 3 migrations should start at 00095+ (verify before creating)
- MOT-169 (users.handle): needs citext extension
- MOT-170 (route_lists): includes trigger + data migration
- MOT-186 (subscriptions): includes enum type
- MOT-183 (surface_reports): includes enum type
- MOT-190 (sponsorships): includes enum type

### Conventions (CLAUDE.md reminders)
- Use `as const` objects not TypeScript `enum` — but DB enums are OK in migrations
- posthog-react-native for mobile, posthog-js for web
- SUPABASE_USER for user-scoped queries, SUPABASE_ADMIN for system ops
- All colors from palette, zero hardcoded hex
- Run `pnpm generate` after every resolver change
- Use DataLoader for N+1 prevention on ResolveFields

## Monetization Architecture

```
┌─────────────────────────────────────────────────┐
│                  RevenueCat                       │
│  (Source of truth for billing)                    │
│  Products: monthly_pro ($5.99), annual_pro ($49.99) │
├──────────┬────────────────────┬──────────────────┤
│ iOS IAP  │   Google Play      │  Stripe (Web)    │
└────┬─────┴─────────┬──────────┴────────┬─────────┘
     │               │                   │
     ▼               ▼                   ▼
┌────────────────────────────────────────────────┐
│  POST /webhooks/revenuecat                      │
│  Signature verify → dedup → sync subscriptions  │
└────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼───────────────────────────┐
│  subscriptions table (Supabase)                 │
│  user_id, status, product_id, period_end        │
└────────────────────┬───────────────────────────┘
                     │
┌────────────────────▼───────────────────────────┐
│  EntitlementService.getTier(userId)             │
│  Phase 3: checks subscriptions table            │
│  Returns 'pro' if status in (trialing, active)  │
└─────────────────────────────────────────────────┘
```

## Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mapbox GL JS bundle size (~200KB) | Performance | Dynamic import with `ssr: false`, only for authenticated users |
| RevenueCat SDK + Expo compatibility | Build failure | Test with expo-revenue-cat in dev client, not Expo Go |
| DB enum types (surface_condition, sub_status) | Migration complexity | Keep enums in SQL only, map to `as const` in TypeScript |
| Overpass API rate limits for fuel stops | Feature degradation | Cache 24h, implement circuit breaker, fallback to "no data" |
| Review soft-wall SEO impact | Google cloaking risk | Keep full reviews in DOM (JSON-LD), blur visually only |

## Sources

All 25 tickets pulled from Linear with full descriptions, step-by-step implementation, acceptance criteria, and dependency graphs.

### Linear Tickets
MOT-157, MOT-166, MOT-167, MOT-168, MOT-169, MOT-170, MOT-171, MOT-172, MOT-173, MOT-174, MOT-175, MOT-176, MOT-177, MOT-178, MOT-179, MOT-180, MOT-181, MOT-183, MOT-184, MOT-185, MOT-186, MOT-187, MOT-188, MOT-189, MOT-190

### AllTrails UX Research
See `docs/research/2026-04-13-alltrails-ux-walkthrough.md` for comprehensive competitor analysis:
- Trail detail page structure (13 sections documented)
- 3-tier paywall strategy (Free/Plus/$35yr/Peak/$80yr)
- **Map NOT blurred for free users** — contradicts PRD §8
- **Save is free** — no auth wall on bookmarking
- **Reviews fully visible** — our soft-wall at 3 is more aggressive
- Mobile patterns: bottom sheet filters, sticky CTAs, collapsible map
- SEO: TouristAttraction JSON-LD, BreadcrumbList, canonical URLs

### Phase 1 Foundation (completed)
All Phase 1 tickets (MOT-149 through MOT-199) are Done. EntitlementService, SearchService, routeBySlug, SSR pages, sitemap, and analytics are live on `feat/routes-discovery-phase1`.
