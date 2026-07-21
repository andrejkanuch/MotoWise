#!/usr/bin/env bash
#
# Guard: ban `as any` / `as never` casts on Expo Router navigation calls.
#
# app.config.ts sets `typedRoutes: true`, so route literals are validated at
# compile time. Force-casting a navigation argument to `any`/`never` defeats
# that check. Type dynamically-built hrefs as `Href` from 'expo-router' instead.
#
# Scans only apps/mobile/src. Exits non-zero and lists offenders if any are
# found; exits 0 when clean.
#
# Implementation notes:
# - A naive `[^)]*` regex stops at the first `)`, so nested calls like
#   `String(listIndex)` blind the guard (see rides.tsx / saved.tsx history).
# - We track paren depth from push|replace|navigate( so nested `)` does not
#   end the scan early, and multi-line object args are covered.
# - `<Redirect ... as any|never ...>` is scanned across the opening tag.
# - Portable awk (BSD + GNU): no POSIX [[:class:]] character classes.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/mobile/src"

if [ ! -d "$SRC" ]; then
  echo "ERROR: expected mobile src at $SRC" >&2
  exit 2
fi

# Collect .ts/.tsx paths (rg if available, else find).
if command -v rg >/dev/null 2>&1; then
  # shellcheck disable=SC2207
  files=($(rg --files -g '*.ts' -g '*.tsx' "$SRC"))
else
  # shellcheck disable=SC2207
  files=($(find "$SRC" \( -name '*.ts' -o -name '*.tsx' \)))
fi

offenders=""

for file in "${files[@]+"${files[@]}"}"; do
  [ -n "$file" ] || continue
  hits="$(
    awk -v file="$file" '
      function delta_parens(s,   i, c, d, in_str, quote, esc) {
        d = 0
        in_str = 0
        quote = ""
        esc = 0
        for (i = 1; i <= length(s); i++) {
          c = substr(s, i, 1)
          if (in_str) {
            if (esc) { esc = 0; continue }
            if (c == "\\") { esc = 1; continue }
            if (c == quote) { in_str = 0; quote = ""; continue }
            continue
          }
          if (c == "\"" || c == "'"'"'") { in_str = 1; quote = c; continue }
          if (c == "(") d++
          else if (c == ")") d--
        }
        return d
      }

      function has_cast(s) {
        return (s ~ /as[ \t]+any[^A-Za-z0-9_]/ || s ~ /as[ \t]+never[^A-Za-z0-9_]/ || s ~ /as[ \t]+any$/ || s ~ /as[ \t]+never$/)
      }

      function is_nav_call(s) {
        # Match .push( / .replace( / .navigate( or bare push( / replace( / navigate(
        return (s ~ /\.push[ \t]*\(/ || s ~ /\.replace[ \t]*\(/ || s ~ /\.navigate[ \t]*\(/ ||
                s ~ /(^|[^A-Za-z0-9_])push[ \t]*\(/ || s ~ /(^|[^A-Za-z0-9_])replace[ \t]*\(/ ||
                s ~ /(^|[^A-Za-z0-9_])navigate[ \t]*\(/)
      }

      function open_paren_index(s,   idx, p) {
        # Prefer method form (.push/replace/navigate), else bare identifier.
        if (match(s, /\.push[ \t]*\(/) || match(s, /\.replace[ \t]*\(/) || match(s, /\.navigate[ \t]*\(/)) {
          return RSTART + RLENGTH - 1
        }
        if (match(s, /(^|[^A-Za-z0-9_])push[ \t]*\(/) || match(s, /(^|[^A-Za-z0-9_])replace[ \t]*\(/) ||
            match(s, /(^|[^A-Za-z0-9_])navigate[ \t]*\(/)) {
          # RSTART points at boundary or start of keyword; find "(" from there.
          p = index(substr(s, RSTART), "(")
          if (p > 0) return RSTART + p - 1
        }
        return 0
      }

      function report() {
        printf "%s:%d:%s\n", file, FNR, $0
      }

      {
        line = $0

        # --- <Redirect ...> (possibly multi-line opening tag) ---
        if (!in_redirect && index(line, "<Redirect") > 0) {
          in_redirect = 1
        }
        if (in_redirect) {
          if (has_cast(line)) report()
          if (index(line, "/>") > 0 || index(line, ">") > 0) in_redirect = 0
        }

        # --- push / replace / navigate (paren-depth tracked) ---
        if (!tracking) {
          if (is_nav_call(line)) {
            open_at = open_paren_index(line)
            if (open_at > 0) {
              rest = substr(line, open_at)
              tracking = 1
              depth = delta_parens(rest)
              if (has_cast(rest)) report()
              if (depth <= 0) tracking = 0
            }
          }
        } else {
          depth += delta_parens(line)
          if (has_cast(line)) report()
          if (depth <= 0) tracking = 0
        }
      }
    ' "$file"
  )"
  if [ -n "$hits" ]; then
    offenders="${offenders}${hits}"$'\n'
  fi
done

if [ -n "$offenders" ]; then
  echo "ERROR: router navigation casts to 'any'/'never' are banned (typedRoutes validates routes)."
  echo "Type dynamic hrefs as 'Href' from 'expo-router' instead. Offenders:"
  printf '%s' "$offenders" | sed '/^$/d'
  echo
  exit 1
fi

echo "OK: no router navigation 'as any'/'as never' casts in apps/mobile/src."
exit 0
