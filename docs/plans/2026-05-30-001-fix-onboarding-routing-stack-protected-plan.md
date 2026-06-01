---
date: 2026-05-30
id: 2026-05-30-001
type: fix
title: Onboarding/app routing — migrate imperative NavigationGate to declarative Stack.Protected
status: proposed
---

# Fix onboarding routing across the app

## Problem

App-wide routing (auth → onboarding → tabs) is implemented imperatively in
`apps/mobile/src/app/_layout.tsx` inside `NavigationGate`:

```ts
useEffect(() => {
  // ...guard against loading...
  let target: string | null = null;
  if (!session && !inAuthGroup && !inPublicShareRoute) target = '/(auth)/login';
  else if (session && inAuthGroup) target = onboardingCompleted ? '/(tabs)/(home)' : '/(onboarding)';
  else if (session && !inOnboarding && !onboardingCompleted) target = '/(onboarding)';
  else if (session && inOnboarding && onboardingCompleted) target = '/(tabs)/(home)';
  if (target) setTimeout(() => router.replace(target as any), 0);
}, [session, segments, isLoading, router, onboardingCompleted, meQuery.isLoading, meQuery.isError]);
```

Why this is fragile:

1. **Imperative if/else target chain** re-runs on every `segments` change and
   defers navigation with `setTimeout(replace, 0)` to dodge a
   setState-during-render warning — a smell that hides races.
2. **`router.replace` collapses the back stack.** This is the same class of bug
   that broke onboarding Back (`GO_BACK was not handled`): any `replace`-based
   transition discards history.
3. **Completion is double-managed.** `personalizing.tsx` calls
   `setOnboardingCompleted(true)` *and* `router.replace(OB_ROUTE.HOME)`, while the
   gate *also* watches `onboardingCompleted` to redirect — two sources of truth
   for the same transition.
4. **Public-share bypass is a string list** (`PUBLIC_SHARE_SEGMENTS`) checked
   inside the routing effect, rather than expressed structurally.

Expo Router v7 has a first-class mechanism for exactly this: **`Stack.Protected`
guards** (declarative). When a guard flips, the router auto-navigates to the next
available screen — no manual `replace`, no effect, no stack collapse.

## Current route tree (root `src/app/`)

- `(auth)` — login, register
- `(onboarding)` — welcome + steps
- `(tabs)` — home/diagnose/discover/garage/learn/profile
- `(modals)` — start-ride, ride-detail, whats-new, etc.
- Public share routes: `t/[token]`, `ride/[id]`, `route/[country]`, `routes/[id]`
- Authed deep link: `trip/[id]` (NOT in `PUBLIC_SHARE_SEGMENTS` today → signed-in only)
- `+not-found`

Current gating facts to preserve:
- `onboardingCompleted = storeOnboardingCompleted || serverOnboardingCompleted`
  (store flips instantly on completion; server confirms on next `me`).
- While auth is hydrating or `me` is loading for a signed-in user, the gate
  renders `null` (prevents an onboarding→tabs flash before `me` resolves).
- Public share routes must be reachable by **anonymous** users AND by signed-in
  users **mid-onboarding** (no redirect).

## Target design

### 1. `_layout.tsx` — declarative guards

Keep `NavigationGate`'s side-effects (preference hydration, PostHog props,
privacy sync, What's New). Remove the routing `useEffect`, `PUBLIC_SHARE_SEGMENTS`
routing use, `useSegments`, and the `router.replace` target chain. Keep the
loading guard.

```tsx
const isSignedIn = !!session;

// Preserve the no-flash behavior: wait for auth + me before rendering guards.
if (isLoading || (isSignedIn && meQuery.isLoading && !meQuery.isError)) return null;

return (
  <>
    <Stack screenOptions={{ headerShown: false }}>
      {/* Gated groups first so default landing resolves to the right group */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && !onboardingCompleted}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={isSignedIn && onboardingCompleted}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" />
        <Stack.Screen name="trip" />
      </Stack.Protected>

      {/* Public share-link routes — always accessible (anon + authed), declared
          last so they're never chosen as the default landing screen. */}
      <Stack.Screen name="t" />
      <Stack.Screen name="ride" />
      <Stack.Screen name="route" />
      <Stack.Screen name="routes" />
      <Stack.Screen name="+not-found" />
    </Stack>
    <SurveyOverlay />
  </>
);
```

### 2. `personalizing.tsx` — single completion trigger

Stop navigating manually. Flip the store flag only when BOTH the server mutation
and the minimum animation have finished; the guard does the redirect.

- In the mutation effect: drop `setOnboardingCompleted(true)`; keep `setMutationDone(true)`.
- In the "both done" effect: `reset(); setOnboardingCompleted(true);` (remove `router.replace(OB_ROUTE.HOME)`).
- `handleContinue` safety: `reset(); setOnboardingCompleted(true);` (remove replace).
- Remove now-dead `navFailed`/`setNavFailed` nav-failure branch (guard can't "fail").

Net: the personalizing animation always plays its full duration, then the guard
swaps `(onboarding)` → `(tabs)` automatically.

### 3. Welcome resume — unchanged

The once-per-launch resume fix (intra-`(onboarding)` `router.replace`) stays; it's
navigation *within* the onboarding group, not gating.

### 4. Constants

Continue using `OB_SCREEN`/`OB_ROUTE`; `OB_ROUTE.HOME` becomes unused in
personalizing — remove if no other reference.

## Risks & open questions (verify on simulator)

- **Default landing resolution.** Need to confirm Expo picks the correct group as
  the initial screen per state (esp. that param-only public routes are never the
  default). Mitigation: declare gated groups before public routes; if needed set
  `unstable_settings = { initialRouteName: ... }` or an anchor.
- **No-flash on returning onboarded user.** The loading guard must hold the splash
  until `me` resolves; verify no `(onboarding)` flash.
- **Deep-link auth callback** (`exchangeCodeForSession`) still lands correctly.

## Test matrix (XcodeBuild simulator)

| State | Expected |
|---|---|
| Logged out, cold start | `(auth)/login` |
| Sign in, onboarding incomplete | `(onboarding)` welcome; forward push + Back work |
| Kill mid-onboarding, relaunch | resumes at correct step; Back still works |
| Finish onboarding | personalizing plays full ~2.5s, then auto → `(tabs)/(home)` |
| Returning onboarded user, cold start | splash → `(tabs)`, no onboarding flash |
| Sign out | → `(auth)` |
| Anon deep link `ride/[id]` | share preview, no login redirect |
| Signed-in mid-onboarding deep link `ride/[id]` | share preview, no onboarding redirect |
| Signed-in deep link `trip/[id]` while not onboarded | redirected into onboarding |

## Rollout

1. Implement `_layout.tsx` guards + `personalizing.tsx` completion change.
2. `pnpm precheck` (lint + typecheck + test).
3. Simulator pass over the full test matrix above.
4. Manual sanity on a physical build before merge (deep links / cold start).
