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
# Same setup and teardown as the email-code E2E (it reuses that runner): UI
# signup, a code from the Supabase admin API, the account deleted on exit.
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
E2E_VERIFY_FLOW=onboarding-paywall-verify.yaml E2E_LABEL=onboarding-paywall \
  exec sh "$SCRIPT_DIR/run-onboarding-email-code-e2e.sh"
