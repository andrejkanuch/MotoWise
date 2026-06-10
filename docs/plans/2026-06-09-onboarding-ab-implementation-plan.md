# Onboarding A/B Test — Implementation Plan

**Date:** 2026-06-09
**Branch:** `feat/onboarding-ab-2026` (off `fix/backend-audit-remediation` — the default-closed API auth guard lives there and every new `@Public()` resolver interacts with it)
**Specs:** `onboarding-abc-test-plan.md` · `onboarding-design-prompts.md` (A) · `onboarding-design-prompts-variantB.md` (B) · `auth-and-paywall-timing.md` · `onboarding-aha-moment.md`
**Visual source of truth:** `docs/design-reference/onboarding-v4/` (JSX extracted from the standalone HTML reference — screens 01–12, S1, CP, tokens, chrome)

---

## Current-state findings (verified in code)

| Area | Today |
|---|---|
| Flow | 8 V2 screens: welcome → experience → goals → bike-setup → maintenance → paywall → notifications → personalizing (`config/onboarding.ts`, `ONBOARDING_SCREENS`) |
| Auth | **Account required BEFORE onboarding.** `_layout.tsx` `Stack.Protected guard={isSignedIn && !onboardingCompleted}`; `(auth)/` stack (login/register) shown when no session |
| Completion | `personalizing.tsx` calls `completeOnboarding` mutation (JWT required) → `setOnboardingCompleted(true)` (in-memory only) → tabs |
| Bike skip | `handleSkip()` → `setBikeData(null)`; maintenance silently auto-skips when no bike |
| Analytics | `posthog-react-native`, eager init in `analytics.ts`; `ONBOARDING_STARTED/STEP_VIEWED/STEP_COMPLETED/STEP_SKIPPED/COMPLETED/RESUMED` exist with `step`/`step_index`; **no feature flags used anywhere** |
| RevenueCat | `Purchases.configure` is lazy — first triggered by `loginRevenueCat(userId)` after sign-in. `presentPaywall({placement, personalization})` + `setOnboardingAttributes()` exist |
| API AI | **OpenAI only** (`openai@6`, `gpt-4.1`, 60s timeout, Zod via `zodResponseFormat`) in `diagnostics/diagnostic-ai.service.ts`. No Anthropic/Gemini SDK installed |
| NHTSA | `motorcycles/nhtsa.service.ts`: vPIC makes/models + `getRecallsByVin(vin)` — **no year/make/model recall lookup** (onboarding has no VIN) |
| OEM | `oemSchedulesPreview(make, model?, year?)` public query exists (1h cache) |
| Make stats | Fleet stats query w/ `riders` count already consumed in `bike-setup.tsx` (24h staleTime) |
| Store | `onboarding.store.ts` zustand+MMKV v5; already has `ridingFrequency`, `lastServiceDate`, `currentMileage` (inside `bikeData`), `lastCompletedScreen` resume |
| Migrations | Latest `00142_account_deletion_grants.sql` |

---

## Key decisions & defaults (deviations flagged ⚠)

1. **Variant routing model.** One multivariate PostHog flag `onboarding_ab_2026`: `lean` | `invested` | `control`. `lean`/`invested` → new flow; `control` (or flag disabled/missing after successful fetch) → **existing V4 flow untouched** = the safety degradation + trivial holdout. Default rollout 50/50 lean/invested, control at 0%.
2. **Offline fallback.** Flag fetch fails/times out (~2s budget) → assign `lean` locally (`source: 'fallback'`), persist, never re-roll. When PostHog later connects we push the locally-assigned variant as person/super property + `$feature_flag_called` so funnels stay truthful. We do **not** re-assign mid-flow.
3. ⚠ **Free users get the Account step at the end of onboarding** (after paywall-dismiss → before notifications), framed "Save your setup", instead of "no wall + contextual prompt later". Reason: the entire app (tabs, GraphQL, RLS) requires a Supabase session; app-wide anonymous support (e.g. Supabase anonymous sign-ins + identity linking) is a product-scale change far beyond this test and risky on native OAuth (no idToken-based identity linking). The test's lever is preserved: **anonymous through onboarding AND the paywall; purchase friction = Buy button only; purchasers see "Secure your subscription"**. Both arms identical on auth so the A/B comparison is unaffected.
4. ⚠ **Post-purchase Account "Not now" is omitted** (same reason — a session is required to enter tabs). Purchasers are already Pro on-device; account screen is one-tap Apple/Google-first.
5. ⚠ **AI provider chain = Gemini (primary, when `GOOGLE_GENERATIVE_AI_API_KEY` set) → OpenAI (existing `OPENAI_API_KEY`, secondary) → static template**, all via the **Vercel AI SDK** (`ai` + `@ai-sdk/google` + `@ai-sdk/openai`, `generateObject` with Zod). Anthropic is NOT used (per product direction — we hold Gemini/OpenAI keys). Spec said "Claude (primary)"; superseded.
6. **Recalls by year/make/model** via NHTSA `api.nhtsa.gov/recalls/recallsByVehicle?make=&model=&modelYear=` (new service method, cached in `model_insights`-adjacent cache, separate from vPIC). Make-only bikes (partial capture, no model): recall card degrades to "we'll watch recalls for your {make}" — no fabricated count.
7. **Cost projection** = OEM schedule preview × in-code `as const` per-category cost table (EUR), shipped in API service (no DB table for v1 — fewer moving parts; table can come later). Hedged copy ("about €X").
8. **One composed public query** `onboardingReveal(year, make, model?)` returns recalls + oemTaskCount + projectedYearlyCost + riderCount + `insights {status, knownIssues[]}` — single round-trip behind B's 04L loader; A uses the same query (ignores AI fields). All onboarding-time resolvers are `@Public()` + `SUPABASE_ADMIN` (anonymous users have no JWT).
9. **`completeOnboarding` timing**: unchanged mutation, now fired in `personalizing` *after* the account exists (account now precedes it in both arms). Onboarding answers live in the persisted zustand store until then (already the case today).
10. **V4 screens stay in place** (`control` + safety). New flow = new routes living alongside; `config/onboarding.ts` becomes variant-keyed.
11. **i18n**: new screens use `t()` with EN strings added; other locales get EN fallback in v1 (translation pass is a follow-up).
12. **RevenueCat anonymous at launch** for users in `lean`/`invested` without a session; `Purchases.logIn(supabaseUUID)` on account create/sign-in aliases the purchase (already what `loginRevenueCat` does). `$posthogUserId` attribute set to the PostHog anonymous distinct_id pre-auth so RC events join the funnel.

---

## Workstreams

### W1 — Experiment assignment (PostHog)
- **New** `apps/mobile/src/stores/experiment.store.ts` — zustand + MMKV (`experiment-state`): `{ onboardingVariant: 'lean'|'invested'|'control'|null, assignedAt: string|null, source: 'posthog'|'fallback'|null }` + `assignVariant()`, `reset()` (never reset on logout).
- **New** `apps/mobile/src/lib/onboarding-experiment.ts` — `resolveOnboardingVariant()`: if persisted → return; else `posthog.reloadFeatureFlagsAsync()` with ~2s race → `getFeatureFlag('onboarding_ab_2026')`; map unknown/disabled→`control`; fetch-error→`lean` fallback; persist; `posthog.register({ onboarding_variant })` + `$set` person property; capture exposure (`$feature_flag_called` fires automatically on `getFeatureFlag`; manual capture on fallback path).
- Hook into `(onboarding)/index.tsx` before first render (splash holds until resolved, hard 2.5s cap).
- Constants in `config/onboarding.ts`: `EXPERIMENT_FLAG_KEY`, `OB_VARIANT = {LEAN, INVESTED, CONTROL} as const`.
- Create the flag in PostHog (EU project 155556) via MCP: multivariate `lean` 50 / `invested` 50 / `control` 0.

### W2 — Analytics funnel
- `analytics.ts`: add events `REVEAL_VIEWED`, `COMMITMENT_COMPLETED`, `ACCOUNT_CREATED`, `BIKE_ADDED` (onboarding activation, make-level; distinct from `GARAGE_BIKE_ADDED`).
- **New** `apps/mobile/src/lib/onboarding-analytics.ts` — `trackOnboardingEvent(event, screen, props)` auto-attaches `{variant, step, step_index}` from experiment store + variant-aware config. All onboarding screens migrate to it.
- `onboarding_completed` carries `has_bike`, `primary_goal`, `variant`.
- **New doc** `docs/onboarding-ab-event-schema.md` — full event/property schema + the PostHog funnel definition (install→trial primary, bike-add guardrail).

### W3 — Variant-aware flow (mobile)
- `config/onboarding.ts`: `ONBOARDING_FLOWS: Record<ObVariant, readonly OnboardingRoute[]>` (control = current list). `getResumeRoute`/`getPreviousRoute`/progress index take `variant`. `TOTAL_SCREENS` → `getTotalScreens(variant)`.
- Flow A (lean): index → experience → bike-setup → **reveal** → goals → maintenance → **commitment** → paywall → **account** → notifications → personalizing.
- Flow B (invested): index → experience → **frequency** → **stay-on-top** → **last-service** → bike-setup → **building-plan** → reveal(projection-led) → goals → maintenance → commitment(hold) → paywall → account → notifications → personalizing.
- `_layout.tsx` root gate: `(onboarding)` now also reachable with **no session** when variant ∈ {lean, invested} && !locallyCompleted; `(auth)` remains for control + returning users. Welcome "Log in" → existing `(auth)/login` (returning-user path). Local persisted `onboardingCompleted` flag added (survives kill) and reconciled with server `preferences.onboardingCompleted` once signed in.
- Bike skip → partial capture sheet (popular makes, "just my make") that **always** `setBikeData({make, year: default, …})` — `setBikeData(null)` path removed from the new flow; fires `BIKE_ADDED` with `capture_level: 'make'|'model'`.
- Maintenance: always populated (bike always exists in new flow); guard the no-bike dead-end for control only.

### W4 — New/modified screens
Match `docs/design-reference/onboarding-v4/` (layout, copy, motion); reanimated v4, palette tokens, `borderCurve: 'continuous'`, <300ms, haptics.
- **Shared new:** `reveal.tsx` (Bike Dossier; A=recall-led order, B=projection-led + AI known-issues card — same component, variant prop), `commitment.tsx` (A=1-tap; B=press-and-hold fill w/ haptic), `account.tsx` (post-purchase "Secure your subscription" / free "Save your setup"; Apple/Google/email reusing `(auth)` logic).
- **B-only:** `frequency.tsx` (clone experience card pattern), `stay-on-top.tsx` (clone goals multi-select), `last-service.tsx` (chips + mileage input reusing `mileage-slider`/year-input patterns), `building-plan.tsx` (personalizing pulse-ring + ticking status lines, advances at data-ready or 2.5s cap).
- Store additions: `stayOnTopOf: string[]`, plus reuse existing `ridingFrequency`, `lastServiceDate`; `bikeData.currentMileage` for mileage. Bump store version w/ migration.

### W5 — Auth / RevenueCat
- `subscription.ts`: `configureRevenueCatAnonymously()` called at launch for lean/invested (no session); keep lazy login path. `Purchases.setAttributes({$posthogUserId: <anon distinct_id>})` pre-auth.
- Paywall screen: add "Restore purchases" + "Already have an account? Sign in" affordances (paywall result handling already supports `restored`).
- `account.tsx`: on signup/sign-in success → `loginRevenueCat(supabaseUUID)` (aliases anonymous purchase) → continue to notifications. `personalizing` then runs `completeOnboarding` with the fresh JWT.
- **Config task (dashboard, documented in PR):** RevenueCat Restore Behavior = "Transfer to new App User ID".

### W6 — AI personalization service (API)
- **New module** `apps/api/src/modules/model-insights/`:
  - `ai-provider.interface.ts` + `gemini.provider.ts` / `openai.provider.ts` / `static.provider.ts` (shared `generate-insights.ts` using the AI SDK `generateObject`); failover chain w/ per-call timeout via `AbortSignal.timeout` (env `AI_INSIGHTS_TIMEOUT_MS`, default 2000) + Zod validation (`ModelInsightsPayloadSchema` in `@motovault/types`) — invalid/timeout = fail down chain.
  - `model-insights.service.ts`: cache-first read of `model_insights` by normalized (year, make, model); on miss insert `pending` row + fire-and-forget generation; periodic regen by `generated_at` age.
  - `onboarding-reveal.resolver.ts`: `@Public()` `onboardingReveal(year, make, model?)` → composed payload (recalls via new `nhtsa.service.getRecallsByYearMakeModel`, oemTaskCount + projected cost via OemSchedules + cost table, riderCount via existing stats, insights).
  - Known-issues prompt: Y/M/M only (no PII), hedged output enforced by schema (`bullets: 3 × {title, detail}` + mandatory hedge phrasing), token-capped.
- Feature flag: env `AI_INSIGHTS_ENABLED` (API kill switch) — disabled → static provider only; mobile hides AI card when `insights.status !== 'ready'`.

### W7 — Data model + GraphQL
- Migration `00143_model_insights.sql`: table (id uuid pk, year int, make text, model text, normalized_key text unique, status text check, payload jsonb, source_model text, generated_at timestamptz, created_at, updated_at) + RLS **deny-all to authenticated** (service-role only — read path is the public resolver via SUPABASE_ADMIN with app-layer shaping) + index on normalized_key.
- Sequence per CLAUDE.md: migration → `npx supabase db push` → `pnpm generate:types` → Zod schemas in `@motovault/types` → NestJS models/resolver → `pnpm generate`.
- Mobile op: `apps/mobile/src/graphql/queries/get-onboarding-reveal.graphql`.

### W8 — Tests & verification
- Mobile (jest): experiment assignment (posthog ok / offline fallback / persistence / no re-roll), variant flow selection + resume routes per variant, partial-capture skip yields `has_bike=true`, onboarding-analytics attaches variant on every event.
- API (vitest): provider failover (timeout → next → static), Zod-invalid → failover, cache hit/miss/pending, recalls-by-YMM mapping, cost projection.
- Manual QA checklist appended to `docs/onboarding-ab-event-schema.md` (both arms; purchase/free/restore/sign-in; AI-down; offline assignment).
- `pnpm generate` + `pnpm precheck` green per workstream commit.

## Commit plan
1. `docs: onboarding A/B plan + reference design + event schema`
2. `feat(mobile): W1 experiment assignment`
3. `feat(mobile): W2 analytics funnel`
4. `feat(mobile): W3 variant-aware flow + restructure`
5. `feat(mobile): W4 new screens (reveal/commitment/account + B set)`
6. `feat(mobile): W5 anonymous RC + post-purchase account`
7. `feat(api,db,types): W6+W7 model insights + reveal query + migration`
8. `test: W8 coverage + QA checklist`

## Out-of-code config tasks
- PostHog: create `onboarding_ab_2026` flag (done via MCP during W1).
- RevenueCat dashboard: Restore Behavior → "Transfer to new App User ID".
- API env: `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini primary; falls back to OpenAI without it), `AI_INSIGHTS_ENABLED=true`, `AI_INSIGHTS_TIMEOUT_MS=2000`.
- Supabase: `npx supabase db push` for 00143 (done during W7).
