#!/usr/bin/env sh
# Pre-push: Biome only on files changed since merge-base with main (fast local feedback).
# CI and `pnpm precheck` still run full `pnpm lint` on the repo.

set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BASE=""
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || true)
fi
if [ -z "$BASE" ] && git rev-parse --verify main >/dev/null 2>&1; then
  BASE=$(git merge-base HEAD main 2>/dev/null || true)
fi

if [ -z "$BASE" ]; then
  echo "precheck-changed: no merge-base with origin/main or main — running full Biome check"
  pnpm exec biome check . || exit 1
else
  FILES=$(git diff --name-only --diff-filter=AMRC "$BASE...HEAD" | grep -E '\.(ts|tsx|js|jsx|json|css)$' || true)
  if [ -z "$FILES" ]; then
    echo "precheck-changed: no matching source files changed vs $BASE — skipping Biome"
  else
    echo "precheck-changed: biome check on files changed since merge-base $BASE"
    # word-splitting is intentional: one path per word from git diff
    # shellcheck disable=SC2086
    pnpm exec biome check $FILES || exit 1
  fi
fi

pnpm typecheck && pnpm test && pnpm check:i18n
