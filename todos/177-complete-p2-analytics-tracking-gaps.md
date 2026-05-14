---
status: complete
priority: p2
issue_id: "177"
tags: [code-review, mobile, analytics]
dependencies: ["170"]
---

# Analytics tracking gaps — bike-setup and maintenance missing STEP_VIEWED

## Problem Statement
bike-setup.tsx and maintenance.tsx have no ONBOARDING_STEP_VIEWED event on mount. experience.tsx uses SCREEN_VIEWED instead of ONBOARDING_STEP_VIEWED. PostHog funnel has gaps.

## Fix
Add useEffect on mount in bike-setup and maintenance to fire ONBOARDING_STEP_VIEWED with step name. Change experience.tsx to use ONBOARDING_STEP_VIEWED for consistency.
