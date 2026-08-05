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
# Vercel PREVIEW deployments sit behind Deployment Protection, so an unauthenticated
# request 302s to an auth wall and the identity check below fails. Export
# VERCEL_AUTOMATION_BYPASS_SECRET to send Vercel's `x-vercel-protection-bypass` header
# (the documented method for automation; the header form keeps the secret out of proxy
# logs, unlike the query-parameter form). Production is reachable without it via the
# custom domain — protection is scoped "all_except_custom_domains", so
# https://motovault.app is exempt while its *.vercel.app deployment URL is not.
#
# Companion cheap tripwire that DOES run in CI on every PR:
#   apps/web/src/app/__tests__/not-found-contract.test.ts
# See docs/solutions/runtime-errors/nextjs-streaming-swallows-404s-and-redirects.md
#
# If `blog:real` 404s on a Vercel PREVIEW, check the Supabase env vars first — that is a
# missing-credentials symptom, not a 404-contract failure. The four SUPABASE_* /
# NEXT_PUBLIC_SUPABASE_* vars were `production`-only until 2026-08-05, so previews could not
# read blog_posts and EVERY blog slug 404'd. They now cover `preview` too. A local build
# needs them in apps/web/.env.local for the same reason.
set -uo pipefail

BASE="${1:-${BASE_URL:-https://motovault.app}}"
BASE="${BASE%/}"

# Shared curl options. The bypass secret goes in an array so it is passed as a single
# argv element and never interpolated into a logged string.
CURL_OPTS=(-s --max-time 30)
if [ -n "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  CURL_OPTS+=(-H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}")
  echo "Using Vercel protection-bypass header (secret is set)."
fi

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
root_status=$(curl "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' "$BASE/" || echo 000)
if [ "$root_status" = "000" ]; then
  echo "ERROR: $BASE/ is unreachable — cannot verify the 404 contract." >&2
  echo "Start a PRODUCTION build (dev mode cannot reproduce this bug):" >&2
  echo "  pnpm --filter web build && (cd apps/web && PORT=3100 pnpm start)" >&2
  exit 2
fi

# Identity check: port 3000/3100 may be held by an unrelated local app, and two
# measurement runs during the original investigation silently hit another product.
title=$(curl "${CURL_OPTS[@]}" "$BASE/" | tr -d '\n' | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p')
case "$title" in
  *MotoVault*) printf 'Target confirmed: %s\n\n' "$title" ;;
  *)
    echo "ERROR: $BASE/ does not look like MotoVault (<title>: '${title:-none}')." >&2
    echo "Either another app is bound to that port, or this is a protected Vercel" >&2
    echo "preview and VERCEL_AUTOMATION_BYPASS_SECRET is unset/wrong." >&2
    exit 2
    ;;
esac

failures=0
checked=0

while read -r want path label; do
  [ -n "${want:-}" ] || continue
  # No -L: the redirect status itself is the assertion.
  read -r got prerender <<EOF
$(curl "${CURL_OPTS[@]}" -o /dev/null -D - "$BASE$path" \
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
