#!/bin/sh
# Onboarding sign-in E2E (issue 365 T11, FS-OB1a): a returning rider signs in
# from Welcome's "Already have an account? Sign in".
#
#   1. unfinished — a confirmed account with onboarding NOT completed must leave
#      sign-in for Experience with the "Account ready" notice
#      (onboarding-signin-unfinished-account.yaml).
#   2. onboarded  — a confirmed account with preferences.onboardingCompleted=true
#      must land on Home (onboarding-signin-onboarded-account.yaml).
#   3. discover   — opt-in only (issue 365 T29, FS-PO8): an onboarded account
#      opens Discover with no OS location dialog (discover-first-open-android.yaml).
#      SIGNIN_CASES=discover; run it with the device locale in English and es-ES.
#
# Each case gets its own user, created confirmed through the admin API, marked
# public.users.is_synthetic = true (e2e-mark-synthetic.sh) and deleted at
# teardown, pass or fail.
#
# Usage:
#   pnpm --filter @motovault/mobile test:e2e:onboarding-signin
#   SIGNIN_CASES=unfinished DEVICE=<udid> pnpm --filter @motovault/mobile test:e2e:onboarding-signin
#
# LOCAL STACK ONLY: this runner creates users, so it refuses any SUPABASE_URL
# that is not the local stack. Export the local stack's SUPABASE_URL
# (http://127.0.0.1:54321 from the host, also for the Android emulator build
# e2e-android-local), SUPABASE_SERVICE_ROLE_KEY, and install a standalone E2E
# build pointed at that stack (T00 recipe, .maestro/README.md).
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MOBILE_DIR=$(dirname "$SCRIPT_DIR")
# shellcheck source=./e2e-mark-synthetic.sh
. "$SCRIPT_DIR/e2e-mark-synthetic.sh"
APP_ID=${APP_ID:-com.motovault.app}
SIGNIN_CASES=${SIGNIN_CASES:-"unfinished onboarded"}

SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}
[ -n "$SUPABASE_URL" ] || { echo "error: export SUPABASE_URL (the local stack, e.g. http://127.0.0.1:54321)"; exit 1; }
[ -n "$SUPABASE_SERVICE_ROLE_KEY" ] || { echo "error: export the local stack's SUPABASE_SERVICE_ROLE_KEY"; exit 1; }
case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*|http://10.0.2.2:*) ;;
  *) echo "error: SUPABASE_URL=$SUPABASE_URL is not the local stack; this runner creates users and never runs against production"; exit 1;;
esac
command -v maestro >/dev/null 2>&1 || { echo "error: maestro CLI not found. Install: curl -fsSL https://get.maestro.mobile.dev | bash"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "error: jq not found (brew install jq)"; exit 1; }

DEVICE_ARGS=""
[ -n "${DEVICE:-}" ] && DEVICE_ARGS="--device $DEVICE"
STAMP=$(date +%Y%m%d%H%M%S)
TEST_PASSWORD="E2e!$(date +%s)Aa"
# Space-separated ids of every user this run created; teardown deletes them all.
CREATED_IDS=""

admin() { # admin METHOD PATH [DATA] — DELETE fails loudly so a leaked user is visible
  method=$1; path=$2; data=${3:-}
  fail_opt=""
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

cleanup() {
  code=${1:-$?}
  trap - EXIT
  trap '' INT TERM PIPE
  set +e
  for id in $CREATED_IDS; do
    echo "→ teardown: deleting test user $id"
    admin DELETE "users/$id" >/dev/null 2>&1 || echo "  warning: user delete failed — remove $id manually"
  done
  exit "$code"
}
trap cleanup EXIT
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

create_user() { # create_user EMAIL -> prints the new id
  resp=$(admin POST users "$(jq -n --arg e "$1" --arg p "$TEST_PASSWORD" '{email:$e,password:$p,email_confirm:true}')")
  printf '%s' "$resp" | jq -er '.id // empty' || { echo "error: could not create $1: $resp" >&2; return 1; }
}

mark_onboarded() { # mark_onboarded USER_ID — preferences.onboardingCompleted = true
  curl -sS --fail-with-body --max-time 15 -X PATCH \
    "$SUPABASE_URL/rest/v1/users?id=eq.$1" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=minimal" \
    -d "$(jq -n --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{preferences:{onboardingCompleted:true,experienceLevel:"beginner",ridingGoals:["track_rides"]},onboarding_completed_at:$at}')" >/dev/null
}

for case_name in $SIGNIN_CASES; do
  case "$case_name" in
    unfinished) flow=onboarding-signin-unfinished-account.yaml ;;
    onboarded) flow=onboarding-signin-onboarded-account.yaml ;;
    discover) flow=discover-first-open-android.yaml ;;
    *) echo "error: unknown case '$case_name' (unfinished | onboarded | discover)"; exit 1 ;;
  esac
  email="e2e-signin-${case_name}+${STAMP}@motovault.app"
  echo "→ $case_name: creating confirmed user $email"
  id=$(create_user "$email")
  CREATED_IDS="$CREATED_IDS $id"
  mark_synthetic "$id" || exit 1
  [ "$case_name" != "unfinished" ] && mark_onboarded "$id"
  echo "→ $case_name: running $flow"
  # shellcheck disable=SC2086
  maestro $DEVICE_ARGS test "$MOBILE_DIR/.maestro/flows/$flow" \
    --env APP_ID="$APP_ID" --env TEST_EMAIL="$email" --env TEST_PASSWORD="$TEST_PASSWORD"
done
echo "✓ onboarding sign-in E2E passed ($SIGNIN_CASES)"
