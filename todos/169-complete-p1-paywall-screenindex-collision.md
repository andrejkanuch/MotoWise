---
status: complete
priority: p1
issue_id: "169"
tags: [code-review, mobile, bug]
dependencies: []
---

# paywall uses screenIndex={4} same as maintenance (should be 5)

## Problem Statement
`app/(onboarding)/paywall.tsx:72` — Both maintenance and paywall use `screenIndex={4}`. Paywall should be 5 per ONBOARDING_SCREENS config.

## Fix
Change paywall to `screenIndex={5}`.
