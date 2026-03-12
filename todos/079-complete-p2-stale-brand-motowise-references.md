---
status: pending
priority: p2
issue_id: "079"
tags: [code-review, rebrand, api, mobile]
dependencies: []
---

## Problem Statement

Several "MotoWise" references were missed in the rebrand:
1. `PremiumGuard` throws `'MotoWise Pro subscription required'` — should be "MotoVault Pro"
2. `upgrade.tsx` links to `https://motowise.app/terms` and `https://motowise.app/privacy` — should be `motovault.app`

## Proposed Solutions

Fix both references. Run a global search for remaining "motowise" and "motolearn" strings.
- Effort: Small | Risk: Low

## Acceptance Criteria

- [ ] No user-facing "MotoWise" or "MotoLearn" strings remain
- [ ] URLs updated to motovault.app domain
- [ ] `grep -ri "motowise\|motolearn" apps/ packages/ --include="*.ts" --include="*.tsx"` returns only the RevenueCat entitlement constant (which is immutable)
