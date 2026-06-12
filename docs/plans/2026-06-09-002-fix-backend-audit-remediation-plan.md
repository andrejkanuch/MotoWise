---
title: Backend Audit Remediation (Critical → Consolidation) + Test Scenarios
type: fix
status: active
date: 2026-06-09
source_audit: docs/Backend-Audit-2026-06-09.md
---

# 🐛 Backend Audit Remediation (apps/api) + Test Scenarios

## Enhancement Summary

**Deepened on:** 2026-06-09 (framework-docs verification against installed packages, data-migration review with corrected SQL, security review of the plan itself, architecture review, simplicity verdict).

**Plan-changing facts discovered (all verified against the repo / node_modules / prod):**
1. **Throttler v6 config in the draft was WRONG**: `canActivate` loops over ALL registered named throttlers — a guarded resolver gets every module-level preset applied. Register exactly **one** `default` throttler; override per-resolver via `@Throttle({ default: PRESET })`. Also: `ThrottlerStorage` v6 has only `increment(key, ttl, limit, blockDuration, throttlerName)` (no `getRecord`); inputs are **ms**, returned `timeToExpire`/`timeToBlockExpire` are **seconds**; `getRequestResponse` must be **sync** and the returned `res` needs `.header()` (or set `setHeaders: false`); `getTracker` is async.
2. **Upstash pipelines are NOT atomic; `redis.multi()` is.** Atomic pattern: `redis.multi().incr(key).pexpire(key, ttlMs, 'NX').pttl(key).exec()` — `EXPIRE/PEXPIRE ... NX` is supported in 1.37.0.
3. **The users column-REVOKE deadlocks the existing UPDATE policy**: `"Users update own data"` (00057) has six `WITH CHECK` subselects reading `role`/`email`/`subscription_tier`… — none granted → **every profile update would throw permission-denied**. Fix: move immutable-column protection to **column-level UPDATE grants** and simplify the policy (corrected SQL in 1b).
4. **`select('*')` hard-breaks under column grants** (PostgREST expands `*`; supabase-js bare `.select()` and post-mutation `.select()` default to `*`). Known breakage: `users.service.ts:108` (`select('*')` own row), `:142` (`preferences`), `:154` (`update().select()`), `expenses.service.ts:181` (`currency`). These move to the admin client (with explicit `eq('id', userId)`) or granted columns, **deployed with/before the migration**.
5. **`rides_public_read` (00058) was never dropped by 00084** — it still gates on `is_public = true`, so the visibility restrictive-merge is a no-op for reads unless this policy is dropped. `summaries_public_read` (00058) also gates on `rides.is_public`. The live `comments_insert` policy is in **00070** (not 00063); kudos/comments `is_public` references are in *policies*, not trigger fns.
6. **`share_links` is anon-dumpable TODAY**: `00022` created `FOR SELECT TO anon USING (true)` — the public anon key can dump every plaintext token + user→motorcycle mapping. Drop the policy in **Phase 1** (one line; `resolve()` already uses the admin client). Prefer **rotation** over hash-in-place since tokens may already be exfiltrated.
7. **Guard fix goes default-closed**: instead of `return true` for non-GraphQL contexts (which makes every future REST route default-open), branch the request extraction — REST → `context.switchToHttp().getRequest()`, GraphQL → `GqlExecutionContext` — then run the SAME `isPublic`/JWT logic for both. `@Public()` on health/webhook becomes load-bearing.
8. **jose 6: `decodeProtectedHeader` is SYNC** (mock with `mockReturnValue`; `jwtVerify` with `mockResolvedValue`). Pin algorithms **per path** (HS256 branch: `['HS256']`; JWKS branch: `['ES256','RS256']`), add `issuer`, and count legacy-HS256 verifications for a retirement plan.
9. **Event-emitter v3 confirms C5's mechanism**: request-scoped listeners build DI from the event payload → anon client. Singleton fix is right; note `@OnEvent` **suppresses listener errors by default** — use `suppressErrors: false` or catch-and-report inside.
10. **`ride_summaries.ride_id` unique index already exists** (00058) — 1e needs only `ON CONFLICT (ride_id) DO NOTHING` + a prod drift check, no new index.

**Simplicity verdict (precedent: mobile remediation trimmed ~30-40% churn for ~95% value):** Phases 1–2 ship as-is. Phase 3 trimmed — H6 Redis reservation layer replaced by a **pending-row RPC** (merges H6+H7: the reservation row IS the log row); H9 endRide RPC replaced by a **claim-first conditional UPDATE** (keeps meters→unit conversion in TS where it already correctly lives). Phase 4 trimmed ~40% (verified bugs now; perf polish backlogged). Phase 5 = 5a/5b/5c only (#9 cut, #8 drive-by, stretch formally backlogged). Phase 6 dissolved into the other phases + touch-only rule + 2 CI greps. Phase 7 trimmed of mock-theater. **Every Critical/High and every verified bug still ships**; deferred items are in the Backlog section — nothing silently dropped.

---

## Overview

The 2026-06-09 backend audit (`docs/Backend-Audit-2026-06-09.md`) of apps/api (~26k LOC, 40 modules) confirmed three production-impacting bugs (verified against code AND the prod database), three more critical broken flows, ~16 high-severity issues clustered around auth and money/quota races, and ~1,900 LOC of structural duplication. This plan sequences remediation into 6 implementation phases + a test-scenario phase, ordered by production impact.

### Standing amendments (apply throughout)

- **Reconcile, don't replay, RevenueCat** (replayed events: new event_ids bypass dedupe, Meta CAPI fires per backlogged RENEWAL, no event-timestamp ordering → old EXPIRATION can downgrade a current subscriber). H12/H13/H14 land **before** any reconciliation.
- **Atomic RPC house rules**: `SECURITY DEFINER` + **`SET search_path = ''` with schema-qualified references** (repo convention per 00085/00086/00060; NOT `'public'`); identity from `auth.uid()` — **never a `p_user_id` parameter on user-callable RPCs**; explicit `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated` (or `service_role` only for money RPCs); `.rpc()` returns PromiseLike — wrap in `Promise.resolve()` before `.catch()`; every new RPC gets an RPC-exists test; `NOTIFY pgrst, 'reload schema';` at the end of every migration.
- **Per-table client rule** (replaces the blanket rules; update root CLAUDE.md in 1b): anon/user client for publicly-readable tables; admin + explicit code filters (defense-in-depth) for owner-only-RLS tables read from `@Public()` resolvers; user client for user-scoped writes; admin never for user-scoped writes without a documented RLS-footgun reason.
- **Docs rule**: each phase updates every CLAUDE.md / docs/solutions claim it invalidates in the same PR; no deferred doc debt.
- **Composite cursors must accept legacy single-field cursors** (OTA bundles hold old cursors mid-scroll) — fallback parse or treat-as-page-one, never throw.
- **Redis-down invariant (state in 1c AND 3):** fail open per-user (throttle + user budget), fail closed on the global AI spend cap. The global cap is the financial backstop; neither PR may independently relax this.
- **Test mocks**: `jwtVerify`/JWKS → `mockResolvedValue`; `decodeProtectedHeader` → `mockReturnValue` (it's sync). Sync mocks on async fns previously hid a critical dead-JWKS bug.

## Problem Statement

From the audit, by severity (file:line refs in the audit doc):

**Critical (verified):** C1 global guard 401s REST (`/health`, RevenueCat webhook → entitlement sync dead); C2 prod `users` RLS kills the social layer + migration drift (00097 missing in prod); C3 rate limiting removed entirely; C4 `soft_delete_user` unexecutable by anyone; C5 auto ride-summaries dead for private rides; C6 `is_public`/`visibility` split-brain. **NEW (deepening):** C7 `share_links` anon token dump (00022 policy).

**High:** H1 anon key authenticates; H2 forgeable `p_user_id` RPCs (exploitable via PostgREST today); H3 exception filter Sentry-spam + HTTP hang; H4 PII in diagnostic logs; H5 email HTML injection; H6 AI budget TOCTOU; H7 insights never logged; H8 sponsorship tracking no-ops + money race; H9 endRide odometer race + non-idempotent; H10 expense dashboard silently wrong >5k rows; H11 waypoint replacement data loss; H12 RC duplicate retries forever; H13 null `bike_id` crashes health-reports; H14 Meta Subscribe every renewal; H15 ~310 LOC dead searchRoutes; H16 makeStats cache never hits.

**Medium/duplication:** as in the audit; scheduled below or in Backlog.

## Phase Plan

| Phase | Scope | Audit items | Effort | Depends on |
|-------|-------|-------------|--------|-----------|
| 1. Production unblockers | Guard (default-closed), RLS+grants, throttler, deletion, listener, visibility, share-links policy, H2 RPCs | C1–C7, H1, H2, H12–H14 | L | — |
| 2. Security hardening | Filter, PII, email, token rotation, provider trust, GDPR export | H3–H5 + stragglers | M | 1 |
| 3. Money/quota | Pending-row budget RPC (H6+H7), sponsorship RPC, endRide claim-first, MODEL_COSTS completion, makeStats | H6–H9, H16 | M | 1 |
| 4. Data correctness | unwrap() first, SQL aggregation, atomic waypoints, dead code, verified misc bugs | H10, H11, H15 + Mediums | M | 1 |
| 5. Consolidation | 5a pagination, 5b unwrap sweep, 5c Paginated factory (+ drive-bys) | Duplication #1, #2, #5 | M | 4 |
| 6. Test scenarios | Per-fix Vitest matrix, inventory specs, shared mocks | (user-requested) | M | rolling |

Each phase = one PR. `pnpm precheck` + `pnpm generate` per phase. **Migrations: two-push strategy** — (push 1) drift audit/repair + 1b users migration, verify `pg_policies`, then (push 2) the rest of Phase 1's migrations. Dual-write code deploys **before** the visibility migration runs.

---

## Technical Approach

### Phase 1 — Production unblockers

**1a. Guard default-closed + JWT hardening + webhook revival (C1, H1, H12–H14)**
- `gql-auth.guard.ts`: branch request extraction —
  ```ts
  const req = context.getType<GqlContextType>() === 'graphql'
    ? GqlExecutionContext.create(context).getContext().req
    : context.switchToHttp().getRequest();
  ```
  then the SAME `isPublic`/JWT logic for both contexts (REST stays default-closed). `@Public()` on `HealthController` + `RevenueCatWebhookController` (now load-bearing; webhook keeps its HMAC check, which fails closed when the secret env is unset — verified).
- JWT (same file, same PR): require non-empty string `payload.sub`; per-path algorithm pinning (`decodeProtectedHeader` sync → HS256 branch `algorithms: ['HS256']`, JWKS branch `['ES256','RS256']`); `audience: 'authenticated'`; `issuer: ${SUPABASE_URL}/auth/v1` on both paths. Sentry-count legacy HS256 verifications (retirement metric). Pre-check: grep/logs for any non-Supabase JWT consumer.
- **H12**: `revenuecat.service.ts` — duplicate `NON_RENEWING_PURCHASE` (`ConflictException` / PG `23505`) → log + 200. **H13**: `HealthReport.motorcycleId` nullable; `pnpm generate`; mobile null-handling in same PR. **H14**: Meta `Subscribe` only on first paid conversion (INITIAL_PURCHASE non-trial or trial conversion via RC `period_type`/`is_trial_conversion`).
- **Ops (after deploy):** verify webhook 200s in RC dashboard. **Reconcile, don't replay**: source `app_user_id`s from our own tables (RC v1 `GET /subscribers/{id}` silently *creates* unknown subscribers), fetch current state, upsert entitlements conditionally on event timestamp (`WHERE last_event_at <= fetched_at` semantics — run the pass twice and diff as the simple variant). Meta CAPI untouched throughout. Note the guard's 60s tier cache delays visible effect. Check Render health-check config (prod `/health` didn't respond during audit).

**1b. `users` RLS + column grants (C2) — corrected design**
- **1b-zero (gate):** `supabase db diff --linked` + ledger check; `supabase migration repair --status reverted <version>` if needed. Don't re-run 00097 — supersede it (fully idempotent `DROP POLICY IF EXISTS` + recreate). Re-verify 00004's role-escalation protection still present in prod. Assert `handle` column/citext exist (partial drift = unknown drift).
- Migration (single transaction; corrected per data-migration review):
  - Row policies: `users_select_public_profiles FOR SELECT TO authenticated USING ((is_public = true OR id = (SELECT auth.uid())) AND deleted_at IS NULL)` — note **`deleted_at IS NULL`** (soft-deleted users must not stay enumerable); re-create anon-by-handle policy with the same `deleted_at` guard.
  - Column SELECT grants: `REVOKE SELECT ON public.users FROM authenticated, anon;` then `GRANT SELECT (id, handle, public_username, display_name, bio, city, avatar_url, follower_count, following_count, is_public, show_saved_publicly, created_at) ON public.users TO authenticated, anon;` **Never grant**: `email`, `full_name` (PII), `role`, `subscription_tier`, `subscription_status`, `subscription_expires_at`, `trial_started_at`, `revenuecat_id`, `preferences`, `currency`, `measurement_system`, `deleted_at`, `deletion_scheduled_at`, onboarding columns. (Column grants are role-wide across all visible rows — "grant email for own rows" is impossible.)
  - **Replace the UPDATE policy's WITH CHECK subselects with column-level UPDATE grants** (they'd deadlock under the REVOKE): `REVOKE UPDATE ... ; GRANT UPDATE (full_name, avatar_url, years_riding, preferences, measurement_system, currency, display_name, bio, city, public_username, handle, is_public, show_saved_publicly) ON public.users TO authenticated;` + simplified `FOR UPDATE USING/WITH CHECK (auth.uid() = id)`. Exact list: diff against `users.service.update()` + onboarding mutations before shipping. This is strictly stronger than the old subselect freeze.
  - `NOTIFY pgrst, 'reload schema';`
- **Code (deploys with/before the migration):** move own-row reads off the user client or onto granted columns — `users.service.ts:108` (`select('*')`), `:142` (`preferences`), `:154` (`update().select()`), `expenses.service.ts:181` (`currency`) → admin client + explicit `eq('id', userId)` (id from verified JWT). Inventory rule: **any** `select('*')`/bare `.select()`/post-mutation `.select()` touching `users` from the user client breaks — grep all. Verify web admin dashboard reads users via service role (the admin row policy no longer yields non-granted columns).
- Anon-facing `@Public()` trip feeds (`trip-lifecycle.service.ts:252/318/454`) + `getRiderProfile`: move user joins to SUPABASE_ADMIN with `redactOrganiser()`/app-layer redaction as the single privacy gate. Update root CLAUDE.md client rule + reconciliation note in `docs/solutions/security-issues/supabase-admin-client-on-public-queries.md` (this PR).
- Feed semantics decision: keep `users!inner` (rows of authors who went private drop out) — documented in code comment.
- **C7 (pulled forward):** `DROP POLICY "Anon read share links" ON public.share_links;` + `REVOKE SELECT ... FROM anon` — nothing breaks (`resolve()` uses admin client; owner reads have own-row policy).
- **H2 (pulled forward; exploitable via PostgREST today):** `join_group_ride` + `mark_article_read` get `IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE` — **`mark_article_read` is `LANGUAGE sql` → convert to plpgsql** (same signature). Both also get `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated` (they currently have default PUBLIC execute). Pre-checked: both called via user client only — safe.
- Post-deploy assertion script: `pg_policies` on `users`/`rides`/`share_links` matches expectations.

**1c. Rate limiting, selective (C3) — corrected config**
- Restore `gql-throttler.guard.ts` from `git show 24d066b5~1:...`; make `getRequestResponse` context-aware and **sync**; returned `res` must expose `.header()` (Express does) or set `setHeaders: false`. Override async `getTracker(req)`: `req.user?.id ?? req.ip` (Express `req.ip` honors `trust proxy = 1` already set in main.ts — never hand-parse `x-forwarded-for`, it's spoofable).
- `ThrottlerModule.forRoot({ throttlers: [{ name: 'default', limit: <permissive baseline>, ttl }], storage: redisThrottlerStorage })` — **exactly one named throttler** (multiple named presets would ALL apply to every guarded resolver). Module is `@Global()`; per-resolver `@UseGuards(GqlThrottlerGuard)` + `@Throttle({ default: THROTTLE_PRESETS.X })` overrides. No `APP_GUARD`, no `@SkipThrottle` anywhere.
- Throttled resolver list (the spec): `generateArticle`, `submitDiagnostic`, `askTripAssistant`, `generateOnboardingInsights`, `regenerateRideSummary`, `joinWaitlist`, `joinPremiumWaitlist`, `fuelStopsNearRoute`. Known gap accepted: comments/kudos/follows spam (DB-bounded).
- `redis-throttler.storage.ts` v6 interface: implement **only** `increment(key, ttlMs, limit, blockDurationMs, throttlerName)` returning `{totalHits, timeToExpire: seconds, isBlocked, timeToBlockExpire: seconds}`; atomic via `redis.multi().incr(key).pexpire(key, ttlMs, 'NX').pttl(key).exec()` (NOT `.pipeline()` — non-atomic). Implement block semantics (block key with TTL when `totalHits > limit`). In-memory fallback: track block expiry, `.unref()` the sweep timer, handle null Redis client.
- Redis-down: fail open + Sentry warn (per the standing invariant; global AI cap in Phase 3 is the financial backstop).
- Update `apps/api/CLAUDE.md` throttling claim in this PR.

**1d. Account deletion (C4)**
- Migration: `GRANT EXECUTE ON FUNCTION public.soft_delete_user(uuid) TO authenticated;` + same grant for `cancel_account_deletion(uuid)` (identical latent bug; same internal auth check). Keep `hard_delete_expired_accounts` service-role-only. `NOTIFY pgrst`.
- Integration check: user-client `auth.uid()` works end-to-end for the RPC.
- Ops: mine Sentry/logs for failed `deleteAccount` calls since 00033; complete those deletions manually (GDPR exposure compounds daily).

**1e. Ride-summary listener → singleton (C5)**
- New singleton `RideSummaryListenerService` (admin client) with `@OnEvent(RIDE_EVENTS.COMPLETED, { suppressErrors: false })` (or catch-and-Sentry inside — default suppresses errors silently). Define `RIDE_EVENTS` `as const` now (3 files share the literal).
- Idempotency: `ON CONFLICT (ride_id) DO NOTHING` — the unique index already exists (00058); just drift-check it in prod.
- Metering gates (ship in this commit): generations write to `content_generation_log` (verify fields); `enforceFreeTireSummaryLimit` → **fail closed** (minimal flip only — Phase 3's consolidation rewrites it); define `MODEL_COSTS: Record<AiModel, {...}>` in `config/constants.ts` **unconditionally here** and migrate ride-summaries to it (Phase 3 migrates the rest and **deletes `AI_COSTS`**). Accepted risk: limiter stays racy-but-bounded until H6 lands (overage ≤ concurrent-requests−1). No retroactive backfill.

**1f. Visibility canonicalization (C6) — corrected inventory & ordering**
- **Deploy order: dual-write code FIRST, then migration.** Code: `updateRide({isPublic})` also writes `visibility`; `updateRideVisibility` also writes `is_public`; `getPublicRide` gates on `visibility`; `Ride.isPublic` derived from `visibility === 'public'` in `mapRow` (SDL unchanged); `feed.service.ts:92` switches `.eq('is_public', true)` → `.eq('visibility', 'public')` (after the new index exists).
- Migration (single transaction; corrected SQL from the data-migration review — use its sketch):
  - Snapshot disagreeing rows into `_visibility_backfill_audit` (RLS-enabled, no policies = service-role only) — the rollback path.
  - Restrictive merge writing **BOTH** columns: disagreement → `visibility='private', is_public=false`.
  - **`DROP POLICY "rides_public_read"`** (00058 — never dropped by 00084; without this the merge is a read no-op).
  - Recreate `summaries_public_read` on `visibility`; recreate `kudos_insert` (00060) and `comments_insert` (**copy the 00070 body**, not 00063) swapping the rides predicate to `visibility = 'public' AND deleted_at IS NULL`.
  - Create new partial index on `visibility='public'` **before** the old one is dropped; old `is_public` index + column drop deferred to a later cleanup migration.
  - Verification queries in-migration-PR: 0 disagreeing rows; `rides_public_read` absent from `pg_policies`; snapshot populated. Rollback documented: restore from audit table + old policy DDL kept in the migration header comment.
- Product decisions documented: restrictive merge may 404 some previously-shared links (owner sign-off in PR); `visibility='unlisted'` rides — kudos/comments allowed on `'public'` only (decide + state).

### Phase 2 — Security hardening

- **H3** filter: branch on `host.getType<GqlContextType>()` — HTTP → write response via adapter; GraphQL → return GraphQLError (no writable response exists there). Sentry only non-HttpException or ≥500. Message passthrough only `<500`. Keep string error codes (mobile token refresh depends on them).
- **H4**: diagnostics resolver logs ids/flags only.
- **H5**: `escapeHtml()` at all email interpolation sites + `renderEmailLayout({title, bodyHtml})` + `EMAIL_COLORS as const`.
- **Share-link tokens (C7 follow-through): rotation preferred over hash-in-place** (tokens were anon-readable — treat as exfiltrated). If product chooses continuity instead: hash-in-place with the `token_hashed_at IS NULL` double-hash guard, `ALTER COLUMN token DROP DEFAULT`, app-side plaintext minting (node crypto) inserting only the hash, encoding normalized to 00086's `lower(token)::bytea` SHA-256 hex, `TOKEN_PATTERN` pre-check retained. Either way: tokens become show-once — `ShareLink.token/url` returned only at creation (GraphQL model + mobile UX change, plan explicitly); rollback = revoke/rotate, not restore (one-way hashes); migration header says so.
- **Provider trust**: `supabase-user.provider.ts` forwards guard-verified `request.accessToken`, not the raw header.
- **GDPR export completeness**: add rides, trips, fuel logs/stops, comments, follows, kudos, surface reports. (Parallelization: only if it's a one-line Promise.all while in the file.)
- HS256 retirement follow-up item: delete the legacy branch when the 1a Sentry counter flatlines at zero.

### Phase 3 — Money/quota (trimmed per simplicity verdict)

- **H6+H7 merged — pending-row reservation RPC** (replaces the draft's Redis reservation layer): `reserve_ai_generation(p_content_type, p_daily_limit)` — `SECURITY DEFINER`, `SET search_path=''`, identity via `auth.uid()`; `pg_advisory_xact_lock(hashtext(auth.uid()::text))`; count today's non-failed `content_generation_log` rows; over limit → raise; else insert `status='pending'` row, return id. Service updates that row to `success` (+ tokens + cost from MODEL_COSTS) or `failed`. The reservation row IS the log row → insights can't "forget" to log (H7 solved structurally); survives restarts; `aiBudgetStatus`/global cap keep reading one table. Global Redis circuit breaker unchanged (fail-closed backstop).
- `enforceFeatureLimit(userId, contentType)` on `AiBudgetService` — period + limit resolved internally from an `AI_FEATURE_LIMITS`-keyed dispatch table (constant already exists in `@motovault/types`); replaces the 3 copy-pasted blocks; date-fns for period math. `recordGeneration()` consumes `MODEL_COSTS` internally — callers pass only `{model, tokens, status}`.
- Migrate remaining cost call sites to `MODEL_COSTS` (defined in 1e) and **delete `AI_COSTS`**.
- **H8 sponsorship RPC — service_role only** (money-drain vector otherwise: any user could loop the RPC via PostgREST and drain budgets): `track_sponsorship_impression/_click(p_id)` per the corrected SQL — `WHERE status='active' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())`, spend clamp, auto-pause CASE; `REVOKE FROM PUBLIC, anon, authenticated; GRANT TO service_role`; service calls via SUPABASE_ADMIN (**keep** `_supabaseAdmin` — the draft's "remove unused" is reversed). Hide `costPerImpression/monthlyBudget/spentThisMonth` from the public model. Backlog: per-user impression dedupe ledger.
- **H9 endRide — claim-first conditional UPDATE, no RPC**: (1) `UPDATE rides SET mileage_applied = true WHERE id = ? AND user_id = ? AND mileage_applied = false` `.select()` — exactly one caller wins; loser/retry returns current completed ride state (idempotency fix, service-level). (2) Winner applies the existing TS odometer math (meters→`mileage_unit` conversion stays in its one documented place — an SQL RPC would duplicate it). Residual same-bike-two-rides-same-instant race documented and accepted (solo-rider app; user-correctable).
- **H16**: `MakeStatsService` singleton (admin client; the TTL cache finally works).

### Phase 4 — Data correctness (trimmed)

- **First commit: `src/common/supabase/unwrap.ts`** (moved up from 5b per architecture review) — every error-handling fix below adopts it; defines `PG_ERROR` `as const` (PGRST116, 23505) here.
- **H10**: `expense_dashboard_aggregates` RPC (or grouped selects) — `date_trunc` months, category sums, totals in SQL; verified-wrong today past 5k rows. Magic `5000` → `QUERY_LIMITS.MAX_EXPENSES_PER_QUERY` where a raw fetch survives.
- **H11**: `replace_trip_waypoints(p_trip_id, p_waypoints jsonb)` RPC — **no `p_user_id`**; `auth.uid()` + organiser check inside; mirrors `reorder_trip_waypoints` (00085).
- **H15**: delete dead searchRoutes (~310 LOC) + duplicate `LatLngInput` + ignored `near` arg + group-rides dead geo args + duplicate `me` query + `reviewer` dup field.
- **Verified misc bugs (do now):** `tripDetail` passes `@CurrentUser()`; `savedTrips` → `TRIP_DETAIL_SELECT`; `shareRideAsTrip` `.single()`→`.maybeSingle()` (dup check passes on multi-row today); `createNextRecurrence` logs + user client (recurring chains die silently); `getComments` exactly-one-target Zod guard (skip the dispatch-table refactor); pt-BR locale full-tag-then-base fallback; `meta-events` hardcoded `3.0.0`/OS constants (corrupts ad attribution); diagnostics whole-garage fetch → `findById(userId, bikeId)`; Discover admin-ID cache (full users scan per request); places-taxonomy Redis cache 1h (this endpoint caused the throttler removal); articles/quizzes/places log + rethrow non-PGRST116 via `unwrap()`; `respondToTripInvite` → **throw** on join failure (no new RPC); interactive AI timeouts ↓ ~30s / 1 retry.
- **Client-choice fixes kept:** maintenance-tasks admin **writes** → user client (RLS posture); `@Public()`-with-user-client reads (search/places) per the per-table rule. Deferred: admin-for-authenticated-reads pairs (ride-analytics, entitlements) — correct today, fix when touched.

### Phase 5 — Consolidation (5a/5b/5c only)

CI gate on every commit: `pnpm generate && git diff --exit-code apps/api/schema.graphql packages/graphql/src/generated`.

- **5a `src/common/pagination/`**: `encodeCursor(...parts)`, `decodeCursor(cursor, shape)` (keep the ISO-date+UUID regex injection defense), `buildConnection({rows, limit, mapNode, cursorOf, totalCount?})`, `clampFirst(first, max=50)`. Composite `(timestamp, id)` cursors fix tie-skipping as sites migrate; **legacy cursor fallback** mandatory. All 17 sites + 5 codec pairs.
- **5b**: mechanical `unwrap()` sweep of the remaining ~90 log-and-throw sites (the hard cases were shaken down in Phase 4). CI grep banning raw `'PGRST116'`/`'23505'` lands here; plus grep banning new `select('*')` in apps/api.
- **5c**: `Paginated(classRef, name)` factory replacing 9 Edge/Connection pairs (explicit SDL names).
- **Drive-bys (no standalone commits):** `getFollowers`/`getFollowing` collapse; NHTSA `fetchJson<T>`; `assertOwner()` only where a touched file already has the pattern — scoped to **pre-checks before RPCs/multi-step ops only, never replacing owner-scoped WHERE filters**; typed `keyof Database['public']['Tables']`.

### Phase 6 — Test scenarios (user-requested; rolling per phase, finalized last)

Shared infra first: `apps/api/test/supabase-mock.ts` (extract the `createChain`/`createMockClient` duplicated in 5 spec files).

| Area | Scenarios (trimmed of mock-theater) |
|------|-----------|
| Guard (1a) | REST without JWT → 401 unless `@Public()`; REST `@Public()` → passes; GraphQL without JWT → 401; valid JWT → user populated; **anon key as Bearer → 401** (no sub); wrong `aud` → 401; wrong `issuer` → 401; HS256 token routed to JWKS path → 401 (per-path alg pinning); `@Public()` GraphQL + anon-key Bearer → proceeds **without** user object. **Controller-inventory spec**: every `@Controller()` route is `@Public()` or carries its own guard. |
| Webhook (1a) | Valid HMAC → 200; invalid/missing secret → fails closed; duplicate subscription event → 200; duplicate `NON_RENEWING_PURCHASE` → 200 (no retry loop); RENEWAL → no Meta Subscribe; first conversion → exactly one; malformed → 422. |
| users RLS (1b) | Migration-PR SQL verification (one-time gates, not suite members): other-user `email` select → denied; granted columns of public profile → rows; private/soft-deleted profile → 0 rows; own-row full read via admin path works; profile UPDATE still works (the WITH-CHECK deadlock regression). Post-deploy `pg_policies` script. Service-level: feed returns followed users' rides (mocked). |
| Throttler (1c) | Preset metadata applied per enumerated resolver (reflection spec); storage call-shape: `multi()` used, `PEXPIRE NX` present, TTL always set; null-Redis fallback; userId tracker for authed / `req.ip` for public. **Structural spec: every resolver class injecting the AI client or `AiBudgetService` carries `@UseGuards(GqlThrottlerGuard)`** (the enumerated list rots otherwise). |
| Deletion (1d) | RPC-exists + happy path; non-owner → raises. |
| Listener (1e) | `ride.completed` → singleton generates for a private ride (admin client); duplicate event → single summary; generation logged; free-tier limit fail-closed; listener errors NOT silently suppressed. |
| Visibility (1f) | Dual-write both directions; `getPublicRide` honors `visibility`; `mapRow` derives `isPublic`; kudos/comments on newly-public ride; migration verification queries (SQL, in PR). |
| Budget (3) | `reserve_ai_generation` RPC-exists + contract (over-limit raises; pending row created; update-to-success/failed); insights generation produces a log row; MODEL_COSTS table-driven test; `AI_COSTS` no longer referenced. |
| endRide (3) | Retry after success → returns completed ride, mileage applied once; claim-before-apply order asserted; loser of concurrent claim skips mileage. |
| Sponsorship (3) | RPC called via admin client (not JS math); RPC-exists; error surfaces. |
| Aggregation (4) | RPC-exists + one staging verification query (documented in PR); small-fixture parity only if a JS fallback path survives. |
| Pagination (5a) | Round-trip encode/decode; composite ordering with timestamp ties; **legacy cursor accepted**; malformed → BadRequest; injection strings rejected. |
| unwrap (5b) | PGRST116 → NotFound; 23505 → onConflict; generic → ISE; success passthrough. |
| Misc (4) | pt-BR → pt-BR, `pt` → en; `escapeHtml` payload inert; `getComments` zero targets → BadRequest. |
| Guard-audit extension | "No accidental `@Public()`" spec extended to **every** module's resolver. |

---

## Backlog (explicitly deferred — nothing silently dropped)

From the audit, deferred with rationale (revisit when touched or when scale demands):
- JS→SQL for rider stats / spending summary / ride-analytics single-fetch (merely slow, not wrong; each needs an RPC+migration).
- Diagnostics/fuel-stops fat-resolver decomposition + Promise.all batching (saves 1-2s on 30-60s AI paths).
- `updateTrip` single pre-read; popular-articles cache; `joinWaitlist` dedupe (1c throttle kills the abuse); `publishAsTemplate` slug suffix; correlation-id stability fix.
- Admin-for-authenticated-**reads** client swaps (ride-analytics, entitlements).
- Duplication #3 `camelizeRow` (med-risk null semantics ×31 mappers), #4 photo factory (until a 3rd photo feature), #6 UserSummary, #7 `Tables<>` adoption, #9 `pickDefinedSnake` (cut).
- Enum-registration migration of the 445-line file (until an enum changes); full date-fns/constants sweeps (touch-only rule applies); `new Date()` CI guard (flaky regex).
- Sponsorship per-user impression dedupe ledger; HS256 branch deletion (when counter flatlines); `forToken()` singleton Supabase factory (named stretch — after Phase 2's accessToken plumbing; request-scoped DataLoaders stay request-scoped, that scope is load-bearing).
- comments/kudos/follows spam throttling (DB-bounded).

## System-Wide Impact

- Guard branching changes auth posture for both context types — controller-inventory + module-wide guard-audit specs are the nets.
- Webhook revival resumes entitlement writes; reconciliation conditional on event timestamps; guard tier cache delays visibility 60s.
- Column grants are role-wide: any users-table `select('*')` from the user client anywhere breaks — grep-inventory is load-bearing, deploy code before/with migration.
- Reviving the listener opens an AI spend channel — metered + fail-closed in the same commit.
- `HealthReport.motorcycleId` nullability is a generated-type break (mobile same PR). `Ride.isPublic` derived (SDL unchanged). Phase 5 SDL byte-stable (CI gate). No forced app release anywhere (legacy cursors, derived isPublic, null tolerated at runtime).

## Acceptance Criteria

**Phase 1 (go/no-go):**
- [ ] `GET /health` 200 unauthenticated (prod); REST routes default-closed otherwise
- [ ] RC dashboard: 200 deliveries; duplicates → 200; entitlements reconciled; zero Meta CAPI during reconciliation
- [ ] Anon key as Bearer → 401; valid sessions unaffected; profile UPDATE still works post-grants
- [ ] Other-user `email/full_name/role/tier` unreadable (SQL test); feed shows followed users' rides (staging)
- [ ] `share_links` not anon-readable; H2 RPCs reject forged `p_user_id` and anon callers
- [ ] AI mutations throttled per presets; public SSR unthrottled (no MOTOVAULT-WEB-4 regression)
- [ ] `deleteAccount` succeeds; backlog of failed deletions processed
- [ ] Private-ride completion generates a metered, logged summary; fail-closed limit
- [ ] 0 disagreeing visibility rows; `rides_public_read` absent; snapshot table populated; kudos/comments work on public rides

**Phases 2–6:**
- [ ] Sentry: no 4xx noise; HTTP errors return real responses; <500 messages only
- [ ] Reservation RPC bounds concurrent AI generations; insights metered; `AI_COSTS` deleted
- [ ] endRide idempotent; mileage exactly-once under the claim gate
- [ ] Expense dashboard correct on >5k-row staging data
- [ ] Dead code gone; `pnpm generate` diff intentional-only; SDL byte-stable through Phase 5
- [ ] ≥600 LOC net removal from 5a–5c; CI greps active (PGRST116/23505, select('*'))
- [ ] `pnpm precheck` green per phase; guard-audit + controller-inventory + AI-guard structural specs all green

## Dependencies & Risks

- Two-push migration strategy; drift repair gates everything (1b-zero). Dual-write code deploys before the visibility migration. RPC migrations ship with their calling code + RPC-exists tests.
- Column grants: the UPDATE-policy deadlock and `select('*')` breakage are the two known landmines — both have corrected designs above; staging pass mandatory.
- Restrictive visibility merge may 404 some shared links — owner sign-off in PR.
- Throttler: single-default-throttler config is the verified-correct shape; `req.ip` is the spec.
- RC reconciliation: source IDs from our tables only (v1 GET creates subscribers); run-twice-and-diff.

## Sources & References

- **Source audit:** `docs/Backend-Audit-2026-06-09.md`
- **Deepening reviews (2026-06-09):** framework-docs verification (throttler 6.5.0 / @upstash/redis 1.37 / jose 6.2 / @nestjs/graphql 13.2.4 / event-emitter 3.0.1 — verified against installed node_modules), data-migration review (corrected SQL for 1b/1f/H8/RPCs; blockers found in draft sketches), security review (C7 share_links discovery, default-closed guard, deny-list completion, RC reconciliation races), architecture review (A1–A10: phase ordering, helper shapes, scope strategy), simplicity verdict (Phase 3–7 trims; ~1,700–2,200 LOC churn removed, 100% of production fixes preserved)
- **Institutional learnings:** `docs/solutions/security-issues/dead-jwks-path-missing-await.md`, `security-issues/supabase-admin-client-on-public-queries.md`, `runtime-errors/redis-backed-infra-and-backend-hardening.md`, `integration-issues/monorepo-code-review-multi-category-fixes.md`, `integration-issues/scheduled-social-worker-cron-migration.md`, `architecture/trip-unification-three-entities-to-one.md`, `integration-issues/expense-dashboard-server-aggregation-charting.md`
- **Git archaeology:** `24d066b5` (throttler removal; guard restorable at `24d066b5~1`)
- **Prod verification:** `pg_policies` on `users` queried live 2026-06-09; RLS gap + 00097 drift confirmed
- **Key migrations referenced:** 00003, 00004, 00014, 00022, 00031, 00033, 00041, 00057, 00058, 00059, 00060, 00061, 00063, 00068, 00070, 00084, 00085, 00086, 00097, 00100, 00139
- **Precedent plan:** `docs/plans/2026-05-29-001-refactor-mobile-codebase-audit-remediation-plan.md`
