#!/usr/bin/env bash
# Preflight for screenshot capture: refuse unless the installed app can send NOTHING to
# RevenueCat, PostHog or Meta, and cannot pull a production OTA. capture_market.sh runs this
# first and stops on any failure.
#
#   capture/preflight.sh <UDID> [--static-only] [--smoke-seconds 45]
#
# (a) STATIC, on the installed .app (and on Metro's bundle if one is running on :8081):
#     - no RevenueCat public key (appl_/goog_ prefix, or the exact values from apps/mobile/.env*)
#     - no PostHog project key (phc_ prefix, or the exact value) in the JS bundle or app.config
#     - no FacebookAppID / FacebookClientToken in Info.plist (Meta SDK not linked in)
#     - Expo.plist EXUpdatesEnabled = false (a production OTA would bring the keys back)
#     Secret values are compared, never printed.
# (b) NETWORK SMOKE: launch the app, sample the app process's sockets with lsof once a second
#     for N seconds, and fail if any remote address is one the blocked hosts resolve to. Also
#     scans the unified log of the app process for the blocked host names. Chosen over an
#     /etc/hosts sinkhole because that needs sudo and the owner's approval (RUNBOOK §5a); the
#     sinkhole is the stronger option and can be added on top.
#     Limits: a socket that opens and closes between two samples can be missed, and a CDN
#     address shared with an unrelated host fails safe (false alarm). (a) is the primary gate.
set -euo pipefail

UDID="${1:?usage: preflight.sh <UDID> [--static-only] [--smoke-seconds N]}"
shift
STATIC_ONLY=false
SMOKE=45
while [[ $# -gt 0 ]]; do
  case "$1" in
    --static-only) STATIC_ONLY=true; shift ;;
    --smoke-seconds) SMOKE="$2"; shift 2 ;;
    *) echo "unknown arg $1" >&2; exit 2 ;;
  esac
done

APP_ID=com.motovault.app
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
REPORT="$HERE/../out/preflight-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$REPORT")"
BLOCKED_HOSTS=(api.revenuecat.com api-paywalls.revenuecat.com api-diagnostics.revenuecat.com
  eu.i.posthog.com us.i.posthog.com eu-assets.i.posthog.com us-assets.i.posthog.com
  graph.facebook.com graph.instagram.com connect.facebook.net)
fail=0
note() { echo "$*" | tee -a "$REPORT"; }
bad() { note "FAIL: $*"; fail=1; }

APP="$(xcrun simctl get_app_container "$UDID" "$APP_ID" app 2>/dev/null || true)"
[[ -d "$APP" ]] || { note "FAIL: $APP_ID is not installed on $UDID"; exit 1; }
note "app: $APP"

# ---- (a) static ------------------------------------------------------------------------
# The exact-value check needs the real keys. They live in apps/mobile/.env* of whichever tree has
# them: the build tree (APP_TREE), this checkout, or the repo's main worktree (git worktree list).
MAIN_TREE="$(git -C "$REPO" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')"
ENV_TREES="${PREFLIGHT_ENV_DIRS:-${APP_TREE:-} $REPO $MAIN_TREE}"
python3 - "$APP" "$ENV_TREES" >>"$REPORT" 2>&1 <<'PY' || fail=1
import os, plistlib, re, sys, urllib.request
from pathlib import Path
app = Path(sys.argv[1])
trees = list(dict.fromkeys(Path(t).resolve() for t in sys.argv[2].split() if t))
secrets = {}
for envf in sorted(f for t in trees for f in (t / "apps/mobile").glob(".env*")):
    if envf.name.endswith(".example"):
        continue
    for line in envf.read_text(errors="ignore").splitlines():
        m = re.match(r"\s*(EXPO_PUBLIC_RC_IOS_KEY|EXPO_PUBLIC_RC_ANDROID_KEY|POSTHOG_API_KEY|EXPO_PUBLIC_POSTHOG_KEY|"
                     r"EXPO_PUBLIC_META_APP_ID|EXPO_PUBLIC_META_CLIENT_TOKEN)\s*=\s*['\"]?([^'\"#\s]+)", line)
        if m and len(m.group(2)) >= 6:
            secrets.setdefault(m.group(1), set()).add(m.group(2))
if not secrets:
    # Without the real values only the key-prefix regexes below would run, and a key in another
    # format (Meta app id, a custom PostHog host key) would pass unseen. Fail closed instead.
    print("FAIL: no RC/PostHog/Meta value found in apps/mobile/.env* of: " + ", ".join(map(str, trees))
          + " (set PREFLIGHT_ENV_DIRS to the tree that holds .env.production)"); sys.exit(1)
print("exact-value check uses " + ", ".join(sorted(secrets)) + " from " + ", ".join(map(str, trees)))
patterns = {"RevenueCat iOS key": rb"appl_[A-Za-z0-9]{16,}", "RevenueCat Android key": rb"goog_[A-Za-z0-9]{16,}",
            "PostHog project key": rb"phc_[A-Za-z0-9]{20,}"}
blobs = {}
for p in [app / "main.jsbundle", app / "EXConstants.bundle" / "app.config", app / "app.config"]:
    if p.exists():
        blobs[str(p.relative_to(app))] = p.read_bytes()
for p in app.rglob("*.hbc"):
    blobs[str(p.relative_to(app))] = p.read_bytes()
try:  # a Metro dev server, if the capture runs on a dev client
    with urllib.request.urlopen("http://localhost:8081/index.bundle?platform=ios&dev=false&minify=false", timeout=60) as r:
        blobs["metro:index.bundle"] = r.read()
except Exception:
    pass
if not blobs:
    print("FAIL: no JS bundle found in the app and no Metro server on :8081"); sys.exit(1)
failed = False
for name, data in blobs.items():
    hits = [f"{label} pattern" for label, rx in patterns.items() if re.search(rx, data)]
    hits += [f"the value of {var} from apps/mobile/.env*" for var, vals in secrets.items()
             if any(v.encode() in data for v in vals)]
    for h in hits:
        print(f"FAIL: {h} is in {name}")
    failed |= bool(hits)
    if not hits:
        print(f"ok: {name} ({len(data)//1024} KB) carries no RC/PostHog/Meta key")
info = plistlib.loads((app / "Info.plist").read_bytes())
for k in ("FacebookAppID", "FacebookClientToken"):
    if info.get(k):
        print(f"FAIL: Info.plist {k} is set (Meta SDK configured)"); failed = True
expo = next(iter(app.rglob("Expo.plist")), None)
if expo is None:
    print("FAIL: Expo.plist not found, cannot prove expo-updates is off"); failed = True
else:
    ep = plistlib.loads(expo.read_bytes())
    if ep.get("EXUpdatesEnabled", True) is not False:
        print(f"FAIL: {expo.relative_to(app)} EXUpdatesEnabled is not false (a production OTA could load)"); failed = True
    else:
        print("ok: expo-updates disabled")
print("static:", "FAIL" if failed else "PASS")
sys.exit(1 if failed else 0)
PY
grep -E "^(FAIL|ok|static)" "$REPORT" | tail -20
[[ $fail -eq 0 ]] || { echo "preflight FAILED (static). Report: $REPORT" >&2; exit 1; }
$STATIC_ONLY && { note "network smoke skipped (--static-only)"; exit 0; }

# ---- (b) network smoke -----------------------------------------------------------------
BLOCKED_IPS="$(python3 - "${BLOCKED_HOSTS[@]}" <<'PY'
import socket, sys
ips = set()
for h in sys.argv[1:]:
    try:
        ips |= {ai[4][0] for ai in socket.getaddrinfo(h, 443)}
    except OSError:
        pass
print(" ".join(sorted(ips)))
PY
)"
note "blocked hosts resolve to $(wc -w <<<"$BLOCKED_IPS") addresses"
xcrun simctl terminate "$UDID" "$APP_ID" >/dev/null 2>&1 || true
LOGF="$(mktemp)"
EXE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist")"
log stream --style compact --predicate "process == \"$EXE\"" >"$LOGF" 2>/dev/null &
LOGPID=$!
xcrun simctl launch "$UDID" "$APP_ID" >/dev/null
sleep 3
PID="$(xcrun simctl spawn "$UDID" launchctl list | awk -v id="UIKitApplication:$APP_ID" 'index($3,id)==1 {print $1; exit}')"
[[ "$PID" =~ ^[0-9]+$ ]] || { kill $LOGPID 2>/dev/null; bad "could not find the app's pid"; exit 1; }
note "smoke: pid $PID, sampling sockets for ${SMOKE}s"
SEEN="$(mktemp)"
for _ in $(seq 1 "$SMOKE"); do
  lsof -nP -a -i -p "$PID" 2>/dev/null | awk 'NR>1 && $9 ~ /->/ {split($9,a,"->"); print a[2]}' >>"$SEEN" || true
  sleep 1
done
kill $LOGPID 2>/dev/null || true
sort -u "$SEEN" | tee -a "$REPORT" >/dev/null
for ip in $BLOCKED_IPS; do
  if grep -q -F "$ip:" "$SEEN" || grep -q -F "[$ip]:" "$SEEN"; then bad "app connected to $ip (a RevenueCat/PostHog/Meta address)"; fi
done
for h in "${BLOCKED_HOSTS[@]}"; do
  if grep -q -F "$h" "$LOGF"; then bad "unified log mentions $h for the app process"; fi
done
rm -f "$SEEN" "$LOGF"
[[ $fail -eq 0 ]] && note "preflight PASS ($(date))" || { echo "preflight FAILED. Report: $REPORT" >&2; exit 1; }
