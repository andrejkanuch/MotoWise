---
title: "feat: Implement Brand Design System — Direction A: Trusted Guide"
type: feat
status: active
date: 2026-03-06
deepened: 2026-03-06
---

## Enhancement Summary

**Deepened on:** 2026-03-06
**Research sources:** Context7 (NativeWind v5, Next.js 16), 5 review agents (architecture, performance, TypeScript, patterns, simplicity), 3 skill agents (expo-tailwind-setup, building-native-ui, frontend-design), repo research, best-practices research, SpecFlow analysis
**Sections enhanced:** 8

### Key Improvements
1. **NativeWind v5 Metro config corrected** — `withNativewind(config)` no longer takes `input` param (v5 breaking change from v4)
2. **Font loading pattern grounded** — `next/font/google` with `variable` CSS prop on `<html>`, confirmed against Next.js 16.1.6 docs
3. **NativeWind theme switching pattern added** — `vars()` + `useColorScheme` from official NativeWind v5 docs
4. **Monorepo `@source` directive added** — Required for Tailwind v4 to scan classes in shared packages
5. **Accessibility contract strengthened** — WCAG AA contrast validation tooling specified
6. **Institutional learning applied** — Monorepo code review prevention strategies (from `docs/solutions/`)

### New Considerations Discovered
- NativeWind v5 removed the JSX transform — no more automatic `className` on every element; uses `react-native-css` runtime instead
- PostCSS install for mobile must use `npx expo install --dev` (not `pnpm add -D`) to ensure Expo-compatible versions
- `@source "../../packages/"` directive is mandatory in both `globals.css` and `global.css` for Tailwind to detect utility usage in shared packages
- Dark mode on mobile requires a `ThemeProvider` wrapper component using NativeWind `vars()` — not just `useColorScheme`

---

# Implement Brand Design System — Direction A: Trusted Guide

## Overview

Establish MotoLearn's visual identity with a "Trusted Guide" brand direction — conveying reliability, expertise, and warmth for motorcycle learners. This feature creates a shared design token package (`@motolearn/design-system`), integrates Tailwind CSS v4 on web, NativeWind v5 on mobile, and migrates all existing hardcoded styles to token-based styling with dark mode support.

Currently the codebase has **zero design system infrastructure**: web uses inline `style={{}}` objects, mobile uses `StyleSheet.create` with hardcoded hex values, and there are two competing "primary" colors (`#007AFF` on web, `#1a1a2e` on mobile). This feature resolves all inconsistencies.

## Problem Statement / Motivation

- **No shared tokens**: 11+ unique hardcoded color values scattered across 16+ files with no consistency
- **No CSS framework**: Web has no `globals.css`, no Tailwind, no CSS modules — just inline styles
- **No brand identity**: Generic system fonts, iOS blue buttons, no deliberate visual language
- **No dark mode**: `app.json` declares `userInterfaceStyle: "automatic"` but no code supports it
- **No tab icons**: Mobile tab bar is text-only (broken UX pattern)
- **Inconsistent primary colors**: `#007AFF` (web) vs `#1a1a2e` (mobile) — no deliberate choice

## Proposed Solution

A three-layer design system shared across web and mobile:

```
@motolearn/design-system (packages/design-system/)
        |
   tokens.css (@theme directive — single source of truth)
        |
   +----+----+
   |         |
 Web       Mobile
 Tailwind  NativeWind v5
 CSS v4    (react-native-css)
```

### Brand Direction: "Trusted Guide"

| Role | Color | Psychology | Usage |
|------|-------|-----------|-------|
| **Primary** | Deep blue (oklch hue ~230) | Trust, reliability, expertise | Navigation, CTAs, links, headers |
| **Accent** | Teal-green (oklch hue ~160) | Growth, learning, progress | Progress indicators, success, badges |
| **Warm** | Amber/gold (oklch hue ~70) | Encouragement, premium feel | Highlights, featured content, achievements |
| **Neutral** | True gray (no hue) | Stability, clarity | Body text, backgrounds, borders |
| **Danger** | Red (oklch hue ~25) | Warning, destructive | Delete, sign out, errors |

### Typography

- **Primary**: Plus Jakarta Sans (geometric sans-serif — authority without coldness)
- **Fallback**: Inter, system-ui, sans-serif
- **Mono**: Geist Mono (diagnostic codes, technical content)
- **Loading**: `next/font` on web (zero FOIT), `expo-font` on mobile

### Research Insights: Typography

**Best Practices:**
- Use `next/font/google` with `variable` option to create CSS custom properties — confirmed in Next.js 16.1.6 docs
- Apply font variable classes to `<html>` element, not `<body>`, so Tailwind `font-sans` utility inherits correctly
- Set `display: 'swap'` on all font declarations for optimal LCP

**Implementation Detail (from Context7 — Next.js 16.1.6):**
```tsx
// apps/web/src/app/layout.tsx
import { Plus_Jakarta_Sans } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${GeistMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  )
}
```

**Type Scale:**
| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `display` | 2rem (32px) | 700 | 1.2 | Hero headings |
| `h1` | 1.75rem (28px) | 700 | 1.25 | Page titles |
| `h2` | 1.5rem (24px) | 600 | 1.3 | Section headings |
| `h3` | 1.25rem (20px) | 600 | 1.4 | Sub-sections |
| `body` | 1rem (16px) | 400 | 1.5 | Body text |
| `body-sm` | 0.875rem (14px) | 400 | 1.5 | Secondary text |
| `caption` | 0.75rem (12px) | 500 | 1.4 | Labels, metadata |

## Technical Approach

### Architecture

#### New Package: `packages/design-system`

```
packages/design-system/
  package.json              # @motolearn/design-system
  tsconfig.json
  src/
    tokens.css              # @theme tokens (consumed by both apps via CSS import)
    semantic.css            # Light/dark semantic aliases (:root/.dark)
    colors.ts               # JS color constants (for charts, RN Animated, non-CSS contexts)
    typography.ts           # Font family/size/weight/lineHeight constants
    spacing.ts              # Spacing scale constants
    index.ts                # Re-exports all JS modules
```

**Why separate from `@motolearn/types`**: Types owns Zod schemas and validation (runtime dependency on Zod). Design tokens are pure CSS + constants with zero runtime dependencies. Separate packages mean independent Turbo caching — a color change doesn't trigger type-checking rebuilds.

### Research Insights: Package Structure

**Package.json exports configuration (dual CSS + TS):**
```json
{
  "name": "@motolearn/design-system",
  "version": "0.0.1",
  "private": true,
  "exports": {
    "./tokens.css": "./src/tokens.css",
    "./semantic.css": "./src/semantic.css",
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "devDependencies": {
    "@motolearn/tsconfig": "workspace:*",
    "typescript": "~5.7.0"
  }
}
```

**TypeScript token exports (with `as const` per project convention):**
```ts
// packages/design-system/src/colors.ts
export const colors = {
  primary: {
    50:  'oklch(0.97 0.01 230)',
    100: 'oklch(0.93 0.03 230)',
    200: 'oklch(0.86 0.06 230)',
    300: 'oklch(0.76 0.10 230)',
    400: 'oklch(0.65 0.14 230)',
    500: 'oklch(0.55 0.17 230)',
    600: 'oklch(0.47 0.16 230)',
    700: 'oklch(0.40 0.14 230)',
    800: 'oklch(0.33 0.11 230)',
    900: 'oklch(0.25 0.08 230)',
    950: 'oklch(0.18 0.06 230)',
  },
  accent: {
    50:  'oklch(0.97 0.02 160)',
    500: 'oklch(0.60 0.15 160)',
    700: 'oklch(0.42 0.12 160)',
  },
  warm: {
    50:  'oklch(0.97 0.01 70)',
    500: 'oklch(0.70 0.12 70)',
  },
  neutral: {
    50:  'oklch(0.98 0.00 0)',
    100: 'oklch(0.96 0.00 0)',
    200: 'oklch(0.92 0.00 0)',
    300: 'oklch(0.87 0.00 0)',
    400: 'oklch(0.71 0.00 0)',
    500: 'oklch(0.55 0.00 0)',
    600: 'oklch(0.44 0.00 0)',
    700: 'oklch(0.37 0.00 0)',
    800: 'oklch(0.27 0.00 0)',
    900: 'oklch(0.18 0.00 0)',
    950: 'oklch(0.10 0.00 0)',
  },
  danger:  { 500: 'oklch(0.58 0.22 25)' },
  success: { 500: 'oklch(0.62 0.18 145)' },
  warning: { 500: 'oklch(0.75 0.15 80)' },
} as const

export type ColorToken = typeof colors
```

#### Token CSS (`tokens.css`) using Tailwind v4 `@theme`

```css
@theme {
  /* Primary — Deep Blue (Trust) */
  --color-primary-50:  oklch(0.97 0.01 230);
  --color-primary-100: oklch(0.93 0.03 230);
  --color-primary-200: oklch(0.86 0.06 230);
  --color-primary-300: oklch(0.76 0.10 230);
  --color-primary-400: oklch(0.65 0.14 230);
  --color-primary-500: oklch(0.55 0.17 230);
  --color-primary-600: oklch(0.47 0.16 230);
  --color-primary-700: oklch(0.40 0.14 230);
  --color-primary-800: oklch(0.33 0.11 230);
  --color-primary-900: oklch(0.25 0.08 230);
  --color-primary-950: oklch(0.18 0.06 230);

  /* Accent — Teal Green (Growth) */
  --color-accent-50:  oklch(0.97 0.02 160);
  --color-accent-100: oklch(0.93 0.04 160);
  --color-accent-200: oklch(0.86 0.08 160);
  --color-accent-300: oklch(0.76 0.12 160);
  --color-accent-400: oklch(0.65 0.15 160);
  --color-accent-500: oklch(0.60 0.15 160);
  --color-accent-600: oklch(0.50 0.13 160);
  --color-accent-700: oklch(0.42 0.12 160);

  /* Warm — Amber/Gold (Encouragement) */
  --color-warm-50:  oklch(0.97 0.01 70);
  --color-warm-100: oklch(0.94 0.03 70);
  --color-warm-200: oklch(0.88 0.06 70);
  --color-warm-300: oklch(0.82 0.10 70);
  --color-warm-400: oklch(0.76 0.13 70);
  --color-warm-500: oklch(0.70 0.12 70);

  /* Neutral — True Gray */
  --color-neutral-50:  oklch(0.98 0.00 0);
  --color-neutral-100: oklch(0.96 0.00 0);
  --color-neutral-200: oklch(0.92 0.00 0);
  --color-neutral-300: oklch(0.87 0.00 0);
  --color-neutral-400: oklch(0.71 0.00 0);
  --color-neutral-500: oklch(0.55 0.00 0);
  --color-neutral-600: oklch(0.44 0.00 0);
  --color-neutral-700: oklch(0.37 0.00 0);
  --color-neutral-800: oklch(0.27 0.00 0);
  --color-neutral-900: oklch(0.18 0.00 0);
  --color-neutral-950: oklch(0.10 0.00 0);

  /* Semantic */
  --color-danger-500:  oklch(0.58 0.22 25);
  --color-success-500: oklch(0.62 0.18 145);
  --color-warning-500: oklch(0.75 0.15 80);

  /* Typography */
  --font-sans:    "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-heading: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "Geist Mono", ui-monospace, monospace;

  /* Border Radius */
  --radius-card:   0.75rem;
  --radius-button: 0.5rem;
  --radius-input:  0.5rem;
  --radius-pill:   9999px;
}
```

#### Semantic Color Aliases (`semantic.css`)

```css
:root {
  --color-surface:          var(--color-neutral-50);
  --color-surface-elevated: white;
  --color-on-surface:       var(--color-neutral-900);
  --color-on-surface-muted: var(--color-neutral-500);
  --color-border:           var(--color-neutral-200);
  --color-border-muted:     var(--color-neutral-100);
  --color-input-bg:         white;
  --color-input-border:     var(--color-neutral-300);
}

.dark {
  --color-surface:          var(--color-neutral-950);
  --color-surface-elevated: var(--color-neutral-900);
  --color-on-surface:       var(--color-neutral-50);
  --color-on-surface-muted: var(--color-neutral-400);
  --color-border:           var(--color-neutral-800);
  --color-border-muted:     var(--color-neutral-900);
  --color-input-bg:         var(--color-neutral-900);
  --color-input-border:     var(--color-neutral-700);
}
```

### Implementation Phases

#### Phase 1: Foundation — Token Package + Web Tailwind

**Deliverables:**
- `packages/design-system/` with `tokens.css`, `semantic.css`, JS exports
- Tailwind CSS v4 installed and configured in `apps/web`
- `globals.css` importing tokens + Tailwind
- Root layout updated with font loading via `next/font`
- `next.config.ts` updated to transpile `@motolearn/design-system`

**Files created:**
- `packages/design-system/package.json`
- `packages/design-system/tsconfig.json`
- `packages/design-system/src/tokens.css`
- `packages/design-system/src/semantic.css`
- `packages/design-system/src/colors.ts`
- `packages/design-system/src/typography.ts`
- `packages/design-system/src/spacing.ts`
- `packages/design-system/src/index.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/globals.css`

**Files modified:**
- `apps/web/package.json` (add `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `geist`)
- `apps/web/src/app/layout.tsx` (import globals.css, add `next/font` loading with `variable` CSS props)
- `apps/web/next.config.ts` (add `@motolearn/design-system` to `transpilePackages`)
- `turbo.json` (add design-system to pipeline if needed)
- Root `pnpm-workspace.yaml` (already covers `packages/*` — verify)

**Success criteria:**
- `pnpm --filter web dev` starts with Tailwind processing
- `bg-primary-500` and all token utilities work in web pages
- No build errors

### Research Insights: Web Tailwind v4 Setup

**globals.css (verified against Tailwind v4 + Turbo monorepo patterns):**
```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";
@import "@motolearn/design-system/tokens.css";
@import "@motolearn/design-system/semantic.css";

/* CRITICAL: Tell Tailwind to scan shared packages for class usage */
@source "../../packages/";

/* Enable class-based dark mode (not just media query) */
@custom-variant dark (&:where(.dark, .dark *));
```

**PostCSS config (Tailwind v4 — no JS config file needed):**
```js
// apps/web/postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Edge Cases:**
- The `@source` directive is mandatory in monorepos — without it, Tailwind won't generate utilities for classes used in `packages/design-system`
- No `tailwind.config.js` needed — Tailwind v4 is fully CSS-configured
- No `content` array — auto-detection replaces it

#### Phase 2: Web Migration — Replace Inline Styles

**Deliverables:**
- All web pages migrated from inline `style={{}}` to Tailwind classes
- Brand colors applied consistently across all pages
- Dark mode CSS variables functional (toggle via `.dark` class on `<html>`)

**Files modified:**
- `apps/web/src/app/page.tsx` — home page
- `apps/web/src/app/login/page.tsx` — login
- `apps/web/src/app/error.tsx` — error boundary
- `apps/web/src/app/not-found.tsx` — 404
- `apps/web/src/app/loading.tsx` — loading state
- `apps/web/src/app/admin/layout.tsx` — admin sidebar
- `apps/web/src/app/admin/page.tsx` — admin dashboard
- `apps/web/src/app/admin/sign-out-button.tsx` — sign-out
- `apps/web/src/app/admin/not-found.tsx` — admin 404
- `apps/web/src/app/admin/articles/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/diagnostics/page.tsx`
- `apps/web/src/app/admin/flags/page.tsx`

**Success criteria:**
- Zero inline `style={{}}` objects in web app (all Tailwind)
- Zero hardcoded hex color values in web app
- All text/background combos meet WCAG 2.1 AA (4.5:1)
- Dark mode toggleable via class on html element

### Research Insights: Web Migration

**Migration pattern (inline style -> Tailwind):**
```tsx
// BEFORE
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 24 }}>
  <h1>MotoLearn</h1>
  <Link href="/login" style={{ padding: '12px 24px', background: '#007AFF', color: '#fff', borderRadius: 8 }}>Sign In</Link>
</div>

// AFTER
<div className="flex flex-col items-center justify-center min-h-screen gap-6">
  <h1 className="text-3xl font-bold text-on-surface">MotoLearn</h1>
  <Link href="/login" className="px-6 py-3 bg-primary-500 text-white rounded-button hover:bg-primary-600 transition-colors">Sign In</Link>
</div>
```

**Dark mode web toggle (store preference in localStorage):**
```tsx
// apps/web/src/app/components/theme-toggle.tsx
'use client'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as typeof theme
    if (stored) setTheme(stored)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else if (theme === 'light') root.classList.remove('dark')
    else {
      // System preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      root.classList.toggle('dark', mq.matches)
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (/* toggle UI */)
}
```

#### Phase 3: Mobile Setup — NativeWind v5

**Deliverables:**
- NativeWind v5 installed and configured in `apps/mobile`
- Metro config updated with `withNativewind`
- Global CSS importing shared tokens
- Tab bar icons added using `expo-symbols`

**Files created:**
- `apps/mobile/postcss.config.mjs`
- `apps/mobile/src/global.css`

**Files modified:**
- `apps/mobile/package.json` (via `npx expo install`)
- `apps/mobile/metro.config.js` (add `withNativewind` wrapper)
- `apps/mobile/src/app/_layout.tsx` (import global.css, add ThemeProvider)
- `apps/mobile/src/app/(tabs)/_layout.tsx` (add `tabBarIcon` with SF Symbols, tab bar styling)
- `apps/mobile/app.json` (update `backgroundColor` to new brand primary)

**Success criteria:**
- NativeWind processes Tailwind classes in mobile app
- Tab bar shows icons for all 4 tabs (Learn=book, Diagnose=wrench, Garage=car, Profile=person)
- Shared tokens from `@motolearn/design-system` are consumable

### Research Insights: NativeWind v5 Setup (from Context7)

**CRITICAL CORRECTION: NativeWind v5 Metro config changed from v4.**

The plan's original Metro config was based on v4 patterns. NativeWind v5 **removed the `input` parameter**:

```js
// apps/mobile/metro.config.js — NativeWind v5 (CORRECT)
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativewind(config);
// NOTE: No second argument! v5 auto-detects the CSS input.
```

**Installation (use `npx expo install` for Expo-compatible versions):**
```bash
npx expo install nativewind react-native-css
npx expo install --dev tailwindcss @tailwindcss/postcss postcss
pnpm --filter mobile add expo-symbols
```

**Global CSS for mobile:**
```css
/* apps/mobile/src/global.css */
@import "tailwindcss";
@import "@motolearn/design-system/tokens.css";
@import "@motolearn/design-system/semantic.css";
@source "../../packages/";
```

**PostCSS config (identical to web):**
```js
// apps/mobile/postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**ThemeProvider pattern (from NativeWind v5 docs — Context7):**
```tsx
// apps/mobile/src/app/_layout.tsx
import { vars, useColorScheme } from 'nativewind'
import './global.css'  // NativeWind v5 requires CSS import in root

const themes = {
  light: vars({
    '--color-surface': 'oklch(0.98 0.00 0)',
    '--color-surface-elevated': 'white',
    '--color-on-surface': 'oklch(0.18 0.00 0)',
    '--color-on-surface-muted': 'oklch(0.55 0.00 0)',
  }),
  dark: vars({
    '--color-surface': 'oklch(0.10 0.00 0)',
    '--color-surface-elevated': 'oklch(0.18 0.00 0)',
    '--color-on-surface': 'oklch(0.98 0.00 0)',
    '--color-on-surface-muted': 'oklch(0.71 0.00 0)',
  }),
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useColorScheme()
  return <View style={themes[colorScheme ?? 'light']}>{children}</View>
}
```

**Tab bar icons (using expo-symbols per CLAUDE.md):**
```tsx
// apps/mobile/src/app/(tabs)/_layout.tsx
import { SymbolView } from 'expo-symbols'

<Tabs.Screen
  name="(learn)"
  options={{
    title: t('tabs.learn'),
    tabBarIcon: ({ color }) => <SymbolView name="book.fill" tintColor={color} size={24} />,
  }}
/>
<Tabs.Screen
  name="(diagnose)"
  options={{
    title: t('tabs.diagnose'),
    tabBarIcon: ({ color }) => <SymbolView name="wrench.and.screwdriver.fill" tintColor={color} size={24} />,
  }}
/>
<Tabs.Screen
  name="(garage)"
  options={{
    title: t('tabs.garage'),
    tabBarIcon: ({ color }) => <SymbolView name="car.fill" tintColor={color} size={24} />,
  }}
/>
<Tabs.Screen
  name="(profile)"
  options={{
    title: t('tabs.profile'),
    tabBarIcon: ({ color }) => <SymbolView name="person.fill" tintColor={color} size={24} />,
  }}
/>
```

#### Phase 4: Mobile Migration — Replace Hardcoded Styles

**Deliverables:**
- All mobile screens migrated to NativeWind classes (or token-based StyleSheet where NativeWind isn't suitable)
- Brand colors applied consistently
- Dark mode functional with three-way toggle (System / Light / Dark)
- Theme preference persisted in Zustand store

**Files modified:**
- `apps/mobile/src/app/(auth)/login.tsx`
- `apps/mobile/src/app/(auth)/register.tsx`
- `apps/mobile/src/app/(tabs)/(learn)/index.tsx`
- `apps/mobile/src/app/(tabs)/(learn)/article/[slug].tsx`
- `apps/mobile/src/app/(tabs)/(learn)/quiz/[id].tsx`
- `apps/mobile/src/app/(tabs)/(diagnose)/index.tsx`
- `apps/mobile/src/app/(tabs)/(diagnose)/new.tsx`
- `apps/mobile/src/app/(tabs)/(diagnose)/[id].tsx`
- `apps/mobile/src/app/(tabs)/(garage)/index.tsx`
- `apps/mobile/src/app/(tabs)/(garage)/add-bike.tsx`
- `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx`
- `apps/mobile/src/app/(tabs)/(profile)/index.tsx` (add dark mode toggle)
- `apps/mobile/src/app/+not-found.tsx`
- `apps/mobile/src/stores/auth.store.ts` (add `colorScheme` preference)

**Success criteria:**
- Zero hardcoded hex color values in mobile app
- Dark mode toggle in Profile tab works with three states (System/Light/Dark)
- Theme preference persists across app restarts (Zustand + AsyncStorage/SecureStore)
- Status bar adapts to current theme
- `borderCurve: 'continuous'` on all rounded elements (per CLAUDE.md)

### Research Insights: Mobile Dark Mode

**Zustand store extension (follows existing `auth.store.ts` pattern):**
```ts
// apps/mobile/src/stores/auth.store.ts — add colorScheme
interface AuthState {
  // ... existing fields
  colorScheme: 'system' | 'light' | 'dark'
  setColorScheme: (scheme: 'system' | 'light' | 'dark') => void
}

// Use zustand persist middleware with expo-secure-store
// (locale already stored this way — follow same pattern)
```

**Dark mode toggle UI (Profile tab):**
```tsx
// Three-segment control: System | Light | Dark
// Uses NativeWind's setColorScheme() for immediate effect
import { useColorScheme } from 'nativewind'

const { setColorScheme } = useColorScheme()
// When user selects "dark": setColorScheme('dark')
// When user selects "system": setColorScheme(undefined) // follows OS
```

**Prevention strategy (from monorepo code review learning):**
- Never use `.map(this.method)` — always use arrow function wrapper
- Wire validation immediately when adding infrastructure (don't leave disconnected)
- No premature stubs — only add what's immediately needed

## System-Wide Impact

### Interaction Graph

- Token CSS change -> Tailwind recompiles utilities -> both apps hot-reload
- Font change in `tokens.css` -> `next/font` needs matching update in `layout.tsx`
- New color added to `@theme` -> automatically creates `bg-*`, `text-*`, `border-*` utilities
- Dark mode toggle (web) -> `.dark` class on `<html>` -> CSS variables switch -> all components re-paint
- Dark mode toggle (mobile) -> NativeWind `setColorScheme()` -> RN Appearance API -> re-render

### Error Propagation

- Missing `@motolearn/design-system` in `transpilePackages` -> Next.js build fails with import error
- NativeWind Metro config missing -> `className` prop has no effect (silent failure — components render unstyled)
- OKLCH color in non-supporting browser -> graceful degradation to nearest sRGB (handled by Tailwind v4)
- Missing `@source "../../packages/"` in globals.css -> Tailwind won't generate utilities for shared package classes (silent failure — classes have no effect)

### State Lifecycle Risks

- Dark mode preference stored client-only (Zustand) — not synced to server `preferences` JSONB
- Font loading on mobile: if `expo-font` fails to load Plus Jakarta Sans, falls back to system font (safe)
- CSS import order matters: `tokens.css` must come before `semantic.css`

### API Surface Parity

- No API changes required — this is purely frontend
- The NestJS API is unaffected

### Integration Test Scenarios

1. Web: Load home page -> verify primary-500 blue renders correctly -> toggle dark mode -> verify surface color inverts
2. Mobile: Launch app -> verify tab bar shows 4 icons with correct tint -> navigate all tabs -> verify brand colors
3. Mobile: Profile -> toggle dark mode -> navigate to Diagnose -> verify dark styling persists
4. Web: Admin dashboard -> verify all 6 stat cards use semantic token colors -> resize to mobile breakpoint
5. Cross-platform: Compare primary button color on web login vs mobile login -> must be identical token value

## Acceptance Criteria

### Functional Requirements

- [ ] `packages/design-system` exists with `tokens.css`, `semantic.css`, and JS exports
- [ ] Both `apps/web` and `apps/mobile` import and consume shared tokens
- [ ] All hardcoded hex color values in `apps/web` are replaced with Tailwind token classes
- [ ] All hardcoded hex color values in `apps/mobile` are replaced with NativeWind classes or token constants
- [ ] Plus Jakarta Sans loaded on web via `next/font`, falls back to Inter/system-ui
- [ ] Mobile tab bar has icons for all 4 tabs (Learn, Diagnose, Garage, Profile)
- [ ] Dark mode toggle works on mobile (three-way: System/Light/Dark)
- [ ] Dark mode CSS structure works on web (`.dark` class toggle)
- [ ] Theme preference persists across mobile app restarts
- [ ] `app.json` `backgroundColor` updated to new brand primary

### Non-Functional Requirements

- [ ] All text/background color combinations meet WCAG 2.1 AA contrast ratios (4.5:1 normal, 3:1 large)
- [ ] Web Lighthouse performance score stays above 90 (no font-loading regressions)
- [ ] `pnpm build` succeeds for all apps with zero errors
- [ ] `pnpm lint` passes with zero violations
- [ ] No runtime errors in Expo dev server or Next.js dev server

### Quality Gates

- [ ] `pnpm dev` starts all three apps without errors
- [ ] Web pages render correctly in Chrome, Safari, Firefox
- [ ] Mobile app renders correctly on iOS simulator and Android emulator
- [ ] Dark mode toggle does not cause layout shifts or flashes
- [ ] No `style={{}}` inline objects remain in web app source
- [ ] No hardcoded hex colors remain in mobile app source
- [ ] `@source` directive present in both web and mobile CSS entry points

## Dependencies & Prerequisites

- **Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/postcss`, `postcss`) — web
- **NativeWind v5** (`nativewind`, `react-native-css`) — mobile
- **expo-symbols** — mobile tab bar icons (SF Symbols on iOS, Material Icons on Android)
- **Plus Jakarta Sans** — Google Fonts, loaded via `next/font/google` on web
- **Geist Mono** — loaded via `geist` package on web
- **geist** — Vercel's font package for Geist Mono

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NativeWind v5 incompatible with Expo 55 + New Architecture | Medium | High | Test in spike branch first; fallback to plain StyleSheet with token constants from `@motolearn/design-system` |
| OKLCH colors not rendering on older Android WebView | Low | Medium | Tailwind v4 handles sRGB fallback automatically |
| Plus Jakarta Sans not available via expo-font | Low | Low | Fallback to Inter or system font — defined in font stack |
| Biome doesn't sort Tailwind classes | High | Low | Accept unsorted classes for now; revisit if Biome adds plugin support |
| Metro config break after NativeWind integration | Medium | High | Keep current Metro config as git backup; test incrementally |
| `@source` directive missing causes silent class failures | Medium | High | Add verification step: grep for `@source` in both CSS entry points during CI |

## Future Considerations

- **Component library**: Once tokens are stable, extract shared components (Button, Card, Badge, Input) into `packages/design-system/src/components/`
- **Animation tokens**: Add `duration.fast` (150ms), `duration.normal` (300ms), easing curves
- **Responsive breakpoints**: Define web breakpoints for admin dashboard mobile support
- **Storybook**: Isolated component development environment for the design system
- **Visual regression tests**: Chromatic or Percy integration to catch unintended visual changes
- **Server-persisted theme**: Sync dark mode preference to `users.preferences` JSONB for cross-device consistency
- **Contrast validation CI**: Automated WCAG contrast ratio checking in CI pipeline

## Sources & References

### Internal References

- `apps/web/src/app/layout.tsx` — current web root layout (inline body style only)
- `apps/web/src/app/page.tsx` — home page with `#007AFF` hardcoded primary
- `apps/mobile/src/app/(tabs)/_layout.tsx` — tab bar with no icons
- `apps/mobile/src/stores/auth.store.ts` — Zustand store (add colorScheme)
- `apps/mobile/app.json` — `userInterfaceStyle: "automatic"`, `backgroundColor: "#1a1a2e"`
- `CLAUDE.md` — project conventions (Biome, expo-symbols, borderCurve)
- `docs/solutions/integration-issues/monorepo-code-review-multi-category-fixes.md` — prevention strategies

### External References

- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme) — `@theme` directive docs
- [Tailwind v4 in Turbo Monorepo](https://medium.com/@philippbtrentmann/setting-up-tailwind-css-v4-in-a-turbo-monorepo-7688f3193039) — `@source` directive
- [NativeWind v5 Installation](https://www.nativewind.dev/v5/getting-started/installation) — Metro config (no `input` param)
- [NativeWind v5 Themes](https://www.nativewind.dev/v5/guides/themes) — `vars()` + `useColorScheme` pattern
- [NativeWind v5 Migration from v4](https://www.nativewind.dev/v5/guides/migrate-from-v4) — breaking changes
- [Next.js 16 Font API](https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/02-components/font.mdx) — `variable` CSS prop pattern
- [Plus Jakarta Sans — Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- [Color Psychology — Blue for Trust](https://www.ignytebrands.com/the-psychology-of-color-in-branding/)
- [WCAG 2.1 AA Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Color Inventory (Current -> New)

| Current | Usage | Replacement Token |
|---------|-------|-------------------|
| `#007AFF` | Web primary buttons | `primary-500` |
| `#1a1a2e` | Mobile primary, Android icon bg | `primary-950` |
| `#e74c3c` | Destructive actions | `danger-500` |
| `#666` | Secondary text | `neutral-500` |
| `#999` | Tertiary text | `neutral-400` |
| `#333` | Body text | `neutral-800` |
| `#ddd` | Input borders | `neutral-300` / `input-border` |
| `#eee` | Dividers, card borders | `neutral-200` / `border` |
| `#f0f0f0` | Inactive backgrounds | `neutral-100` |
| `red` | Error text | `danger-500` |
