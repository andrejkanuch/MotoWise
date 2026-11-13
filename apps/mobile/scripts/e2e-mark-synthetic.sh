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
# Teardown deletes the auth user, and with it the public.users row, so is_synthetic alone cannot
# exclude a deleted account. mark_synthetic therefore also appends the user id (the PostHog
# distinct_id after identify) to a local ledger outside the repo, E2E_USER_LOG (default
# $HOME/.motovault-local/e2e-users.log, one tab-separated line: UTC time, user id, Supabase host).
# q00-excluded-persons.md builds {E2E_PERSONS} from it. Ids only, never the test email.
#
# Usage (after sourcing):  mark_synthetic <user id>   # non-zero exit when the row was not updated

E2E_SYNTHETIC_FLAG_BODY='{"is_synthetic":true}'
E2E_USER_LOG=${E2E_USER_LOG:-$HOME/.motovault-local/e2e-users.log}

record_e2e_user() { # record_e2e_user USER_ID — never fails the run
  _re_host=$(printf '%s' "$SUPABASE_URL" | sed -E 's#^[a-z]+://([^/]+).*#\1#')
  { mkdir -p "$(dirname "$E2E_USER_LOG")" &&
    printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$_re_host" >>"$E2E_USER_LOG"; } 2>/dev/null ||
    echo "  warning: could not append $1 to $E2E_USER_LOG — add it by hand for the #365 exclusion"
}

mark_synthetic() { # mark_synthetic USER_ID
  _ms_user=$1
  record_e2e_user "$_ms_user"
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
