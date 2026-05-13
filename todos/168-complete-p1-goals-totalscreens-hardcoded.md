---
status: complete
priority: p1
issue_id: "168"
tags: [code-review, mobile, bug]
dependencies: []
---

# goals.tsx hardcodes totalScreens={7} instead of TOTAL_SCREENS (8)

## Problem Statement
`app/(onboarding)/goals.tsx:125` — Uses `totalScreens={7}` while all other screens use `TOTAL_SCREENS` constant (8). Progress bar shows wrong segment count.

## Fix
Replace `totalScreens={7}` with `totalScreens={TOTAL_SCREENS}`.
