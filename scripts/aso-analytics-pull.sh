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
# Verified downloads from THIS run only — the completion marker is set off this,
# never off pre-existing files (a stale/empty file must not look like success).
RUN_OK="$OUT/.run_ok"
rm -f "$RUN_OK"

# Try the last 6 processing dates (Apple lags 1-2 days; give a window). Each date
# is independent — we don't stop at the first hit, so a full window is preserved.
for d in 1 2 3 4 5 6; do
  DATE=$(date -v-${d}d '+%Y-%m-%d')
  RAW="$OUT/view_${DATE}.json"
  # Distinguish a CLI/auth failure (non-zero exit) from a legitimately-empty
  # result — a failed command must NOT fall through to the "no instances" path.
  if ! asc analytics view --request-id "$REQ" --date "$DATE" --include-segments --paginate --output json > "$RAW" 2>>"$LOG"; then
    log "date $DATE: 'asc analytics view' failed (see log above) — not treating as empty"
    rm -f "$RAW"
    continue
  fi
  if ! grep -q '"data"' "$RAW" 2>/dev/null; then
    log "date $DATE: no instances yet ($(head -c 120 "$RAW" | tr '\n' ' '))"
    rm -f "$RAW"
    continue
  fi
  log "date $DATE: instances found -> $RAW"
  # Defensive parse: pull instance-id + segment-id + download URL for the two funnel
  # reports. Each SEGMENT gets its own file (segment id in the name) so segments never
  # overwrite each other; Apple's exports are tab-delimited, so the extension is .tsv.
  # Only verified, non-empty downloads are appended to RUN_OK.
  python3 - "$RAW" "$REQ" "$OUT" "$DATE" "$RUN_OK" <<'PY' >> "$LOG" 2>&1
import sys, json, subprocess, os
raw, req, outdir, date, run_ok = sys.argv[1:6]
d = json.load(open(raw))
items = d.get("data", [])
want = {"discovery and engagement": "engagement", "app downloads": "downloads"}

def record_if_valid(path, label):
    # A download only counts if the file exists and is non-empty.
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(run_ok, "a") as f:
            f.write(path + "\n")
        print(f"  OK {label} -> {path} ({os.path.getsize(path)} bytes)")
        return
    print(f"  FAILED {label}: missing or empty -> {path}")

for it in items:
    name = (it.get("name") or it.get("attributes", {}).get("name") or "").lower()
    key = next((v for k, v in want.items() if k in name), None)
    if not key:
        continue
    # segments can live in several shapes; search for a downloadUrl + ids.
    segs = it.get("segments") or it.get("attributes", {}).get("segments") or []
    inst = it.get("instanceId") or it.get("id")
    for i, s in enumerate(segs):
        seg_id = s.get("id") or s.get("segmentId") or f"seg{i}"
        url = s.get("url") or s.get("downloadUrl") or (s.get("attributes", {}) or {}).get("url")
        dest = os.path.join(outdir, f"{key}_{date}_{seg_id}.tsv")
        label = f"{key}/{seg_id}"
        if url:
            gz = dest + ".gz"
            if subprocess.run(["curl", "-fsSL", "-o", gz, url]).returncode != 0:
                print(f"  FAILED {label}: curl error"); continue
            if subprocess.run(["gunzip", "-f", gz]).returncode != 0:
                print(f"  FAILED {label}: gunzip error"); continue
            record_if_valid(dest, f"{label} (url)")
        elif inst and seg_id:
            rc = subprocess.run(["asc", "analytics", "download", "--request-id", req,
                                 "--instance-id", inst, "--segment-id", seg_id,
                                 "--decompress", "--output", dest]).returncode
            if rc != 0:
                print(f"  FAILED {label}: asc download rc={rc}"); continue
            record_if_valid(dest, f"{label} (asc)")
PY
done

# Mark complete ONLY when this run verified at least one non-empty download.
if [ -s "$RUN_OK" ]; then
  touch "$DONE_MARKER"
  log "SUCCESS: $(wc -l < "$RUN_OK" | tr -d ' ') verified funnel file(s) captured into $OUT (engagement_*.tsv / downloads_*.tsv). Marker set."
  rm -f "$RUN_OK"
else
  log "no verified funnel data this run — will retry on next scheduled run."
fi
log "=== pull run end ==="
