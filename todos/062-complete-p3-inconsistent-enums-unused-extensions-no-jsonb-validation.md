---
status: complete
priority: p3
issue_id: "062"
tags: [code-review, database, pattern-consistency]
---

# Inconsistent enum strategy, unused extensions, no JSONB validation

## Problem Statement

Several minor database hygiene issues:

1. **Enum inconsistency:** `content_type` and `status` in content_generation_log use CHECK constraints (typed as bare `string` in database.types.ts), while all other categorical columns use PG enums (typed as union literals). `mileage_unit` also uses CHECK instead of enum.

2. **Unused extensions:** `uuid-ossp` (all tables use `gen_random_uuid()` instead) and `pg_trgm` (no trigram indexes exist) are loaded but unused.

3. **No JSONB validation:** Safety-critical `content_json` on articles has no `CHECK (jsonb_typeof(content_json) = 'object')`. Direct SQL inserts (seed, admin) bypass Zod validation.

4. **Table naming:** `content_generation_log` is singular; all other tables are plural.

5. **Seed data:** Uses `gen_random_uuid()` for article IDs — non-repeatable across `db:reset`.

## Proposed Solutions

- Document CHECK-vs-enum decision in schema-design.md
- Remove `uuid-ossp` if unneeded, or document `pg_trgm` planned usage
- Add minimal JSONB CHECK constraints on articles and quizzes
- Use fixed UUIDs in seed.sql

## Effort
Small — individual fixes
