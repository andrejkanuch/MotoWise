#!/bin/zsh
# MotoVault ASO analytics fetcher.
# Purpose: capture App Store funnel data (impressions / product page views / downloads)
# once Apple populates the analytics report requests created 2026-07-15.
# Must run LOCALLY — asc credentials live in the macOS keychain (not available to cloud jobs).
# Safe to run repeatedly (idempotent). Self-quiets once it has captured funnel data.
#
# Reports of interest (ONGOING request f25db9b3-06e1-4442-a33b-98cf84224602):
#   r14 = "App Store Discovery and Engagement Standard"  (impressions, page views, conversion by source)
#   r3  = "App Downloads Standard"                        (downloads)

set -u
export PATH="/opt/homebrew/bin:/usr/bin:/bin:$PATH"
export ASC_TIMEOUT=120s

APP_ID="6760291360"
REQ="f25db9b3-06e1-4442-a33b-98cf84224602"     # ONGOING analytics report request
OUT="$HOME/.motovault-aso"
LOG="$OUT/pull.log"
DONE_MARKER="$OUT/.captured"
mkdir -p "$OUT"

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*" >> "$LOG"; }

if [ -f "$DONE_MARKER" ]; then
  log "already captured funnel data (marker present) — skipping. Delete $DONE_MARKER to force."
  exit 0
fi

log "=== pull run start ==="
captured=0

# Try the last 6 processing dates (Apple lags 1-2 days; give a window).
for d in 1 2 3 4 5 6; do
  DATE=$(date -v-${d}d '+%Y-%m-%d')
  RAW="$OUT/view_${DATE}.json"
  asc analytics view --request-id "$REQ" --date "$DATE" --include-segments --paginate --output json > "$RAW" 2>>"$LOG"
  if ! grep -q '"data"' "$RAW" 2>/dev/null; then
    log "date $DATE: no instances yet ($(head -c 120 "$RAW" | tr '\n' ' '))"
    rm -f "$RAW"
    continue
  fi
  log "date $DATE: instances found -> $RAW"
  # Defensive parse: pull instance-id + segment-id + download URL for the two funnel reports.
  python3 - "$RAW" "$REQ" "$OUT" "$DATE" <<'PY' >> "$LOG" 2>&1
import sys, json, subprocess, os
raw, req, outdir, date = sys.argv[1:5]
d = json.load(open(raw))
items = d.get("data", [])
want = {"discovery and engagement": "engagement", "app downloads": "downloads"}
for it in items:
    name = (it.get("name") or it.get("attributes", {}).get("name") or "").lower()
    key = next((v for k, v in want.items() if k in name), None)
    if not key:
        continue
    # segments can live in several shapes; search recursively for a downloadUrl + ids.
    segs = it.get("segments") or it.get("attributes", {}).get("segments") or []
    inst = it.get("instanceId") or it.get("id")
    for s in segs:
        seg_id = s.get("id") or s.get("segmentId")
        url = s.get("url") or s.get("downloadUrl") or (s.get("attributes", {}) or {}).get("url")
        dest = os.path.join(outdir, f"{key}_{date}.csv")
        if url:
            subprocess.run(["curl", "-s", "-L", "-o", dest + ".gz", url])
            subprocess.run(["gunzip", "-f", dest + ".gz"])
            print(f"  downloaded {key} via url -> {dest}")
        elif inst and seg_id:
            subprocess.run(["asc", "analytics", "download", "--request-id", req,
                            "--instance-id", inst, "--segment-id", seg_id,
                            "--decompress", "--output", dest], check=False)
            print(f"  downloaded {key} via asc download -> {dest}")
PY
  # Consider captured if we now have an engagement CSV for this date.
  if ls "$OUT"/engagement_*.csv >/dev/null 2>&1; then captured=1; fi
done

if [ "$captured" -eq 1 ]; then
  touch "$DONE_MARKER"
  log "SUCCESS: funnel data captured into $OUT (engagement_*.csv / downloads_*.csv). Marker set."
else
  log "no funnel data yet — will retry on next scheduled run."
fi
log "=== pull run end ==="
