---
status: pending
priority: p2
issue_id: "136"
tags: [code-review, design-system, mobile]
dependencies: []
---

# Heatmap screen uses hardcoded rgba values

## Problem Statement

`apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx:261` uses `rgba(0,0,0,0.55)` for a scrim, and line 358 uses `rgba(45,158,120,0.10)` which is literally `palette.accent500` at 10% alpha. Violates the repo rule: "no hardcoded hex/rgba — use palette tokens from `@motovault/design-system`." Once in the tree, these values drift from the design system any time tokens are updated.

## Findings

- **Project Standards Reviewer:** two rgba literals in one screen contradict design-system rule in CLAUDE.md.
- **Pattern Recognition Specialist:** literal alpha calc duplicates existing accent token.

## Proposed Solutions

### Option A: Add palette.scrim + alpha helper (Recommended)

```ts
// packages/design-system/src/palette.ts
export const palette = {
  ...existing,
  scrim: 'rgba(0,0,0,0.55)',
};
// usage: backgroundColor: palette.scrim
// usage: backgroundColor: `${palette.accent500}1A` // 10% alpha
```

Add a Biome lint rule or a pre-push grep guard forbidding `rgba(` / `#[0-9a-fA-F]{6}` under `apps/mobile/src`:

```bash
if rg -n 'rgba\(|#[0-9a-fA-F]{6}' apps/mobile/src --type tsx; then
  echo "Hardcoded color detected" && exit 1
fi
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Token-based alpha via `color-mix` shim

Build a `withAlpha(token, 0.1)` helper that returns a palette-backed string. Safer against hex drift but adds runtime work.

## Recommended Action

Option A. Option B later if more alpha variants appear.

## Technical Details

- **Affected files:** `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx`, `packages/design-system/src/palette.ts`, `.githooks/pre-push` or CI script

## Acceptance Criteria

- [ ] No `rgba(` or `#hex` literals under `apps/mobile/src`
- [ ] Scrim color sourced from `palette.scrim`
- [ ] Pre-push/CI guard blocks future regressions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | project-standards-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
