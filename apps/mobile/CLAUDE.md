# Mobile — Expo 55

## Commands
- `pnpm --filter mobile start` — Expo dev server
- `pnpm --filter mobile ios` — iOS simulator
- `pnpm --filter mobile android` — Android emulator
- `pnpm --filter mobile test` — Jest tests

## Architecture
- Expo Router v7 with file-based routing in src/app/
- NativeTabs with 4 tabs: (learn), (diagnose), (garage), (profile)
- Each tab wraps a Stack for in-tab navigation
- TanStack Query v5 for data fetching/caching (useQuery, useMutation)
- graphql-request v7 for GraphQL transport (gqlFetcher reads fresh Supabase JWT per request)
- Zustand for local state (app preferences)
- Supabase client for auth + storage (photo uploads)
- Tokens stored in expo-secure-store (never AsyncStorage)

## Patterns
- GraphQL operations in src/graphql/{queries,mutations}/*.graphql
- Import generated types from @motolearn/graphql
- Auth gating in root _layout.tsx (Redirect to (auth) if no session)
- Use process.env.EXPO_OS not Platform.OS
- Use borderCurve: 'continuous' for rounded corners
- Use headerSearchBarOptions for search (not custom search bar)
- Use presentation: 'formSheet' for modals (add-bike, confirm dialogs)
- File naming: kebab-case (add-bike.tsx, fault-code-card.tsx)

## Common Mistakes
- Forgetting to run `pnpm generate` after modifying .graphql files
- Using localhost on Android emulator (use 10.0.2.2)
- Not handling loading/error states in TanStack Query hooks
- Missing expo-camera permissions in app.json
- Storing tokens in AsyncStorage instead of expo-secure-store
- Using @expo/vector-icons or expo-symbols (use lucide-react-native)
