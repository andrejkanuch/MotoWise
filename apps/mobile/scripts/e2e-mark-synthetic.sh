#!/bin/sh
# Sourced by the E2E runners (run-onboarding-e2e.sh, run-onboarding-email-code-e2e.sh): marks the
# account a run created as synthetic (public.users.is_synthetic = true) as soon as it exists, so the
# #365 metrics leave it out even when teardown fails or TEST_EMAIL keeps the account
# (docs/research/activation-365/queries/q00-excluded-persons.md).
#
# Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the runner's own values, which must match the
# build under test: production by default, or a local stack via the SUPABASE_URL override). The
# column has no client grant (00197), so only the service role can set it; this touches only the
# row of the test account the runner itself created.
#
# Usage (after sourcing):  mark_synthetic <user id>   # non-zero exit when the row was not updated

E2E_SYNTHETIC_FLAG_BODY='{"is_synthetic":true}'

mark_synthetic() { # mark_synthetic USER_ID
  _ms_user=$1
  # return=representation: a filter that matches no row returns [] instead of a silent 204.
  _ms_resp=$(curl -sS --fail-with-body --max-time 15 -X PATCH \
    "$SUPABASE_URL/rest/v1/users?id=eq.$_ms_user&select=id,is_synthetic" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d "$E2E_SYNTHETIC_FLAG_BODY") || { echo "  mark_synthetic: request failed: $_ms_resp"; return 1; }
  if printf '%s' "$_ms_resp" | jq -e --arg id "$_ms_user" 'length == 1 and .[0].id == $id and .[0].is_synthetic == true' >/dev/null; then
    echo "  marked user $_ms_user is_synthetic=true"
  else
    echo "  mark_synthetic: public.users row not updated for $_ms_user. Response: $_ms_resp"
    return 1
  fi
}
