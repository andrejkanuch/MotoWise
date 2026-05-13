---
status: complete
priority: p2
issue_id: "172"
tags: [code-review, mobile, performance, zustand]
dependencies: ["167"]
---

# Migrate onboarding store from AsyncStorage to MMKV

## Problem Statement
`stores/onboarding.store.ts:14,113` — Uses AsyncStorage (async, slow) while checklist.store already uses MMKV (sync, 10-30x faster). Inconsistent and slower startup rehydration.

## Fix
Replace AsyncStorage import with MMKV using `createMMKV({ id: 'onboarding-store' })` pattern from checklist.store.ts. Bump store version to trigger re-init.
