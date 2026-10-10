# Mobile — Expo app

Design: `DESIGN.md` and `PRODUCT.md` here govern every mobile screen (light and dark).

## Verify
- `pnpm verify:mobile` (repo root) — typecheck + Jest + mobile guards
- `pnpm --filter @motovault/mobile exec jest <path>` — one test file; `pnpm --filter @motovault/mobile typecheck` — types only
- `pnpm check:i18n` — the i18n ratchet. E2E (Maestro): `.maestro/README.md`
- `pnpm --filter @motovault/mobile start` (also `ios`, `android`) — dev server

## Where things go
Do not move an existing domain.

| Domain | Home |
|---|---|
| ride, carplay, receipt-scan, create-trip | `src/features/<domain>/` |
| bike-hub | `src/components/bike-hub/` for UI and hooks, `src/lib/bike-hub/` for pure logic |
| any other existing domain | `src/components/<domain>/` |
| a domain with no folder yet | `src/features/<domain>/` |

| Kind | Goes in | Rule |
|---|---|---|
| Route | `src/app/**` | Params, `Stack.Screen` options and one screen component. No hook definitions. The structure check caps a new route at 300 lines |
| Screen body | The domain home, as `<name>-screen.tsx` | |
| Hook | The domain home if one domain uses it, `src/hooks/` if two or more do | One hook per `use-*` file |
| Query | Keys always from `src/lib/query-keys.ts`. A document fetched from two or more files gets a factory in `src/lib/query-options.ts` | Every variable that changes the payload is in the key |
| Zustand store (local state) | `src/stores/<name>.store.ts` | |
| Service (stateful, I/O, not React) | The domain home, or `src/lib/` if no single domain owns it | |
| Pure helper | `src/utils/` if two or more domains use it, the domain home otherwise | `utils` imports nothing from `lib`, `stores`, `hooks`, `components`, `features` or `app` |
| Shared UI primitive | `src/components/ui/` | Imports no domain folder |
| Tokens | `src/theme/` | |
| Test | `__tests__/` beside the code; cross-cutting contracts in `src/__tests__/` | Never under `src/app` |

- Allowed direction: `app` to `features` and `components`, to `hooks`, to `lib` and `stores`, to `utils`, `theme` and `config`. Nothing imports `app`. No new barrel files.
- Imports: use `@/` (it maps to `src/`) for any import that would climb three or more directories; one- and two-level relative paths are accepted. `pnpm check:mobile-structure` fails on a new import climbing three or more levels, a new layering violation, a route that grows, or misplaced TypeScript.
- File naming: kebab-case, routes included. Exception: `src/widgets/*Widget.tsx` stay PascalCase — coupled to the native iOS widget targets in `app.config.ts` and the lazy imports in `src/lib/widget-sync.ts`; renaming breaks the widget build.

## Architecture
- Expo Router, file-based routes in src/app/. JS `Tabs` (`src/app/(tabs)/_layout.tsx`): (home), (discover), (garage), (profile) are visible; (learn) and (diagnose) are hidden (`href: null`)
- TanStack Query v5 + graphql-request (gqlFetcher reads a fresh Supabase JWT per request); operations in src/graphql/{queries,mutations}/*.graphql; types from @motovault/graphql
- Supabase Auth for all auth (email, Google, Apple). OAuth uses `signInWithIdToken` (native), not `signInWithOAuth` (browser). Tokens in expo-secure-store, NEVER AsyncStorage. Auth gating in root _layout.tsx (Redirect to (auth) if no session)

## i18n
- All user-facing copy goes through `t()`. Locales: `SUPPORTED_LOCALES` in `packages/types/src/constants/enums.ts`; files in `src/i18n/locales/*.json`; `en` is the source of truth.
- `eslint.config.mjs` is an **i18n-only ESLint config**, the one deliberate exception to Biome-only: `eslint-plugin-i18next/no-literal-string` is the only tool that sees hard-coded text inside RN `<Text>`. Do NOT add general ESLint rules to it and do NOT remove it as a Biome duplicate.
- The gate is a ratchet (`scripts/check-i18n.sh`; pre-push and CI): it blocks only NEW hard-coded strings in changed files and new `en.json` keys missing from a locale. Older debt is not blocked; fix it when you touch a file. Full audits: `pnpm i18n:status`, `pnpm --filter @motovault/mobile i18n:hardcoded`.

## UI rules
- Colours come from `palette` in @motovault/design-system — no hardcoded hex or rgba (`pnpm check:mobile-colors`)
- react-native-reanimated v4 for animations, never the RN Animated API. Enter with FadeIn/FadeInUp/SlideInUp; stagger lists with `FadeInUp.delay(index * 50)`; keep animations under 300ms
- Haptics on iOS for interactive feedback, through `src/utils/haptics.ts` (`triggerImpact`, `triggerNotification`, `triggerSelection`)
- `borderCurve: 'continuous'` on all rounded elements. Inline styles, not StyleSheet.create, unless reused across components
- Modal presentation is a three-way rule: `formSheet` for short forms, with an explicit background; `fullScreenModal` for immersive, camera, map or long-content screens; `card` for a detail pushed inside a stack
- Use process.env.EXPO_OS, not Platform.OS. Icons: lucide-react-native, not @expo/vector-icons (`symbol:…` SF Symbol strings in expo-quick-actions are fine)
- Before building a component, check @expo/ui for a native one (sheets, toggles, sliders, pickers, buttons): `@expo/ui/swift-ui` (wrap in `<Host>`; `/modifiers` for styling), `@expo/ui/jetpack-compose`, `@expo/ui/community/...`. Prefer it for simple cases; @gorhom/bottom-sheet stays for complex sheets (scrolling, several snap points, maps)
- Navigation casts (`as any`/`as never` on `router.push/replace/navigate` / `<Redirect>`) are BANNED — type dynamic hrefs as `Href` from `expo-router` (`pnpm check:router`)
- Analytics (PostHog): screens are tracked ONCE, by `src/hooks/use-screen-tracking.ts`; `$screen` is the route template, ids go in `route_<param>`, every screen carries `feature_area` (add new routes to the map in `src/lib/analytics-screen.ts`). Never call `trackScreen` from a screen. Autocapture is off — track actions with `trackEvent`. Every `AnalyticsEvent` constant needs a call site. Creating an expense fires `trackExpenseAdded` with an `EXPENSE_ENTRY_SOURCE`

## Release and dependencies
- **OTA: publish with `--environment production` or the `Mobile OTA Update` workflow, never with a local env file.** It needs the owner's go-ahead and ships everything mobile on `main` since the store binary was cut. The runtime version is `version` in `app.config.ts`: an OTA reaches only builds with that version, which does not guard against a native mismatch. Read `docs/runbooks/mobile-ota.md` first
- `expo` and `react-native` are declared in this app only. Run Expo CLI from this directory or via `pnpm --filter @motovault/mobile <script>`. `@sentry/react-native` stays in `expo.install.exclude` (pinned ahead of Expo's recommendation; re-check each SDK bump). Why: `docs/solutions/build-errors/renovate-dependabot-duplicate-bots.md`

## Common Mistakes
- Forgetting `pnpm generate` after modifying .graphql files; using localhost on the Android emulator (use 10.0.2.2)
- Putting native permissions or usage strings anywhere but `app.config.ts` (there is no mobile `app.json`)
- An RNGH gesture inside a bike-hub segment that does not gate `.enabled()` on `useSegmentInteractive()` — recognisers leak onto recycled views (`docs/solutions/ui-bugs/hidden-segment-rows-still-receive-taps-gesture-handler.md`)
- `router.back()` then `router.push()` from a formSheet — use one `router.replace`; in code comments write "issue 4446", never the hash form (the colour guard reads it as hex) (`docs/solutions/ui-bugs/sheet-navigation-race-react-native-screens-4446.md`)
