---
status: complete
priority: p2
issue_id: "159"
tags: [code-review, database, data-integrity]
dependencies: ["151"]
---

# year_to never populated in OEM seed data — filter clause is dead code

## Problem Statement

The service queries `.or('year_to.is.null,year_to.gte.${year}')` for year-range filtering, but no seed data row ever sets `year_to`. Discontinued models (e.g., BMW R 1200 GS ended 2018, F 800 GS ended 2018) still match all years.

## Findings

- **Architecture Strategist:** `oem-schedules.service.ts:29` + migration INSERT data — `year_to` is always NULL despite comments noting model end years

## Proposed Solutions

### Option A: Add year_to values for discontinued models
Update INSERT statements (in migration fix for #151) to include `year_to` for: R 1200 GS (2018), F 800 GS (2018), F 800 R (2019), C 600 (2015), and similar.
- Effort: Low
- Risk: None

## Acceptance Criteria

- [ ] Discontinued models have `year_to` set in seed data
- [ ] A 2025 query for R 1200 GS does not match 2004+ schedules
