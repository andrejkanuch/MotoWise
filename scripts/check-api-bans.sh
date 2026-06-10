#!/usr/bin/env sh
# API hygiene gate (Phase 5 consolidation). Bans the raw Postgres error-code
# literals that the shared PG_ERROR constants replaced, so they don't creep
# back in:
#
#   'PGRST116' → PG_ERROR.NOT_FOUND
#   '23505'    → PG_ERROR.UNIQUE_VIOLATION
#
# Both live in apps/api/src/common/supabase/unwrap.ts, which is the single
# allowed home for the literals. Test specs are also exempt (they construct
# fixture errors with explicit codes).
#
# NOTE: a `select('*')` ban was considered but skipped — apps/api has ~37
# pre-existing usages, so a meaningful guard would need a ratchet (baseline
# count) rather than a hardcoded allowlist. Left for a follow-up to avoid
# inventing fragile infrastructure here.
#
# Full-repo, non-incremental — runs in `pnpm precheck` and CI.
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

API_SRC="apps/api/src"

RAW_CODES=$(grep -rnE "'(PGRST116|23505)'" "$API_SRC" \
  --include='*.ts' \
  | grep -v '/common/supabase/unwrap.ts:' \
  | grep -v '\.spec\.ts:' || true)

if [ -n "$RAW_CODES" ]; then
  echo "check-api-bans: raw Postgres error-code literals found — use PG_ERROR.* instead:"
  echo "$RAW_CODES"
  exit 1
fi

echo "check-api-bans: OK (no raw PGRST116/23505 literals outside unwrap.ts)."
