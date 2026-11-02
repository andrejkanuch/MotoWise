#!/bin/sh
# Email-code confirmation E2E (plan U7): sign up a NEW account through the
# onboarding UI, read the code the app's user would get, type it, and finish
# onboarding — then delete the account, pass or fail.
#
#   1. onboarding-email-code-signup.yaml  — UI signup; asserts the code step.
#   2. admin generate_link {type: signup} — a valid code for that pending signup
#      (it replaces the emailed one; the flow only types this one).
#   3. onboarding-email-code-verify.yaml  — types the code; asserts onboarding
#      continues to Home.
#
# Usage:
#   pnpm --filter @motovault/mobile test:e2e:email-code
#   DEVICE=<simulator udid> pnpm --filter @motovault/mobile test:e2e:email-code
#
# E2E_VERIFY_FLOW swaps part 2 (run-onboarding-paywall-e2e.sh uses it); any
# EXPECTED_ARM is passed through to that flow.
#
# Targets whatever Supabase the installed build talks to. Supabase URL + anon key
# come from apps/mobile/.env, the service-role key from apps/api/.env; export
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY to override (they
# must match the build). Prereq: a standalone/preview build on a booted
# simulator (see .maestro/README.md).
#
# The UI signup makes Supabase send a real confirmation email. TEST_EMAIL
# defaults to Resend's delivered+<label>@resend.dev test address, which reports
# delivered without bouncing, so production sender reputation is unaffected.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MOBILE_DIR=$(dirname "$SCRIPT_DIR")
REPO_ROOT=$(cd "$MOBILE_DIR/../.." && pwd)
APP_ID=${APP_ID:-com.motovault.app}
E2E_VERIFY_FLOW=${E2E_VERIFY_FLOW:-onboarding-email-code-verify.yaml}
E2E_LABEL=${E2E_LABEL:-email-code}

get_env() { # get_env FILE KEY  -> prints value (empty if missing)
  [ -f "$1" ] || return 0
  grep -hE "^$2=" "$1" | head -1 | cut -d= -f2-
}

SUPABASE_URL=${SUPABASE_URL:-$(get_env "$MOBILE_DIR/.env" EXPO_PUBLIC_SUPABASE_URL)}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-$(get_env "$REPO_ROOT/apps/api/.env" SUPABASE_SERVICE_ROLE_KEY)}
for pair in "SUPABASE_URL=$SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"; do
  case "$pair" in *=) echo "error: missing ${pair%=*} (set it in the env files or export it)"; exit 1;; esac
done
command -v maestro >/dev/null 2>&1 || { echo "error: maestro CLI not found. Install: curl -fsSL https://get.maestro.mobile.dev | bash"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq not found (brew install jq)"; exit 1; }

STAMP=$(date +%Y%m%d%H%M%S)
TEST_EMAIL=${TEST_EMAIL:-"delivered+mv-e2e-${E2E_LABEL}-${STAMP}@resend.dev"}
TEST_PASSWORD="E2e!$(date +%s)Aa"
DEVICE_ARGS=""
[ -n "${DEVICE:-}" ] && DEVICE_ARGS="--device $DEVICE"

admin() { # admin METHOD PATH [DATA] — DELETE fails loudly so a leaked user is visible
  method=$1; path=$2; data=${3:-}
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

# The account is created by the app, so look it up by email at teardown.
# CREATED_AFTER limits the match to accounts created during this run, so a
# TEST_EMAIL that names an existing account can never get it deleted.
user_id_for_email() {
  admin GET "users?filter=$(jq -rn --arg e "$TEST_EMAIL" '$e|@uri')&per_page=50" \
    | jq -r --arg e "$TEST_EMAIL" --arg after "${CREATED_AFTER:-}" \
      '.users[]? | select(.email == $e) | select($after == "" or .created_at >= $after) | .id' \
    | head -1
}

if [ -n "$(user_id_for_email)" ]; then
  echo "error: an account already exists for $TEST_EMAIL — use a new address"
  exit 1
fi
CREATED_AFTER=$(date -u +%Y-%m-%dT%H:%M:%S)

cleanup() {
  code=$?
  USER_ID=$(user_id_for_email || true)
  if [ -n "$USER_ID" ]; then
    echo "→ teardown: deleting test user $USER_ID ($TEST_EMAIL)"
    admin DELETE "users/$USER_ID" >/dev/null 2>&1 || echo "  warning: user delete failed — remove $TEST_EMAIL manually"
  else
    echo "→ teardown: no user found for $TEST_EMAIL"
  fi
  exit $code
}
trap cleanup EXIT INT TERM

echo "→ part 1: UI signup as $TEST_EMAIL (APP_ID=$APP_ID)"
# shellcheck disable=SC2086
maestro $DEVICE_ARGS test "$MOBILE_DIR/.maestro/flows/onboarding-email-code-signup.yaml" \
  --env APP_ID="$APP_ID" --env TEST_EMAIL="$TEST_EMAIL" --env TEST_PASSWORD="$TEST_PASSWORD"

echo "→ fetching a confirmation code for the pending signup"
CODE=$(admin POST generate_link "$(jq -n --arg e "$TEST_EMAIL" --arg p "$TEST_PASSWORD" '{type:"signup",email:$e,password:$p}')" \
  | jq -r '.email_otp // .properties.email_otp // empty')
[ -n "$CODE" ] || { echo "error: generate_link returned no email_otp"; exit 1; }

echo "→ part 2: typing the code ($E2E_VERIFY_FLOW)"
# shellcheck disable=SC2086
maestro $DEVICE_ARGS test "$MOBILE_DIR/.maestro/flows/$E2E_VERIFY_FLOW" \
  --env APP_ID="$APP_ID" --env CONFIRMATION_CODE="$CODE" --env EXPECTED_ARM="${EXPECTED_ARM:-}"
echo "✓ $E2E_LABEL E2E passed"
# cleanup() deletes the user on exit.
