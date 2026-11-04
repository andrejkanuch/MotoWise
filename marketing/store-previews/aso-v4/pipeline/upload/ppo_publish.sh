#!/usr/bin/env bash
# Build the aso-v4 Product Page Optimization test on App Store Connect: one experiment, one
# treatment ("local per-country set"), and per live App Store language a treatment localization with
# that language's own screenshots (out/composed/<CC>/ios/iphone-6.9), product page header and
# search-results asset. Stops before App Review; submit with `node asc_ppo.mjs submit <experimentId>`.
#
#   upload/ppo_publish.sh            # create + upload
#   upload/ppo_publish.sh --dry-run  # print the plan only
#
# Resume after a failure (never re-run from scratch: that creates a second experiment):
#   PPO_EXPERIMENT_ID=<id> PPO_TREATMENT_ID=<id> upload/ppo_publish.sh
# A language marked done in the log for this experiment is skipped; one with a localization but no
# done marker is re-synced in place (its screenshots and both assets are uploaded again).
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=${1:-}
unset ASC_PROFILE ASC_BYPASS_KEYCHAIN ASC_CONFIG_PATH
export ASC_KEY_TYPE=team ASC_KEY_ID=B7J3LS6SPC ASC_ISSUER_ID=faa21eba-ddd9-41ca-b90d-42b5af7913d0 \
  ASC_PRIVATE_KEY_PATH="$HOME/.asc/keys/AuthKey_B7J3LS6SPC.p8"
# Screenshot uploads to ASC hit "context deadline exceeded" at the default (2026-11-03).
export ASC_UPLOAD_TIMEOUT=${ASC_UPLOAD_TIMEOUT:-600s}
APP=6760291360
NAME="Local per-country screenshots Nov 2026"
TRAFFIC=${PPO_TRAFFIC:-50}
# Live App Store localization -> the market whose captures it shows. en-GB is also the Philippines'
# page and es-MX is also Colombia's and Argentina's (Apple serves by language, not country).
LOCALES=(${PPO_LOCALES:-en-US:US en-GB:GB es-MX:MX pt-BR:BR fr-FR:FR it:IT de-DE:DE})
OUT=${PPO_OUT:-out/composed}
LOG=${PPO_LOG:-$(dirname "$OUT")/ppo-publish.log}  # progress + resume markers live next to the sets
json() { python3 -I -c 'import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))' "$1"; }

# A set is publishable only when compose rendered every iPhone slot: compose skips a slot with no
# capture and renumbers the rest, so a short set would silently ship without its hero shot.
check_set() {
  python3 -I - "$OUT/$1" <<'PY'
import json, sys
from pathlib import Path
d = Path(sys.argv[1])
if not (d / "manifest.json").is_file():
    print(f"{d.name}: not publishable: no composed set at {d}"); sys.exit(1)
m = json.loads((d / "manifest.json").read_text())
want = [f for f in m["files"] if f["file"].startswith("ios/iphone-6.9/")]
have = sorted(p.name for p in (d / "ios/iphone-6.9").glob("*.png"))
skipped = [w for w in m.get("warnings", []) if w.startswith("iphone-6.9:")]
missing = [a for a in ("header", "search") if not (d / "ios/asset-library" / f"{a}.png").is_file()]
if skipped or not want or len(have) != len(want) or missing:
    print(f"{d.name}: not publishable: {len(have)} png vs {len(want)} in manifest; skipped={skipped}; missing={missing}")
    sys.exit(1)
print(len(have))
PY
}

for pair in "${LOCALES[@]}"; do
  cc=${pair#*:}
  n=$(check_set "$cc") || { echo "$n"; exit 1; }
  echo "plan: ${pair%%:*} <- $cc ($n screenshots + header + search)"
done
[ "$DRY" = "--dry-run" ] && exit 0
mkdir -p "$(dirname "$LOG")"

exp=${PPO_EXPERIMENT_ID:-}
trt=${PPO_TREATMENT_ID:-}
on_err() {
  echo "FAILED mid-run. Nothing is submitted. Resume with:" | tee -a "$LOG"
  echo "  PPO_EXPERIMENT_ID=${exp:-<none yet>} PPO_TREATMENT_ID=${trt:-<none yet>} PPO_LOCALES=\"${LOCALES[*]}\" upload/ppo_publish.sh" | tee -a "$LOG"
}
trap on_err ERR

if [ -z "$exp" ]; then
  exp=$(asc product-pages experiments create --v2 --app "$APP" --platform IOS --name "$NAME" \
    --traffic-proportion "$TRAFFIC" --output json </dev/null | json 'd["data"]["id"]')
  echo "experiment $exp" | tee -a "$LOG"
fi
if [ -z "$trt" ]; then
  trt=$(asc product-pages experiments treatments create --experiment-id "$exp" --name "Local per-country set" \
    --output json </dev/null | json 'd["data"]["id"]')
  echo "treatment $trt" | tee -a "$LOG"
fi
existing=$(asc product-pages experiments treatments localizations list --treatment-id "$trt" --output json </dev/null \
  | json '" ".join("%s=%s" % (x["attributes"]["locale"], x["id"]) for x in d["data"])')

sync_set() {  # retries: a fresh localization is pre-filled with the live page asynchronously
  local lid=$1 cc=$2 try
  for try in 1 2 3; do
    if asc product-pages experiments treatments localizations screenshot-sets sync --localization-id "$lid" \
      --path "$OUT/$cc/ios/iphone-6.9" --device-type IPHONE_67 --confirm --output json </dev/null >/dev/null; then
      return 0
    fi
    echo "sync $cc try $try failed; retrying in 60 s" | tee -a "$LOG"
    sleep 60
  done
  return 1
}

for pair in "${LOCALES[@]}"; do
  loc=${pair%%:*}; cc=${pair#*:}
  if grep -qxF "$loc done in $exp" "$LOG" 2>/dev/null; then echo "$loc already done in $exp, skipped"; continue; fi
  lid=$(tr ' ' '\n' <<<"$existing" | sed -n "s/^$loc=//p")
  if [ -z "$lid" ]; then
    lid=$(asc product-pages experiments treatments localizations create --treatment-id "$trt" --locale "$loc" \
      --output json </dev/null | json 'd["data"]["id"]')
    echo "$loc localization $lid" | tee -a "$LOG"
    # New treatment localizations start as a copy of the live page, filled in the background. A sync
    # right after create races that copy ("set already has 10 appScreenshots"), so let it settle.
    sleep 90
  else
    echo "$loc localization $lid (existing, re-syncing)" | tee -a "$LOG"
  fi
  sync_set "$lid" "$cc"
  echo "$loc screenshots synced from $cc" | tee -a "$LOG"
  for kind in header search; do  # one marker per placed asset, so a resume never places one twice
    if grep -qxF "$loc $kind placed in $exp" "$LOG"; then echo "$loc $kind already placed"; continue; fi
    node upload/asc_ppo.mjs asset "$kind" "$lid" "$OUT/$cc/ios/asset-library/$kind.png" | tee -a "$LOG"
    echo "$loc $kind placed in $exp" | tee -a "$LOG"
  done
  echo "$loc done in $exp" | tee -a "$LOG"
done
trap - ERR
echo "done: experiment $exp ready for review (node upload/asc_ppo.mjs submit $exp)" | tee -a "$LOG"
