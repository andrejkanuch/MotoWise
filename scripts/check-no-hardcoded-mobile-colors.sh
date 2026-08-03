#!/usr/bin/env sh
#
# Guard: ban NEW raw hex / rgba() colors in apps/mobile/src.
#
# Two layers:
#   A) Foundation files must stay fully tokenized (zero hex/rgba literals).
#   B) Merge-base ratchet: fail only if ADDED lines in changed mobile files
#      introduce new #[hex] or rgba( — legacy debt elsewhere is ignored.
#
# Allowlisted (OEM / third-party color maps that are intentionally raw):
#   apps/mobile/src/config/brand-dna.ts  (MAKE_COLORS OEM brand hexes)
#
# Design-system package is out of scope (canonical token home).
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

COLOR_RE='#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\('
FOUNDATION_FILES="
apps/mobile/src/components/diagnostic-flow/diagnostic-colors.ts
apps/mobile/src/components/onboarding/onboarding-colors.ts
"

# ── A) Foundation must stay clean ──────────────────────────────────────────
foundation_offenders=""
for f in $FOUNDATION_FILES; do
  if [ ! -f "$f" ]; then
    echo "ERROR: foundation file missing: $f"
    exit 1
  fi
  hits="$(grep -nE "$COLOR_RE" "$f" || true)"
  if [ -n "$hits" ]; then
    foundation_offenders="${foundation_offenders}${f}:\n${hits}\n"
  fi
done

if [ -n "$foundation_offenders" ]; then
  echo "ERROR: foundation color modules must use @motovault/design-system palette only (no raw hex/rgba)."
  printf "%b" "$foundation_offenders"
  exit 1
fi
echo "OK: foundation color modules are tokenized."

# ── B) Ratchet vs merge-base (new hex/rgba in changed files) ───────────────
BASE=""
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || true)
fi
if [ -z "$BASE" ] && git rev-parse --verify main >/dev/null 2>&1; then
  BASE=$(git merge-base HEAD main 2>/dev/null || true)
fi

if [ -z "$BASE" ]; then
  echo "ERROR: no merge-base with origin/main or main — cannot run the color ratchet."
  echo "       Fetch the base branch first (e.g. \`git fetch origin main\`);"
  echo "       CI must not silently skip this gate on a shallow checkout."
  exit 1
fi

# Paths relative to repo root; exclude allowlisted + foundation (already checked).
CHANGED=$(
  git diff --name-only --diff-filter=AMRC "$BASE...HEAD" -- apps/mobile/src \
    | grep -E '\.(ts|tsx|js|jsx|json|css)$' \
    | grep -vE '\.(test|d)\.(ts|tsx|js|jsx)$|/__tests__/|/__mocks__/|/mocks/' \
    | grep -vE '^apps/mobile/src/config/brand-dna\.ts$' \
    | grep -vE '^apps/mobile/src/components/diagnostic-flow/diagnostic-colors\.ts$' \
    | grep -vE '^apps/mobile/src/components/onboarding/onboarding-colors\.ts$' \
    || true
)

if [ -z "$CHANGED" ]; then
  echo "OK: no changed mobile source files to ratchet (vs $BASE)."
  exit 0
fi

ratchet_offenders=""
# shellcheck disable=SC2086
for f in $CHANGED; do
  # Added lines only (+…), skip +++ file headers
  added="$(git diff -U0 "$BASE...HEAD" -- "$f" | grep -E '^\+[^+]' || true)"
  if [ -z "$added" ]; then
    continue
  fi
  hits="$(printf '%s\n' "$added" | grep -nE "$COLOR_RE" || true)"
  if [ -n "$hits" ]; then
    ratchet_offenders="${ratchet_offenders}${f}:\n${hits}\n"
  fi
done

if [ -n "$ratchet_offenders" ]; then
  echo "ERROR: new raw hex/rgba colors in changed mobile files (use @motovault/design-system palette)."
  printf "%b" "$ratchet_offenders"
  exit 1
fi

echo "OK: no new hardcoded colors in changed mobile files (vs $BASE)."
exit 0
