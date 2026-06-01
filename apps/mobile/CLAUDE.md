# Mobile — Expo 56

## Commands
- `pnpm --filter mobile start` — Expo dev server
- `pnpm --filter mobile ios` — iOS simulator
- `pnpm --filter mobile android` — Android emulator
- `pnpm --filter mobile test` — Jest tests

## i18n / translations
- All user-facing copy must go through `t()` (react-i18next). 13 locales live in `src/i18n/locales/*.json`, `en` is the source of truth.
- **Hard-coded string guard** (`eslint.config.mjs`): this app keeps an **i18n-only ESLint config** — a deliberate exception to the repo's Biome-only rule. It exists for one reason: `eslint-plugin-i18next/no-literal-string` is the only tool that detects hard-coded text inside RN `<Text>` (Biome has no such rule; `i18next-cli lint` only understands web/DOM JSX and silently ignores capitalized RN components). Do NOT add general ESLint rules here and do NOT remove this config thinking it duplicates Biome — it does not. Currently `jsx-text-only` mode; escalate to `jsx-only`/`all` (with excludes) once the legacy backlog is cleared.
- **Gating is a ratchet** (see root `scripts/check-i18n.sh`, wired into pre-push via `precheck:push` + the CI `i18n` job): it blocks only NEW regressions vs the merge-base — new hard-coded strings in changed files, and new `en.json` keys missing from any locale (`scripts/check-i18n-new-keys.ts`). Pre-existing debt (~324 hard-coded strings, ~36–67 absent keys/locale incl. plural-grammar forms) is intentionally not blocked; fix it opportunistically when you touch a file.
- Full audits (non-blocking): `pnpm i18n:status` (completeness across all locales) and `pnpm --filter mobile i18n:hardcoded` (every hard-coded string).

## Architecture
- Expo Router v7 with file-based routing in src/app/
- NativeTabs with 4 tabs: (learn), (diagnose), (garage), (profile)
- Each tab wraps a Stack for in-tab navigation
- TanStack Query v5 for data fetching/caching (useQuery, useMutation)
- graphql-request v7 for GraphQL transport (gqlFetcher reads fresh Supabase JWT per request)
- Zustand for local state (app preferences)
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
- Use process.env.EXPO_OS not Platform.OS
- Use borderCurve: 'continuous' for rounded corners
- Use headerSearchBarOptions for search (not custom search bar)
- Use presentation: 'formSheet' for modals (add-bike, confirm dialogs)
- File naming: kebab-case (add-bike.tsx, fault-code-card.tsx)
  - Exception: `src/widgets/*Widget.tsx` stay PascalCase — the names are coupled to the native iOS widget targets declared in `app.config.ts` (`expo-widgets` plugin) and to the lazy `import('../widgets/NextServiceWidget')` calls in `lib/widget-sync.ts`. Renaming them would break the native widget build.

## Common Mistakes
- Forgetting to run `pnpm generate` after modifying .graphql files
- Using localhost on Android emulator (use 10.0.2.2)
- Not handling loading/error states in TanStack Query hooks
- Missing expo-camera permissions in app.json
- Storing tokens in AsyncStorage instead of expo-secure-store
- Using @expo/vector-icons (use lucide-react-native). iOS quick actions may use `symbol:…` strings (SF Symbols) via expo-quick-actions — that is not the removed `expo-symbols` package.
