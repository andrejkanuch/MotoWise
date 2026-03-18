---
name: design-loop
description: Compound Design Loop — multi-persona brainstorm + Impeccable command loop for production-grade UI redesign
argument-hint: "<file-path> [--domain='motorcycle app'] [--team=default] [--max-iterations=10]"
---

# The Compound Design Loop

**Build fast, then refine through specialized lenses.**

A systematic design review workflow that runs all Impeccable design commands through parallel agent teams, each playing a specialist role (UI designer, domain expert, motion designer, accessibility auditor). Uses Ralph Loop for persistence across iterations.

## Principles

1. **Separate building from designing.** The feature should already work before this skill runs. We redesign what exists, not what we're building.
2. **Multi-persona brainstorm before touching code.** 3-4 specialist agents discuss the design simultaneously. One person can't hold all perspectives.
3. **One command = one lens.** Each Impeccable command forces you to look at the SAME code through a completely different filter.
4. **Subtraction before addition.** Always run `/distill` before `/delight`. The highest-impact change is often a deletion.
5. **Critique sandwich.** Critique at start → iterate → critique again to verify.

## Workflow

### Step 0: Activate Ralph Loop (optional)

If `ralph-loop` skill is available, run:
```
/ralph-loop:ralph-loop "finish all Impeccable commands" --max-iterations $MAX_ITERATIONS --completion-promise "ALL_COMMANDS_COMPLETE"
```

### Step 1: Create Progress Tracker

Create a `design-review-progress.md` file next to the target file tracking:
- All 20 Impeccable commands as checkboxes
- Design team members
- Current iteration number
- Fixes applied per iteration

### Step 2: DIAGNOSE (Iteration 1)

Launch **3 parallel agents**:

**Agent 1 — /critique + /audit** (UX/Accessibility Auditor):
> "You are a senior frontend auditor. Read [FILE] and perform a comprehensive audit: WCAG AA contrast, focus states, ARIA labels, performance (GPU-composited animations), CSS variable consistency, responsive behavior, browser compatibility. Also critique the UX: visual hierarchy, information density, touch targets, state transitions clarity. For each issue: severity, exact selector, specific fix code."

**Agent 2 — Domain Expert** (customized per `--domain`):
> "You are a [DOMAIN] expert with 15 years experience. Read [FILE] and evaluate from a REAL USER's perspective: [domain-specific criteria]. Be BRUTALLY honest. Provide specific design recommendations for each issue."

**Agent 3 — Lead Designer** (visual quality):
> "You are a lead product designer at a premium app studio. Read [FILE] and evaluate: visual sophistication, typography system, color usage, spatial rhythm, surface treatment, iconography quality, state differentiation, design system coherence. Provide specific CSS changes for your top 5 recommendations."

**→ Synthesize:** Read all agent outputs. Identify consensus issues (flagged by 2+ agents). Prioritize by impact (safety > accessibility > visual > polish). Apply critical fixes. Update progress tracker.

### Step 3: SYSTEMATIZE (Iteration 2)

Launch **4 parallel agents**:

**Agent 4 — /normalize:**
> "Ensure the design strictly follows the design system. Check: CSS variable consistency (find ALL hardcoded values), spacing grid alignment (4px base), border radius tokens, color system, font weight validity. Output a structured report."

**Agent 5 — /typeset:**
> "Fix all typography issues. Check: modular type scale consistency, line-heights, letter-spacing, font weight distribution, readability at size, monospace vs sans-serif consistency, orphans/widows. Output specific CSS changes."

**Agent 6 — /arrange:**
> "Fix layout and spacing. Check: vertical rhythm, horizontal alignment, content grouping (Gestalt proximity), overflow at viewport width, bottom safe area clearance, section ordering logic. Apply the TOP 10 most impactful spacing fixes."

**Agent 7 — /clarify:**
> "Improve all UX copy. Review EVERY piece of text: labels (clear and unambiguous?), button text (action-oriented?), status indicators, abbreviation consistency, voice/tone appropriateness. For each: current text, recommended text, why."

**→ Synthesize & apply.** Update progress.

### Step 4: ENHANCE + HARDEN (Iteration 3)

Launch **5 parallel agents**:

**Agent 8 — /animate:**
> "Identify opportunities for purposeful micro-interactions. State transitions, value changes, route progress, button interactions. All animations MUST be GPU-composited (transform/opacity only). Provide exact CSS. Only add motion that serves a purpose."

**Agent 9 — /delight** (may edit file directly):
> "Find moments where small touches of personality make the interface memorable. Celebration moments, satisfying transitions, ambient details. Keep suggestions to 5-7 max. Provide exact CSS/JS code."

**Agent 10 — /distill:**
> "Strip to ESSENCE. Identify: elements to remove entirely, visual complexity to simplify, redundant information, decorative elements that don't serve the user. Be ruthless. Output prioritized list of 8-10 simplifications."

**Agent 11 — /harden** (may edit file directly):
> "Make the interface RESILIENT. Edge cases, error states, safety, text overflow, responsive breakpoints. Provide exact HTML/CSS/JS for the top 5 most critical fixes."

**Agent 12 — /colorize:**
> "Evaluate color usage: semantic consistency, state conflicts (e.g., warning color used for both pause and alerts), colorblind safety, sunlight readability. Provide specific color adjustments as CSS variable overrides. Max 6 changes."

**→ Synthesize & apply.** Update progress.

### Step 5: POLISH + SHIP (Iteration 4)

Launch **5-6 parallel agents**:

**Agent 13 — /adapt:**
> "Ensure it works across devices. Check: narrow screens (360px), wide screens (430px), safe areas (env()), landscape handling, force dark mode. Output CSS media queries to add."

**Agent 14 — /onboard:**
> "Evaluate first-time user experience. Empty states, label clarity, feature discoverability, self-explanatory UI. Provide 3-5 minimal copy/UI tweaks."

**Agent 15 — /optimize:**
> "Optimize performance. Font loading (trim unused weights), CSS efficiency (transition: all → specific), animation compositing, unused CSS removal, SVG simplification. Prioritized list of 5-8 optimizations."

**Agent 16 — /polish:**
> "FINAL quality pass. Pixel-level alignment, visual consistency, spacing precision, animation timing consistency, :active states on all buttons, shadow depth logic, optical centering. The last 5%."

**Agent 17 — /extract:**
> "Catalog reusable design system tokens: color tokens, type scale, spacing grid, component patterns (anatomy + variants), animation tokens (easings + durations), surface system tiers. Output as structured specification."

**Agent 18 — /bolder + /overdrive:**
> "Look for areas that are TOO safe. Amplify 3-5 targeted elements. Then propose ONE technically impressive effect (CSS/SVG/JS) that serves the context. Provide exact code."

**→ Apply final fixes.** Update progress. Open in browser to verify.

### Step 6: Completion

If using Ralph Loop, output: `<promise>ALL_COMMANDS_COMPLETE</promise>`

Otherwise, output a final summary:
- Commands completed (19/19)
- Design team sign-off status
- Total fixes applied
- Key improvements by category

## Agent Prompt Template

Every agent gets this structure:
1. **Role**: "You are running the /X command from the Impeccable design toolkit on [FILE]"
2. **Context**: What the design is, who uses it, what matters
3. **Checklist**: 5-10 numbered evaluation criteria specific to that command
4. **Output format**: "Do NOT edit the file, just output findings" (default) OR "You may edit the file directly" (for /harden, /delight, /arrange only)
5. **Constraint**: Stay within the command's domain

## Domain Expert Presets

The `--domain` flag customizes Agent 2's persona:

- `motorcycle`: Rider with 15 years experience, used Calimoto/RISER/Ducati Link. Evaluates glanceability, glove operation, sunlight readability, vibration, safety.
- `fitness`: Runner/cyclist who uses Strava/Nike Run Club daily. Evaluates mid-workout readability, GPS accuracy indicators, split/pace clarity.
- `finance`: Day trader using Bloomberg/Robinhood. Evaluates data density, real-time update clarity, color-coded P&L, error-state urgency.
- `medical`: ER nurse using Epic/Cerner. Evaluates critical alert hierarchy, medication safety, patient ID prominence, handoff clarity.
- `default`: Power user of the app's domain. Evaluates real-world usage, edge cases, competitor comparison.

## Key Decision: Research vs. Edit Agents

Most agents are **research-only** (output findings that you synthesize). This prevents conflicting edits. Only these agents may edit directly:
- `/harden` — adds new safety features (HTML/JS)
- `/delight` — adds celebration animations (JS)
- `/arrange` — restructures layout (CSS)

All others output recommendations that you apply manually after synthesis.

Start with Step 1 now.
