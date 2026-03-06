---
status: pending
priority: p2
issue_id: "031"
tags: [code-review, architecture]
dependencies: []
---

# Mobile App Missing Tab Navigator — No Way to Switch Between Sections

## Problem Statement

CLAUDE.md documents "NativeTabs with 4 tabs: (learn), (diagnose), (garage), (profile)" but the root layout uses a plain `<Stack>`. The four tab groups exist as route groups but have no tab bar connecting them. Users have no navigation mechanism to switch between tabs.

## Findings

- **Source:** Architecture Strategist (P2-3)
- **File:** `apps/mobile/src/app/_layout.tsx`
- No `<Tabs>` component from expo-router used anywhere

## Proposed Solutions

### Option A: Add (tabs)/_layout.tsx with Tabs Component
Create a tabs layout wrapping the four route groups.
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Tab bar visible with 4 tabs (Learn, Diagnose, Garage, Profile)
- [ ] Users can navigate between tabs
- [ ] Each tab maintains its own stack navigation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-06 | Created from code review | |
