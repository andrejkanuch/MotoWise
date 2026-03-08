# PR #8 Review: Onboarding Wiring, API Cleanup & GraphQL Operations

**Branch:** `feat/MOT-46-47-48-56-57-onboarding-wiring-cleanup`
**Reviewer:** Claude Opus 4.6 (automated)
**Date:** 2026-03-06

---

## Summary

This PR wires the onboarding flow end-to-end: NHTSA API integration in the select-bike screen, onboarding gating in the root layout, user preferences persistence via GraphQL, a Zustand onboarding store, 9 new GraphQL operation files, typed mapRow helpers in QuizzesService, NestJS exception handling improvements in NhtsaService, and a database migration for existing users. Also fixes the generate pipeline (turbo refs, tsconfig, codegen).

**Files changed:** 42 (+1664 / -135)

---

## CRITICAL

### C1. Personalizing screen: mutation failure is silently ignored; navigation proceeds anyway

**File:** `apps/mobile/src/app/(onboarding)/personalizing.tsx`, lines 40-55

The `updateUser` mutation fires on mount. If it fails, `.then(() => reset())` is never called, but the timer-based navigation at line 64 (`router.replace('/(tabs)/(learn)')`) fires unconditionally after 3.2 seconds regardless of mutation result.

This means:
- User gets routed to the main app even though `onboardingCompleted` was never set to `true` on the server.
- On next app launch, the `Me` query will show `onboardingCompleted` as absent, so the user gets stuck in an onboarding loop.
- The `reset()` call on the store is also skipped, leaving stale state.

**Recommendation:** Await the mutation result. Only navigate on success. Show a retry UI on failure. Couple the navigation timer to mutation completion, not just a fixed timeout.

```typescript
// Suggested pattern (pseudocode):
const [mutationDone, setMutationDone] = useState(false);
const [error, setError] = useState(false);

useEffect(() => {
  updateUser({ ... }).then((result) => {
    if (result.error) { setError(true); return; }
    reset();
    setMutationDone(true);
  });
}, []);

// Navigate only after BOTH animation minimum AND mutation success
useEffect(() => {
  if (!mutationDone) return;
  const timer = setTimeout(() => router.replace('/(tabs)/(learn)'), delay);
  return () => clearTimeout(timer);
}, [mutationDone]);
```

---

### C2. Race condition: preferences read-then-write is not atomic

**File:** `apps/api/src/modules/users/users.service.ts`, lines 45-58

The preferences merge reads current preferences, merges in memory, then writes back. Two concurrent requests could overwrite each other's changes (lost update). While unlikely during onboarding (single user, single device), this service method is general-purpose and could be called from other contexts.

**Recommendation:** Use Supabase's JSONB merge operator in SQL: `preferences = preferences || $1::jsonb` via an RPC call, or at minimum document this limitation. For production safety, consider a Postgres function:

```sql
UPDATE users SET preferences = COALESCE(preferences, '{}'::jsonb) || $1::jsonb WHERE id = $2
```

---

### C3. Stale models displayed when year changes after make is selected

**File:** `apps/mobile/src/app/(onboarding)/select-bike.tsx`, lines 38-42

When the user changes the year after already selecting a make + model, `modelsResult` will re-fetch for the new year, but `selectedModel` is NOT cleared. The user could proceed with a model that doesn't exist for the new year. Additionally, `modelsResult.data` may momentarily show old results while the new query is in-flight (urql caches by variables).

`selectedModel` is cleared when the make changes (line 57), but not when the year changes.

**Recommendation:** Add a `useEffect` or callback that clears `selectedModel` when `year` or `selectedMake` changes:

```typescript
// In setYear handler or via useEffect:
useEffect(() => {
  setSelectedModel(null);
}, [year, selectedMake?.makeId]);
```

---

## WARNING

### W1. `new Date().getFullYear()` called on every render

**File:** `apps/mobile/src/app/(onboarding)/select-bike.tsx`, line 36

`new Date().getFullYear() + 1` is evaluated on every render (inside the component body, not memoized). While cheap, it's better practice to compute this once.

**Recommendation:** Move outside the component or wrap in `useMemo`.

---

### W2. NavigationGate blocks rendering with null while Me query fetches

**File:** `apps/mobile/src/app/_layout.tsx`, line 49

```typescript
if (isLoading || (session && meResult.fetching)) return null;
```

Every time the app opens, authenticated users see a blank white screen until the Me query completes. The implementation plan specifically called for caching `onboardingCompleted` in a persisted Zustand store to avoid this, but the plan's recommendation was not followed. The current implementation always waits for the network.

**Recommendation:** Cache `onboardingCompleted` in the persisted auth store. Use the cached value for immediate routing. Let the `Me` query revalidate in the background with `cache-and-network` request policy.

---

### W3. `router.replace` in useEffect dependency array

**File:** `apps/mobile/src/app/_layout.tsx`, line 47

```typescript
}, [session, segments, isLoading, router.replace, onboardingCompleted, meResult.fetching]);
```

`router.replace` is a function reference that may change on every render (depending on Expo Router internals), potentially causing infinite effect re-runs. The `segments` array also creates a new reference on every render.

**Recommendation:** Remove `router.replace` from the dependency array (it's stable enough, or use `useCallback`). Consider debouncing or using a ref for the router to prevent rapid successive `replace` calls.

---

### W4. No error state shown when makes query fails

**File:** `apps/mobile/src/app/(onboarding)/select-bike.tsx`, lines 179-213

When `makesResult.fetching` is false but `makesResult.error` exists, the component renders an empty chip grid (since `makes` defaults to `[]`). There is no error message or retry button.

**Recommendation:** Check `makesResult.error` and display an error banner with a retry option. The plan originally called for keeping a `FALLBACK_POPULAR_MAKES` array for offline/error scenarios.

---

### W5. `UserPreferencesSchema.parse` throws on invalid input, returning 400 to user

**File:** `apps/api/src/modules/users/users.service.ts`, line 46

`UserPreferencesSchema.parse(input.preferences)` will throw a `ZodError` if validation fails. This will bubble up as an unhandled exception (likely a 500 Internal Server Error) since there's no try-catch around it.

**Recommendation:** Use `safeParse` and throw a `BadRequestException` with the Zod error details:

```typescript
const result = UserPreferencesSchema.safeParse(input.preferences);
if (!result.success) {
  throw new BadRequestException(result.error.flatten());
}
```

Or wrap in try-catch. NestJS exception filters may or may not catch ZodError depending on configuration.

---

### W6. NHTSA model cache eviction is not truly LRU

**File:** `apps/api/src/modules/motorcycles/nhtsa.service.ts`, lines 168-171

```typescript
const oldestKey = this.modelsCache.keys().next().value;
```

`Map.keys()` returns insertion-order, but cache hits don't re-insert the entry. So the "oldest key" is the first-inserted, not the least-recently-used. Frequently accessed entries could be evicted while stale ones persist. This is a minor concern given the 7-day TTL handles staleness.

**Recommendation:** For true LRU, delete and re-set on cache hit, or accept this as FIFO eviction and document it.

---

### W7. `strictPropertyInitialization: false` is overly broad

**File:** `packages/tsconfig/nestjs.json`, line 11

This disables strict property initialization checks across the entire NestJS API. While NestJS decorators like `@Inject` don't initialize in the constructor in the traditional sense, this flag suppresses legitimate warnings elsewhere.

**Recommendation:** Use `declare` keyword or `!` non-null assertion on specific injected properties instead of disabling the check globally. This is a shared config that affects all code in the API.

---

### W8. `preferences` typed as `Record<string, unknown>` in GraphQL layer

**Files:**
- `apps/api/src/modules/users/models/user.model.ts`, line 19
- `apps/api/src/modules/users/dto/update-user.input.ts`, line 8

Using `GraphQLJSON` means the client can send arbitrary JSON. The server-side Zod validation catches this, but the GraphQL schema itself provides no type safety. Consider documenting this gap or adding a custom scalar.

---

## NOTE

### N1. Migration numbering convention

**File:** `supabase/migrations/00019_set_existing_users_onboarded.sql`

The migration is well-written: idempotent, preserves existing keys via `||`, includes rollback instructions. Good use of `COALESCE` for null safety.

---

### N2. Onboarding store is ephemeral (no persistence)

**File:** `apps/mobile/src/stores/onboarding.store.ts`

The onboarding Zustand store is not persisted. If the user force-closes mid-onboarding, state is lost and they restart from step 1. This appears intentional per the plan ("Do NOT reset on app background... Only reset on successful completion or full app kill"), but worth noting.

---

### N3. Motorcycle is created on select-bike screen, not personalizing screen

**File:** `apps/mobile/src/app/(onboarding)/select-bike.tsx`, lines 69-91

The `createMotorcycle` mutation fires on the select-bike screen's Continue button, while preferences are saved on the personalizing screen. If the user completes bike selection but abandons on step 3 (riding goals) or step 4 (personalizing), the motorcycle is created but `onboardingCompleted` is never set. On re-entry, they'll go through onboarding again and potentially create a duplicate motorcycle.

**Recommendation:** Consider moving motorcycle creation to the personalizing screen alongside the preferences mutation, or add deduplication logic.

---

### N4. `schema.graphql` committed to repository

**File:** `apps/api/schema.graphql`

The generated schema file is now committed. Ensure this is intentional and listed in codegen outputs. If it's auto-generated, consider adding it to `.gitignore` to avoid merge conflicts. If it's intentional (for PR review of schema changes), that's fine but should be documented.

---

### N5. Pre-push hook added

**Files:** `.githooks/pre-push`, `package.json` (prepare script)

Good addition. The `prepare` script sets `core.hooksPath` to `.githooks`. The pre-push hook runs `pnpm precheck` (lint + typecheck + test).

---

### N6. GraphQL operation files over-fetch fields

**Files:** `apps/mobile/src/graphql/mutations/create-diagnostic.graphql`, `create-flag.graphql`, `my-diagnostics.graphql`, `my-progress.graphql`

Several operations fetch `userId` which is redundant (the client already knows the current user). Minor, but adds to payload size.

---

### N7. `ExperienceLevel` enum keys differ from plan

**File:** `packages/types/src/constants/enums.ts`, lines 51-55

The plan specified keys as `Beginner`, `Intermediate`, `Advanced` but the implementation uses `BEGINNER`, `INTERMEDIATE`, `ADVANCED`. The values are the same (`'beginner'`, etc.), so this is cosmetic. Consistent with other enums in the file (e.g., `UserRole`).

---

### N8. `as ExperienceLevel` cast in welcome screen

**File:** `apps/mobile/src/app/(onboarding)/index.tsx`, line 33

```typescript
setExperienceLevel(selected as ExperienceLevel);
```

The `selected` state is typed as `string | null`, and `EXPERIENCE_LEVELS` keys match the `ExperienceLevel` values, so the cast is safe but not ideal. The `selected` state could be typed as `ExperienceLevel | null` to eliminate the cast.

---

### N9. Codegen config: `useTypeImports: true` added

**File:** `packages/graphql/codegen.ts`, line 15

Good addition. Ensures generated code uses `import type` where possible, improving tree-shaking and aligning with the project's TypeScript conventions.

---

### N10. Missing `@as-integrations/express5` context

**File:** `apps/api/package.json`, line 16

New dependency `@as-integrations/express5` added. This appears to be required by `@nestjs/apollo` v13 when used with NestJS 11 (which uses Express 5 under the hood). Appropriate addition.

---

## Verdict

The PR implements a solid onboarding flow with good patterns (Zod validation, auth guards on NHTSA queries, typed mapRow helpers, JSONB merge semantics). However, there are three critical issues that should be addressed before merge:

1. **C1:** Personalizing screen navigates regardless of mutation success -- data loss risk
2. **C2:** Non-atomic preferences merge -- potential lost updates (lower risk, but a design concern)
3. **C3:** Stale model selection persists when year changes -- UX bug

The warnings around blank screen on app launch (W2) and missing error states (W4) are important for user experience and should be addressed in this PR or a fast follow-up.
