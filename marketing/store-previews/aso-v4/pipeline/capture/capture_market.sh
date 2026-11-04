#!/usr/bin/env bash
# Capture the ten screenshot slots for one market on an iOS simulator.
#
#   TEST_PASSWORD=… capture/capture_market.sh <CC> [UDID] [--slots garage,expenses] [--dry-run]
#
# Reads out/seed/<CC>/ids.json (written by gen_seed_market.py) and the market's seed-ready file,
# switches the simulator to the market's language + region (reboots only when they change),
# forces dark mode, the 9:41 status bar and permissions, then runs Maestro.
# Output: out/captures/<CC>/<slot>.png + capture-env.json (what was passed, minus the password).
#
# --dry-run prints every simctl/maestro command and the Maestro env instead of running them.
# Prereqs (RUNBOOK.md step 5): the market account is seeded (owner-approved), a Release
# simulator build with entitlements is installed, ONLY this simulator is booted (Maestro can
# attach to the wrong one), and the Maestro MCP is not driving the same simulator.
set -euo pipefail

CC="$(echo "${1:?usage: capture_market.sh <CC> [UDID] [--slots a,b] [--dry-run]}" | tr '[:lower:]' '[:upper:]')"
shift
UDID=""
SLOTS=""
DRY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --slots) SLOTS="$2"; shift 2 ;;
    --dry-run) DRY=true; shift ;;
    *) UDID="$1"; shift ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
PIPE="$(cd "$HERE/.." && pwd)"
APP_ID=com.motovault.app
OUT="$PIPE/out/captures/$CC"

run() {
  if $DRY; then printf '+ %q' "$1"; shift; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

if [[ -z "$UDID" ]]; then
  UDID="$(xcrun simctl list devices booted -j | python3 -c 'import json,sys
d=json.load(sys.stdin)["devices"]; b=[x["udid"] for v in d.values() for x in v]
print(b[0] if len(b)==1 else "")' 2>/dev/null || true)"
  if [[ -z "$UDID" ]]; then
    $DRY && UDID="<UDID>" || { echo "Boot exactly one simulator or pass its UDID" >&2; exit 1; }
  fi
fi

# ---- preflight: nothing may reach RevenueCat, PostHog or Meta ---------------------------
# Hard rule (owner, 2026-11-03). preflight.sh refuses a build that carries an RC/PostHog/Meta
# key or can load an OTA, then launches it once and watches its sockets. No bypass flag exists
# on purpose: fix the build instead (RUNBOOK §5).
if $DRY; then
  echo "+ $HERE/preflight.sh $UDID   # must PASS before anything below runs"
else
  "$HERE/preflight.sh" "$UDID"
fi

# ---- market settings -------------------------------------------------------------------
read -r LANGS APPLE_LOCALE METRIC < <(python3 - "$CC" "$PIPE" <<'PY'
import json, sys
from pathlib import Path
cc, pipe = sys.argv[1], Path(sys.argv[2])
for d in (pipe.parent / "markets", pipe / "out/markets-seed", pipe / "fixtures/markets"):
    f = d / f"{cc}.json"
    if f.exists():
        m = json.loads(f.read_text()); break
else:
    sys.exit(f"{cc}: no seed-ready market file")
dev = m["device"]
metric = dev.get("metric", m["measurement_system"] == "metric")
print(",".join(dev["apple_languages"]), dev["apple_locale"], "true" if metric else "false")
PY
)
IFS=, read -r -a LANG_ARR <<<"$LANGS"

# ---- simulator language + region ----------------------------------------------------
# AppleLanguages drives the UI language the app resolves (expo-localization languageCode),
# AppleLocale the region (date order, first weekday), AppleMetricUnits the system unit default.
# The app's own units and currency come from the ACCOUNT (users.measurement_system/currency),
# not from the device. A language change only takes effect after a reboot.
current="$(xcrun simctl spawn "$UDID" defaults read -g AppleLocale 2>/dev/null || true)"
if $DRY || [[ "$current" != "$APPLE_LOCALE" ]]; then
  run xcrun simctl spawn "$UDID" defaults write -g AppleLanguages -array "${LANG_ARR[@]}"
  run xcrun simctl spawn "$UDID" defaults write -g AppleLocale -string "$APPLE_LOCALE"
  run xcrun simctl spawn "$UDID" defaults write -g AppleMetricUnits -bool "$METRIC"
  run xcrun simctl shutdown "$UDID"
  run xcrun simctl boot "$UDID"
  run xcrun simctl bootstatus "$UDID" -b
fi

# ---- look of the device -------------------------------------------------------------
run xcrun simctl ui "$UDID" appearance dark
for service in photos camera location; do
  run xcrun simctl privacy "$UDID" grant "$service" "$APP_ID" || true
done
# Clean status bar: 9:41, full battery, full Wi-Fi + cellular, no carrier name.
run xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --operatorName "" --batteryState charged --batteryLevel 100

# ---- Maestro env ------------------------------------------------------------------------
ENV_ARGS=()
while IFS= read -r line; do
  ENV_ARGS+=(-e "$line")
done < <(python3 "$HERE/labels.py" "$CC")
ENV_ARGS+=(-e "OUT=$OUT")
mkdir -p "$OUT"
python3 "$HERE/labels.py" "$CC" --json >"$OUT/capture-env.json"

if $DRY; then
  : "${TEST_PASSWORD:=<from the password manager>}"
else
  : "${TEST_PASSWORD:?set TEST_PASSWORD (the market account password)}"
fi

FLOWS=("$HERE/flows/run-all.yaml")
if [[ -n "$SLOTS" ]]; then
  FLOWS=("$HERE/flows/_signin.yaml")
  IFS=, read -r -a picked <<<"$SLOTS"
  for s in "${picked[@]}"; do FLOWS+=("$HERE/flows/$s.yaml"); done
fi

for flow in "${FLOWS[@]}"; do
  if $DRY; then
    echo "+ maestro --device $UDID test $flow ${ENV_ARGS[*]} -e TEST_PASSWORD=***"
  else
    maestro --device "$UDID" test "$flow" "${ENV_ARGS[@]}" -e "TEST_PASSWORD=$TEST_PASSWORD"
  fi
done

$DRY && echo "(dry run: nothing executed)" || echo "Captures in $OUT"
