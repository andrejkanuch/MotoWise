# Mobile — Expo 57

## Commands
- `pnpm --filter @motovault/mobile start` — Expo dev server
- `pnpm --filter @motovault/mobile ios` — iOS simulator
- `pnpm --filter @motovault/mobile android` — Android emulator
- `pnpm --filter @motovault/mobile test` — Jest tests

## i18n / translations
- All user-facing copy must go through `t()` (react-i18next). The locales are `SUPPORTED_LOCALES` in `packages/types/src/constants/enums.ts`; their files live in `src/i18n/locales/*.json`, and `en` is the source of truth.
- **Hard-coded string guard** (`eslint.config.mjs`): this app keeps an **i18n-only ESLint config** — a deliberate exception to the repo's Biome-only rule. It exists for one reason: `eslint-plugin-i18next/no-literal-string` is the only tool that detects hard-coded text inside RN `<Text>` (Biome has no such rule; `i18next-cli lint` only understands web/DOM JSX and silently ignores capitalized RN components). Do NOT add general ESLint rules here and do NOT remove this config thinking it duplicates Biome — it does not. Currently `jsx-text-only` mode; escalate to `jsx-only`/`all` (with excludes) once the legacy backlog is cleared.
- **Gating is a ratchet** (see root `scripts/check-i18n.sh`, wired into pre-push via `precheck:push` + the CI `i18n` job): it blocks only NEW regressions vs the merge-base — new hard-coded strings in changed files, and new `en.json` keys missing from any locale (`scripts/check-i18n-new-keys.ts`). Pre-existing debt (~324 hard-coded strings, ~36–67 absent keys/locale incl. plural-grammar forms) is intentionally not blocked; fix it opportunistically when you touch a file.
- Full audits (non-blocking): `pnpm i18n:status` (completeness across all locales) and `pnpm --filter @motovault/mobile i18n:hardcoded` (every hard-coded string).

## Architecture
- Expo Router with file-based routing in src/app/
- JS `Tabs` from expo-router (`src/app/(tabs)/_layout.tsx`): (home), (discover), (garage), (profile) are visible; (learn) and (diagnose) exist but are hidden (`href: null`)
- Each tab wraps a Stack for in-tab navigation
- TanStack Query v5 for data fetching/caching (useQuery, useMutation)
- graphql-request v7 for GraphQL transport (gqlFetcher reads fresh Supabase JWT per request)
- Zustand for local state; the stores live in `src/stores`
- Supabase client for auth + storage (photo uploads)
- Tokens stored in expo-secure-store (never AsyncStorage)

## Expo UI (@expo/ui)
- Before building any UI component, check if @expo/ui already provides a native equivalent (BottomSheet, Toggle, Slider, Picker, DateTimePicker, SegmentedControl, Button, etc.)
- SwiftUI components: `import { ... } from '@expo/ui/swift-ui'` — require wrapping in `<Host>` component
- Jetpack Compose components: `import { ... } from '@expo/ui/jetpack-compose'`
- Community components (cross-platform): `import ... from '@expo/ui/community/...'` (e.g., datetime-picker, slider)
- Use Expo UI modifiers for SwiftUI styling: `import { ... } from '@expo/ui/swift-ui/modifiers'`
- Prefer native Expo UI components over third-party libraries for simpler use cases (pickers, toggles, sheets)
- For complex interactive sheets (scrollable content, multiple snap points, maps), @gorhom/bottom-sheet is still appropriate

## Patterns
- GraphQL operations in src/graphql/{queries,mutations}/*.graphql
- Import generated types from @motovault/graphql
- Auth gating in root _layout.tsx (Redirect to (auth) if no session)
- Navigation casts (`as any`/`as never` on `router.push/replace/navigate` / `<Redirect>`) are BANNED — `typedRoutes: true` validates route literals at compile time; type dynamic hrefs as `Href` from `expo-router` instead (guard: `scripts/check-no-router-any.sh`)
- Analytics (PostHog): screens are tracked ONCE, by `hooks/use-screen-tracking.ts` in the root layout — the `$screen` name is the Expo Router route template (`/(tabs)/(garage)/bike/[id]`), ids go in `route_<param>` properties and every screen carries `feature_area` (map in `lib/analytics-screen.ts`; add new routes there). Never call `trackScreen` from a screen. Touch autocapture is off — track actions with `trackEvent`. Every `AnalyticsEvent` constant needs a call site (`analytics-event-catalog.test.ts` fails otherwise). Anything that creates an expense fires `trackExpenseAdded` with an `EXPENSE_ENTRY_SOURCE`.
- Use process.env.EXPO_OS not Platform.OS
- Use borderCurve: 'continuous' for rounded corners
- Modal presentation is a three-way rule: `formSheet` for short forms, with an explicit background; `fullScreenModal` for immersive, camera, map or long-content screens; `card` for a detail pushed inside a stack
- File naming: kebab-case (add-bike.tsx, fault-code-card.tsx)
  - Exception: `src/widgets/*Widget.tsx` stay PascalCase — the names are coupled to the native iOS widget targets declared in `app.config.ts` (`expo-widgets` plugin) and to the lazy `import('../widgets/NextServiceWidget')` calls in `lib/widget-sync.ts`. Renaming them would break the native widget build.

## Common Mistakes
- Forgetting to run `pnpm generate` after modifying .graphql files
- Using localhost on Android emulator (use 10.0.2.2)
- Not handling loading/error states in TanStack Query hooks
- Putting native permissions or usage strings anywhere but `app.config.ts` (there is no mobile `app.json`)
- Storing tokens in AsyncStorage instead of expo-secure-store
- An RNGH gesture inside a bike-hub segment that does not gate `.enabled()` on `useSegmentInteractive()` — hidden segments' recognisers leak onto recycled native views (`docs/solutions/ui-bugs/hidden-segment-rows-still-receive-taps-gesture-handler.md`)
- `router.back()` then `router.push()` from a formSheet — use one `router.replace`; in code comments write "issue 4446", never the hash form (the colour guard reads it as hex) (`docs/solutions/ui-bugs/sheet-navigation-race-react-native-screens-4446.md`)
- Using @expo/vector-icons (use lucide-react-native). iOS quick actions may use `symbol:…` strings (SF Symbols) via expo-quick-actions — that is not the removed `expo-symbols` package.
