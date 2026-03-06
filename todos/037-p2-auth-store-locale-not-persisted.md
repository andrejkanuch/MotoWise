# P2: Auth store locale is not persisted across app restarts

## Location
`apps/mobile/src/stores/auth.store.ts`

## Problem
The user's locale preference is stored only in Zustand in-memory state. When the app is restarted, it resets to `'en'` (hardcoded default on line 18), ignoring the user's previous explicit language choice.

The `_layout.tsx` (line 32-35) attempts to restore locale on mount, but reads from the same non-persisted store, so it will always be `'en'`.

The mobile CLAUDE.md says tokens go in `expo-secure-store`. The locale preference should also be persisted, either via Zustand `persist` middleware with an AsyncStorage/SecureStore adapter, or by storing it in the user's Supabase profile and syncing on login.

## Fix
Add Zustand `persist` middleware to the auth store (or a separate preferences store) with `expo-secure-store` or `AsyncStorage` as the storage backend. On app launch, read the persisted locale and pass it to `i18n.changeLanguage()`.
