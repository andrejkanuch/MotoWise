---
status: complete
priority: p3
issue_id: "165"
tags: [code-review, types, api]
dependencies: []
---

# OemSchedule priority field typed as string instead of enum

## Problem Statement

`apps/api/src/modules/oem-schedules/models/oem-schedule.model.ts:34` — GraphQL field declares `@Field(() => GqlMaintenancePriority)` but the TS property is typed as `string`. A typo in seed data (e.g., "High" vs "high") would pass without error.

## Fix

Type the property as `GqlMaintenancePriority` and validate the cast in `mapRow`.
