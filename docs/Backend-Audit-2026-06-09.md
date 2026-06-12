# Backend Audit — apps/api (2026-06-09)

Full review of the NestJS 11 GraphQL backend (~26k LOC, 40 modules). Six parallel review passes: core infrastructure, trips/motorcycles/maintenance, rides/expenses/analytics, AI/content modules, social/monetization modules, and a cross-module duplication audit. The three headline findings below were independently re-verified against the code and the **production database** before being written down.

---

## Executive summary

The architecture is fundamentally sound — dual Supabase clients, local JWT verification, DataLoader discipline where it matters, Zod at the boundaries, atomic RPCs for racy operations, good prompt-injection hygiene on AI paths. The problems cluster in four areas:

1. **Three confirmed production-impacting bugs** (global guard breaking REST endpoints incl. the RevenueCat webhook; `users` RLS making the social layer non-functional; rate limiting silently removed entirely).
2. **Race conditions around money/quotas** (AI budget check-then-spend, sponsorship spend math, odometer sync).
3. **~1,900 LOC (~9%) of structural duplication** — cursor pagination ×17, Supabase error boilerplate ×97, `mapRow` ×31, Edge/Connection classes ×9.
4. **Aggregation in JS instead of SQL** (expense dashboard, rider stats, spending summary) — wrong at scale, not just slow.

---

## CRITICAL — verified against code and/or production

### C1. Global `GqlAuthGuard` runs on REST routes — `/health` and `/webhooks/revenuecat` get 401
- `src/common/guards/gql-auth.guard.ts:59-64` — `canActivate` never checks `context.getType()`; it always wraps the context with `GqlExecutionContext.create()`. Verified: for Express (REST) calls the normalized context still resolves a request object, so the guard executes on HTTP routes.
- Neither `health.controller.ts` nor `revenuecat.controller.ts` carries `@Public()` (verified by grep).
- Consequences: Render health probes get 401; **RevenueCat → entitlement sync is dead** (the webhook auth header is an HMAC secret, not a JWT). Unnoticed because `ENTITLEMENTS_ENFORCED` defaults to false. Prod `/health` did not respond to curl within 60s (cold start or failing health checks — inconclusive, check Render dashboard).
- **Fix:** first line of `canActivate`: `if (context.getType<GqlContextType>() !== 'graphql') return true;` plus explicit `@Public()` on both controllers. Then verify RevenueCat delivery logs and replay missed events.

### C2. `users` RLS blocks the entire social layer for authenticated users — confirmed in PROD
- Live policies on `public.users` (queried via Supabase MCP): own-row SELECT, admin SELECT, own-row UPDATE ×2. **Nothing else.**
- Also **migration drift**: the `Anon read public profile by handle` policy from `00097_users_handle.sql` exists in migrations but NOT in prod.
- `feed.service.ts:89` embeds `users!inner(...)` via `SUPABASE_USER` → the inner join drops every row whose author the viewer can't read → **feed returns (at most) your own rides; everyone else's content vanishes silently**. Same root cause breaks `follows` target lookups ("User not found"), and kudos/comments author info falls back to `'Rider'`.
- Trips equivalent: `trip-lifecycle.service.ts:252/318/454` — `@Public()` trip feeds join `users` via the user client, so organiser info is RLS-stripped and `redactOrganiser()` is mostly dead code. (Violates the project's own rule: `@Public()` reads MUST use `SUPABASE_ADMIN`.)
- **Fix:** add an authenticated read policy (e.g. `FOR SELECT TO authenticated USING (is_public = true)`) or route these joins through `public_profiles` / the admin client with app-layer redaction as the single privacy gate. Reconcile migration drift (`supabase db push` state).

### C3. Rate limiting does not exist — the throttler stack is dead code
- Zero matches for `ThrottlerModule`/`ThrottlerGuard`/`@Throttle` in `src/` (verified by grep). Commit `24d066b5` removed the guard; `RedisThrottlerStorage`, `THROTTLE_PRESETS`, `THROTTLE_*` env vars, and the dependency remain as ~200 lines of misleading dead code. `apps/api/CLAUDE.md` still claims AI endpoints are throttled.
- Paid AI mutations (`generateArticle`, `submitDiagnostic`, `askTripAssistant`, `generateOnboardingInsights`), the public waitlist email-sender, and everything else are unthrottled.
- **Fix:** re-register `ThrottlerModule` with a GraphQL-aware guard wired to `RedisThrottlerStorage` (fix its non-atomic `INCR`/`EXPIRE` — use `EXPIRE ... NX` in a pipeline) — or delete the whole stack and the stale docs. Don't keep the half-state.

### C4. `deleteAccount` calls an RPC nobody can execute
- `users.service.ts:257-266` calls `soft_delete_user` with the user client, but `00033_account_deletion.sql` revokes EXECUTE from `authenticated` (service_role only), while the function body requires `auth.uid() = p_user_id` (null for service_role). As migrated, **no caller satisfies both**. App Store compliance issue — verify in prod, then either `GRANT EXECUTE TO authenticated` (the internal check makes it safe) or drop the internal check and use the admin client.

### C5. Auto ride-summaries silently never generate for private rides (the default)
- `ride-summaries.service.ts:343` — the `@OnEvent('ride.completed')` listener lives in a request-scoped service (injects `SUPABASE_USER`). The event payload has no auth header, so the provider builds an anon client; rides RLS makes private rides owner-only → fetch returns nothing → `NotFoundException` swallowed as a `warn`.
- **Fix:** move the listener into a singleton admin-client service (mirror `RideRollupAggregator`, which does this correctly).

### C6. `is_public` vs `visibility` split-brain on rides
- `updateRideVisibility` writes only `visibility` (`rides.service.ts:327`); `updateRide` writes only `is_public` (`:268`); `getPublicRide` gates on `is_public` (`:473`) while RLS gates on `visibility`. The two columns diverge after any update — contradictory access answers depending on path. Pick `visibility` as canonical and migrate.

---

## HIGH

### Security / auth
- **H1. Anon key authenticates as a user** — `gql-auth.guard.ts:94-124` verifies signature+expiry only. The public Supabase anon key is an HS256 JWT signed with the same secret, no `sub` → guard passes with `user.id === undefined`. Require `sub`, restrict `algorithms`, enforce `audience: 'authenticated'`.
- **H2. SECURITY DEFINER RPCs accept forgeable `p_user_id`** — `join_group_ride` (00068) and `mark_article_read` (00014) have no `auth.uid()` check and default EXECUTE grants; any JWT holder can call them via PostgREST as another user. Add the `auth.uid() IS DISTINCT FROM p_user_id` guard like `complete_onboarding` (00041) has.
- **H3. Exception filter** (`gql-exception.filter.ts`) — sends every 401/404/400 to Sentry (quota burn) and returns a `GraphQLError` for HTTP contexts without writing a response (request hangs). Branch on `host.getType()`; only capture ≥500s.
- **H4. PII in logs** — `diagnostics.resolver.ts:55-60` logs the full free-text symptom input at `log` level. Log ids/flags only.
- **H5. HTML injection in transactional emails** — `email.service.ts:54,88,116` interpolates user-controlled `fullName`/`email` into HTML unescaped. Add `escapeHtml()`.

### Money / quota races
- **H6. AI budget check-then-spend TOCTOU** — `ai-budget.service.ts:102-164`: limits are COUNT/SUM over `content_generation_log`, but the spend row is inserted after the AI call, fire-and-forget. N concurrent requests all pass. Use atomic Redis `INCR` with TTL (the circuit breaker already uses this pattern) or insert a `pending` row up front. Same race in free-tier article/assistant/diagnostic limits.
- **H7. Insights generations never logged** — `insights.service.ts:92-185` checks budget but writes nothing to `content_generation_log`: invisible to daily limits, global cap, and `aiBudgetStatus`.
- **H8. Sponsorship impression/click tracking no-ops and races** — `sponsorships.service.ts:46-108`: viewer-side UPDATE matches 0 rows under RLS (returns `true` while recording nothing), and `spent_this_month + cost` computed in JS loses updates. One SECURITY DEFINER RPC with `SET x = x + 1`.
- **H9. `endRide` odometer sync** — `rides.service.ts:116-152`: JS read-modify-write of `current_mileage` + non-atomic `mileage_applied` guard; also not retry-idempotent (retry after success throws). Atomic RPC with `WHERE mileage_applied = false RETURNING`.

### Correctness / data integrity
- **H10. Expense dashboard silently wrong past 5,000 expenses** — `expenses.service.ts:218-225`: `.limit(5000)` with **no ORDER BY**, aggregated in JS. Move aggregation into SQL (`date_trunc` + `sum` + `group by`); also `5000` duplicates `QUERY_LIMITS.MAX_EXPENSES_PER_QUERY`.
- **H11. `updateTrip` waypoint replacement non-atomic** — `trip-lifecycle.service.ts:765-797`: unchecked delete, then insert that can fail → trip left with zero waypoints, no rollback. Add a `replace_trip_waypoints` RPC (the codebase already does this right for `reorder_trip_waypoints`).
- **H12. RevenueCat duplicate `NON_RENEWING_PURCHASE` retries forever** — `revenuecat.service.ts:30-49`: duplicate → `ConflictException` → non-2xx → RC retries a permanently failing delivery. Treat duplicates as success (catch + 200), like the subscription path does.
- **H13. Webhook-created health reports crash `getMyHealthReports`** — `createFromPurchase` inserts `bike_id: null` but `HealthReport.motorcycleId` is non-nullable in GraphQL. Make nullable or filter pending rows.
- **H14. Meta CAPI `Subscribe` fires on every renewal** — `revenuecat.service.ts:109-114` — inflates ad attribution monthly. Restrict to first paid conversion.
- **H15. ~310 LOC dead `searchRoutes` path** — `search.service.ts`: no resolver calls it and the `search_routes_raw` RPC doesn't exist in any migration. Delete it (and never ship an RPC that takes SQL fragments as text).
- **H16. `getMakeStats` cache never hits** — `motorcycles.service.ts:26`: service is request-scoped (via `SUPABASE_USER`), so the instance cache is always cold and the fleet-wide RPC runs every query. Move to a singleton.

---

## MEDIUM (grouped themes)

**Wrong Supabase client (vs the project's own rules)**
- Admin client for user-scoped reads on authenticated resolvers: `ride-analytics.service.ts:18`, `entitlements.service.ts:47`. Admin for user-scoped *writes*: `maintenance-tasks.service.ts` (`createNextRecurrence`, `addPhoto`, `deletePhoto`), `motorcycles.service.ts:222`.
- User client behind `@Public()` resolvers: `search.service.ts:60`, `places.service.ts:42`, `users.service.ts:285` (`getRiderProfile`) — work today only via SECURITY DEFINER / view grants; fragile.
- `supabase-user.provider.ts` forwards the **raw unverified** Authorization header instead of the guard-verified token; 20 injection sites each make their whole DI subtree request-scoped (the single biggest DI cost in the app — consider a singleton `forToken()` factory).

**Aggregate in SQL, not JS**
- `users.service.ts:285-335` rider stats: fetches every `distance_m` row. `maintenance-tasks.service.ts:331-371` spending summary: two full fetches summed in JS. `ride-analytics.service.ts:108-136`: 5 queries over the same rollup rows — fetch once, derive all periods.

**Sequential awaits → `Promise.all`**
- `diagnostics.resolver.ts:50-171` (~120-line fat resolver, 7 sequential round trips, tier fetched twice, whole garage fetched to find one bike); `fuel-stops.resolver.ts:26-55` (fat resolver + duplicate route fetch + duplicated default constants); `rides.service.ts:198-218`; `expenses.service.ts:318-340`; `trip-lifecycle.service.ts:686-725` (3 sequential pre-reads of the same row); `getDiscoverRiderTrips` full `users` scan for admin IDs per request (cache it).

**Error swallowing**
- `createNextRecurrence` (maintenance) returns null with no log — recurring chains die silently. `respondToTripInvite` warns and returns `true` when the join RPC fails. `articles/quizzes/places` reads return null on DB error (outage looks like 404). `enforceFreeTierSummaryLimit` fails **open** while the tier lookup beside it fails closed.
- `.single()` misuse on 0-row-is-normal paths: `trip-lifecycle.service.ts:870` (duplicate check passes on multi-row!) — use `.maybeSingle()`.

**Blocking AI mutations** — 60s timeout × 3 retries holds GraphQL requests up to ~4 min. Diagnostics already creates a `processing` row — return it immediately and let the client poll. Lower interactive timeouts to ~25s / 1 retry meanwhile.

**No caching of cheap-to-cache public reads** — places taxonomy (powers SSR + sitemap; the thing that got the throttler removed), popular articles, insights (same input → paid regeneration). Redis is already wired.

**AI cost accounting wrong** — single `AI_COSTS` (gpt-4.1 pricing) applied to nano/mini models → spend overstated 5–25×, circuit breaker trips early; ride-summaries hardcodes its own model + pricing. Dispatch table `MODEL_COSTS: Record<AiModel, {input, output}>`.

**Cursor correctness** — virtually every keyset paginator uses strict `lt/gt` on a non-unique timestamp (feed, follows, kudos, comments, group-rides, rides, articles) → rows sharing a timestamp skip/duplicate across pages. Composite `(timestamp, id)` cursors — fold into the shared helper below.

**Other notable** — `tripDetail` resolver never passes `@CurrentUser` so self/participant redaction breaks (`trips.resolver.ts:132`); `savedTrips` uses the wrong select constant so template fields vanish; `publishAsTemplate` slug collisions make BOTH templates unreachable; `getComments` with zero args queries `group_ride_id = ''`; `joinWaitlist` is an unauthenticated email cannon; share-link tokens stored plaintext while trip tokens are hashed; `pt-BR` Accept-Language resolves to English (`locale.interceptor.ts:11` splits on `-`); correlation ID differs across root fields of one request; GDPR data export omits rides/trips/fuel/comments/follows; `Subscribe`-event/`meta-events.service.ts` hardcodes app version `3.0.0`.

**Convention violations (project's own rules)**
- Magic strings everywhere: ride/trip/task statuses, visibility values, `'PGRST116'` (~11 sites), `'23505'` (~9), event name `'ride.completed'` in 3 files. Define `as const` constants (`RIDE_STATUS`, `PG_ERROR`, `RIDE_EVENTS`...).
- Hand-rolled date math across ~10 files (`24*60*60*1000`, manual Monday/month-start computed 3 different ways) — project rule says date-fns.
- Two competing enum-registration patterns: `common/enums/graphql-enums.ts` (445 lines, TS-enum style + sync guards) vs `shared/graphql/enums.ts` (111 lines, `as const`, matches project rules). Consolidate on the latter — halves the code.

---

## Duplication audit — ~1,900 LOC removable (~9% of the API)

No shared pagination/error/mapping helpers exist today; `common/` only has guards/pipes/interceptors. Ranked by LOC-saved × low-risk:

| # | Pattern | Sites | LOC saved | Risk |
|---|---------|-------|-----------|------|
| 1 | `buildConnection()` + `encodeCursor`/`decodeCursor` (`common/pagination/`) | 17 build blocks in 11 services; 5 verbatim codec pairs; 15× `Math.min(first, 50)` | ~430 | Low |
| 2 | `unwrap()` Supabase error helper (`common/supabase/`) | 97 exact copies of log-and-throw across 33 files | ~290 | Low |
| 3 | `camelizeRow<T>()` generic mapper | 31 `mapRow` functions, 645 LOC, ~243 pure-rename lines | ~400 | Med |
| 4 | Photo-attachment service + generic DataLoader factory | expenses vs maintenance-tasks verticals are near-identical (models differ by 2 lines) | ~200 | Med |
| 5 | `Paginated(classRef, name)` ObjectType factory | 9 hand-written Edge/Connection pairs | ~160 | Low |
| 6 | `UserSummary` model + `USER_SUMMARY_SELECT` const + `mapUserSummary()` | 5 identical author types; select fragment copy-pasted 13× | ~120 | Low-Med |
| 7 | Use generated `Tables<'x'>` over hand-rolled `*Row` interfaces | 25+ shadow interfaces, 62 `as unknown as` casts | ~200 | Low-Med |
| 8 | `assertOwner()` helper | 8 fetch-compare-throw blocks | ~80 | Low |
| 9 | `pickDefinedSnake()` partial-update builder | 44 if-lines across 7 files | ~35 | Low |

Also: `getFollowers`/`getFollowing` are byte-identical except one column; `createMockClient` test scaffolding duplicated verbatim in 5 spec files; NHTSA fetch+timeout block repeated 3×.

Recommended order: #1 → #2 → #5 → #8/#9 (low-risk, ~1,000 LOC, covered by 31 existing spec files + `pnpm generate` schema-diff check), then #3/#4/#6/#7 module-by-module. Pass explicit names in #5 so emitted SDL doesn't change.

## Things done genuinely well (keep as patterns)

- DataLoader discipline on every `@ResolveField` DB path (expenses, tasks, trip reviews/saves); the feed itself is properly batched with trigger-maintained denormalized counts — no N+1s found anywhere.
- Cursor inputs regex-validated before interpolation into PostgREST `.or()` filters — deliberate injection defense.
- Atomic RPCs where races matter: `join_group_ride` (FOR UPDATE), `clone_trip_template`, `reorder_trip_waypoints`, `process_revenuecat_event` dedupe, soft-delete RPCs.
- Prompt-injection hygiene: `sanitizeForPrompt`, data-framing tags, injection pre-filters, `zodResponseFormat` + second `safeParse`, hallucinated-ID validation against the DB.
- Timing-safe HMAC webhook comparison; jose local JWT verification with JWKS migration support; Sentry PII scrubbing; env validation with empty-string→undefined transform.
- Guard-audit specs asserting resolvers aren't accidentally `@Public()` — cheap, clever regression net worth extending to every module.
- `GATING_MATRIX` as a typed `as const` dispatch table with exhaustive tests — the model citizen for the no-if/else-chains rule.

## Recommended action order

1. **Today:** C1 guard fix (+`@Public()` on health/webhook) — then check RevenueCat delivery logs and replay missed events. C2 users RLS policy + migration-drift reconciliation. Decide throttler: rewire or delete (C3).
2. **This week:** C4 account deletion, C5 summary listener → singleton, C6 visibility split-brain, H1 JWT hardening, H6 atomic budget reservation, H10 SQL aggregation, H12 webhook idempotency.
3. **Next:** consolidation passes #1/#2/#5/#8/#9 (~1,000 LOC), then the medium-severity themes (client-choice cleanups, Promise.all batching, constants/date-fns sweeps) as mechanical follow-ups, ideally enforced by a few custom Biome/grep CI checks (e.g. ban `select('*')`, ban raw `'PGRST116'`).
