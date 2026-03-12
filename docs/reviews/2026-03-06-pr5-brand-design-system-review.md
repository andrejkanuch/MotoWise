# Architecture Review: PR #5 — Brand Design System Implementation

**Branch:** `feat/brand-design-system-trusted-guide`
**Reviewer:** Architecture Strategist Agent
**Date:** 2026-03-06
**Commits reviewed:** 6 (70d0271..2e901a2)
**Files changed:** 52 (+2909 / -358)

---

## 1. Architecture Overview

The PR introduces a new shared package (`@motovault/design-system`) containing OKLCH color tokens, typography constants, and spacing values. It integrates Tailwind CSS v4 on the Next.js web app and NativeWind v5 on the Expo mobile app, then migrates all existing inline styles (web) and `StyleSheet.create` blocks (mobile) to utility classes. A dark mode toggle with Zustand persistence is added to the mobile profile screen.

The three-layer token architecture (CSS tokens -> semantic aliases -> JS constants) is sound and follows modern design system conventions. The package boundary is correctly separated from `@motovault/types`.

---

## 2. Findings

### CRITICAL — Missing workspace dependency declarations

**Files:** `/apps/web/package.json`, `/apps/mobile/package.json`

Neither `apps/web` nor `apps/mobile` declares `@motovault/design-system` as a workspace dependency. Both `package.json` files have no `"@motovault/design-system": "workspace:*"` entry. This works locally by accident because the CSS imports use relative filesystem paths (`../../../../packages/design-system/src/tokens.css`), but it means:

- Turborepo cannot infer the dependency graph correctly. A change to `packages/design-system` will not automatically trigger rebuilds of `apps/web` or `apps/mobile`.
- The JS exports (`colors`, `spacing`, `typography`) from `@motovault/design-system` would fail to resolve if any code tried to import them via the package name.
- This violates the monorepo convention in CLAUDE.md: "use @motovault/* imports" rather than relative paths across package boundaries.

**Recommendation:** Add `"@motovault/design-system": "workspace:*"` to the `dependencies` of both `/apps/web/package.json` and `/apps/mobile/package.json`. Then change the CSS imports in `globals.css` / `global.css` to use the package exports path (`@motovault/design-system/tokens.css`) instead of relative filesystem paths. If Tailwind v4 CSS `@import` cannot resolve package exports, keep the relative paths for CSS but still add the workspace dependency for Turbo graph correctness.

---

### CRITICAL — CSS imports use relative filesystem paths instead of package exports

**Files:**
- `/apps/web/src/app/globals.css` (lines 2-3)
- `/apps/mobile/src/global.css` (lines 2-3)

Both files import tokens via `@import "../../../../packages/design-system/src/tokens.css"` instead of `@import "@motovault/design-system/tokens.css"`. The `package.json` exports map in `@motovault/design-system` correctly defines `"./tokens.css": "./src/tokens.css"` and `"./semantic.css": "./src/semantic.css"`, but these exports are never used.

This creates a fragile coupling to the physical filesystem layout. If the monorepo structure changes (e.g., nesting depth), all imports break. The package exports exist specifically to abstract this away.

**Recommendation:** Change to `@import "@motovault/design-system/tokens.css"` and `@import "@motovault/design-system/semantic.css"` in both CSS files. Verify that `@tailwindcss/postcss` resolves package exports (it should, via Node module resolution). If not, document the limitation.

---

### HIGH — Hardcoded OKLCH color values in tab bar layout

**File:** `/apps/mobile/src/app/(tabs)/_layout.tsx` (lines 5-6)

```ts
const TAB_BAR_ACTIVE_COLOR = 'oklch(0.55 0.17 230)'; // primary-500
const TAB_BAR_BG_COLOR = 'oklch(0.98 0 0)'; // neutral-50 (surface)
```

These are raw OKLCH strings duplicated from the token definitions. The entire purpose of the design system package is to be the single source of truth. If `primary-500` changes in `tokens.css`, these values will drift silently.

Additionally, the tab bar background is hardcoded to the light theme surface color, so the tab bar will remain light-colored even when dark mode is active.

**Recommendation:** Import from the JS token constants:
```ts
import { colors } from '@motovault/design-system';
const TAB_BAR_ACTIVE_COLOR = colors.primary[500];
const TAB_BAR_BG_COLOR = colors.neutral[50];
```
For dark mode support, either use `useColorScheme` from `nativewind` to switch between `colors.neutral[50]` and `colors.neutral[950]`, or use the `tabBarBackground` option with a component that reads the current scheme.

---

### HIGH — Hardcoded `placeholderTextColor="#999"` across 8 occurrences

**Files:**
- `/apps/mobile/src/app/(auth)/login.tsx` (lines 32, 42)
- `/apps/mobile/src/app/(auth)/register.tsx` (lines 34, 42, 52)
- `/apps/mobile/src/app/(tabs)/(garage)/add-bike.tsx` (lines 20, 28, 36)

All `TextInput` components use `placeholderTextColor="#999"` — a raw hex value that does not come from the design system and will not respond to dark mode. The PR's own acceptance criteria state "Zero hardcoded hex color values in mobile app."

**Recommendation:** Use `colors.neutral[400]` from the design system package, or derive the value from the current color scheme:
```ts
import { colors } from '@motovault/design-system';
// ...
placeholderTextColor={colors.neutral[400]}
```

---

### HIGH — Untranslated strings in the theme toggle UI

**File:** `/apps/mobile/src/app/(tabs)/(profile)/index.tsx` (lines 74, 77)

```tsx
<Text ...>Theme</Text>
<Text ...>Choose your preferred appearance</Text>
```

The rest of the profile screen uses `useTranslation()` and `t()` calls for all user-visible text. These two new strings are hardcoded in English, breaking the i18n pattern established in the previous PR.

**Recommendation:** Add `profile.theme` and `profile.themeDescription` keys to all locale files (`en.json`, `es.json`, `de.json`) and use `t('profile.theme')` / `t('profile.themeDescription')`. Similarly, the theme option labels ("System", "Light", "Dark") on lines 16-18 should use translation keys.

---

### MEDIUM — Semantic CSS variables not registered with Tailwind `@theme`

**File:** `/packages/design-system/src/semantic.css`

The semantic aliases (`--color-surface`, `--color-on-surface`, etc.) are defined as plain CSS custom properties in `:root` / `.dark`, but they are not registered in the `@theme` block in `tokens.css`. This means Tailwind v4 does not generate utility classes for them.

The web app works around this by using arbitrary property syntax: `bg-[--color-surface]`, `text-[--color-on-surface]`. This is verbose and inconsistent with the primary/neutral tokens that get clean utilities like `bg-primary-500`.

**Recommendation:** Either register semantic tokens in the `@theme` block so they generate utilities (`bg-surface`, `text-on-surface`), or document the intentional decision to use arbitrary properties for semantic tokens. The former is preferred for consistency.

---

### MEDIUM — Inconsistent dark mode strategy between web and mobile

**Web:** Uses `@custom-variant dark` with `.dark` class on `<html>`. Semantic CSS variables switch via `.dark` selector. Components use both semantic variables (`text-[--color-on-surface]`) and explicit dark variants (`dark:text-neutral-50`).

**Mobile:** Uses NativeWind's `useColorScheme` + `dark:` variant prefix on className strings. No `ThemeProvider` wrapper with `vars()` as recommended in the plan document. Semantic CSS variables from `semantic.css` are imported but never used in mobile components.

This means:
1. Web components redundantly specify both `text-[--color-on-surface]` AND `dark:text-neutral-50` (the semantic variable already handles the switch).
2. Mobile components ignore semantic variables entirely and use only `dark:` variants.
3. The two platforms use different dark mode mechanisms, reducing the benefit of shared tokens.

**Recommendation:** Pick one strategy per platform and be consistent. On web, if using semantic CSS variables for dark mode, remove the redundant `dark:` overrides. On mobile, either implement the `ThemeProvider` with `vars()` pattern from the plan (so semantic variables work) or document that mobile uses `dark:` variants exclusively.

---

### MEDIUM — `next-env.d.ts` contains a non-standard `import` statement

**File:** `/apps/web/next-env.d.ts` (line 3)

```ts
import './.next/types/routes.d.ts';
```

Standard `next-env.d.ts` files use only `/// <reference>` triple-slash directives. This file appears to have been auto-generated by Next.js 16 and should not be committed if it differs from the expected format. The comment on line 5 says "This file should not be edited." The `import` statement may cause issues if `.next/types/routes.d.ts` does not exist at typecheck time (which it won't in CI before a build).

**Recommendation:** Verify this is the expected format for Next.js 16. If it causes CI typecheck failures, add `.next/types/` to the build pipeline prerequisites or add `next-env.d.ts` to `.gitignore` as some projects do.

---

### MEDIUM — `@source` directive path may be too broad

**Files:**
- `/apps/web/src/app/globals.css` (line 4): `@source "../../../../packages/";`
- `/apps/mobile/src/global.css` (line 4): `@source "../../../../packages/";`

This tells Tailwind to scan ALL packages for class usage, including `packages/graphql` (generated code), `packages/types` (Zod schemas), and `packages/tsconfig` (config files). This increases Tailwind's scan time unnecessarily and could pick up false-positive class-like strings from generated GraphQL types.

**Recommendation:** Narrow the source to `@source "../../../../packages/design-system/";` since that is the only package likely to contain Tailwind class references. If shared components are added to the design system later, this will still cover them.

---

### LOW — `expo-symbols` is iOS-only; Android fallback not addressed

**File:** `/apps/mobile/src/app/(tabs)/_layout.tsx`

The `SymbolView` component from `expo-symbols` renders SF Symbols, which are iOS-only. The plan document states "SF Symbols on iOS, Material Icons on Android," but no Android fallback is implemented. On Android, `SymbolView` may render nothing or throw.

**Recommendation:** Verify `expo-symbols` v55 behavior on Android. If it does not provide automatic fallback, add a platform check or use a cross-platform icon solution as a fallback.

---

### LOW — Spacing and radii JS constants diverge from CSS tokens

**File:** `/packages/design-system/src/spacing.ts` (line 16)

The JS `radii` object defines `card: 12` (pixels), but `tokens.css` defines `--radius-card: 0.75rem`. At default browser settings, `0.75rem = 12px`, but they can diverge if root font size changes. Similarly, the spacing scale is in pixels in JS but not defined in CSS tokens at all.

**Recommendation:** Add a comment in `spacing.ts` documenting that pixel values assume 16px root font size, or derive the values from a shared constant. Consider adding spacing tokens to `tokens.css` as well for web Tailwind usage.

---

### LOW — `.claude/skills/ralph-wiggum/SKILL.md` included in PR

**File:** `/.claude/skills/ralph-wiggum/SKILL.md`

This is a Claude Code skill definition file unrelated to the design system feature. It should be in a separate PR or excluded from this branch.

**Recommendation:** Remove from this PR branch and submit separately if needed.

---

### LOW — `docs/schema-design.md` included in PR

**File:** `/docs/schema-design.md` (854 lines)

A comprehensive database schema design document was added in this PR. While valuable, it is unrelated to the brand design system feature and inflates the PR scope.

**Recommendation:** Split into a separate PR for cleaner review history.

---

## 3. Compliance Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Types flow one direction (packages -> apps) | PASS | `@motovault/design-system` is a package consumed by apps |
| Use `@motovault/*` imports, not relative cross-package | FAIL | CSS imports use relative `../../../../` paths |
| Use `as const` objects, not TypeScript `enum` | PASS | All JS token exports use `as const` |
| Export both schema AND inferred type | PASS | All TS files export value + type |
| Biome for linting (no ESLint/Prettier) | PASS | Final commit applies Biome fixes |
| `borderCurve: 'continuous'` on rounded elements | PASS | Applied on all mobile rounded elements |
| No hardcoded hex colors | FAIL | 8 `placeholderTextColor="#999"` instances |
| i18n for all user-facing strings | FAIL | "Theme" and "Choose your preferred appearance" not translated |

---

## 4. Risk Analysis

| Risk | Severity | Likelihood |
|------|----------|------------|
| Turbo cache misses due to missing workspace dep | High | Certain |
| Tab bar stays light in dark mode | Medium | Certain (no conditional logic) |
| Android tab bar icons missing | Medium | Likely (iOS-only SF Symbols) |
| Semantic CSS vars unused on mobile | Low | Accepted (uses dark: variants instead) |
| CSS relative paths break on restructure | Low | Unlikely short-term |

---

## 5. Summary of Recommendations

**Must fix before merge (3):**
1. Add `"@motovault/design-system": "workspace:*"` to both app `package.json` files
2. Replace `placeholderTextColor="#999"` with design system token values (8 occurrences)
3. Replace hardcoded OKLCH strings in `_layout.tsx` tab bar with imports from `@motovault/design-system`

**Should fix before merge (3):**
4. Add i18n keys for theme toggle strings in profile screen
5. Change CSS imports to use package export paths instead of relative filesystem paths
6. Fix tab bar background to respond to dark mode

**Consider for follow-up (5):**
7. Register semantic tokens in `@theme` to generate clean Tailwind utilities
8. Unify dark mode strategy (semantic vars vs. `dark:` variants)
9. Narrow `@source` directive to `packages/design-system/` only
10. Verify `expo-symbols` Android behavior
11. Remove unrelated files (`ralph-wiggum/SKILL.md`, `schema-design.md`) from PR
