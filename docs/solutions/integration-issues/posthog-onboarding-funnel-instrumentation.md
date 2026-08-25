---
title: Onboarding-funnel instrumentation blindness — PostHog identity, OAuth signup undercount, replay & dev gating
category: integration-issues
date: 2026-06-09
tags:
  - posthog
  - analytics
  - mobile
  - identity
  - reset
  - oauth
  - signup
  - session-replay
  - funnel
problem_type: integration_issue
component: mobile-analytics
severity: high
status: resolved
---

# Task: Fix onboarding-funnel instrumentation blindness

> **Web analogues:** The same PostHog gotchas on the web app are tracked as items **W2** (consent gating), **W3** (email PII in `identify`), and **W4** (`posthog.reset()` on sign-out) in [`docs/plans/2026-04-11-001-posthog-analytics-audit-plan.md`](../../plans/2026-04-11-001-posthog-analytics-audit-plan.md).

**Created:** 2026-06-09
**Owner:** mobile / analytics
**Why:** We cannot measure (or even watch) what new users do between *installing the app* and *starting onboarding* — the exact place we suspect a "signup wall" is leaking users. Three independent instrumentation defects cause this. This task fixes all three so the signup-wall hypothesis becomes measurable.

---

## Background — what's broken and how we found it

While investigating "where do users leave onboarding, and is it the signup wall?", every cross-signup funnel collapsed to ~0%:

| Funnel step | Users | Note |
|---|---|---|
| Application Installed | 396 | anonymous |
| Saw `/login` wall | **4** | ⚠️ should be ~all of them |
| onboarding_started | 0 | |

The funnel is not measuring reality — it's an **identity-stitching failure**. Separately, `user_signed_up` fires far less than `onboarding_started` (May: 32 vs 166), and there are **zero mobile session recordings** to fall back on.

Net effect: we are blind to the entire pre-signup → signup → onboarding-entry transition.

---

## Defect 1 — `posthog.reset()` orphans anonymous pre-signup events (PRIMARY) — ✅ DONE (2026-06-09)

> Implemented in `_layout.tsx`: added `prevUserIdRef`; reset/cleanup now run only on a real sign-out transition (had a user → null), never on cold-start anonymous launches. `identifyUser()` sets the ref on sign-in/signup. Ships in the next native build/OTA.


**Root cause.** On every auth-state change with no session — including **cold start for a brand-new, never-authenticated user** — we call `resetUser()` → `posthog.reset()`, which rotates the anonymous distinct_id. Pre-signup events (`Application Installed`, `/login` screen views) were captured under the *old* anonymous id; after reset + `identify()`, they're never merged onto the identified person.

**Evidence:**
- `apps/mobile/src/app/_layout.tsx:332-341` — `onAuthStateChange`: `else { logoutRevenueCat(); resetUser(); }` fires whenever `session` is falsy, with no guard for "was there ever a session?"
- `apps/mobile/src/lib/analytics.ts:189-196` — `resetUser()` calls `posthogClient.reset()` unconditionally.
- `apps/mobile/src/lib/analytics.ts:162-181` — `identifyUser()` calls `posthogClient.identify(userId, …)` (correct), but the anonymous history is already orphaned by the time it runs.

**Fix.** Only reset on a genuine **sign-out transition** (had a user → now null), never on the initial/cold-start null session. Track the previously-identified user id.

```ts
// _layout.tsx — onAuthStateChange
const prevUserIdRef = useRef<string | null>(null);

supabase.auth.onAuthStateChange((_event, session) => {
  invalidateGqlAccessTokenCache();
  setSession(session);
  if (session?.user) {
    loginRevenueCat(session.user.id);
    identifyUser(session.user.id);          // merges current anon id → user
    prevUserIdRef.current = session.user.id;
  } else {
    // Only reset on a REAL logout (we previously had a user).
    // Do NOT reset for a cold-start anonymous visitor — that orphans
    // their pre-signup events and breaks every cross-signup funnel.
    if (prevUserIdRef.current) {
      logoutRevenueCat();
      resetUser();
      prevUserIdRef.current = null;
    }
    // …keep the existing cache/secure-store cleanup, but it should also
    //   be guarded by the same "real logout" condition.
  }
});
```

> Verify against the posthog-react-native version that `identify()` aliases the existing anonymous distinct_id (default behavior) and that we are **not** calling `reset()` anywhere else mid-session.

**Acceptance:** A fresh install → `Application Installed` → `/login` view → OAuth signup → `onboarding_started` all share **one** person. The install→onboarding funnel converts at a realistic rate (not 1%).

---

## Defect 2 — `user_signed_up` is under-counted — ✅ DONE (2026-06-09)

> **Root cause confirmed via DB + PostHog:** May had 173 new users but only 32 `user_signed_up` events. OAuth was the culprit — 58 new Apple users → 1 `signed_up`/57 `signed_in`; 89 new Google → 5/89. The single-signal `|last_sign_in_at - created_at| < 5s` check off the `signInWithIdToken` response returned `false` for ~80% of real OAuth signups (timestamps inconsistent/absent on the returned object). Email was unaffected (hardcoded on the register screen).
>
> **Fix (`apps/mobile/src/lib/oauth.ts`):** `isNewlyCreatedUser` now exported, multi-signal — treats EITHER first-ever sign-in (`last_sign_in_at` within 30s of `created_at`) OR created-just-now (`created_at` within 5 min of now) as new, and reads `data.user ?? data.session?.user`. Unit tests added in `oauth-errors.test.ts` (18/18 pass). Web parity (firing `user_signed_up` from the web signup page) intentionally deferred.


**Symptom.** `user_signed_up` unique users ≪ `onboarding_started` (Apr 4 vs 39, May 32 vs 166, Jun 17 vs 42). The `$lib` is only ever `posthog-react-native`, so web signups are entirely absent and even mobile is short.

**Root cause (likely).** OAuth attribution depends on `isNewUser` from the auth helper:
- `apps/mobile/src/app/(auth)/login.tsx:57-61` (Apple) and `:73-76` (Google) — fire `USER_SIGNED_UP` only when `isNewUser === true`, else `USER_SIGNED_IN`.
- Same pattern in `register.tsx`.

If `signInWithApple()` / `signInWithGoogle()` can't reliably compute `isNewUser` (e.g. returns false/undefined on the native id-token path), genuine new users get logged as `USER_SIGNED_IN` and the signup count silently undercounts. Partly compounded by Defect 1 (events split across orphaned anon ids deflate unique-user counts).

**Fix.**
1. Audit `signInWithApple` / `signInWithGoogle` (in the auth lib) — confirm how `isNewUser` is derived. Prefer a server-trustworthy signal: Supabase returns `created_at === last_sign_in_at` (or the user row didn't exist pre-call). Don't rely solely on a client guess.
2. Make `user_signed_up` fire on **all** real first-time auths (email + Apple + Google), and ensure it fires **after** `identify()` so it lands on the identified person.
3. (Optional, web parity) Fire `user_signed_up` from `apps/web/src/app/signup/page.tsx` and `auth-modal.tsx` so web signups are countable too.

**Acceptance:** Over any month, `user_signed_up` unique users ≈ new auth.users rows for that month (cross-check against the DB), and `user_signed_up` ≤ `onboarding_started` with a sane ratio.

---

## Defect 3 — Mobile session replay is OFF (blocks "watch the wall") — ⚠️ REOPENED (2026-08-25)

> ### 2026-08-25 correction: the missing piece is a package, not a project toggle
>
> Marked DONE in 2026-06-09, but **mobile replay has never captured anything**:
> `snapshot_source = mobile` over 90 days returns **zero**, and no event in 30 days
> carries `$recording_status` (0 of 10,377).
>
> Three documents blamed an unset project-side **"Record mobile sessions"** toggle.
> **That diagnosis is wrong.** Per PostHog's current React Native docs there is exactly
> one project setting — *"Record user sessions"* — and it maps to
> `session_recording_opt_in`, which is **already `true`** on project 155556 (web replay
> arrives daily, which proves it). There is nothing left to flip.
>
> **The real cause: the native plugin is not installed.** Mobile replay needs
> **`@posthog/react-native-plugin`** (the renamed `posthog-react-native-session-replay`,
> required for `posthog-react-native` >= 4.47.0). The app runs
> `posthog-react-native@4.47.2` and the plugin is declared only as an **optional peer
> dependency** in `pnpm-lock.yaml:10028` (`peerDependenciesMeta.optional: true`) and is
> **absent from `apps/mobile/package.json` and from `node_modules`**.
>
> So `enableSessionReplay: !__DEV__` in `analytics.ts` is correct and has simply had **no
> native recorder to drive**. Everything else was already done properly — consent gating,
> `maskAllTextInputs` / `maskAllImages` / `maskAllSandboxedViews`, `captureLog: false`.
>
> **Fix:** `pnpm --filter mobile add @posthog/react-native-plugin` (>= 2.0.1), then a
> **new native build** — it is a native module, so it **cannot ship via OTA**. Earliest
> realistic vehicle is 3.20.0.
>
> **Package installed 2026-08-25** — `@posthog/react-native-plugin@2.4.1`, satisfying the
> `>= 2.0.1` peer. It ships `android/`, `ios/` and a podspec and is picked up by
> autolinking, so **no Expo config plugin and no code change is needed**:
> `enableSessionReplay: !__DEV__` in `analytics.ts` was already correct and was only ever
> missing its recorder. `pnpm precheck` is green.
>
> **Remaining step is a native build.** Nothing captures until a build containing this
> module reaches devices, and it cannot go by OTA. Target 3.20.0.
>
> A first install attempt the same day was reverted on the belief it had half-applied.
> That was a misread: pnpm **hoists** this package to the repo-root `node_modules/@posthog/`,
> and the check had looked only at `apps/mobile/node_modules/@posthog/`, which does not
> exist. `require.resolve` from `apps/mobile` finds it correctly. Verify hoisted
> dependencies with `require.resolve`, not a directory listing.
>
> **Do not mark this DONE again without evidence of arriving recordings.** The 2026-06-09
> entry was closed on "the code is correct", which was true and insufficient — the same
> mistake shape as the signup-event gate.

> Implemented in `analytics.ts`: session replay with privacy-safe masking (`maskAllTextInputs`/`maskAllImages`/`maskAllSandboxedViews`/`captureLog`), **gated to release builds only**. PostHog is fully disabled in development — `disabled: __DEV__ || !POSTHOG_API_KEY` (no events or replay sent under Metro/dev-client) and `enableSessionReplay: !__DEV__`, mirroring the existing Sentry `enabled: !__DEV__` gate. Verified against posthog-react-native v4.41.1 type defs + official docs (Context7). **Still requires:** a fresh native build (not OTA) + the project-side "Record mobile sessions" toggle in PostHog settings.
>
> ⛔ **The last sentence is wrong — superseded by the 2026-08-25 correction above.** The
> "fresh native build" half was right; the toggle half was not. There is no separate
> mobile toggle, and the missing piece is the `@posthog/react-native-plugin` package.
> Kept verbatim because this line is what sent three later documents down the wrong path.


**Root cause.** `apps/mobile/src/lib/analytics.ts:25` → `enableSessionReplay: false`. There are **zero** mobile recordings in PostHog; every recording is from the web marketing site. We literally cannot watch a user hesitate at `/login`.

**Fix.** Enable mobile replay with privacy masking (this app stores tokens in secure-store and shows emails/VINs — mask aggressively).

```ts
export const posthogClient: PostHog = new PostHog(POSTHOG_API_KEY || 'placeholder', {
  host: POSTHOG_HOST,
  disabled: !POSTHOG_API_KEY,
  enableSessionReplay: true,
  sessionReplayConfig: {
    maskAllTextInputs: true,    // never capture email/password fields
    maskAllImages: false,
    captureLog: true,
    // consider sampling (e.g. 50%) once volume grows; full capture is fine at current scale
  },
});
```

- Gate behind the existing Privacy toggle (`analyticsEnabled`) so it respects consent.
- Verify replay is also enabled in the PostHog project settings (Session Replay → mobile).

**Acceptance:** New mobile sessions appear under Replay with `snapshot_source: mobile`, text inputs masked.

---

## Verification (after all three ship)

Re-run these in PostHog once a new build has data:

1. **Signup-wall funnel** (the original question):
   `Application Installed` → `$screen $screen_name=/login` → `user_signed_up` → `onboarding_started` → `onboarding_completed`, `filterTestAccounts: true`, all-time.
   *Expect:* a real, non-zero curve. The drop between `/login` and `user_signed_up` is the true signup-wall abandonment.
2. **Signup count sanity:** monthly `user_signed_up` unique users vs `auth.users` rows created that month (DB) — should roughly match.
3. **Watch the wall:** Replay → filter `snapshot_source = mobile`, visited page contains `login`, short duration / no `onboarding_started`. Watch 10–15 to see what users actually do at the wall.

## Out of scope / follow-up
- Product change (e.g. value-prop screen before login, or a guest/preview mode) — decide *after* the funnel is measurable and the recordings are watched. This task only restores measurement.

## Key file references
- `apps/mobile/src/app/_layout.tsx:332-352` — auth-state change / reset call site
- `apps/mobile/src/lib/analytics.ts:23-27` — PostHog client config (session replay)
- `apps/mobile/src/lib/analytics.ts:162-196` — `identifyUser` / `resetUser`
- `apps/mobile/src/app/(auth)/login.tsx:52-81` — OAuth signup-vs-signin attribution
- `apps/mobile/src/app/(auth)/register.tsx` — email + OAuth signup attribution
