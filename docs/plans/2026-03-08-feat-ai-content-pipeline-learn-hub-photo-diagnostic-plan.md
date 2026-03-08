---
title: "feat: AI Content Pipeline + Learn Hub + Photo Diagnostic + Guided Wizard"
type: feat
status: completed
date: 2026-03-08
linear: MOT-8, MOT-9, MOT-12, MOT-13
---

# feat: AI Content Pipeline + Learn Hub + Photo Diagnostic + Guided Wizard

## Overview

Build the four core AI-powered features that transform MotoWise from a CRUD shell into a real product: (1) AI article generation via Claude, (2) Learn Hub UI to browse/read articles, (3) photo diagnostic via Claude Vision, (4) guided diagnostic wizard. These ship together because the Learn↔Diagnose loop is the app's key value proposition.

## Problem Statement

The app has complete auth, garage, onboarding, and data layer infrastructure — but zero content and zero AI features. The Learn tab shows a module grid that links nowhere. The Diagnose tab lists past diagnostics but can't create real ones. Users can't learn anything or diagnose anything.

## Proposed Solution

Four features implemented in 6 phases:

### Phase 1: Article Generation Service (API)

Create `article-generator.service.ts` — Claude API integration that generates structured articles.

#### `apps/api/src/modules/articles/article-generator.service.ts`
- Inject `ConfigService` for `ANTHROPIC_API_KEY`
- Inject `SUPABASE_ADMIN` for writing generated content (system operation)
- `generateArticle(topic: string, category: ArticleCategory, difficulty: ArticleDifficulty): Promise<Article>`
  - Build Claude prompt: system instructions + topic + category + difficulty
  - Use `ArticleContentSchema` from `@motolearn/types` for structured output validation
  - Generate slug from title (kebab-case, dedup with timestamp suffix if collision)
  - Insert into `articles` table: content_json, raw_text (for search vector), category, difficulty
  - Log to `content_generation_log` table (model, tokens, cost, status)
  - Return full Article with content fields

#### Update `apps/api/src/modules/articles/articles.resolver.ts`
- Add `generateArticle` mutation (protected, rate-limited):
  ```graphql
  mutation generateArticle(input: GenerateArticleInput!): Article!
  ```
- `GenerateArticleInput`: `{ topic: string, category?: ArticleCategory, difficulty?: ArticleDifficulty }`
- Apply `@UseGuards(GqlAuthGuard)` + `@Throttle({ default: { ttl: 60000, limit: 5 } })`
- Before generating, check for existing article with trigram similarity > 0.6 on topic

#### Update `apps/api/src/modules/articles/articles.service.ts`
- Add `findBySlugFull(slug: string)` — returns full article including `contentJson`
- Add `findSimilar(topic: string)` — trigram similarity search
- Update `mapRow` to support full content fields

#### Update Article model
- Add `contentJson` field (nullable, JSON scalar — only returned on single-article queries)
- Add `readTime` computed field (word count / 200)

#### New files
| File | Purpose |
|------|---------|
| `apps/api/src/modules/articles/article-generator.service.ts` | Claude API article generation |
| `apps/api/src/modules/articles/dto/generate-article.input.ts` | GraphQL input type |
| `packages/types/src/validators/article.ts` | Add `GenerateArticleSchema` |

### Phase 2: Learn Hub UI (Mobile)

#### Update `apps/mobile/src/app/(tabs)/(learn)/index.tsx`
- Wire search bar to `searchArticles` query with debounce (300ms)
- Show article cards in search results (title, category badge, difficulty, viewCount)
- Module grid cards navigate to filtered article list (category filter)
- Add "Generate Article" button when search returns no results
- Handle generation loading state (spinner + "AI is writing...")

#### Build `apps/mobile/src/app/(tabs)/(learn)/article/[slug].tsx`
- Fetch full article via `articleBySlugFull` query (new query with contentJson)
- Render sections: heading + body for each ArticleSection
- Key takeaways section at bottom
- "Take Quiz" button if quiz exists for article
- "Mark as Read" button → `markArticleRead` mutation
- Related topics as tappable chips → navigate to search with topic

#### Add new GraphQL operations
| File | Operation |
|------|-----------|
| `apps/mobile/src/graphql/queries/article-by-slug-full.graphql` | Full article with contentJson |
| `apps/mobile/src/graphql/mutations/generate-article.graphql` | Generate new article |

#### Add query keys
- `queryKeys.articles.detail(slug)` → `['articles', 'detail', slug]`

### Phase 3: Diagnostic AI Service (API)

Create `diagnostic-ai.service.ts` — Claude Vision integration for photo analysis.

#### `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts`
- Inject `ConfigService` for `ANTHROPIC_API_KEY`
- Inject `SUPABASE_ADMIN` for reading photos from storage + updating diagnostic
- `analyzeDiagnostic(diagnosticId: string, photoUrl: string, context: DiagnosticContext): Promise<DiagnosticResult>`
  - `DiagnosticContext`: motorcycle make/model/year + wizard answers + user description
  - Build Claude Vision prompt: system instructions + context + image
  - Use `DiagnosticResultSchema` from `@motolearn/types` for structured output validation
  - Update diagnostic record: result_json, severity, confidence, status → 'completed'
  - Log to `content_generation_log`
  - Return `DiagnosticResult`

#### Update `apps/api/src/modules/diagnostics/diagnostics.resolver.ts`
- Add `submitDiagnostic` mutation:
  ```graphql
  mutation submitDiagnostic(input: SubmitDiagnosticInput!): Diagnostic!
  ```
- `SubmitDiagnosticInput`: `{ motorcycleId, photoBase64, description?, wizardAnswers?, dataSharingOptedIn }`
- Upload photo to Supabase Storage bucket `diagnostic-photos`
- Create diagnostic record (status: 'processing')
- Call `diagnostic-ai.service.analyzeDiagnostic()`
- Return completed diagnostic with results
- Apply rate limit: 3 per minute

#### Update Diagnostic model
- Add `resultJson` field (nullable, JSON scalar)
- Add `description` field (user's text description)

#### New files
| File | Purpose |
|------|---------|
| `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts` | Claude Vision analysis |
| `apps/api/src/modules/diagnostics/dto/submit-diagnostic.input.ts` | GraphQL input |
| `packages/types/src/validators/diagnostic.ts` | Add `SubmitDiagnosticSchema` |

### Phase 4: Photo Diagnostic UI (Mobile)

#### Build `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`
- Two entry points: "Take Photo" (camera) and "Upload from Gallery"
- Camera integration via `expo-image-picker` (simpler than expo-camera for this use case)
- Image compression to max 1MB via `expo-image-manipulator`
- Photo preview with optional text description field
- "Analyze" button → calls `submitDiagnostic` mutation
- Loading state: animated spinner with "AI is analyzing your photo..."
- Navigate to result screen on completion

#### Build `apps/mobile/src/app/(tabs)/(diagnose)/[id].tsx`
- Fetch diagnostic by ID (need new query)
- Display results: severity badge, confidence %, part identified
- Issues list with probability bars
- Tools needed, difficulty level
- Next steps as numbered list
- Disclaimer: "AI diagnosis for educational purposes only"
- "Find Related Article" button if `relatedArticleId` exists

#### Add new GraphQL operations
| File | Operation |
|------|-----------|
| `apps/mobile/src/graphql/mutations/submit-diagnostic.graphql` | Submit photo for analysis |
| `apps/mobile/src/graphql/queries/diagnostic-by-id.graphql` | Fetch single diagnostic with results |

#### Add query keys
- `queryKeys.diagnostics.detail(id)` → `['diagnostics', 'detail', id]`

### Phase 5: Guided Diagnostic Wizard (Mobile)

#### Update `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`
- Add wizard flow before photo capture (3 steps):
  1. "What do you notice?" — multi-select: noise, vibration, leak, smoke, warning light, performance issue, visual damage
  2. "Where on the bike?" — visual selector or multi-select: engine, brakes, exhaust, tires, electrical, suspension, chain/drivetrain
  3. "When does it happen?" — multi-select: always, at speed, idle, cold start, hot engine, braking, acceleration
- Step navigation with back button + progress indicator
- Skip wizard option for experienced users → goes straight to photo
- Wizard answers passed as structured context to AI diagnostic
- Animated transitions between steps (SlideInRight/SlideOutLeft)

### Phase 6: Cleanup & Integration

- Run `pnpm generate` to regenerate GraphQL types
- Update i18n keys for new screens (en, es, de)
- Add Anthropic SDK dependency: `@anthropic-ai/sdk` to api package.json
- Update CLAUDE.md files with AI service patterns
- Ensure `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## Complete File Change List

### Create (API — 4 files)
| File | Purpose |
|------|---------|
| `apps/api/src/modules/articles/article-generator.service.ts` | Claude API article generation |
| `apps/api/src/modules/articles/dto/generate-article.input.ts` | GenerateArticleInput DTO |
| `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts` | Claude Vision diagnostic analysis |
| `apps/api/src/modules/diagnostics/dto/submit-diagnostic.input.ts` | SubmitDiagnosticInput DTO |

### Create (Mobile — 2 GraphQL operations)
| File | Purpose |
|------|---------|
| `apps/mobile/src/graphql/queries/article-by-slug-full.graphql` | Full article query with contentJson |
| `apps/mobile/src/graphql/mutations/generate-article.graphql` | Article generation mutation |
| `apps/mobile/src/graphql/mutations/submit-diagnostic.graphql` | Diagnostic submission mutation |
| `apps/mobile/src/graphql/queries/diagnostic-by-id.graphql` | Single diagnostic query |

### Modify (API — 6 files)
| File | Changes |
|------|---------|
| `articles/articles.resolver.ts` | Add generateArticle mutation, articleBySlugFull query |
| `articles/articles.service.ts` | Add findBySlugFull, findSimilar methods |
| `articles/articles.module.ts` | Register ArticleGeneratorService |
| `articles/models/article.model.ts` | Add contentJson, readTime fields |
| `diagnostics/diagnostics.resolver.ts` | Add submitDiagnostic mutation |
| `diagnostics/diagnostics.module.ts` | Register DiagnosticAiService |
| `diagnostics/models/diagnostic.model.ts` | Add resultJson, description fields |

### Modify (Mobile — 5 screens)
| File | Changes |
|------|---------|
| `(learn)/index.tsx` | Wire search, article cards, generate button |
| `(learn)/article/[slug].tsx` | Full article reader with sections |
| `(diagnose)/new.tsx` | Wizard + photo capture + submission |
| `(diagnose)/[id].tsx` | Diagnostic result display |
| `(diagnose)/index.tsx` | Minor: link to new diagnostic properly |

### Modify (Types — 2 files)
| File | Changes |
|------|---------|
| `packages/types/src/validators/article.ts` | Add GenerateArticleSchema |
| `packages/types/src/validators/diagnostic.ts` | Add SubmitDiagnosticSchema |

### Modify (Config — 3 files)
| File | Changes |
|------|---------|
| `apps/api/package.json` | Add @anthropic-ai/sdk |
| `apps/mobile/src/i18n/locales/*.json` | New i18n keys |
| `apps/mobile/src/lib/query-keys.ts` | Add articles.detail, diagnostics.detail |

## Acceptance Criteria

### MOT-8: AI Content Pipeline
- [ ] `generateArticle` mutation creates article via Claude API
- [ ] Generated articles follow `ArticleContentSchema` (sections, keyTakeaways, relatedTopics)
- [ ] Articles saved to DB with content_json, raw_text, and search_vector
- [ ] Deduplication: similar topic (trigram > 0.6) returns existing article
- [ ] Generation logged to content_generation_log (model, tokens, cost)
- [ ] Rate limited: 5 articles per minute per user

### MOT-9: Learn Hub UI
- [ ] Search bar filters articles in real-time (debounced 300ms)
- [ ] Module grid cards filter articles by category
- [ ] Article detail screen renders full content (sections, key takeaways)
- [ ] "Generate Article" option when no search results
- [ ] "Mark as Read" updates learning progress
- [ ] Pull-to-refresh on article list

### MOT-12: Photo Diagnostic
- [ ] Camera capture via expo-image-picker
- [ ] Gallery upload option
- [ ] Image compressed to max 1MB before upload
- [ ] Claude Vision analyzes photo + context → structured DiagnosticResult
- [ ] Result displays: severity, confidence, issues, tools, difficulty, next steps
- [ ] Disclaimer shown on every result screen
- [ ] Photo stored in Supabase Storage

### MOT-13: Guided Wizard
- [ ] 3-step wizard with multi-select options
- [ ] Progress indicator (step 1/3, 2/3, 3/3)
- [ ] Skip option for experienced users
- [ ] Wizard answers sent as structured context to AI
- [ ] Animated transitions between steps

## Dependencies

### Add
- `@anthropic-ai/sdk` ^0.39.x (API)
- `expo-image-manipulator` (Mobile — image compression)

### Already Available
- `expo-image-picker` (already in app.json)
- `@tanstack/react-query` (data layer)
- `graphql-request` (transport)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Claude API cost | Rate limiting (5 articles/min, 3 diagnostics/min) + content_generation_log tracking |
| Slow generation (>10s) | Show animated loading states; articles cached for all users after first generation |
| Photo too large | Compress to 1MB with expo-image-manipulator before upload |
| Invalid AI response | Validate with Zod schemas; retry once on validation failure |
| API key exposure | Key only in API .env; never sent to client |

## Institutional Learnings Applied

From `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`:
- AI service stubs were deleted as YAGNI — now implementing them for real with full functionality
- API error codes are GraphQL string extensions; global TanStack error handler checks these

From CLAUDE.md:
- Use SUPABASE_ADMIN for content generation (system operation)
- Use SUPABASE_USER for user-scoped diagnostic reads
- Never import `colors` from design-system in mobile .tsx files — use `palette` or hex
