---
status: complete
priority: p3
issue_id: "163"
tags: [code-review, database, cleanup]
dependencies: ["155"]
---

# HAVING COUNT >= 1 is redundant in get_make_stats()

## Problem Statement

`supabase/migrations/00127_make_stats_rpc.sql:29` — `HAVING COUNT(DISTINCT m.user_id) >= 1` is always true in a GROUP BY. Remove it.

## Fix

Delete the HAVING clause. Folded into todo #155.
