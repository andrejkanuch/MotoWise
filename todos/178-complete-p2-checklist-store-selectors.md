---
status: complete
priority: p2
issue_id: "178"
tags: [code-review, mobile, performance, zustand]
dependencies: []
---

# OnboardingChecklist subscribes to entire store

## Problem Statement
`onboarding-checklist.tsx:31` — Destructures all fields from useChecklistStore() causing re-renders on any store change.

## Fix
Use individual selectors or useShallow from zustand/react/shallow.
