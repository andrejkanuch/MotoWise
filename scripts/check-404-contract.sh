#!/usr/bin/env bash
#
# Guard: a URL with no content must return HTTP 404, not 200.
#
# Why this needs a real server: `notFound()` runs inside a render, and whether the
# resulting response carries 404 or 200 depends on how that render was produced
# (streamed vs not). No unit test can observe a prerender's HTTP status — which is
# exactly why ~1k soft-404s went unnoticed for two months (Sentry MOTOVAULT-WEB-Q/-P/-R).
# Dev mode does not reproduce it either: it does no ISR and streams differently. Point
# this at a production build, a Vercel preview, or production itself.
#
#   scripts/check-404-contract.sh                       # defaults to https://motovault.app
#   scripts/check-404-contract.sh http://127.0.0.1:3100 # local `next start`
#
# Companion cheap tripwire that DOES run in CI on every PR:
#   apps/web/src/app/__tests__/not-found-contract.test.ts
# See docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md
#
# KNOWN FALSE FAILURE on a Vercel PREVIEW deployment: `blog:real` returns 404 there.
# NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are scoped to the `production` target only, so a
# preview cannot read blog_posts and EVERY blog slug 404s. That is a preview-env gap, not
# a 404-contract failure — the `blog:bogus` row still tests what matters. Production and a
# local build with those vars in apps/web/.env.local both return 200.
set -uo pipefail

BASE="${1:-${BASE_URL:-https://motovault.app}}"
BASE="${BASE%/}"

# Route families, one line each: <expected-status> <path> <label>
# Encode FAMILIES, not one-off URLs: every route that can call notFound() needs a
# bogus case here, or the next one to regress is the one nobody checked.
# Real paths are load-bearing too — an all-404s site would satisfy the bogus rows alone.
CASES=$(cat <<'EOF'
404 /trips/us/mt/beartooth-highway-does-not-exist trip-detail:bogus
200 /trips/us/mt/beartooth-highway              trip-detail:real
404 /explore/zz                                 explore-country:bogus
200 /explore/us                                 explore-country:real
404 /explore/us/zz-99                           explore-region:bogus
200 /explore/us/mt                              explore-region:real
404 /de/explore/zz                              explore-country-i18n:bogus
200 /de/explore/us                              explore-country-i18n:real
404 /de/explore/us/zz-99                        explore-region-i18n:bogus
200 /de/explore/us/mt                           explore-region-i18n:real
404 /blog/this-post-does-not-exist              blog:bogus
200 /blog/motorcycle-oil-types-guide            blog:real
404 /guides/this-guide-does-not-exist           guides:bogus
200 /guides/alpine-motorcycle-passes            guides:real
308 /trips/us/ca/pacific-coast-highway          legacy-slug:redirect
308 /trips/ch/vs/furka-pass                     bare-slug:redirect
404 /definitely-not-a-route                     control:bogus
EOF
)

printf 'Checking the 404 contract against %s\n\n' "$BASE"

# Fail loudly rather than skip when the target is unreachable — a guard that
# silently passes against a dead host is worse than no guard.
root_status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$BASE/" || echo 000)
if [ "$root_status" = "000" ]; then
  echo "ERROR: $BASE/ is unreachable — cannot verify the 404 contract." >&2
  echo "Start a PRODUCTION build (dev mode cannot reproduce this bug):" >&2
  echo "  pnpm --filter web build && (cd apps/web && PORT=3100 pnpm start)" >&2
  exit 2
fi

# Identity check: port 3000/3100 may be held by an unrelated local app, and two
# measurement runs during the original investigation silently hit another product.
title=$(curl -s --max-time 30 "$BASE/" | tr -d '\n' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p')
case "$title" in
  *MotoVault*) printf 'Target confirmed: %s\n\n' "$title" ;;
  *)
    echo "ERROR: $BASE/ does not look like MotoVault (<title>: '${title:-none}')." >&2
    echo "Another app is probably bound to that port. Use a different PORT." >&2
    exit 2
    ;;
esac

failures=0
checked=0

while read -r want path label; do
  [ -n "${want:-}" ] || continue
  # No -L: the redirect status itself is the assertion.
  read -r got prerender <<EOF
$(curl -s -o /dev/null -D - --max-time 30 "$BASE$path" \
    | awk 'BEGIN{IGNORECASE=1} /^HTTP\//{s=$2} /^x-nextjs-prerender:/{p="prerender"} END{print (s?s:"000"), (p?p:"-")}')
EOF
  checked=$((checked + 1))
  if [ "$got" = "$want" ]; then
    printf '  ok    %-3s  %-28s %s\n' "$got" "$label" "$path"
  else
    printf '  FAIL  got %s, want %s  %-22s %s  [%s]\n' "$got" "$want" "$label" "$path" "$prerender"
    failures=$((failures + 1))
  fi
done <<EOF
$CASES
EOF

printf '\n'
if [ "$failures" -gt 0 ]; then
  echo "ERROR: $failures of $checked checks failed."
  echo
  echo "A bogus URL returning 200 means the not-found page is being served as a"
  echo "successful response, so Google indexes it as a real, thin page. The usual"
  echo "cause is a loading.tsx creating a Suspense boundary above the route: the"
  echo "shell streams before notFound() runs, and a streamed response can only be"
  echo "200. See docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md"
  exit 1
fi

echo "OK: all $checked checks passed — unknown URLs 404, real URLs 200, legacy slugs 308."
exit 0
