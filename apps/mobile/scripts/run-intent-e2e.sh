#!/bin/sh
# Web→app intent E2E runner (iOS): seed the simulator clipboard with an
# `mvintent://` token, then drive onboarding through Maestro to assert the
# "Is this your ride?" confirmation behaves correctly.
#
# Usage:
#   pnpm --filter @motovault/mobile test:e2e:intent            # valid → confirmation
#   pnpm --filter @motovault/mobile test:e2e:intent-fallback   # unknown make → normal grid
#
# iOS ONLY — the intent transport on iOS is the clipboard (seeded here via
# `xcrun simctl pbcopy`). The Android install-referrer path can't be seeded
# without a real Play Store install and is verified manually on an emulator.
#
# The token is an https URL so the app can gate its (permission-prompting)
# clipboard read behind `hasUrlAsync()`. During the flow iOS shows a one-time
# "… would like to paste" dialog when the app reads it — the flows tap
# "Allow Paste". Run against a bundled preview/Release build (NOT the Metro dev
# client — clearState wipes its Metro link; see .maestro/README.md).
#
# Prereq: a STANDALONE / PREVIEW build (bundled JS, no Metro) built with
# EXPO_PUBLIC_OB_VARIANT=invested installed on a booted iOS simulator — same as
# onboarding.yaml (see .maestro/README.md). The flow uses clearState +
# clearKeychain to reset the one-shot intent flag; the clipboard is system-level
# and survives clearState, so it is seeded BEFORE Maestro launches the app.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MOBILE_DIR=$(dirname "$SCRIPT_DIR")
APP_ID=${APP_ID:-com.motovault.app}
E2E_FLOW=${E2E_FLOW:-intent-onboarding.yaml}

command -v maestro >/dev/null 2>&1 || { echo "error: maestro CLI not found. Install: curl -fsSL https://get.maestro.mobile.dev | bash"; exit 1; }
command -v xcrun >/dev/null 2>&1 || { echo "error: xcrun not found — this runner is iOS-simulator only."; exit 1; }

# Fresh epoch-ms timestamp so the token passes the ~2-minute TTL check. `date`
# has no ms on macOS, so append milliseconds as 000 (seconds precision is fine).
TS="$(date +%s)000"
# The token the web writes just before the store redirect (see apps/web
# storeAnchorProps, T5). Overridable for the fallback case.
INTENT_TOKEN=${INTENT_TOKEN:-"https://motovault.app/i?mv_make=Yamaha&mv_model=MT-07&utm_source=blog&utm_campaign=blog_maintenance&ts=${TS}"}

echo "→ seeding simulator clipboard with intent token"
printf '%s' "$INTENT_TOKEN" | xcrun simctl pbcopy booted

echo "→ running Maestro flow $E2E_FLOW (APP_ID=$APP_ID)"
maestro test "$MOBILE_DIR/.maestro/flows/$E2E_FLOW" --env APP_ID="$APP_ID"
