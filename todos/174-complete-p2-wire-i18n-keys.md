---
status: complete
priority: p2
issue_id: "174"
tags: [code-review, mobile, i18n]
dependencies: []
---

# ~50+ hardcoded English strings not wired to i18n

## Problem Statement
bike-setup, maintenance, brand-hero, make-grid, model-picker, task-card have hardcoded English strings. The i18n keys already exist in locale JSON files but aren't referenced from code. All 14 locales show English-only on these screens.

## Fix
Wire existing i18n keys using t() calls. Add missing keys to en.json and all locale files for strings that don't have keys yet. Affected screens: bike-setup.tsx, maintenance.tsx. Affected components: brand-hero.tsx, make-grid.tsx, model-picker.tsx, year-input.tsx, task-card.tsx.
