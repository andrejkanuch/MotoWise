---
title: "feat: Add i18n multi-language support (English, Spanish, German)"
type: feat
status: active
date: 2026-03-06
---

# feat: Add i18n Multi-Language Support (EN/ES/DE)

## Enhancement Summary

**Deepened on:** 2026-03-06
**Research agents used:** 11 (best-practices-researcher, framework-docs-researcher, repo-research-analyst, architecture-strategist, security-sentinel, performance-oracle, kieran-typescript-reviewer, data-integrity-guardian, pattern-recognition-specialist, code-simplicity-reviewer, learnings-researcher)
**Context7 docs queried:** react-i18next, nestjs-i18n, next-intl

### Key Improvements from Research
1. **Simplified architecture**: Keep English content on `articles` table (no destructive migration), translation tables for ES/DE only
2. **Security hardened**: Explicit RLS write-deny policies, locale validation guard at API boundary, JSONB content sanitization
3. **Performance optimized**: Dual index strategy `(locale, article_id)` + `(article_id, locale)`, DataLoader batching, bundle all translations
4. **Type safety tightened**: `SupportedLocaleSchema` Zod export, `satisfies Record<>` for exhaustiveness, CI key parity check
5. **Simplified Phase 3**: Deferred admin i18n (YAGNI — internal tool, team speaks English)

### New Considerations Discovered
- nestjs-i18n may be overkill — a simple NestJS interceptor (~25 lines) suffices for locale detection
- JSONB content in translations is an XSS vector on the admin dashboard — requires safe rendering
- PostgreSQL `ALTER TYPE ... ADD VALUE` cannot run inside a transaction — locale enum extension requires careful migration planning
- `GENERATED ALWAYS AS` search_vector with CASE expression is correct but needs fallback for future locales

---

## Overview

Add internationalization (i18n) to MotoLearn supporting English, Spanish, and German. This covers three layers: mobile UI strings, API locale-aware content serving, and database schema for multilingual AI-generated content (articles, quizzes). Corresponds to Linear ticket MOT-32.

## Problem Statement / Motivation

MotoLearn targets a global motorcycle community but currently has zero i18n support:
- ~50 hardcoded English strings in the mobile app
- ~15 hardcoded strings in the admin dashboard
- No language columns in the database
- Full-text search locked to `to_tsvector('english', ...)`
- AI content generated in English only
- No user language preference storage

Spanish and German are the two largest European motorcycle markets after English-speaking countries.

## Proposed Solution

Three-phase approach prioritized by independence and impact. **Architecture decision: additive-only migration** — English content stays on the `articles`/`quizzes` tables; translation tables store ES/DE only. This avoids destructive data migration and keeps all existing queries working unchanged.

### Research Insights: Translation Table vs JSONB

| Approach | Pros | Cons |
|---|---|---|
| **Separate translation table (chosen)** | Normalized, queryable by locale, per-locale search vectors, scales to many locales | JOIN on non-English reads, more migrations |
| JSONB columns on existing tables | No JOINs, simpler queries | Hard to query by locale, no per-locale FTS, row bloat |

The translation table approach is correct for this codebase because: (1) per-locale `search_vector` with correct `regconfig` requires separate rows, (2) the existing `articles` table has FK relationships from `learning_progress`, `content_flags`, `diagnostics` that are locale-independent, (3) it scales cleanly when adding more locales.

### Phase 0: Shared Types (prerequisite for all phases)

Define the single source of truth for locale types in `packages/types`. This must exist before any app consumes it.

**`packages/types/src/constants/enums.ts`** — add:
```typescript
export const SUPPORTED_LOCALES = ['en', 'es', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
```

**Research Insight (TypeScript reviewer):** Use array form (not object) since keys === values. Array gives `.includes()` for runtime validation and `.map()` for iteration (dropdown options, seeding). Export Zod schema alongside per project convention:

**`packages/types/src/validators/locale.ts`** — new:
```typescript
import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../constants/enums';

export const SupportedLocaleSchema = z.enum(SUPPORTED_LOCALES);
export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;
```

**`apps/api/src/common/constants/locale.ts`** — server-side mapping:
```typescript
import type { SupportedLocale } from '@motolearn/types';

export const LOCALE_TO_REGCONFIG = {
  en: 'english',
  es: 'spanish',
  de: 'german',
} as const satisfies Record<SupportedLocale, string>;
```

**Research Insight (TypeScript reviewer):** `satisfies Record<SupportedLocale, string>` ensures compile-time exhaustiveness — adding `'fr'` to `SUPPORTED_LOCALES` without updating this map causes a TypeScript error.

**`apps/api/src/common/enums/graphql-enums.ts`** — register:
```typescript
import { registerEnumType } from '@nestjs/graphql';
import { SUPPORTED_LOCALES } from '@motolearn/types';
// Derive a plain object for registerEnumType
const SupportedLocaleEnum = Object.fromEntries(
  SUPPORTED_LOCALES.map((l) => [l, l])
);
registerEnumType(SupportedLocaleEnum, { name: 'SupportedLocale' });
```

### Phase 1: Mobile UI Strings + User Preference (no backend changes)

Install `expo-localization` + `i18next` + `react-i18next` in the mobile app. Extract all hardcoded strings into JSON translation files. Add language picker in profile settings. Persist preference in Zustand store.

**Libraries:**
- `expo-localization` — detect device locale (one call: `getLocales()[0]?.languageCode`)
- `i18next` — translation engine (CLDR pluralization, interpolation, namespaces)
- `react-i18next` — React hooks (`useTranslation`, `Trans`)

**Research Insight (simplicity reviewer):** Do NOT install language detection plugins (`i18next-browser-languagedetector`, `i18next-react-native-language-detector`). One line of expo-localization replaces them:
```typescript
import { getLocales } from 'expo-localization';
const deviceLang = getLocales()[0]?.languageCode ?? 'en';
```

**Research Insight (performance oracle):** Bundle all translation files. With ~50 strings x 3 locales = ~3KB total, lazy loading adds network latency (200-500ms on mobile) for negligible savings. Only lazy-load if translations exceed 200 strings/locale or 8+ locales.

**Research Insight (performance oracle):** Total bundle impact: i18next (~26KB) + react-i18next (~10KB) + expo-localization (~3KB) + JSON files (~3KB) = **~42KB gzipped**. Acceptable for a platform capability. Strip unused plugins to minimize.

**File structure:**
```
apps/mobile/src/i18n/
  index.ts              # i18n init with expo-localization
  i18next.d.ts          # TypeScript key safety
  locales/
    en.json             # { "common": {...}, "learn": {...}, "diagnose": {...}, ... }
    es.json
    de.json
```

**i18n init (`apps/mobile/src/i18n/index.ts`):**
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es }, de: { translation: de } },
  lng: deviceLang,  // overridden by user preference on app launch
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
```

**TypeScript type safety (`apps/mobile/src/i18n/i18next.d.ts`):**
```typescript
import en from './locales/en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
```

**Research Insight (TypeScript reviewer):** This gives type-safe keys via `t('someKey')` but does NOT enforce that `es.json` and `de.json` have the same keys. Add a CI check:
```bash
# scripts/check-i18n-keys.ts — compare key trees across all locale files
# Fail build if es.json or de.json is missing keys from en.json
```

**Key files to modify:**
- `apps/mobile/src/app/_layout.tsx` — import i18n init
- `apps/mobile/src/app/(auth)/login.tsx` — replace ~8 hardcoded strings
- `apps/mobile/src/app/(auth)/register.tsx` — replace ~8 strings
- `apps/mobile/src/app/(tabs)/_layout.tsx` — replace 4 tab labels
- All screen files (~15 files) — replace inline strings with `t()` calls
- `apps/mobile/src/app/(tabs)/(profile)/index.tsx` — add language picker

**User preference:**
- Store in Zustand auth store: `locale: SupportedLocale` (imported from `@motolearn/types`)
- On app launch: check user pref > device locale > fallback 'en'
- When user changes language: `i18n.changeLanguage(locale)` + update Zustand store

**Research Insight (security):** Validate Zustand-persisted locale on read (not just write). A corrupted AsyncStorage value should fall back to 'en', not crash the app.

**Date/number formatting:**
- Use native `Intl.DateTimeFormat` and `Intl.NumberFormat` (Hermes supports these)
- No additional library needed

**Phase 1 does NOT include:** urql exchange for x-locale header (deferred to Phase 2), any API changes, any database changes.

### Phase 2: Database Schema + API Locale Support

Add translation tables for non-English articles and quizzes. Make the API locale-aware. English content stays on the original tables — no destructive migration.

**Migration: `supabase/migrations/00005_i18n_translation_tables.sql`**

```sql
-- Supported locales enum
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- For adding future locales, use a separate migration file.
CREATE TYPE public.supported_locale AS ENUM ('en', 'es', 'de');

-- Article translations (for non-English content)
-- English content stays on articles table as the canonical/fallback version
CREATE TABLE public.article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  locale public.supported_locale NOT NULL,
  title TEXT NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  content_json JSONB NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector(
      CASE locale
        WHEN 'en' THEN 'english'::regconfig
        WHEN 'es' THEN 'spanish'::regconfig
        WHEN 'de' THEN 'german'::regconfig
      END,
      title || ' ' || raw_text
    )
  ) STORED,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id, locale)
);

-- Quiz translations (for non-English quizzes)
CREATE TABLE public.quiz_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  locale public.supported_locale NOT NULL,
  questions_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, locale)
);

-- Indexes
-- (article_id, locale) — created implicitly by UNIQUE constraint, serves single-article lookups
-- (locale, article_id) — serves listing queries filtered by locale (dominant query pattern)
CREATE INDEX idx_article_translations_locale_article
  ON public.article_translations (locale, article_id);
CREATE INDEX idx_article_translations_search
  ON public.article_translations USING GIN (search_vector);
CREATE INDEX idx_quiz_translations_locale_quiz
  ON public.quiz_translations (locale, quiz_id);

-- RLS policies
ALTER TABLE public.article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_translations ENABLE ROW LEVEL SECURITY;

-- Read: publicly readable
CREATE POLICY "Article translations are publicly readable"
  ON public.article_translations FOR SELECT USING (true);
CREATE POLICY "Quiz translations are publicly readable"
  ON public.quiz_translations FOR SELECT USING (true);

-- Write: service_role only (AI generation writes via SUPABASE_ADMIN)
-- No INSERT/UPDATE/DELETE policies for authenticated role = denied by default with RLS enabled
-- This is intentional: translations are system-generated, not user-editable
```

**Research Insights (security sentinel):**
- `ENABLE ROW LEVEL SECURITY` is explicitly included — without it, RLS is silently disabled
- No write policies for `authenticated` role means INSERT/UPDATE/DELETE are denied by default
- Only `service_role` (SUPABASE_ADMIN) can write translations — matches the pattern where AI generates content

**Research Insights (performance oracle):**
- Dual index strategy: `UNIQUE(article_id, locale)` for single-article lookups + `(locale, article_id)` for listing queries
- The dominant query pattern is "all articles in locale X" (feeds, pagination), which needs locale-first index
- At 10K articles x 3 locales = 30K rows, GIN index is ~10MB — fits comfortably in memory

**Research Insights (data integrity guardian):**
- ON DELETE CASCADE is correct and consistent with existing patterns (quizzes, content_flags, learning_progress all cascade from articles)
- UNIQUE(article_id, locale) prevents duplicate translations
- `GENERATED ALWAYS AS` search_vector CASE must be updated when adding new locales — document this

**API changes:**

**Locale detection — simple interceptor (not nestjs-i18n):**

**Research Insight (simplicity reviewer):** nestjs-i18n is designed for server-rendered error messages and template-based responses. Your API is a GraphQL API returning data. A simple interceptor (~25 lines) replaces the entire library:

```typescript
// apps/api/src/common/interceptors/locale.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { SupportedLocaleSchema } from '@motolearn/types';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;
    const raw = req.headers['accept-language']?.split(',')[0]?.split('-')[0]
      ?? req.headers['x-locale']
      ?? 'en';
    req.locale = SupportedLocaleSchema.catch('en').parse(raw);
    return next.handle();
  }
}
```

**Research Insight (security sentinel):** Validate locale at API boundary with Zod `.catch('en').parse()` — rejects invalid values and falls back to English. Never pass raw header strings to services.

**Research Insight (TypeScript reviewer):** Use standard `Accept-Language` header (not custom `x-locale`). It's the HTTP standard and requires no client-side custom header setup. Fall back to `x-locale` if present.

**Service layer changes:**
- `ArticlesService.search()` — accept `locale` parameter, LEFT JOIN `article_translations` when locale !== 'en'
- `ArticlesService.findBySlug()` — accept `locale`, return translated content when available, English fallback
- `QuizzesService` — same pattern for quiz translations
- All translation queries use explicit SELECT columns and `.limit()` per established patterns

**Research Insight (performance oracle — N+1 prevention):**
- ALWAYS use JOIN for translations, never lazy field resolvers
- For listing queries: single `SELECT a.*, at.title, at.content_json FROM articles a LEFT JOIN article_translations at ON a.id = at.article_id AND at.locale = $1`
- For GraphQL field resolution batching: DataLoader keyed by `{articleId, locale}`

**urql locale exchange (mobile):**
- Add `Accept-Language` header to all GraphQL requests via urql `fetchExchange` options
- Read locale from Zustand store

**Shared types (`packages/types`):**
```typescript
// src/constants/enums.ts — already added in Phase 0
export const SUPPORTED_LOCALES = ['en', 'es', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
```

**NestJS models:**
- `ArticleTranslation` model with `@ObjectType()` decorator
- Update `Article` model: add optional `translation` field resolved via DataLoader

### Phase 3: AI Content Generation in ES/DE

- Update article generation prompts to accept target locale
- Generate articles natively in each language (do NOT translate -- Claude scores 98% ES, 97.7% DE)
- Store generated translations in `article_translations` and `quiz_translations` via SUPABASE_ADMIN

**Research Insight (security sentinel):** AI-generated content for a motorcycle learning platform carries safety risk. Incorrect translation of safety instructions is a liability issue. Recommendations:
- Add `review_status` column to translations (`draft` | `reviewed` | `published`)
- Never serve unreviewed AI translations for `is_safety_critical` articles
- Structure AI prompts defensively: system message for instructions, user message for content
- Log all AI translation requests and responses for audit

**Admin i18n deferred:** The admin dashboard is an internal tool used by the team (who speak English). Adding next-intl is a YAGNI violation. Defer until there's actual demand.

## Technical Considerations

- **`as const` for locales** -- per CLAUDE.md, use `as const` objects not TypeScript `enum`
- **Update sequence** -- migration > db:reset > generate:types > Zod schemas > NestJS models > pnpm generate
- **Search vector** -- PostgreSQL has built-in `spanish` and `german` text search configs
- **Cache keys** -- if caching is added, always include locale: `article:{id}:{locale}`
- **Fallback** -- if translation missing for requested locale, fall back to English (read from `articles` table directly)
- **No RTL needed** -- EN/ES/DE are all LTR languages
- **Enum extensibility** -- `ALTER TYPE supported_locale ADD VALUE 'fr'` cannot run in a transaction; use a dedicated migration file
- **`satisfies` for exhaustiveness** -- use `satisfies Record<SupportedLocale, string>` on all locale-keyed maps to catch missing locales at compile time

### Research Insights: Institutional Learnings Applied

From `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`:

| Learning | Application to i18n |
|----------|-------------------|
| **Enum single source of truth** | `SUPPORTED_LOCALES` in `packages/types` -> Zod schema -> GraphQL enum -> all apps |
| **Explicit SELECT columns** | All translation queries list columns explicitly, never `SELECT *` |
| **Always LIMIT list queries** | Translation listing queries include `.limit()` |
| **RLS WITH CHECK** | Translation tables have `ENABLE ROW LEVEL SECURITY` + no authenticated write policies |
| **Wire validation at creation** | `SupportedLocaleSchema` wired to interceptor immediately, not left as dead code |
| **No premature stubs** | No TranslationsService until Phase 2 implementation begins |
| **Never `.map(this.method)`** | All new service methods use `.map((row) => this.mapRow(row))` |

## Acceptance Criteria

### Phase 0: Shared Types
- [ ] `SUPPORTED_LOCALES` array and `SupportedLocale` type in `packages/types/src/constants/enums.ts`
- [ ] `SupportedLocaleSchema` Zod schema in `packages/types/src/validators/locale.ts`
- [ ] `LOCALE_TO_REGCONFIG` map with `satisfies Record<>` in API
- [ ] `SupportedLocale` GraphQL enum registered in `graphql-enums.ts`

### Phase 1: Mobile UI
- [ ] `expo-localization` + `i18next` + `react-i18next` installed and configured
- [ ] Translation JSON files for EN/ES/DE with all ~50 mobile strings
- [ ] All hardcoded strings in mobile app replaced with `t()` calls
- [ ] TypeScript-safe translation keys via `i18next.d.ts`
- [ ] CI script to check key parity across locale JSON files
- [ ] Language picker in profile settings
- [ ] User locale preference persisted in Zustand store (validated on read)
- [ ] Date/number formatting uses `Intl` with current locale
- [ ] Tests: i18n setup loads, language switching works, fallback to EN

### Phase 2: Database + API
- [ ] Migration creates `article_translations` and `quiz_translations` tables
- [ ] Dual index strategy: `UNIQUE(article_id, locale)` + `(locale, article_id)`
- [ ] RLS: `ENABLE ROW LEVEL SECURITY` + SELECT publicly readable + no authenticated write policies
- [ ] Locale interceptor validates `Accept-Language` / `x-locale` header with Zod
- [ ] Articles API: LEFT JOIN translations for non-English locales, English fallback from articles table
- [ ] Full-text search uses correct language config per locale
- [ ] Quizzes API returns locale-filtered questions
- [ ] urql sends `Accept-Language` header with current locale
- [ ] DataLoader batching for translation lookups (prevents N+1)
- [ ] All translation queries use explicit SELECT columns + `.limit()`
- [ ] Tests: locale detection, translation table queries, search per locale, English fallback

### Phase 3: AI + Content
- [ ] Article generation prompts include target locale
- [ ] Articles generated natively in ES/DE (not translated)
- [ ] `review_status` column on translations for safety-critical content workflow
- [ ] AI translation requests logged for audit

## Dependencies & Risks

- **Risk:** `GENERATED ALWAYS AS` search_vector CASE must be updated when adding new locales
- **Mitigation:** Document in migration comments; CASE with no matching locale falls through to NULL (search won't work but won't crash)
- **Risk:** `ALTER TYPE ... ADD VALUE` cannot run in a transaction
- **Mitigation:** Always use a dedicated migration file for adding locale enum values
- **Dependency:** Phase 2 requires Supabase CLI compatibility (currently broken in local setup)
- **Risk:** AI content quality in ES/DE may vary for motorcycle-specific terminology
- **Mitigation:** Start with 5 test articles per language; add `review_status` workflow for safety-critical content
- **Risk:** XSS via JSONB content in admin dashboard
- **Mitigation:** Never use `dangerouslySetInnerHTML`; use purpose-built renderer that maps AST nodes to React components with proper escaping; add CSP headers

## Sources & References

- Linear ticket: MOT-32 `[P1-03] Multi-language Support (Spanish, German)`
- [Expo Localization Guide](https://docs.expo.dev/guides/localization/)
- [react-i18next docs](https://react.i18next.com/) -- useTranslation hook, I18nextProvider, TypeScript setup
- [nestjs-i18n docs](https://nestjs-i18n.com/) -- HeaderResolver, AcceptLanguageResolver (evaluated but not used -- simple interceptor preferred)
- [next-intl docs](https://next-intl.dev/) -- deferred for Phase 3+ admin i18n
- [Claude Multilingual Support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support)
- Existing patterns: `packages/types/src/constants/enums.ts` (as const pattern), `apps/api/src/modules/articles/articles.service.ts` (search implementation)
- Institutional learnings: `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md`
