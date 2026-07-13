#!/bin/sh
# Onboarding E2E runner: create a Supabase user, drive the full onboarding flow
# through Maestro, then delete the user — pass or fail.
#
# Usage:
#   pnpm --filter @motovault/mobile test:e2e:onboarding
#
# Reads Supabase config from env files (no secrets in the repo):
#   - URL + anon key from apps/mobile/.env         (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)
#   - service-role key from apps/api/.env          (SUPABASE_SERVICE_ROLE_KEY)
# Override any of them by exporting SUPABASE_URL / SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY before running (e.g. to point at local Supabase).
#
# Prereq: install a STANDALONE / PREVIEW build (bundled JS, no Metro) with
# EXPO_PUBLIC_OB_VARIANT=invested baked into its bundle, running on a booted
# simulator/emulator. Metro-backed Expo dev-client builds are unsupported —
# `clearState` wipes the dev client's Metro connection (see .maestro/README.md
# and onboarding.yaml).
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MOBILE_DIR=$(dirname "$SCRIPT_DIR")
REPO_ROOT=$(cd "$MOBILE_DIR/../.." && pwd)
APP_ID=${APP_ID:-com.motovault.app}

get_env() { # get_env FILE KEY  -> prints value (empty if missing)
  [ -f "$1" ] || return 0
  grep -hE "^$2=" "$1" | head -1 | cut -d= -f2-
}

SUPABASE_URL=${SUPABASE_URL:-$(get_env "$MOBILE_DIR/.env" EXPO_PUBLIC_SUPABASE_URL)}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-$(get_env "$MOBILE_DIR/.env" EXPO_PUBLIC_SUPABASE_ANON_KEY)}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-$(get_env "$REPO_ROOT/apps/api/.env" SUPABASE_SERVICE_ROLE_KEY)}

for pair in "SUPABASE_URL=$SUPABASE_URL" "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"; do
  case "$pair" in *=) echo "error: missing ${pair%=*} (set it in the env files or export it)"; exit 1;; esac
done

command -v maestro >/dev/null 2>&1 || { echo "error: maestro CLI not found. Install: curl -fsSL https://get.maestro.mobile.dev | bash"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq not found (brew install jq)"; exit 1; }

# Unique, disposable test identity. `.test`-style local part keeps it obvious in the dashboard.
STAMP=$(date +%Y%m%d%H%M%S)
TEST_EMAIL="e2e-onboarding+${STAMP}@motovault.app"
TEST_PASSWORD="E2e!$(date +%s)Aa"
USER_ID=""

admin() { # admin METHOD PATH [DATA]
  method=$1; path=$2; data=${3:-}
  # DELETE (teardown) must surface HTTP 4xx/5xx: plain `curl -sS` exits 0 on
  # error responses, which would hide a rejected delete and leak test users.
  # --fail-with-body makes curl exit non-zero on error while still printing the
  # body. The POST path keeps its plain body capture (RESP=$(...) parses .id).
  fail_opt=""
  [ "$method" = "DELETE" ] && fail_opt="--fail-with-body"
  if [ -n "$data" ]; then
    curl -sS $fail_opt -X "$method" "$SUPABASE_URL/auth/v1/admin/$path" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" -d "$data"
  else
    curl -sS $fail_opt -X "$method" "$SUPABASE_URL/auth/v1/admin/$path" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  fi
}

cleanup() {
  code=$?
  if [ -n "$USER_ID" ]; then
    echo "→ teardown: deleting test user $USER_ID"
    admin DELETE "users/$USER_ID" >/dev/null 2>&1 || echo "  warning: user delete failed — remove $TEST_EMAIL manually"
  fi
  exit $code
}
trap cleanup EXIT INT TERM

echo "→ setup: creating confirmed test user $TEST_EMAIL"
RESP=$(admin POST users "$(jq -n --arg e "$TEST_EMAIL" --arg p "$TEST_PASSWORD" '{email:$e,password:$p,email_confirm:true}')")
USER_ID=$(printf '%s' "$RESP" | jq -r '.id // empty')
if [ -z "$USER_ID" ]; then
  echo "  failed to create user. Response:"; printf '%s\n' "$RESP" | jq . 2>/dev/null || printf '%s\n' "$RESP"
  exit 1
fi
echo "  created user id=$USER_ID"

echo "→ running Maestro onboarding flow (APP_ID=$APP_ID)"
maestro test "$MOBILE_DIR/.maestro/flows/onboarding.yaml" \
  --env APP_ID="$APP_ID" \
  --env TEST_EMAIL="$TEST_EMAIL" \
  --env TEST_PASSWORD="$TEST_PASSWORD"
# cleanup() runs on exit (pass or fail) and deletes the user.
