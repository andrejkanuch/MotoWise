#!/usr/bin/env sh
# i18n ratchet gate. Blocks NEW regressions vs the merge-base; ignores legacy debt.
#
#   A) Hard-coded UI strings: eslint-plugin-i18next/no-literal-string on changed
#      mobile source files only (Biome can't do this; i18next-cli can't see RN <Text>).
#   B) Untranslated new keys: any key newly added to en.json must exist in all locales
#      (scripts/check-i18n-new-keys.ts).
#
# Mirrors scripts/precheck-changed.sh's "changed files since merge-base" philosophy.
# For a full, non-blocking completeness report run: pnpm i18n:status
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
  echo "check-i18n: no merge-base with origin/main or main — skipping i18n ratchet."
  exit 0
fi

# A) Hard-coded strings on changed mobile source files.
CHANGED=$(
  git diff --name-only --diff-filter=AMRC "$BASE...HEAD" -- apps/mobile/src \
    | grep -E '\.(ts|tsx)$' \
    | grep -vE '\.(test|d)\.(ts|tsx)$|/__tests__/|/__mocks__/|/mocks/|/i18n/' \
    | sed 's#^apps/mobile/##' \
    || true
)
if [ -n "$CHANGED" ]; then
  echo "check-i18n: scanning changed mobile files for hard-coded strings..."
  # word-splitting is intentional: one path per line from git diff
  # shellcheck disable=SC2086
  ( cd apps/mobile && npx eslint $CHANGED )
else
  echo "check-i18n: no changed mobile source files — skipping hard-coded-string scan."
fi

# B) New en.json keys must be translated in every locale.
pnpm exec tsx scripts/check-i18n-new-keys.ts "$BASE"
