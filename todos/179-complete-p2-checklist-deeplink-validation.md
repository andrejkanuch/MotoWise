---
status: complete
priority: p2
issue_id: "179"
tags: [code-review, mobile, security]
dependencies: []
---

# Checklist deep link injection via persisted store

## Problem Statement
`onboarding-checklist.tsx:116` — `router.push(item.deepLink as never)` trusts persisted MMKV strings without validation.

## Fix
Resolve deep links at render time from ALL_CHECKLIST_ITEMS constant using item.id, rather than trusting persisted deepLink strings.
