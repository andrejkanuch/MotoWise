#!/usr/bin/env bash
# Capture + compose every market in one run, on one simulator, from the key-free capture build.
#   APP_TREE=<worktree the build came from> PW_DIR=<dir with <cc>.pw files> capture/capture_all.sh <UDID> [CC ...]
# Each market's password is read from $PW_DIR/<cc>.pw (lowercase letters and digits only: the
# simulator keyboard in some languages mistypes "-" and capitals). capture_market.sh runs the
# RevenueCat/analytics preflight before every market; a failed market is reported and skipped.
set -uo pipefail
cd "$(dirname "$0")/.."
UDID=${1:?UDID}; shift
MARKETS=("$@"); [ ${#MARKETS[@]} -eq 0 ] && MARKETS=(US GB CA AU PH MX CO AR ES BR FR IT DE)
: "${APP_TREE:?set APP_TREE to the worktree the capture build was made from}"
: "${PW_DIR:?set PW_DIR}"
APP_PATH=${APP_PATH:-$APP_TREE/apps/mobile/build/Build/Products/Release-iphonesimulator/MotoVaultDev.app}
[ -d "$APP_PATH" ] || { echo "no capture build at $APP_PATH"; exit 1; }
export APP_TREE MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}
SUMMARY=out/capture-all-summary.txt; : > "$SUMMARY"
for cc in "${MARKETS[@]}"; do
  lc=$(echo "$cc" | tr '[:upper:]' '[:lower:]')
  log=out/capture-$cc.log
  xcrun simctl terminate "$UDID" com.motovault.app 2>/dev/null
  # Sign the previous market's account out: the Supabase session lives in the keychain, which
  # survives an uninstall, so reset the keychain and reinstall the same key-free build.
  xcrun simctl uninstall "$UDID" com.motovault.app 2>/dev/null
  xcrun simctl keychain "$UDID" reset
  xcrun simctl install "$UDID" "$APP_PATH"
  rm -f out/captures/"$cc"/*.png   # every slot from this build, never a stale capture
  TEST_PASSWORD="$(cat "$PW_DIR/$lc.pw")" capture/capture_market.sh "$cc" "$UDID" > "$log" 2>&1
  n=$(ls out/captures/"$cc"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n" -lt 10 ]; then
    # One retry of just the missing slots (a cold Maestro driver or a slow tile load).
    missing=$(python3 -I -c 'import os,sys;s=["garage","ride_tracking","ride_stats","expenses","costs_overview","maintenance_reminders","service_history","receipt_scan","trip_planning","season_summary"];print(",".join(x for x in s if not os.path.exists(f"out/captures/{sys.argv[1]}/{x}.png")))' "$cc")
    TEST_PASSWORD="$(cat "$PW_DIR/$lc.pw")" capture/capture_market.sh "$cc" "$UDID" --slots "$missing" >> "$log" 2>&1
    n=$(ls out/captures/"$cc"/*.png 2>/dev/null | wc -l | tr -d ' ')
  fi
  rm -rf out/composed/"$cc"
  python3 compose/compose.py "$cc" --captures out/captures/"$cc" --out out/composed/"$cc" --accent-line2 >> "$log" 2>&1
  c=$(ls out/composed/"$cc"/ios/iphone-6.9/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "$cc captures=$n composed_iphone=$c $(grep -m1 -E 'Assertion is false|FAILED' "$log" | head -c 120)" | tee -a "$SUMMARY"
done
