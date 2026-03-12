# MotoVault — Implementation Gap Report

**Date:** March 12, 2026
**Scope:** Full-stack codebase audit (mobile, API, web, database)
**Total files analyzed:** 250+

---

## Executive Summary

Your codebase is significantly more mature than most pre-launch projects — the architecture is clean, the type system is solid, and core features work end-to-end. But there are **17 critical/high-priority gaps** that need addressing before launch, primarily around: subscription billing (not wired), legal compliance (GDPR data export/deletion), missing screens (quiz is a blank placeholder), and security hardening (AI cost controls, image validation).

---

## LAUNCH BLOCKERS (Fix before any public release)

### 1. RevenueCat Never Initialized
**Where:** Mobile app startup
**What:** `initRevenueCat()` function is defined in `src/lib/subscription.ts` but **never called anywhere**. The subscription store exists but is never hydrated. The paywall screen fetches offerings but the core SDK isn't initialized.
**Impact:** No subscription revenue. Paywall is cosmetic only.
**Fix:** Call `initRevenueCat()` in root `_layout.tsx` on app mount. Connect store to RevenueCat listeners.
**Effort:** 2-3 days

### 2. No Pro Feature Gates
**Where:** Entire mobile app
**What:** All features (AI diagnostics, unlimited articles, maintenance reminders) are available to all users regardless of subscription tier. There's no logic anywhere that checks `subscription_tier` before allowing access.
**Impact:** No incentive to upgrade. Zero conversion.
**Fix:** Create a `useProGate()` hook that checks subscription state and shows paywall when free users hit premium features.
**Effort:** 3-5 days

### 3. Quiz Screen Is a Blank Placeholder
**Where:** `apps/mobile/src/app/(tabs)/(learn)/quiz/[id].tsx`
**What:** The screen only displays the quiz ID. No questions rendered, no answer tracking, no submission logic, no scoring. The learning hub links to quizzes that don't work.
**Impact:** Broken user experience. Learning feature is incomplete.
**Fix:** Implement quiz rendering, answer selection, submission via GraphQL, score display.
**Effort:** 3-5 days

### 4. Data Export Handler Is Empty
**Where:** `apps/mobile/src/app/(tabs)/(profile)/privacy.tsx` lines 139-150
**What:** "Export My Data" button shows an alert with an empty `onPress: () => {}` callback. Does nothing.
**Impact:** GDPR Article 20 (data portability) violation. App Store rejection risk if reviewers test this flow.
**Fix:** Build API endpoint to compile user data → generate JSON/CSV → email to user or allow download.
**Effort:** 3-5 days

### 5. Account Deletion Not Implemented
**Where:** `apps/mobile/src/app/(tabs)/(profile)/privacy.tsx` lines 153-177
**What:** "Delete My Account" redirects to "contact support" instead of actually deleting. Both Apple and Google now **require** in-app account deletion.
**Impact:** **App Store rejection guaranteed.** Apple requires functional account deletion since June 2022. Google requires it since December 2023.
**Fix:** Build deletion confirmation flow → API endpoint → cascade delete user data → sign out.
**Effort:** 3-5 days

### 6. Missing OG Image and App Icon for Web
**Where:** `apps/web/public/`
**What:** `og-image.png` and `icon.png` are referenced in JSON-LD and OpenGraph meta tags but don't exist in the public directory.
**Impact:** Broken social sharing previews (Twitter, LinkedIn, iMessage). Missing favicon.
**Fix:** Design and export both images. OG image should be 1200×630.
**Effort:** 1 day

---

## HIGH PRIORITY (Fix before or immediately after launch)

### 7. AI Article Generation Not Wired
**Where:** `apps/mobile/src/app/(tabs)/(learn)/index.tsx` line 89
**What:** TODO comment: "Wire GenerateArticleDocument mutation when API resolver is ready." Button shows a fake 2-second loading animation then does nothing.
**Impact:** Core feature appears broken. Users will tap "Generate" and nothing happens.
**Fix:** Wire the mutation. The API resolver and service already exist.
**Effort:** 1 day

### 8. Onboarding Mutation Schema Mismatch
**Where:** `apps/mobile/src/app/(onboarding)/personalizing.tsx` line 57
**What:** Uses `as any` type assertion on `CompleteOnboardingDocument`. Fields like `ridingFrequency`, `maintenanceStyle`, `annualRepairSpend` may not match the GraphQL schema.
**Impact:** Onboarding data silently lost. User profile incomplete. AI insights based on partial data.
**Fix:** Run `pnpm generate` to sync types, then verify all fields are included in the mutation.
**Effort:** 1 day

### 9. No Image Size Validation on Diagnostic Uploads
**Where:** `apps/api/src/modules/diagnostics/diagnostic-ai.service.ts`
**What:** Base64 image data is passed directly to Claude with no size limit. A 100MB image would be accepted and sent to the AI.
**Impact:** Claude API cost explosion, potential OOM on API server, abuse vector.
**Fix:** Validate base64 length before processing (max ~5MB decoded). Return 413 if exceeded.
**Effort:** 1 day

### 10. No Daily AI Spend Limits
**Where:** API — articles, diagnostics, insights modules
**What:** Rate limiting exists (5 articles/min, 3 diagnostics/min) but there's no daily/monthly budget cap per user or globally.
**Impact:** A determined user could generate 300 articles/hour × $0.02 each = $6/hour in API costs. At scale, this is unbounded.
**Fix:** Add a daily token budget per user (check `content_generation_log` before each generation). Add a global circuit breaker.
**Effort:** 2-3 days

### 11. Zero Test Coverage
**Where:** Entire API (`apps/api/`)
**What:** 1 test file found (locale interceptor spec, 56 lines). No service tests, no resolver tests, no auth guard tests, no integration tests. Coverage: <1%.
**Impact:** No safety net for regressions. Every code change is a deployment risk.
**Fix:** Start with the highest-risk surfaces: auth guard, AI services, soft-delete RPCs.
**Effort:** 1-2 weeks (ongoing)

### 12. No Analytics or Crash Reporting
**Where:** Mobile app
**What:** Privacy screen shows toggles for "Analytics" and "Crash Reporting" but no SDK is integrated (no Sentry, PostHog, Mixpanel, or Firebase). Toggles do nothing.
**Impact:** You'll be flying blind post-launch. Can't measure retention, can't debug crashes, can't track feature adoption.
**Fix:** Integrate Sentry (crash reporting) + PostHog or Mixpanel (analytics). Respect the user's toggle settings.
**Effort:** 2-3 days

### 13. Unprotected Article Queries
**Where:** `apps/api/src/modules/articles/articles.resolver.ts` lines 23-35
**What:** `searchArticles()`, `articleBySlug()`, and `articleBySlugFull()` have no `@UseGuards(GqlAuthGuard)` decorator. Intentionally public? Or accidentally unprotected?
**Impact:** If intentional, add `@Public()` decorator for clarity. If not, unauthenticated users can access all article content.
**Fix:** Add explicit `@Public()` decorator if intentional, or add auth guard if not.
**Effort:** 30 minutes

---

## MEDIUM PRIORITY (Post-launch improvements)

### 14. No Audit Logging
**Where:** Database
**What:** No audit table tracks user data changes. Soft-deleted rows have no trail of who deleted them or when. `content_generation_log` tracks AI calls but no user CRUD actions.
**Impact:** Cannot investigate data issues, cannot demonstrate compliance, cannot detect abuse.
**Fix:** Create an `audit_log` table with trigger-based INSERT/UPDATE/DELETE logging on key tables.
**Effort:** 3-5 days

### 15. No Global Error Boundary (Mobile)
**Where:** Mobile app root
**What:** Individual screens handle errors, but there's no root-level React error boundary. An unhandled exception in any component tree will crash the entire app.
**Fix:** Add an `ErrorBoundary` wrapper in root `_layout.tsx` with a "Something went wrong" fallback screen.
**Effort:** 1 day

### 16. Admin Dashboard Is Empty
**Where:** `apps/web/src/app/admin/`
**What:** All 4 admin pages (articles, users, diagnostics, flags) are heading-only placeholders with no data tables, no API integration, no CRUD.
**Impact:** No way to manage content, moderate flags, or view user data without direct DB access.
**Fix:** Build out at minimum the articles management page (create, edit, hide/show, view stats).
**Effort:** 1-2 weeks

### 17. Accessibility Labels Missing
**Where:** Entire mobile app
**What:** Only 1 component (`HealthScoreRing.tsx`) has accessibility labels. All buttons, form fields, pressables, and navigation elements across 54 screens lack `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint`.
**Impact:** VoiceOver/TalkBack users cannot use the app. Potential legal exposure (ADA compliance).
**Fix:** Systematic pass through all interactive elements. Start with navigation and primary flows.
**Effort:** 3-5 days

---

## LOWER PRIORITY (Nice to have)

| # | Issue | Location | Effort |
|---|---|---|---|
| 18 | Deep linking not configured | Mobile app | 2 days |
| 19 | Hardcoded `motowise.app` URLs in web share page | Web app | 30 min |
| 20 | Insights service uses manual validation instead of Zod | API | 1 day |
| 21 | Fire-and-forget promises missing `.catch()` (6 places) | API | 1 hour |
| 22 | No soft-delete recovery / "undo" mutations | API | 2 days |
| 23 | No data retention policy for soft-deleted rows | Database | 1 day |
| 24 | Memory-based rate limiting won't survive restarts | API | 2 days |
| 25 | 17 console.log statements in mobile codebase | Mobile | 1 hour |
| 26 | No structured logging / request trace IDs | API | 2-3 days |
| 27 | No database transaction support for multi-step ops | API | 3 days |
| 28 | Share links don't enforce expiration | Database | 1 day |
| 29 | Subscription DB columns exist but no enforcement | Database | 2 days |

---

## Priority Effort Summary

| Priority | Items | Total Effort |
|----------|-------|-------------|
| **Launch Blockers** | 6 | ~2-3 weeks |
| **High Priority** | 7 | ~3-4 weeks |
| **Medium Priority** | 4 | ~2-3 weeks |
| **Lower Priority** | 12 | ~2-3 weeks |

**Realistic launch timeline:** 3-4 weeks if you focus exclusively on launch blockers + the highest-impact high-priority items (article generation wiring, image validation, spend limits).

**Minimum viable launch (just blockers):** 2-3 weeks for RevenueCat, pro gates, quiz screen, data export, account deletion, and OG images.

---

## What You're Doing Right

This isn't all doom and gloom — the codebase has genuinely strong foundations:

- **Architecture:** Clean monorepo with proper package boundaries, one-direction type flow, generated types
- **Security:** RLS on all 14 tables, security-hardened functions with pinned search paths, role escalation prevention, JWT validation
- **AI integration:** Structured outputs with Zod validation, rate limiting, cost tracking, graceful fallbacks
- **Database:** 30 well-organized migrations, proper soft-delete patterns, composite indexes, denormalized counters with triggers
- **Mobile UX:** Reanimated v4 animations, haptic feedback, dark mode, 3 languages, pull-to-refresh, offline-first caching
- **Web:** CSP/HSTS headers, JSON-LD structured data, i18n alternates, proper error pages

The gaps are mostly "last mile" issues — wiring things together, adding guardrails, and finishing placeholder screens. The hard architectural work is done.

---

*Generated March 12, 2026 from full-stack codebase audit across apps/mobile, apps/api, apps/web, supabase/, and packages/.*
