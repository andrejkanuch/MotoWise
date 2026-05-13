---
status: complete
priority: p1
issue_id: "170"
tags: [code-review, mobile, bug, analytics]
dependencies: []
---

# notifications.tsx fires ONBOARDING_STEP_COMPLETED on mount instead of STEP_VIEWED

## Problem Statement
`app/(onboarding)/notifications.tsx:163-169` — Every other screen fires `ONBOARDING_STEP_VIEWED` on mount and `STEP_COMPLETED` on action. This fires COMPLETED on mount, inflating PostHog funnel.

## Fix
Change the mount event from `ONBOARDING_STEP_COMPLETED` to `ONBOARDING_STEP_VIEWED`.
