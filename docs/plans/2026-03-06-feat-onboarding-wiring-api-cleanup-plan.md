---
title: Onboarding Wiring, GraphQL Operations & API Cleanup
type: feat
status: active
date: 2026-03-06
deepened: 2026-03-06
linear_issues: MOT-57, MOT-56, MOT-48, MOT-47, MOT-46
---

# Onboarding Wiring, GraphQL Operations & API Cleanup

## Enhancement Summary

**Deepened on:** 2026-03-06
**Agents used:** TypeScript Reviewer, Security Sentinel, Architecture Strategist, Performance Oracle, Data Migration Expert, Pattern Recognition Specialist, Framework Docs Researcher, Learnings Researcher

### Critical Fixes from Deepening
1. **Define typed `UserPreferencesSchema`** with `.strict()` — prevents property injection and storage DoS
2. **Use JSONB merge semantics** in UsersService — prevents overwriting existing preferences
3. **Fix `questions_json` column name** — plan had wrong DB column name `questions`
4. **Add error handling to personalizing.tsx** — mutations can fail silently, causing stuck/duplicate states
5. **Cache `onboardingCompleted` in persisted auth store** — eliminates blank screen on every app launch
6. **Use `Stack.Protected` for auth gating** — Expo Router 5.x declarative pattern replaces imperative `router.replace`

---

## Implementation Order

```
MOT-46 (15min) ──┐
MOT-47 (30min) ──┤── parallel, no dependencies
MOT-48 (45min) ──┤
Migration (2c) ──┤
Zustand store(2b)┘
        │
        ▼
  Phase 2a: Add preferences to User model + service (requires pnpm generate after)
        │
        ▼
  pnpm generate (single run covers MOT-48 + Phase 2a)
        │
        ▼
  MOT-57 + MOT-56 ── tightly coupled, implement together
```

---

## Phase 0: Shared Type Definitions (NEW — prerequisite for all phases)

### 0a. Define typed UserPreferencesSchema

> **Why:** `Record<string, unknown>` is a security hole — clients can write arbitrary keys (property injection), send multi-MB payloads (storage DoS), or set keys like `isAdmin: true` that future code might trust. `.strict()` rejects unknown keys entirely.

**New file:** `packages/types/src/validators/user-preferences.ts`

```typescript
import { z } from 'zod';
import { EXPERIENCE_LEVELS } from '../constants/enums';

const experienceLevelValues = Object.values(EXPERIENCE_LEVELS) as [string, ...string[]];

export const UserPreferencesSchema = z.object({
  onboardingCompleted: z.boolean().optional(),
  experienceLevel: z.enum(experienceLevelValues).optional(),
  ridingGoals: z.array(z.string().max(50)).max(10).optional(),
}).strict();

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
```

**Add to `packages/types/src/constants/enums.ts`:**

```typescript
export const EXPERIENCE_LEVELS = {
  Beginner: 'beginner',
  Intermediate: 'intermediate',
  Advanced: 'advanced',
} as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[keyof typeof EXPERIENCE_LEVELS];
```

**Update `packages/types/src/validators/user.ts`:**

```typescript
import { UserPreferencesSchema } from './user-preferences';

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  preferences: UserPreferencesSchema.optional(),
});
```

**Export from `packages/types/src/index.ts`:**

```typescript
export { UserPreferencesSchema, type UserPreferences } from './validators/user-preferences';
export { EXPERIENCE_LEVELS, type ExperienceLevel } from './constants/enums';
```

---

## Phase 1: Independent Fixes (Parallel)

### MOT-46: Replace raw Error throws with NestJS exceptions

**Corrected scope**: The raw `throw new Error()` calls are in `nhtsa.service.ts` (lines 87, 123), NOT in quizzes/content-flags (those already use NestJS exceptions).

**Files:**
- `apps/api/src/modules/motorcycles/nhtsa.service.ts`

**Changes:**

```typescript
// nhtsa.service.ts — import ServiceUnavailableException
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
```

Replace both `throw new Error(...)` with `throw new ServiceUnavailableException(...)`.

**Add 10-second `AbortController` timeout with distinct error handling:**

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);
try {
  const response = await fetch(url, { signal: controller.signal });
  // ...
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new ServiceUnavailableException('NHTSA API request timed out');
  }
  throw new ServiceUnavailableException('Failed to reach NHTSA API');
} finally {
  clearTimeout(timeout);
}
```

> **Security insight:** Distinguish `AbortError` (timeout) from network failure for clearer error messages and potential retry logic.

**Add `OnModuleInit` cache warming** to eliminate cold-cache latency:

```typescript
@Injectable()
export class NhtsaService implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.getMakes();
      this.logger.log('NHTSA makes cache warmed');
    } catch (e) {
      this.logger.warn('Failed to warm NHTSA cache', e);
    }
  }
}
```

**Add models cache size limit** to prevent memory exhaustion:

```typescript
private static readonly MAX_MODELS_CACHE = 500;

// Before caching a new entry in getModels():
if (this.modelsCache.size >= NhtsaService.MAX_MODELS_CACHE) {
  const oldestKey = this.modelsCache.keys().next().value;
  if (oldestKey) this.modelsCache.delete(oldestKey);
}
```

> **Security insight:** Without auth guards, the public NHTSA queries can be used to grow the in-memory cache unboundedly. Cap at 500 entries (~1MB).

**Add `@UseGuards(GqlAuthGuard)` to NHTSA queries** in `motorcycles.resolver.ts`:

```typescript
@Query(() => [MotorcycleMake], { name: 'motorcycleMakes' })
@UseGuards(GqlAuthGuard)
async motorcycleMakes(): Promise<MotorcycleMake[]> {
```

> **Security insight:** These endpoints are only used during onboarding by authenticated users. Without auth, they can be abused as a relay to DoS the NHTSA API.

**Acceptance Criteria:**
- [ ] No `throw new Error()` in any service file under `apps/api/src/`
- [ ] Both NHTSA fetch calls use `ServiceUnavailableException`
- [ ] Both fetch calls have 10-second timeout via `AbortController`
- [ ] `AbortError` handled distinctly from network errors
- [ ] `OnModuleInit` warms makes cache on API boot
- [ ] Models cache capped at 500 entries
- [ ] `@UseGuards(GqlAuthGuard)` on `motorcycleMakes` and `motorcycleModels` queries
- [ ] Existing tests pass

---

### MOT-47: Type mapRow parameters with Database row types

**Files:**
- `apps/api/src/modules/quizzes/quizzes.service.ts` — add `mapQuizRow` + `mapAttemptRow` methods
- `apps/api/src/modules/content-flags/content-flags.service.ts` — leave as `Tables<'content_flags'>` (see below)

> **Fix from TypeScript review:** The DB column is `questions_json`, NOT `questions`. The original plan had the wrong column name which would cause a compile error.

> **Fix from TypeScript review:** Preserve the existing `z.array(QuizQuestionSchema).parse(data.questions_json)` Zod validation instead of downgrading to `as QuizQuestion[]` cast.

**QuizzesService:**

```typescript
import type { Tables } from '@motovault/types/database';
import { QuizQuestionSchema } from '@motovault/types';

private mapQuizRow(
  row: Pick<Tables<'quizzes'>, 'id' | 'article_id' | 'questions_json' | 'generated_at'>,
): Quiz {
  return {
    id: row.id,
    articleId: row.article_id,
    questions: z.array(QuizQuestionSchema).parse(row.questions_json),
    generatedAt: row.generated_at,
  };
}

private mapAttemptRow(
  row: Pick<Tables<'quiz_attempts'>, 'id' | 'quiz_id' | 'score' | 'total_questions' | 'completed_at'>,
): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    score: row.score,
    totalQuestions: row.total_questions,
    completedAt: row.completed_at,
  };
}
```

> **Learnings insight:** Always use `.map((row) => this.mapQuizRow(row))` instead of `.map(this.mapQuizRow)` to preserve `this` context.

**ContentFlagsService** — leave as `Tables<'content_flags'>`:

> **Pattern recognition insight:** ContentFlagsService uses `.select()` without column specification (returns `*`), so the full `Tables<'content_flags'>` type is accurate. Narrowing to `Pick` would be misleading when selecting all columns. Leave as-is.

**Acceptance Criteria:**
- [ ] `QuizzesService` has `mapQuizRow` and `mapAttemptRow` with `Pick` types
- [ ] Column name is `questions_json` (not `questions`)
- [ ] Zod parse preserved for `questions_json` (no `as` cast)
- [ ] Arrow functions in `.map()` calls: `.map((row) => this.mapQuizRow(row))`
- [ ] ContentFlagsService left as `Tables<'content_flags'>` (no change needed)
- [ ] `pnpm typecheck` passes
- [ ] Existing tests pass

---

### MOT-48: Write .graphql operation files for mobile app

**Directory:** `apps/mobile/src/graphql/`

9 missing operations. Operation names corrected per naming convention (`Get` prefix for queries):

> **Pattern recognition fix:** `ArticleBySlug` → `GetArticleBySlug`, `QuizByArticle` → `GetQuizByArticle`, `SubmitQuiz` → `CreateQuizAttempt`

#### Queries

**`queries/search-articles.graphql`**
```graphql
query SearchArticles($input: SearchArticlesInput!) {
  searchArticles(input: $input) {
    edges {
      node {
        id
        slug
        title
        difficulty
        category
        isSafetyCritical
        generatedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

**`queries/get-article-by-slug.graphql`**
```graphql
query GetArticleBySlug($slug: String!) {
  articleBySlug(slug: $slug) {
    id
    slug
    title
    difficulty
    category
    viewCount
    isSafetyCritical
    generatedAt
    updatedAt
  }
}
```

**`queries/get-quiz-by-article.graphql`**
```graphql
query GetQuizByArticle($articleId: String!) {
  quizByArticle(articleId: $articleId) {
    id
    articleId
    questions {
      question
      options
      explanation
    }
    generatedAt
  }
}
```

**`queries/my-diagnostics.graphql`**
```graphql
query MyDiagnostics {
  myDiagnostics {
    id
    motorcycleId
    severity
    confidence
    status
    dataSharingOptedIn
    createdAt
  }
}
```

**`queries/my-progress.graphql`**
```graphql
query MyProgress {
  myProgress {
    id
    articleId
    articleRead
    quizCompleted
    quizBestScore
    firstReadAt
    lastReadAt
  }
}
```

#### Mutations

**`mutations/create-quiz-attempt.graphql`**
```graphql
mutation CreateQuizAttempt($input: SubmitQuizInput!) {
  submitQuiz(input: $input) {
    id
    quizId
    score
    totalQuestions
    completedAt
  }
}
```

**`mutations/create-diagnostic.graphql`**
```graphql
mutation CreateDiagnostic($input: CreateDiagnosticInput!) {
  createDiagnostic(input: $input) {
    id
    motorcycleId
    severity
    confidence
    status
    createdAt
  }
}
```

**`mutations/create-flag.graphql`**
```graphql
mutation CreateFlag($input: CreateFlagInput!) {
  createFlag(input: $input) {
    id
    articleId
    status
    createdAt
  }
}
```

**`mutations/mark-article-read.graphql`**
```graphql
mutation MarkArticleRead($articleId: String!) {
  markArticleRead(articleId: $articleId) {
    id
    articleId
    articleRead
    firstReadAt
    lastReadAt
  }
}
```

**After creating all files:** Run `pnpm generate` to regenerate TypedDocumentNode types.

> **Pattern recognition insight:** The generated package (`packages/graphql/src/generated/index.ts`) currently exports nothing (`export {};`). Running `pnpm generate` after creating these files + Phase 2a changes will populate it. Only use TypedDocumentNode imports (`{Operation}Document` from `@motovault/graphql`), never inline `gql` tags.

**Acceptance Criteria:**
- [ ] All 9 .graphql files created with correct operation names
- [ ] File names use kebab-case: `get-article-by-slug.graphql`, `create-quiz-attempt.graphql`
- [ ] `pnpm generate` succeeds without errors
- [ ] Generated types in `packages/graphql/src/generated/` include all new operations

---

## Phase 2: Onboarding Prerequisites

### 2a. Add preferences to User model + UpdateUserInput

**Files to modify:**

1. **`apps/api/src/modules/users/models/user.model.ts`** — add `preferences` field:
   ```typescript
   @Field(() => GraphQLJSON, { nullable: true })
   preferences?: Record<string, unknown>;
   ```
   > GraphQL transport uses `GraphQLJSON` (flexible), but validation happens via `UserPreferencesSchema` in the service layer.

2. **`apps/api/src/modules/users/dto/update-user.input.ts`** — add `preferences` field:
   ```typescript
   @Field(() => GraphQLJSON, { nullable: true })
   preferences?: Record<string, unknown>;
   ```

3. **`apps/api/src/modules/users/users.service.ts`** — **JSONB merge, not overwrite:**

   > **Architecture fix:** Direct column overwrite (`{ preferences: input.preferences }`) will wipe existing preference keys. Use read-modify-write merge pattern.

   ```typescript
   import { UserPreferencesSchema } from '@motovault/types';

   async update(userId: string, input: UpdateUser): Promise<User> {
     const data: Record<string, unknown> = {};
     if (input.fullName !== undefined) data.full_name = input.fullName;

     if (input.preferences) {
       // Validate with strict schema — rejects unknown keys
       const validatedPrefs = UserPreferencesSchema.parse(input.preferences);

       // Read current preferences, merge, write back
       const { data: current } = await this.supabase
         .from('users')
         .select('preferences')
         .eq('id', userId)
         .single();

       data.preferences = { ...(current?.preferences as object ?? {}), ...validatedPrefs };
     }

     const { data: row, error } = await this.supabase
       .from('users')
       .update(data)
       .eq('id', userId)
       .select()
       .single();

     if (error) throw new BadRequestException(error.message);
     return this.mapRow(row);
   }
   ```

4. **`packages/types/src/validators/user.ts`** — update to use typed schema (done in Phase 0)

5. **`apps/mobile/src/graphql/queries/me.graphql`** — add `preferences` field:
   ```graphql
   query Me {
     me {
       id
       email
       fullName
       role
       preferences
       createdAt
       updatedAt
     }
   }
   ```

6. **`apps/mobile/src/graphql/mutations/update-user.graphql`** — add `preferences` to response:
   ```graphql
   mutation UpdateUser($input: UpdateUserInput!) {
     updateUser(input: $input) {
       id
       fullName
       preferences
     }
   }
   ```
   > **Performance insight:** Including `preferences` in the response prevents an extra `Me` re-fetch after onboarding completes.

### 2b. Create onboarding Zustand store

**New file:** `apps/mobile/src/stores/onboarding.store.ts`

```typescript
import { create } from 'zustand';
import type { ExperienceLevel } from '@motovault/types';

interface BikeData {
  year: number;
  make: string;
  makeId: number;
  model: string;
  nickname?: string;
}

interface OnboardingState {
  experienceLevel: ExperienceLevel | null;
  bikeData: BikeData | null;
  ridingGoals: string[];
  setExperienceLevel: (level: ExperienceLevel) => void;
  setBikeData: (data: BikeData | null) => void;
  setRidingGoals: (goals: string[]) => void;
  reset: () => void;
}

const initialState = {
  experienceLevel: null as ExperienceLevel | null,
  bikeData: null as BikeData | null,
  ridingGoals: [] as string[],
};

export const useOnboardingStore = create<OnboardingState>()((set, _get, store) => ({
  ...initialState,
  setExperienceLevel: (level) => set({ experienceLevel: level }),
  setBikeData: (data) => set({ bikeData: data }),
  setRidingGoals: (goals) => set({ ridingGoals: goals }),
  reset: () => set(store.getInitialState(), true),
}));
```

> **TypeScript fix:** `experienceLevel` typed as `ExperienceLevel | null` (not loose `string`).
> **Zustand best practice:** Use `store.getInitialState()` with `true` (replace) for proper reset.
> **Do NOT reset on app background** — users frequently background mid-onboarding (incoming calls). Only reset on successful completion or full app kill.

### 2c. Migration: existing users get onboarding_completed

**New file:** `supabase/migrations/00019_set_existing_users_onboarded.sql`

```sql
-- Set onboarding_completed for all existing users so they skip onboarding.
-- New users get preferences = '{}' (from 00002 default), which means
-- onboardingCompleted is absent, correctly routing them to onboarding.
--
-- This migration is idempotent: the WHERE clause skips rows that already
-- have the onboardingCompleted key (regardless of value).
--
-- Pre-migration verification (run manually):
-- SELECT COUNT(*) FROM public.users WHERE preferences ? 'onboardingCompleted';
-- Expected: 0 (feature is new)
--
-- Rollback:
-- UPDATE public.users SET preferences = preferences - 'onboardingCompleted'
-- WHERE preferences ? 'onboardingCompleted';

UPDATE public.users
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"onboardingCompleted": true}'::jsonb
WHERE preferences IS NULL
   OR NOT (preferences ? 'onboardingCompleted');
```

> **Migration review:** Safe, idempotent, preserves existing preference keys via `||` shallow merge. The `set_updated_at` trigger will bump `updated_at` on affected rows — acceptable since the row genuinely changed.

---

## Phase 3: MOT-57 + MOT-56 (Tightly Coupled)

### MOT-57: Wire NHTSA API to onboarding select-bike screen

**File:** `apps/mobile/src/app/(onboarding)/select-bike.tsx`

**Changes:**

1. **Remove** `POPULAR_MAKES` hardcoded array (lines 10-31). Keep as `FALLBACK_POPULAR_MAKES` for offline/error fallback.

2. **Use TypedDocumentNode imports only** (never inline `gql` tags):
   ```typescript
   import { useQuery, useMutation } from 'urql';
   import { MotorcycleMakesDocument, MotorcycleModelsDocument } from '@motovault/graphql';
   import { useOnboardingStore } from '../../stores/onboarding.store';
   ```

3. **Prefetch makes on welcome screen** (step 1) for instant data on step 2:
   ```typescript
   // In index.tsx (step 1), add fire-and-forget prefetch:
   useQuery({ query: MotorcycleMakesDocument });
   ```

4. **Fetch makes on mount with fallback:**
   ```typescript
   const [{ data: makesData, fetching: makesFetching, error: makesError }, refetchMakes] = useQuery({
     query: MotorcycleMakesDocument,
   });
   const makes = makesData?.motorcycleMakes ?? FALLBACK_POPULAR_MAKES;
   ```

5. **Fetch models when make + year selected:**
   ```typescript
   const [{ data: modelsData, fetching: modelsFetching }] = useQuery({
     query: MotorcycleModelsDocument,
     variables: { makeId: selectedMakeId!, year: parsedYear },
     pause: !selectedMakeId || !parsedYear || parsedYear < 1960,
   });
   ```

6. **Year validation** — 1960 to current year + 1:
   ```typescript
   const currentYear = new Date().getFullYear();
   const parsedYear = year.length === 4 ? Number.parseInt(year, 10) : null;
   const yearError = parsedYear && (parsedYear < 1960 || parsedYear > currentYear + 1)
     ? `Year must be between 1960 and ${currentYear + 1}` : null;
   ```

7. **Validate before storing** — guard the Continue handler:
   ```typescript
   const handleContinue = () => {
     if (!selectedMake || !selectedModel || !parsedYear || yearError) return;
     setBikeData({ year: parsedYear, make: selectedMake, makeId: selectedMakeId!, model: selectedModel, nickname: nickname || undefined });
     router.push('/riding-goals');
   };
   ```

8. **Loading & error states:** Skeleton chips while makes load, error banner with retry button, keep "Skip for now" prominent.

**Also update (ALL three onboarding screens must wire to store):**
- `apps/mobile/src/app/(onboarding)/index.tsx` — call `setExperienceLevel()` on continue
- `apps/mobile/src/app/(onboarding)/riding-goals.tsx` — call `setRidingGoals()` on continue

### MOT-56: Add onboarding gating in root layout

**1. `apps/mobile/src/app/(onboarding)/personalizing.tsx`** — submit data with error handling:

> **Architecture fix:** Submit immediately, animate in parallel. Don't delay submission behind a timer — if the app is killed during the delay, data is lost.

> **Architecture fix:** Check mutation results for errors. Show retry UI on failure.

```typescript
const { experienceLevel, bikeData, ridingGoals, reset } = useOnboardingStore();
const { setOnboardingCompleted } = useAuthStore();
const [, updateUser] = useMutation(UpdateUserDocument);
const [, createMotorcycle] = useMutation(CreateMotorcycleDocument);
const [error, setError] = useState<string | null>(null);
const [submitted, setSubmitted] = useState(false);

// Submit immediately on mount
useEffect(() => {
  const submit = async () => {
    try {
      if (bikeData) {
        const { error: bikeError } = await createMotorcycle({
          input: { make: bikeData.make, model: bikeData.model, year: bikeData.year, nickname: bikeData.nickname },
        });
        if (bikeError) throw bikeError;
      }

      const { error: userError } = await updateUser({
        input: { preferences: { onboardingCompleted: true, experienceLevel, ridingGoals } },
      });
      if (userError) throw userError;

      // Update local cache BEFORE navigating
      setOnboardingCompleted(true);
      reset();
      setSubmitted(true);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    }
  };
  submit();
}, []);

// Navigate after animation minimum duration AND submission complete
useEffect(() => {
  if (!submitted) return;
  const timer = setTimeout(() => router.replace('/(tabs)/(learn)'), 2000);
  return () => clearTimeout(timer);
}, [submitted]);
```

**2. `apps/mobile/src/stores/auth.store.ts`** — add `onboardingCompleted` to persisted state:

```typescript
interface AuthState {
  // ... existing fields
  onboardingCompleted: boolean | null;
  setOnboardingCompleted: (value: boolean) => void;
}

// In partialize, add onboardingCompleted to persisted fields
```

**3. `apps/mobile/src/app/_layout.tsx`** — use `Stack.Protected` pattern:

> **Expo Router 5.x best practice:** Use declarative `Stack.Protected` with `guard` prop instead of imperative `router.replace` in `useEffect`. This eliminates race conditions and simplifies routing logic.

```typescript
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { MeDocument } from '@motovault/graphql';
import { UserPreferencesSchema } from '@motovault/types';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, isLoading, onboardingCompleted, setOnboardingCompleted } = useAuthStore();

  // Me query — only when authenticated, cache-and-network for instant + fresh
  const [{ data: meData }] = useQuery({
    query: MeDocument,
    requestPolicy: 'cache-and-network',
    pause: !session,
  });

  // Sync server state to local cache
  useEffect(() => {
    if (meData?.me?.preferences) {
      const prefs = UserPreferencesSchema.safeParse(meData.me.preferences);
      if (prefs.success) {
        setOnboardingCompleted(prefs.data.onboardingCompleted ?? false);
      }
    }
  }, [meData]);

  // Use cached value for instant routing; Me query revalidates in background
  const isOnboarded = onboardingCompleted === true;

  useEffect(() => {
    if (!isLoading) SplashScreen.hide();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <UrqlProvider value={urqlClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && !isOnboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={!!session && isOnboarded}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </UrqlProvider>
  );
}
```

> **Performance insight:** Returning users get instant routing from cached `onboardingCompleted` — no blank screen. The `Me` query runs in the background with `cache-and-network` policy.

> **TypeScript insight:** Parse preferences through `UserPreferencesSchema.safeParse()` instead of trusting `?.onboardingCompleted` on an untyped JSON blob.

**Acceptance Criteria for MOT-57:**
- [ ] Makes fetched from `motorcycleMakes` query on mount
- [ ] Makes prefetched on welcome screen (step 1) for instant step 2
- [ ] Popular makes sorted first with `isPopular` flag
- [ ] Hardcoded makes kept as fallback for offline/error
- [ ] Loading skeleton while makes fetch
- [ ] Error banner + retry if makes query fails
- [ ] Year validates 1960 to currentYear + 1
- [ ] Models fetch from `motorcycleModels(makeId, year)` when both selected
- [ ] Model selector is interactive chip list
- [ ] Empty model list shows "No models found" message
- [ ] Continue button disabled until required fields valid
- [ ] "Skip for now" navigates without bike data
- [ ] Bike data stored in onboarding Zustand store
- [ ] All imports use TypedDocumentNode (no inline `gql`)

**Acceptance Criteria for MOT-56:**
- [ ] `preferences` field on User model, UpdateUserInput, UsersService
- [ ] Preferences validated with `UserPreferencesSchema.strict()` in service layer
- [ ] Preferences use JSONB merge (read-modify-write), not overwrite
- [ ] `Me` query includes `preferences`
- [ ] `UpdateUser` response includes `preferences`
- [ ] Root layout uses `Stack.Protected` for declarative routing
- [ ] `onboardingCompleted` cached in persisted auth Zustand store
- [ ] Returning users get instant routing (no blank screen / Me query wait)
- [ ] Personalizing screen submits immediately, animates in parallel
- [ ] Mutation errors handled with retry UI
- [ ] `setOnboardingCompleted(true)` called before `router.replace`
- [ ] Migration sets existing users as onboarded
- [ ] Force-close mid-onboarding restarts from step 1
- [ ] All three onboarding screens wired to Zustand store (index, select-bike, riding-goals)
- [ ] `pnpm precheck` passes

---

## System-Wide Impact

- **API surface**: `User` type gains `preferences` field (additive, non-breaking)
- **Validation**: New `UserPreferencesSchema` with `.strict()` — rejects unknown keys
- **Migration**: `00019` updates existing users' preferences JSONB (safe — additive merge, idempotent)
- **Mobile routing**: Root layout uses `Stack.Protected` for 3 declarative guards (auth/onboarding/tabs)
- **GraphQL codegen**: 9 new operations generate new TypedDocumentNode exports (additive)
- **NHTSA security**: Auth guards + cache size limits added to public queries
- **`updated_at` trigger**: Migration bumps `updated_at` on all existing users (expected)

## Dependencies

- NHTSA API availability (external, no API key needed)
- `@motovault/design-system` tokens for onboarding UI
- Supabase local instance for migration testing (`pnpm db:reset`)
- `pnpm generate` must run after both MOT-48 and Phase 2a (single run)

## Post-Implementation

- Run `pnpm generate` once after all resolver/operation changes
- Run `pnpm precheck` before pushing (lint + typecheck + test)
- Update Linear issues to Done after merge
- Verify migration with post-deploy queries (see migration file comments)

## Migration Rollback

If migration 00019 causes issues:
```sql
UPDATE public.users
SET preferences = preferences - 'onboardingCompleted'
WHERE preferences ? 'onboardingCompleted';
```
