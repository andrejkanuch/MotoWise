---
status: pending
priority: p2
issue_id: "122"
tags: [code-review, typescript, nestjs]
dependencies: []
---

# Hand-rolled DB row types duplicate database.types.ts

## Problem Statement

`apps/api/src/modules/trip-assistant/trip-assistant.service.ts:23-56` and `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts:28-51` hand-type `TripRow`, `WaypointRow`, `BikeRow`, `SuggestionRow` and then cast Supabase responses with `as unknown as TripRow` (4 occurrences). Repo rule: `packages/types/src/database.types.ts` is the single source of truth for DB shapes. A column rename will not trip typecheck — it surfaces as a runtime `undefined`.

## Findings

- **Kieran TypeScript Reviewer:** `as unknown as TripRow` defeats the type system in 4 spots.
- **Architecture Strategist:** violates "DB row shapes — use ONLY in NestJS services, sourced from database.types.ts" convention.

## Proposed Solutions

### Option A: Derive from Database type, drop casts (Recommended)

```ts
import type { Database } from '@motovault/types';
type TripRow = Database['public']['Tables']['trips']['Row'];
type WaypointRow = Database['public']['Tables']['trip_waypoints']['Row'];
type BikeRow = Database['public']['Tables']['motorcycles']['Row'];
type SuggestionRow = Database['public']['Tables']['trip_suggestions']['Row'];

type TripWithAuthor = TripRow & {
  users: Pick<Database['public']['Tables']['users']['Row'], 'display_name' | 'username'> | null;
};
```

Replace `as unknown as TripRow` with `satisfies TripRow` at the Supabase call site, or use the typed Supabase client that already infers rows.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Typed Supabase client wrapper per module

Centralise `createClient<Database>()` so every query is inferred; eliminates casts entirely.

## Recommended Action

Option A now, migrate towards Option B in a separate sweep.

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-assistant/trip-assistant.service.ts`, `apps/api/src/modules/trip-suggestions/trip-suggestions.service.ts`

## Acceptance Criteria

- [ ] No `as unknown as` casts in either service
- [ ] Row types imported from `@motovault/types`
- [ ] `pnpm typecheck` passes after a column rename dry-run (flip a column name in types, confirm typecheck fails)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
