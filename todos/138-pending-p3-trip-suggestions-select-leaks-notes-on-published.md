---
status: pending
priority: p3
issue_id: "138"
tags: [code-review, security, rls, privacy]
dependencies: []
---

# Trip suggestions SELECT leaks notes on published/active/completed trips

## Problem Statement

The SELECT RLS policy on `trip_suggestions` lets ANY authenticated user read suggestions (including up to 2000-char notes) for any trip whose status is `published`, `active`, or `completed`. Organisers often treat suggestions as semi-private planning ("skip town X"). This is a privacy leak, not a security breach.

## Findings

- **Security Sentinel:** `supabase/migrations/00106_trip_suggestions.sql:88-103` — SELECT policy has a status-based branch that bypasses participants-only gating
- Notes field is up to 2000 chars and rendered verbatim in the UI

## Proposed Solutions

### Option A: Drop the status-based branch (Recommended)
Restrict SELECT to organiser + participants regardless of trip status. Suggestions are co-planning artefacts; public trip visibility should not imply suggestion visibility.
- Effort: Small

### Option B: Add a `visibility` column
`visibility text check (visibility in ('participants','public')) default 'participants'` and gate SELECT on it. More flexible but more surface area.
- Effort: Medium

## Technical Details

- **Affected files:** `supabase/migrations/00106_trip_suggestions.sql`, new migration to replace the SELECT policy

## Acceptance Criteria

- [ ] Non-participants cannot read `trip_suggestions` rows for published/active/completed trips
- [ ] Organiser + participants can still read all suggestions on their trips
- [ ] Existing tests updated; add a negative test for a stranger on a published trip

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | security-sentinel |
