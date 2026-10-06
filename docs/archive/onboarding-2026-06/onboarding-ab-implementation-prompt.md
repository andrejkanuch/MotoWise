# Implementation Prompt — Onboarding A/B Test (code + PostHog)

Paste everything in the box below into your coding agent (Claude Code) from the repo root
(`/Users/andrejmacm5/personal/MotoWise`). It references spec docs that live in this repo:
`onboarding-abc-test-plan.md`, `onboarding-restructure-proposal.md`,
`onboarding-design-prompts.md` (Variant A), `onboarding-design-prompts-variantB.md`,
`auth-and-paywall-timing.md`, `onboarding-aha-moment.md`, and `CLAUDE.md`.

---

```
ROLE
You are implementing a two-arm A/B test of the MotoVault onboarding flow across the
mobile app (Expo/React Native) and the API (NestJS + Supabase + RevenueCat), with PostHog
powering assignment and the conversion funnel. Work within the existing monorepo and
follow CLAUDE.md exactly.

START HERE — READ BEFORE CODING (do not skip)
1. Read CLAUDE.md (conventions, type system, update sequence, do-NOTs).
2. Read these spec docs in the repo root and treat them as the source of truth for the
   flows and rules:
   - onboarding-abc-test-plan.md  (the A/B definition, metrics, AI fallback architecture)
   - onboarding-design-prompts.md  (Variant A = "Value-first, lean" — screen specs)
   - VARIANT A REFERENCE DESIGN (the built screens, visual source of truth):
       file:///Users/andrejmacm5/Downloads/MotoVault%20Onboarding%20Screens%20(standalone).html
       i.e. "/Users/andrejmacm5/Downloads/MotoVault Onboarding Screens (standalone).html".
       Open this HTML to see Variant A's actual screens, layout, components, copy, colors,
       and motion. Variant A code must match it; Variant B must reuse the same components
       and look identical to A on every shared screen (see variant-B doc for the deltas).
   - onboarding-design-prompts-variantB.md  (Variant B = "Invested & personalized" — delta from A)
   - auth-and-paywall-timing.md  (anonymous-through-paywall + post-purchase account model)
   - onboarding-aha-moment.md  (the Bike Dossier / Reveal content)
3. Explore the current implementation and confirm assumptions before changing anything:
   - apps/mobile/src/app/(onboarding)/* , config/onboarding.ts , stores/onboarding.store.ts ,
     hooks/use-onboarding-back.ts , components/onboarding/*
   - apps/mobile/src/lib/analytics.ts (AnalyticsEvent, trackEvent) and how PostHog is wired
   - apps/mobile/src/lib/subscription.ts (RevenueCat: presentPaywall, setOnboardingAttributes)
     and wherever Purchases.configure / logIn is called
   - apps/mobile/src/stores/auth.store.ts (onboardingCompleted, sign-in)
   - apps/mobile/src/graphql/mutations/complete-onboarding.graphql and the API resolver
   Produce a short written PLAN (file: docs or PR description) of the changes per workstream
   BEFORE implementing. Ask me only if something is genuinely ambiguous; otherwise proceed
   with sensible defaults and note them.

NON-NEGOTIABLE GUARDRAILS
- Onboarding must NEVER block on a live AI/network call. The day-0 window is where
  conversions are won. Use precompute+cache and tight timeouts with graceful fallback.
- Authoritative facts (recalls, specs, OEM intervals) come from APIs/our data, NEVER from
  an LLM. The LLM only phrases/summarizes, and its output must be hedged.
- Everything new is behind a feature flag and degrades safely to the current behavior.
- Follow CLAUDE.md: no `any` for GraphQL data (use generated @motovault/graphql types);
  colors only from palette tokens; Zod for AI response validation; reanimated v4 (not RN
  Animated); borderCurve 'continuous'; map snake_case→camelCase at the NestJS service layer;
  all DB changes via supabase/migrations + the documented update sequence; never expose the
  service-role key; @Public() resolvers use SUPABASE_ADMIN. Biome for lint/format.
- Keep main green: run `pnpm precheck` (and `pnpm generate` after any resolver/.graphql/model
  change) before considering a workstream done.

THE TEST (summary — full detail in the spec docs)
Two arms, both apply the SAME core restructure (bike = first real action, search-first bike
with a demoted partial-capture skip, an instant Reveal payoff, a commitment step, and
anonymous-through-purchase auth with a post-purchase account). They differ on ONE lever:
- VARIANT A "lean" (reference design = the standalone HTML in Downloads, see READ list):
  shortest path — Experience(1 tap) → Bike → Reveal(concise, recall-led)
  → Goals → Maintenance → Commitment(1-tap) → Paywall → Account(post-purchase) → Notifications
  → Personalizing.
- VARIANT B "invested": adds profiling questions (frequency, "stay on top of", last
  service & mileage), a "Building your plan…" loader, a projection-led Reveal with an
  AI "known issues" card, and a press-and-hold/signature Commitment; paywall fires right
  after the projection peak. Visually identical to A on shared screens (see variant-B doc).
Assignment is 50/50, persistent per install. (Optional: support a third "control" bucket
mapped to the current V4 flow as a holdout — implement the routing so this is trivial to
enable, but default to 50/50 A/B.)

WORKSTREAMS

W1 — Experiment assignment (PostHog)
- Use the existing PostHog integration. Create a multivariate feature flag
  `onboarding_ab_2026` with variants: `lean` (A), `invested` (B) [+ optional `control`].
- Assign ONCE at first launch, BEFORE the onboarding welcome renders; persist the resolved
  variant (MMKV, e.g. an `experiment.store.ts` or a field on the onboarding store) so it is
  stable across resume-after-kill and never re-rolls mid-flow.
- Bucket on a stable distinct_id (the same anonymous id used for RevenueCat where possible).
- Fallback: if the flag can't be fetched (offline/PostHog down), default to `lean` (A) and
  still record the assignment locally; reconcile when the flag resolves. Never leave the
  user without a flow.
- Register the variant as a PostHog person/super property AND attach it to every onboarding
  event (W2). Fire the `$feature_flag_called` / exposure event on assignment.

W2 — Analytics funnel
- Extend AnalyticsEvent / trackEvent so EVERY onboarding event carries `variant`,
  `step`, and `step_index`. Ensure parity across both arms (same event names; B adds events
  for its extra steps).
- Required funnel events (reuse existing where present): onboarding_started,
  onboarding_step_viewed/completed/skipped, bike_added (make-level; the activation metric),
  reveal_viewed, commitment_completed, paywall_viewed, paywall_result (purchased/closed),
  account_created (post-purchase), onboarding_completed (with has_bike, primary_goal, variant).
- Confirm the events map to PostHog so the funnel + the primary metric (install→trial start)
  and guardrails (bike-add rate, trial→paid, retention) can be built. Document the event
  schema in a short markdown file under the repo.

W3 — Variant-aware onboarding flow (mobile)
- Refactor config/onboarding.ts so the ordered screen list is selected by variant
  (A list vs B list), keeping ONBOARDING_SCREENS / getResumeRoute / progress-index logic
  variant-aware (B has more screens → more progress segments). Do not break resume-after-kill.
- Route the (onboarding) stack by the persisted variant. Reuse existing screens for the
  shared steps; only add B's extra screens.
- Apply the core restructure to BOTH arms per the specs: move bike to the first real action,
  make the bike step search-first with the skip DEMOTED to a partial-capture (must still set
  a make-level bike, not setBikeData(null)); add the Reveal and Commitment; ensure Maintenance
  no longer silently dead-ends when bike is missing.

W4 — New/modified screens (Variant B), styled identically to A
- New: 03a Frequency (clone Experience card), 03b "Stay on top of" (clone Goals multi-select),
  03c Last service & mileage (chips + numeric input), 04L "Building your plan…" loader
  (reuse Personalizing's pulsing-ring style). Persist answers to the onboarding store
  (ridingFrequency, lastServiceDate, currentMileage already exist; add fields if needed).
- Modified: 05 Reveal → projection-led + AI known-issues card; 08 Commitment → press-and-hold
  or signature. Follow onboarding-design-prompts-variantB.md exactly. Use palette tokens and
  reanimated v4; keep B visually indistinguishable from A on shared screens.

W5 — Auth / RevenueCat model (per auth-and-paywall-timing.md)
- Configure RevenueCat ANONYMOUSLY at launch; users complete onboarding + paywall without an
  account. On purchase, entitlement unlocks immediately (anonymous).
- After a successful purchase, show the "Secure your subscription" Account screen; on
  account create/sign-in call Purchases.logIn(<supabase user UUID>) to alias the anonymous
  purchase onto the account. Use the Supabase auth UUID as the App User ID (NEVER email).
- Free users: no wall; expose the contextual account prompt later (out of onboarding).
- Add "Restore purchases" and "Already have an account? Sign in" affordances on the paywall
  and a returning-user Sign in path.
- NOTE (config task, not code): set RevenueCat Restore Behavior to "Transfer to new App User
  ID" in the dashboard; document this in the PR.

W6 — AI personalization service + facts (API, NestJS)
- Add an AiPersonalizationService with a provider abstraction and failover chain:
  Claude (primary, existing API integration) → Gemini/OpenAI (secondary) → STATIC template
  (final). Validate every response with Zod; schema-invalid = treat as failure and fall down
  the chain. Tight per-call timeout (1.5–2.5s).
- Precompute + cache by Year/Make/Model: a Supabase table `model_insights`
  (status, generated_at, source_model, payload) populated by an async job on first sighting;
  serve cached instantly thereafter; regenerate periodically.
- Facts: integrate the NHTSA recalls lookup (separate from the vPIC make/model endpoints
  already used) for the Reveal's recall check; derive the projected yearly cost from the
  existing OEM schedule (OemSchedulesPreview) × a cost heuristic/table. The "known issues"
  text is the only AI-authored content and must be hedged.
- Expose this to mobile via GraphQL (code-first, generated types). The Reveal consumes it
  with a loading→static fallback; if AI content is missing, the AI card hides gracefully.

W7 — Data model + GraphQL (follow CLAUDE.md update sequence)
- Add migration(s) for `model_insights` (+ any cost table) with RLS; push, regenerate types,
  update Zod schemas, NestJS models/resolvers, then `pnpm generate`. New .graphql operations
  for fetching recalls/insights/projected cost. No edits to generated files.

W8 — Tests & verification
- Unit tests: variant assignment (incl. fallback + persistence/resume), config/onboarding
  variant selection, AI provider failover + Zod validation + timeout fallback, the bike
  partial-capture skip (must yield has_bike=true).
- Verify analytics: every onboarding event carries `variant`; both arms emit parity events;
  funnel builds in PostHog. Add a brief manual QA checklist (both arms, purchase + free
  paths, AI-down path, offline assignment).
- Run `pnpm precheck` and `pnpm generate`; ensure CI is green.

ACCEPTANCE CRITERIA
- A new install is deterministically assigned to `lean` or `invested`, stable across
  relaunch/resume, defaulting safely if PostHog is unavailable.
- Both arms run end-to-end: A (lean) and B (invested) per the specs; shared screens look
  identical; B adds its steps and richer Reveal/Commitment.
- Bike can be added with minimal input; the demoted skip still creates a make-level bike;
  Maintenance/Reveal/Paywall personalize from the bike and never dead-end.
- Purchase works anonymously; the post-purchase Account screen aliases via logIn(UUID);
  Restore + Sign in paths work.
- AI personalization is cached, times out gracefully to static, is feature-flagged, and
  never blocks onboarding; recalls/specs/intervals come from authoritative sources only.
- PostHog shows the funnel with `variant` on every step; primary metric (install→trial
  start) and guardrails (bike-add rate, trial→paid, retention) are queryable.
- `pnpm precheck` passes; no `any` on GraphQL data; no hardcoded colors; migrations + RLS in
  place; generated files untouched.

PROCESS
- Produce the PLAN first; implement in the W1→W8 order (assignment + analytics first so data
  collection is correct from the start). Keep changes behind the feature flag. Open the work
  as reviewable commits per workstream. Flag any deviation from the specs with a one-line
  reason.
```

---

*If you want, I can also generate the standalone PostHog event-schema/flag spec doc (event
names, properties, the `onboarding_ab_2026` flag config, and the funnel/insight definitions)
to hand to whoever sets up PostHog — separate from this engineering brief.*
