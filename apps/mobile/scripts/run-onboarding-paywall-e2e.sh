#!/bin/sh
# Onboarding paywall E2E (#326): sign up a fresh account through onboarding and
# fail unless the onboarding paywall is shown where the assigned arm puts it
# (commit_first: after account; garage_first: on "Open my garage"). Required
# before a build is promoted to production (docs/runbooks/mobile-release.md).
#
# Usage:
#   DEVICE=<simulator udid> pnpm --filter @motovault/mobile test:e2e:onboarding-paywall
#   EXPECTED_ARM=garage_first DEVICE=... pnpm --filter @motovault/mobile test:e2e:onboarding-paywall
#
# A release build cannot be forced onto an arm: each fresh install draws one
# from the PostHog flag (EXPO_PUBLIC_OB_VARIANT works only in __DEV__). With no
# EXPECTED_ARM the gate needs one passing run per arm: it runs the flow pinned
# to commit_first until a run draws that arm and passes, then the same for
# garage_first, up to MAX_TRIES runs per arm (default 6). A run that draws the
# other arm fails the pin and is retried. A build that never shows an arm's
# paywall never passes for that arm, because the flow then reads the install as
# the other arm (or fails waiting for the paywall).
#
# Each run reuses the email-code runner: UI signup, a code from the Supabase
# admin API, the account deleted on exit.
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MAX_TRIES=${MAX_TRIES:-6}
case "$MAX_TRIES" in
  '' | *[!0-9]* | 0 | 0*) echo "error: MAX_TRIES must be a positive integer (got '$MAX_TRIES')"; exit 2 ;;
esac
# Ctrl-C stops the gate. Each run deletes its own account on the way out, so
# leaving the retry loop is safe.
trap 'exit 130' INT TERM

run_once() { # run_once ARM
  EXPECTED_ARM=$1 E2E_VERIFY_FLOW=onboarding-paywall-verify.yaml E2E_LABEL=onboarding-paywall \
    sh "$SCRIPT_DIR/run-onboarding-email-code-e2e.sh"
}

if [ -n "${EXPECTED_ARM:-}" ]; then
  run_once "$EXPECTED_ARM"
  exit 0
fi

for arm in commit_first garage_first; do
  try=1
  until run_once "$arm"; do
    rc=$?
    [ "$rc" -lt 128 ] || exit "$rc"
    if [ "$try" -ge "$MAX_TRIES" ]; then
      echo "✗ no passing $arm run in $MAX_TRIES tries: that arm shows no paywall, or no install drew it"
      exit 1
    fi
    try=$((try + 1))
    echo "→ $arm: retry $try/$MAX_TRIES (a run that drew the other arm fails the pin)"
  done
  echo "✓ $arm: onboarding paywall shown"
done
echo "✓ onboarding paywall E2E passed for both arms"
