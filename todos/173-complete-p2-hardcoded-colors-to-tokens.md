---
status: complete
priority: p2
issue_id: "173"
tags: [code-review, mobile, design-system]
dependencies: []
---

# ~100+ hardcoded hex/rgba colors violating design system rule

## Problem Statement
All v2 screens and components use inline hex values instead of palette tokens. Recurring: #1a1812, #2a2520, #4eba6f, #C4634A, #fff, rgba(255,255,255,...). CLAUDE.md: "All colors must come from palette."

## Fix
1. Extend ONBOARDING_COLORS with tokens for recurring values (surfaceDark, borderDark, acceptGreen, rejectRed, textOnWarm, etc.)
2. Replace all hardcoded hex/rgba in v2 screens and components with ONBOARDING_COLORS or palette tokens
3. Move brand-specific colors in brand-dna.ts to reference palette where possible
