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
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/apps/mobile/src"

# 1. router.push/replace/navigate(... as any|never ...)
# 2. <Redirect ... as any|never ...>
PATTERN='(push|replace|navigate)\([^)]*\bas (any|never)\b|<Redirect[^>]*\bas (any|never)\b'

offenders="$(grep -rnE "$PATTERN" "$SRC" --include='*.ts' --include='*.tsx' || true)"

if [ -n "$offenders" ]; then
  echo "ERROR: router navigation casts to 'any'/'never' are banned (typedRoutes validates routes)."
  echo "Type dynamic hrefs as 'Href' from 'expo-router' instead. Offenders:"
  echo "$offenders"
  exit 1
fi

echo "OK: no router navigation 'as any'/'as never' casts in apps/mobile/src."
exit 0
