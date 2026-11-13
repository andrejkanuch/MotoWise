#!/bin/sh
# Sourced by run-onboarding-e2e.sh (issue 365 T08, FS-PO2a). Opt-in with
# E2E_SEED_DIAGNOSIS_USED=1: inserts one content_generation_log success row
# (content_type 'diagnostic') for the run's test user, so the server counts this
# month's free diagnosis as used and answers submitDiagnostic with FORBIDDEN.
#
# LOCAL STACK ONLY. It writes with the service role, so it refuses any
# SUPABASE_URL that is not the local Supabase (127.0.0.1 / localhost / 10.0.2.2).
# The build under test must talk to the same stack
# (features/bike-detail-shell-overview/local-stack.md).
#
# Usage (after sourcing):
#   seed_diagnosis_used <user id>     # non-zero exit when the row was not inserted
#   unseed_diagnosis_used <user id>   # teardown; never fails the run

E2E_SEED_LOG_TABLE=content_generation_log

e2e_supabase_is_local() {
  case "$SUPABASE_URL" in
    http://127.0.0.1:* | http://localhost:* | http://10.0.2.2:*) return 0 ;;
    *) return 1 ;;
  esac
}

seed_diagnosis_used() { # seed_diagnosis_used USER_ID
  if ! e2e_supabase_is_local; then
    echo "  seed_diagnosis_used: refusing to seed a non-local SUPABASE_URL ($SUPABASE_URL)"
    return 1
  fi
  _sd_body=$(jq -n --arg u "$1" '{user_id:$u, content_type:"diagnostic", status:"success"}')
  _sd_resp=$(curl -sS --fail-with-body --max-time 15 -X POST \
    "$SUPABASE_URL/rest/v1/$E2E_SEED_LOG_TABLE?select=id" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d "$_sd_body") || { echo "  seed_diagnosis_used: request failed: $_sd_resp"; return 1; }
  if printf '%s' "$_sd_resp" | jq -e 'length == 1' >/dev/null; then
    echo "  seeded a used diagnosis for $1"
  else
    echo "  seed_diagnosis_used: unexpected response: $_sd_resp"
    return 1
  fi
}

unseed_diagnosis_used() { # unseed_diagnosis_used USER_ID
  e2e_supabase_is_local || return 0
  curl -sS --max-time 15 -X DELETE \
    "$SUPABASE_URL/rest/v1/$E2E_SEED_LOG_TABLE?user_id=eq.$1" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    >/dev/null 2>&1 || echo "  warning: could not delete the seeded diagnosis rows of $1"
}
