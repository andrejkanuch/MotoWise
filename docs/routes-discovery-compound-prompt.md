# Routes Discovery — Compound Engineering Prompt

> **56 tickets** across 3 phases, 10 epics. This document provides the full ticket registry and a compound execution prompt designed for parallel AI agent execution.

---

## Complete Ticket Registry

### Phase 0: Validation (6 tickets) — EXECUTE FIRST

| # | ID | Title | Priority | Project |
|---|------|-------|----------|---------|
| 1 | MOT-144 | E0-T1 — Live AllTrails walkthrough (design) | Urgent | Routes Phase 0 |
| 2 | MOT-145 | E0-T2 — Moto competitor scan (Kurviger, Calimoto, REVER) | Urgent | Routes Phase 0 |
| 3 | MOT-146 | E0-T3 — Seeded routes data audit | Urgent | Routes Phase 0 |
| 4 | MOT-147 | E0-T4 — Map tile provider ADR (Mapbox vs MapLibre vs Stadia) | Urgent | Routes Phase 0 |
| 5 | MOT-148 | E0-T5 — URL / slug convention ADR | Urgent | Routes Phase 0 |
| 6 | MOT-193 | P0-Spike — Rider validation survey (50 US routes, 30+ responses) | Urgent | Routes Phase 0 |

All Phase 0 tickets are independent — run all 6 in parallel.

---

### Phase 1: MVP (25 tickets) — CORE DELIVERY

#### E1 — Data Model Extensions (6 tickets)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 7 | MOT-149 | E1-T1 — Migration 00080_route_slugs_and_regions.sql | Urgent | Phase 0 ADRs (MOT-147, MOT-148) |
| 8 | MOT-150 | E1-T2 — Slug + country/region backfill job | Urgent | MOT-149, MOT-151 |
| 9 | MOT-151 | E1-T3 — GeoNames places taxonomy seed | Urgent | MOT-149 |
| 10 | MOT-152 | E1-T4 — Zod schemas + @motovault/types updates | Urgent | MOT-149 |
| 11 | MOT-153 | E1-T5 — routes.service + resolver: routeBySlug query | Urgent | MOT-149, MOT-150, MOT-152 |
| 12 | MOT-195 | E1-T6 — Unit + integration tests for data model | High | MOT-149, MOT-150, MOT-151, MOT-152, MOT-153 |

#### E2 — Global Search API + UI (5 tickets)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 13 | MOT-154 | E2-T1 — SearchService + searchRoutes resolver (FTS + geo-bias) | High | MOT-149 (tsvector columns) |
| 14 | MOT-155 | E2-T2 — Typeahead resolver (routes + places via pg_trgm) | High | MOT-149, MOT-151 |
| 15 | MOT-156 | E2-T3 — Web SearchBar component + /search results page | High | MOT-154, MOT-155 |
| 16 | MOT-158 | E2-T5 — Filter sidebar (web only, mobile deferred to Phase 3) | High | MOT-154 |
| 17 | MOT-196 | E2-T6 — Unit + integration tests for search | High | MOT-154, MOT-155, MOT-156, MOT-158 |

#### E3 — Public Web Route Detail Pages (9 tickets)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 18 | MOT-194 | P1-Infra — Deploy apps/web to Vercel + domain + CI/CD + env vars | High | None (can start immediately) |
| 19 | MOT-159 | E3-T1 — Next.js SSR /route/[country]/[region]/[slug] detail page | High | MOT-153 |
| 20 | MOT-160 | E3-T2 — Static hero image generator + cache (tile provider per MOT-147 ADR) | High | MOT-147, MOT-149, MOT-150 |
| 21 | MOT-161 | E3-T3 — Region index pages /explore/[country]/[region] | High | MOT-149, MOT-151 |
| 22 | MOT-162 | E3-T4 — /explore global browse page (AllTrails-style) | High | MOT-149, MOT-151 |
| 23 | MOT-163 | E3-T5 — sitemap.xml, robots.txt, schema.org JSON-LD | High | MOT-159 |
| 24 | MOT-164 | E3-T6 — Legacy UUID → slug 301 redirects | High | MOT-149, MOT-150 |
| 25 | MOT-197 | E3-T7 — Unit + integration tests for SSR, SEO, and redirects | High | MOT-159, MOT-160, MOT-161, MOT-162, MOT-163, MOT-164 |

#### E4 — Freemium Gating (2 tickets in Phase 1)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 26 | MOT-165 | E4-T1 — EntitlementService (Free/Pro/Anonymous) — getTier() returns 'free' in Phase 1 | High | MOT-153 |
| 27 | MOT-198 | E4-T1b — EntitlementService unit tests (100% coverage) | High | MOT-165 |

#### E8 — Moto Differentiation (1 ticket in Phase 1)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 28 | MOT-182 | E8-T1 — Twist score (curvature_index → 1–10 badge + percentile) | Medium | MOT-149, MOT-150 |

#### E10 — Analytics Instrumentation (2 tickets)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 29 | MOT-191 | E10-T1 — Shared analytics client (web only in Phase 1, mobile deferred) | Low | None (can start immediately) |
| 30 | MOT-192 | E10-T2 — Funnel dashboard (search → detail → save → signup → Pro) | Low | MOT-191 |

#### P1-QA — Final Verification (1 ticket)

| # | ID | Title | Priority | Depends On |
|---|------|-------|----------|------------|
| 31 | MOT-199 | P1-QA — End-to-end smoke tests for Routes Discovery Phase 1 | High | ALL Phase 1 tickets |

---

### Phase 3: Post-MVP (25 tickets) — DEFERRED

#### E2 — Search (deferred mobile)

| # | ID | Title | Priority |
|---|------|-------|----------|
| 32 | MOT-157 | E2-T4 — Mobile search screen + typeahead | High |

#### E4 — Freemium Gating (deferred)

| # | ID | Title | Priority |
|---|------|-------|----------|
| 33 | MOT-166 | E4-T2 — Resolver gating + PublicRoute @ObjectType | High |
| 34 | MOT-167 | E4-T3 — Shared paywall modal component (web + mobile) | High |
| 35 | MOT-168 | E4-T4 — Review soft-wall (first 3 visible, rest blurred) | High |

#### E5 — Saved Routes & Profile Dashboard

| # | ID | Title | Priority |
|---|------|-------|----------|
| 36 | MOT-169 | E5-T1 — users.handle column + public profile URL | High |
| 37 | MOT-170 | E5-T2 — route_lists table migration (forward-compatible schema) | High |
| 38 | MOT-171 | E5-T3 — savedRoutes query + saveRoute/unsaveRoute mutations | High |
| 39 | MOT-172 | E5-T4 — Web /u/[handle]/saved page | Medium |
| 40 | MOT-173 | E5-T5 — Mobile profile Saved tab | High |

#### E6 — Map Preview UX Polish

| # | ID | Title | Priority |
|---|------|-------|----------|
| 41 | MOT-174 | E6-T1 — Anonymous static map hero polish | Medium |
| 42 | MOT-175 | E6-T2 — Authenticated interactive Mapbox GL JS | High |
| 43 | MOT-176 | E6-T3 — Elevation chart with hover sync | Medium |
| 44 | MOT-177 | E6-T4 — Mobile map parity | Medium |

#### E7 — GPX Gating & Download Flow

| # | ID | Title | Priority |
|---|------|-------|----------|
| 45 | MOT-178 | E7-T1 — Wire exportRouteGPX to EntitlementService for quota checks | High |
| 46 | MOT-179 | E7-T2 — Monthly GPX quota reset and tracking | Medium |
| 47 | MOT-180 | E7-T3 — Web GPX download flow and paywall | Medium |
| 48 | MOT-181 | E7-T4 — Mobile GPX share sheet and notifications | Medium |

#### E8 — Moto Differentiation (deferred)

| # | ID | Title | Priority |
|---|------|-------|----------|
| 49 | MOT-183 | E8-T2 — Crowd-sourced surface reports | Medium |
| 50 | MOT-184 | E8-T3 — Fuel-range overlay per bike tank size | Medium |
| 51 | MOT-185 | E8-T4 — Moto-specific filters on search (twist, surface, range) | Medium |

#### E9 — Pro Subscription Plumbing & Monetization

| # | ID | Title | Priority |
|---|------|-------|----------|
| 52 | MOT-186 | E9-T1 — subscriptions table + entitlement wiring | High |
| 53 | MOT-187 | E9-T2 — RevenueCat webhook handler | High |
| 54 | MOT-188 | E9-T3 — Web checkout page (Stripe via RevenueCat Web Billing) | High |
| 55 | MOT-189 | E9-T4 — Mobile paywall + RevenueCat SDK wiring | High |
| 56 | MOT-190 | E9-T5 — Affiliate & sponsored slot scaffolding (feature-flagged) | Medium |

---

## Compound Engineering Prompt

Copy everything below this line and paste it as a prompt to Claude Code or any AI coding agent working on the MotoVault monorepo.

---

```
You are an AI engineering agent working on MotoVault — an AI-powered motorcycle learning & diagnostics platform. You are executing Phase 1 (MVP) of the Routes Discovery feature.

## CRITICAL: Read CLAUDE.md first

Before writing ANY code, read `/CLAUDE.md` at the repo root. It contains mandatory conventions:
- Biome (NOT ESLint/Prettier), `as const` objects (NOT TypeScript `enum`)
- snake_case DB → camelCase GraphQL (map in NestJS services)
- Zod at API boundaries, TypedDocumentNode from @motovault/graphql
- supabase client for all data access (NEVER Prisma)
- `z.unknown()` (NEVER `z.any()`)
- All colors from `palette` in @motovault/design-system (NEVER hardcoded hex/rgba)
- posthog-react-native for mobile (NEVER posthog-js)
- Generated files in packages/graphql/src/generated/ and packages/types/src/database.types.ts are READ-ONLY

## Architecture

- apps/mobile: Expo 54 (RN 0.83, React 19.2) — user-facing mobile app
- apps/api: NestJS 11 — GraphQL API (code-first, Apollo Server) + Claude AI
- apps/web: Next.js 16 — web app (public pages + admin dashboard)
- packages/types: @motovault/types — Zod schemas, shared TS types
- packages/graphql: @motovault/graphql — generated GraphQL client types
- packages/design-system: @motovault/design-system — CSS tokens, color/typography constants
- supabase/: Database migrations, seeds, RLS policies

## Execution Strategy: Compound Parallel Waves

Execute tickets in dependency-ordered waves. Within each wave, ALL tickets are independent and MUST be executed in parallel (separate git branches, one branch per ticket).

### WAVE 0 — Foundation (no code dependencies)
Run these 3 in parallel:
- **MOT-194** → P1-Infra: Deploy apps/web to Vercel + domain + CI/CD + env vars
- **MOT-191** → E10-T1: PostHog analytics client (web only — posthog-react-native deferred to Phase 3)
- **MOT-149** → E1-T1: Migration 00080_route_slugs_and_regions.sql
  - IMPORTANT: Add `is_motovault_pick BOOLEAN DEFAULT FALSE` column (needed by MOT-162)
  - IMPORTANT: Add `featured_tag TEXT` column (needed by MOT-161) OR skip editorial blocks

Branch naming: `feat/mot-{id}-{short-description}`
After MOT-149 merges → push migration: `npx supabase db push`
After each ticket → run: `pnpm generate && pnpm lint:fix && pnpm test`

### WAVE 1 — Data Backfill + Schemas (depends on MOT-149)
Run these 3 in parallel:
- **MOT-151** → E1-T3: GeoNames places taxonomy seed
- **MOT-152** → E1-T4: Zod schemas + @motovault/types updates
- **MOT-154** → E2-T1: SearchService + searchRoutes resolver (FTS + geo-bias)

Run this sequentially after MOT-151 completes:
- **MOT-150** → E1-T2: Slug + country/region backfill job
  - PREREQUISITE: `pnpm add slugify --filter @motovault/api`
  - Depends on MOT-149 (migration) + MOT-151 (places table for reverse geocoding)

### WAVE 2 — Resolvers + Search UI (depends on Wave 1)
Run these 5 in parallel:
- **MOT-153** → E1-T5: routes.service + resolver: routeBySlug query (depends: MOT-149, MOT-150, MOT-152)
- **MOT-155** → E2-T2: Typeahead resolver — routes + places via pg_trgm (depends: MOT-149, MOT-151)
- **MOT-158** → E2-T5: Filter sidebar — web only (depends: MOT-154)
- **MOT-164** → E3-T6: Legacy UUID → slug 301 redirects (depends: MOT-149, MOT-150)
- **MOT-182** → E8-T1: Twist score — curvature_index → 1–10 badge (depends: MOT-149, MOT-150)

### WAVE 3 — Web Pages + Entitlements (depends on Wave 2)
Run these 6 in parallel:
- **MOT-156** → E2-T3: Web SearchBar + /search results page (depends: MOT-154, MOT-155)
- **MOT-159** → E3-T1: Next.js SSR detail page (depends: MOT-153)
  - Use placeholder hero image — do NOT wait for MOT-160
- **MOT-161** → E3-T3: Region index pages /explore/[country]/[region] (depends: MOT-149, MOT-151)
  - Skip editorial blocks in Phase 1 if featured_tag column missing
- **MOT-162** → E3-T4: /explore global browse page (depends: MOT-149, MOT-151)
  - Replace "Staff Picks" with "Top Rated" if is_motovault_pick column missing
- **MOT-165** → E4-T1: EntitlementService — getTier() ALWAYS returns 'free' (depends: MOT-153)
  - Build full GATING_MATRIX as const, but hardcode free tier for Phase 1
- **MOT-160** → E3-T2: Static hero image generator + cache (depends: MOT-147 ADR, MOT-149, MOT-150)
  - Implement StaticImageProvider interface: `{ buildUrl(geometry, width, height): string }`
  - Use MAP_TILE_PROVIDER env var to select provider

### WAVE 4 — SEO + Dashboard (depends on Wave 3)
Run these 3 in parallel:
- **MOT-163** → E3-T5: sitemap.xml, robots.txt, JSON-LD (depends: MOT-159)
- **MOT-192** → E10-T2: Funnel dashboard (depends: MOT-191)
  - Use supabaseAdmin.from('table').select() — NOT Prisma
- Run `pnpm generate` after all resolvers/mutations are finalized

### WAVE 5 — Tests (depends on all implementation waves)
Run these 5 in parallel:
- **MOT-195** → E1-T6: Unit + integration tests for data model
- **MOT-196** → E2-T6: Unit + integration tests for search
- **MOT-197** → E3-T7: Unit + integration tests for SSR, SEO, redirects
- **MOT-198** → E4-T1b: EntitlementService unit tests (target 100% coverage)
- **MOT-199** → P1-QA: End-to-end smoke tests (Playwright/Cypress)
  - Test: search → detail → explore → redirect → SEO tags → entitlements

## Per-Ticket Execution Protocol

For EACH ticket:

1. Read the full ticket description from Linear (each ticket has step-by-step implementation, files to create/modify, acceptance criteria, and verification steps)
2. Create a feature branch: `git checkout -b feat/mot-{id}-{short-name}`
3. Implement following the ticket's step-by-step guide
4. Run: `pnpm generate && pnpm lint:fix && pnpm test`
5. Verify all acceptance criteria from the ticket
6. If ticket modifies resolvers or .graphql files: run `pnpm generate` to regenerate types
7. If ticket modifies DB schema: run `npx supabase db push`
8. Create PR with title: `feat(routes): MOT-{id} — {title}`

## Linear Ticket Retrieval

Each ticket ID (MOT-XXX) can be fetched from Linear via the `get_issue` tool with `includeRelations: true`. The full description contains:
- Goal & context
- Files to create/modify (exact paths)
- Step-by-step implementation with code snippets
- Commands to run
- Acceptance criteria (checkboxes)
- Verification steps
- Definition of Done
- Dependency graph (blockedBy / blocks / relatedTo)

## Key Conventions Reminders

- SUPABASE_ADMIN (service-role): system tasks, admin operations
- SUPABASE_USER (per-request JWT): user-scoped CRUD with RLS
- Auth: Supabase Auth → JWT validated locally via jose in GqlAuthGuard → @CurrentUser() decorator
- Mobile stores tokens in expo-secure-store (NEVER AsyncStorage)
- Use react-native-reanimated v4 for animations (never RN Animated API)
- Use `borderCurve: 'continuous'` on all rounded elements
- Use inline styles unless reusing across components
- NHTSA vPIC API for motorcycle make/model/year data (free, no key)
- Ports: Expo 8081, NestJS 4000, Next.js 3000

## Update Sequence (when modifying data models)

1. Update Supabase migration SQL
2. Push: `npx supabase db push`
3. Run: `pnpm generate:types` → updates database.types.ts
4. Update Zod schemas in packages/types
5. Update NestJS models/resolvers
6. Run: `pnpm generate` → regenerates full pipeline
```

---

## Parallelization Summary

```
WAVE 0 ─┬─ MOT-194 (Vercel deploy)
         ├─ MOT-191 (PostHog client)
         └─ MOT-149 (DB migration) ──────────────────────────────┐
                                                                  │
WAVE 1 ─┬─ MOT-151 (GeoNames seed) ──┐                          │
         ├─ MOT-152 (Zod schemas)     │                          │
         ├─ MOT-154 (SearchService)   │                          │
         └─ MOT-150 (backfill) ◄──────┘                          │
                                                                  │
WAVE 2 ─┬─ MOT-153 (routeBySlug resolver) ◄─ MOT-149,150,152    │
         ├─ MOT-155 (typeahead) ◄─ MOT-149,151                   │
         ├─ MOT-158 (filter sidebar) ◄─ MOT-154                  │
         ├─ MOT-164 (UUID redirects) ◄─ MOT-149,150              │
         └─ MOT-182 (twist score) ◄─ MOT-149,150                 │
                                                                  │
WAVE 3 ─┬─ MOT-156 (SearchBar UI) ◄─ MOT-154,155                │
         ├─ MOT-159 (SSR detail page) ◄─ MOT-153                 │
         ├─ MOT-161 (region pages) ◄─ MOT-149,151                │
         ├─ MOT-162 (/explore page) ◄─ MOT-149,151               │
         ├─ MOT-165 (EntitlementService) ◄─ MOT-153              │
         └─ MOT-160 (hero image gen) ◄─ MOT-147,149,150          │
                                                                  │
WAVE 4 ─┬─ MOT-163 (sitemap + JSON-LD) ◄─ MOT-159               │
         └─ MOT-192 (funnel dashboard) ◄─ MOT-191                │
                                                                  │
WAVE 5 ─┬─ MOT-195 (E1 tests)                                    │
         ├─ MOT-196 (E2 tests)                                   │
         ├─ MOT-197 (E3 tests)                                   │
         ├─ MOT-198 (E4 tests)                                   │
         └─ MOT-199 (E2E smoke tests) ◄─ ALL                     │
```

**Maximum parallelism per wave:** Wave 0: 3 | Wave 1: 3+1 | Wave 2: 5 | Wave 3: 6 | Wave 4: 2 | Wave 5: 5

**Critical path (longest sequential chain):**
MOT-149 → MOT-151 → MOT-150 → MOT-153 → MOT-159 → MOT-163 → MOT-197 → MOT-199
(8 sequential steps — everything else runs in parallel alongside this chain)
