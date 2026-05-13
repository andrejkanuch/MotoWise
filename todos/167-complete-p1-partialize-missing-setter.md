---
status: complete
priority: p1
issue_id: "167"
tags: [code-review, mobile, bug, zustand]
dependencies: []
---

# setAcceptedOemScheduleIds missing from partialize destructure

## Problem Statement
`stores/onboarding.store.ts:114-132` — Every setter is destructured out of `partialize` to exclude functions from persistence, except `setAcceptedOemScheduleIds`. The function leaks into `...data` and gets serialized to AsyncStorage.

## Fix
Add `setAcceptedOemScheduleIds` to the destructure list in `partialize`.
