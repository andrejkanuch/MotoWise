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
# RELAUNCH=1 adds a middle part (issue 365 T13a, FS-OB3) between 1 and 2:
#   onboarding-email-code-relaunch.yaml — kills and relaunches the app (state
#   kept); asserts the code step reopens for TEST_EMAIL with no password field.
#
# Usage:
#   pnpm --filter @motovault/mobile test:e2e:email-code
#   DEVICE=<simulator udid> pnpm --filter @motovault/mobile test:e2e:email-code
#   RELAUNCH=1 sh apps/mobile/scripts/run-onboarding-email-code-e2e.sh
#
# E2E_VERIFY_FLOW swaps part 2 (run-onboarding-paywall-e2e.sh uses it); any
# EXPECTED_ARM is passed through to that flow.
#
# Targets whatever Supabase the installed build talks to. Supabase URL + anon key
# come from apps/mobile/.env, the service-role key from apps/api/.env; export
# SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY to override (they
# must match the build). Prereq: a standalone/preview build on a booted
# simulator (see .maestro/README.md). Local-stack override: see
# run-onboarding-e2e.sh (SUPABASE_URL must match the build under test).
#
# The account the app creates is marked public.users.is_synthetic = true as
# soon as part 1 records its id, and the id goes to the local E2E user ledger
# (e2e-mark-synthetic.sh), so analytics baselines exclude it whether teardown
# deletes it or TEST_EMAIL keeps it (#365 T02).
#
# The UI signup makes Supabase send a real confirmation email. TEST_EMAIL
# defaults to Resend's delivered+<label>@resend.dev test address, which reports
# delivered without bouncing, so production sender reputation is unaffected.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MOBILE_DIR=$(dirname "$SCRIPT_DIR")
# shellcheck source=./e2e-mark-synthetic.sh
. "$SCRIPT_DIR/e2e-mark-synthetic.sh"
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
# A random suffix keeps the default address unique to this run, so no other
# run can create an account under it.
NONCE=$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')
# An address passed in TEST_EMAIL has no nonce, so another run could sign up
# under it too: teardown then reports the account instead of deleting it.
EXPLICIT_EMAIL=${TEST_EMAIL:+1}
TEST_EMAIL=${TEST_EMAIL:-"delivered+mv-e2e-${E2E_LABEL}-${STAMP}-${NONCE}@resend.dev"}
TEST_PASSWORD="E2e!$(date +%s)Aa"
DEVICE_ARGS=""
[ -n "${DEVICE:-}" ] && DEVICE_ARGS="--device $DEVICE"

admin() { # admin METHOD PATH [DATA] — DELETE fails loudly so a leaked user is visible
  method=$1; path=$2; data=${3:-}
  fail_opt=""
  # Teardown ignores Ctrl-C, so its DELETE is bounded instead.
  [ "$method" = "DELETE" ] && fail_opt="--fail-with-body --max-time 15"
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
# Fails (non-zero) when the admin API returns no user list, so a failed lookup
# is never read as "no account".
user_id_for_email() {
  admin GET "users?filter=$(jq -rn --arg e "$TEST_EMAIL" '$e|@uri')&per_page=50" \
    | jq -er --arg e "$TEST_EMAIL" --arg after "${CREATED_AFTER:-}" \
      '.users | map(select(.email == $e) | select($after == "" or .created_at >= $after) | .id) | first // ""'
}

EXISTING=$(user_id_for_email) || { echo "error: could not check whether $TEST_EMAIL has an account"; exit 1; }
if [ -n "$EXISTING" ]; then
  echo "error: an account already exists for $TEST_EMAIL — use a new address"
  exit 1
fi
CREATED_AFTER=$(date -u +%Y-%m-%dT%H:%M:%S)
# Recorded once, right after part 1 (pass or fail), for the account this run's
# signup created. Teardown deletes only this id and never looks one up itself.
USER_ID=""

cleanup() {
  code=${1:-$?}
  # Run once (the exit below would fire the EXIT trap again after a signal),
  # and finish: a second Ctrl-C, or a closed stdout (`| tee` killed by the same
  # Ctrl-C), must not cut the DELETE short and leak the user.
  trap - EXIT
  trap '' INT TERM PIPE
  set +e
  if [ -n "$USER_ID" ] && [ -n "$EXPLICIT_EMAIL" ]; then
    echo "→ teardown: TEST_EMAIL was set, so not deleting — remove user $USER_ID ($TEST_EMAIL) manually"
  elif [ -n "$USER_ID" ]; then
    echo "→ teardown: deleting test user $USER_ID ($TEST_EMAIL)"
    admin DELETE "users/$USER_ID" >/dev/null 2>&1 || echo "  warning: user delete failed — remove $TEST_EMAIL manually"
  else
    echo "→ teardown: no account recorded for this run — if one exists for $TEST_EMAIL, remove it manually"
  fi
  exit $code
}
trap cleanup EXIT
# A signal exit keeps its conventional status, so the gate never reads it as a pass.
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

echo "→ part 1: UI signup as $TEST_EMAIL (APP_ID=$APP_ID)"
PART1=0
# shellcheck disable=SC2086
maestro $DEVICE_ARGS test "$MOBILE_DIR/.maestro/flows/onboarding-email-code-signup.yaml" \
  --env APP_ID="$APP_ID" --env TEST_EMAIL="$TEST_EMAIL" --env TEST_PASSWORD="$TEST_PASSWORD" || PART1=$?

# The app, not this script, creates the account, so its id comes from the one
# lookup here: an address that had no account at preflight and is unique to
# this run, created after the run started.
USER_ID=$(user_id_for_email) || USER_ID=""
if [ -n "$USER_ID" ]; then
  mark_synthetic "$USER_ID" || exit 1
fi
[ "$PART1" -eq 0 ] || exit "$PART1"
[ -n "$USER_ID" ] || { echo "error: part 1 passed but no new account exists for $TEST_EMAIL"; exit 1; }
echo "  signed up user id=$USER_ID"

if [ "${RELAUNCH:-}" = "1" ]; then
  echo "→ relaunch: kill the app on the code step and reopen it"
  # shellcheck disable=SC2086
  maestro $DEVICE_ARGS test "$MOBILE_DIR/.maestro/flows/onboarding-email-code-relaunch.yaml" \
    --env APP_ID="$APP_ID" --env TEST_EMAIL="$TEST_EMAIL"
fi

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
