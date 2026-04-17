---
status: pending
priority: p3
issue_id: "140"
tags: [code-review, security, authz, scope]
dependencies: ["119"]
---

# Trip assistant available to any authenticated user on published trips

## Problem Statement

`loadTripContext` relies solely on RLS visibility. Since published/active/completed trips are world-readable to authenticated users, any logged-in stranger can call `askTripAssistant(tripId)` to summarise, translate, or scrape any published trip. This widens the prompt-injection blast radius tracked in #119 — untrusted waypoint notes get fed into the LLM for callers with no business reading the trip.

## Findings

- **Security Sentinel:** `apps/api/src/modules/trip-assistant/trip-assistant.service.ts:127-135` — no explicit participants/organiser check
- Couples directly to #119 (prompt-injection via waypoint notes)

## Proposed Solutions

### Option A: Gate AI access to organiser + participants (Recommended)
Add an explicit participant lookup at the top of `loadTripContext`; throw `ForbiddenException` otherwise. Public discoverability of a trip does not imply AI assistance on it.
- Effort: Small

### Option B: Allow public trips but strip waypoint notes
Keep the broader audience but drop user-authored text fields from the prompt for non-participants; use a stricter sanitiser on what remains.
- Effort: Small

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-assistant/trip-assistant.service.ts`

## Acceptance Criteria

- [ ] Non-participants get Forbidden (or a stripped prompt under Option B) when calling `askTripAssistant`
- [ ] Organiser + participants unaffected
- [ ] Integration test covers a stranger on a published trip

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | security-sentinel |
