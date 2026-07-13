#!/bin/sh
# Run the Maestro E2E flows against the currently booted device.
#
# The app must already be running on a simulator/emulator (custom dev client, not Expo Go):
#   pnpm --filter @motovault/mobile ios      # or android
#
# APP_ID defaults to the production bundle id. Override for a dev-client build that ships
# under a different id:  APP_ID=com.motovault.app.dev pnpm --filter @motovault/mobile test:e2e
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
MOBILE_DIR=$(dirname "$SCRIPT_DIR")

APP_ID=${APP_ID:-com.motovault.app}

if ! command -v maestro >/dev/null 2>&1; then
  echo "error: maestro CLI not found."
  echo "Install it once:  curl -fsSL https://get.maestro.mobile.dev | bash"
  echo "(requires a JDK — the JDK 17 from the Android setup works)"
  exit 1
fi

echo "Running Maestro flows (APP_ID=$APP_ID) against the booted device…"
exec maestro test "$MOBILE_DIR/.maestro/flows" --env APP_ID="$APP_ID"
