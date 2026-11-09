#!/usr/bin/env sh
#
# Guard: ban NEW raw spacing numbers in apps/mobile/src.
#
# Every padding, margin and gap comes from apps/mobile/src/theme/spacing.ts:
# `layout.*` for page-level spacing (gutters, section gaps), `space.*` for the
# 4pt grid inside a component. Merge-base ratchet, like check:mobile-colors:
# only ADDED lines fail; legacy numbers elsewhere are ignored and migrate when a
# file is touched.
#
# "Added" means everything on top of the merge-base with main: commits, staged
# and unstaged edits, and new untracked files, so a local `verify:mobile` sees
# the same thing CI will. Renames are paired (-M), so moving a file does not
# make its legacy numbers look new.
#
# Flagged:  padding: 12 · marginTop: -8 · gap: 6 · rowGap: 4 · padding: 0.5
#           paddingBottom: insets.bottom + 100 · padding: isWide ? 24 : 16
#           gap: space.md + 2 · paddingBottom: Math.max(insets.bottom, 16)
#           margin: '12%'
# Allowed:  0 (a reset, not a spacing choice), tokens, and tokens combined
#           with insets (paddingTop: insets.top + space.sm). A literal used as
#           a multiplier or divisor (space.md * 2) is a grid multiple, not a
#           new value.
# Exempt:   src/theme/ (the token home), tests and mocks.
# Known gap: a file moved with plain `mv` (not `git mv`) and not yet staged is
# untracked, so all of its lines count as added.
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

SCOPE='apps/mobile/src'
# 1) a spacing prop set straight to a non-zero literal (0.5 counts; 0 is a reset);
# 2) a spacing prop whose expression adds, subtracts or picks (ternary) a
#    non-zero literal — the `insets.bottom + 100` shape;
# 3) a non-zero literal as an argument of Math.max/min — the safe-area
#    `Math.max(insets.bottom, 16)` shape;
# 4) a percentage or numeric string.
PROP='(padding|margin)(Horizontal|Vertical|Top|Bottom|Left|Right|Start|End|Block|Inline)?|gap|rowGap|columnGap'
NUM='([1-9][0-9.]*|0\.[0-9]*[1-9][0-9]*)'
END='([^0-9A-Za-z.]|$)'
SPACING_RE="(^|[^A-Za-z])($PROP): *-?$NUM$END|(^|[^A-Za-z])($PROP): *[^,}]*[-+?:] *$NUM$END|(^|[^A-Za-z])($PROP): *Math\.(max|min)\([^)]*[(,] *$NUM$END|(^|[^A-Za-z])($PROP): *['\"\`]-?$NUM"
# Files the ratchet reads: mobile TS/TSX, minus tests, mocks and the token home.
# Passed to awk through ENVIRON, not -v: -v processes escapes, turning `\.` into
# "any character" (so `card.tsx` matched the `d.tsx` declaration-file skip).
FILE_RE='^apps/mobile/src/.*\.(ts|tsx)$'
SKIP_RE='\.(test|d)\.(ts|tsx)$|/__tests__/|/__mocks__/|/mocks/|^apps/mobile/src/theme/'

BASE=""
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || true)
fi
if [ -z "$BASE" ] && git rev-parse --verify main >/dev/null 2>&1; then
  BASE=$(git merge-base HEAD main 2>/dev/null || true)
fi
if [ -z "$BASE" ]; then
  echo "ERROR: no merge-base with origin/main or main — cannot run the spacing ratchet."
  echo "       Fetch the base branch first (e.g. \`git fetch origin main\`)."
  exit 1
fi

# "<file>\t<added line>" for every added line: tracked changes against the
# merge-base (working tree included), then every line of untracked files.
# Each step writes a file rather than feeding a pipeline, so `set -e` sees a
# failure: a pipeline would only report its last command and the guard would
# go green on a diff it never read.
# - core.quotePath=false keeps non-ASCII paths unquoted.
# - The prefixes are pinned, so a developer's diff.mnemonicPrefix or
#   diff.noprefix cannot change the header.
# - The `+++ b/` header is stripped as a whole (a path may contain spaces),
#   with git's trailing tab. Any other header shape fails loudly.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git -c core.quotePath=false diff --src-prefix=a/ --dst-prefix=b/ -M -U0 --no-color \
  "$BASE" -- "$SCOPE" > "$WORK/tracked.diff"

if ! awk '
  /^\+\+\+ / {
    file = $0
    if (file == "+++ /dev/null") { file = ""; next }
    if (file !~ /^\+\+\+ b\//) { print "unreadable diff header: " file > "/dev/stderr"; exit 2 }
    sub(/^\+\+\+ b\//, "", file)
    sub(/\t$/, "", file)
    next
  }
  /^\+/ { if (file != "") print file "\t" substr($0, 2) }
' "$WORK/tracked.diff" > "$WORK/added.tsv"; then
  echo "ERROR: could not read the diff against $BASE — the spacing ratchet did not run."
  exit 1
fi

git -c core.quotePath=false ls-files --others --exclude-standard -z -- "$SCOPE" > "$WORK/untracked"
tr '\0' '\n' < "$WORK/untracked" | while IFS= read -r f; do
  awk -v file="$f" '{ print file "\t" $0 }' "$f"
done >> "$WORK/added.tsv"

offenders="$(
  KEEP="$FILE_RE" SKIP="$SKIP_RE" awk -F '\t' '$1 ~ ENVIRON["KEEP"] && $1 !~ ENVIRON["SKIP"]' \
    "$WORK/added.tsv" \
    | grep -E "$SPACING_RE" \
    || true
)"

if [ -n "$offenders" ]; then
  echo "ERROR: new raw spacing numbers in mobile files."
  echo "       Use layout.* or space.* from apps/mobile/src/theme/spacing.ts."
  printf '%s\n' "$offenders"
  exit 1
fi

echo "OK: no new hardcoded spacing in mobile files (vs $BASE)."
exit 0
