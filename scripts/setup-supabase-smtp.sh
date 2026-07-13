#!/usr/bin/env bash
#
# Configure Supabase Auth custom SMTP (Resend) for the production project.
#
# WHY: Supabase's built-in email service is rate-limited and unsuitable for
# production, so signup-confirmation / password-reset emails may never arrive.
# This points Auth at Resend (domain motovault.app is verified there).
#
# This is a SURGICAL partial PATCH — it only sets the smtp_* fields and leaves
# email templates, redirect URLs, and every other auth setting untouched.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx \
#   RESEND_SMTP_PASSWORD=re_xxx \
#   bash scripts/setup-supabase-smtp.sh
#
#   - SUPABASE_ACCESS_TOKEN: personal access token
#       https://supabase.com/dashboard/account/tokens
#   - RESEND_SMTP_PASSWORD:  your Resend API key (the SMTP password is the key)
#
set -euo pipefail

PROJECT_REF="tpsoneenbrmdwvzcbifw"

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens}"
: "${RESEND_SMTP_PASSWORD:?Set RESEND_SMTP_PASSWORD — your Resend API key}"

echo "Configuring custom SMTP (Resend) for project ${PROJECT_REF}…"

http_code=$(curl -sS -o /tmp/smtp-patch-resp.json -w '%{http_code}' \
  -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @- <<JSON
{
  "smtp_admin_email": "noreply@motovault.app",
  "smtp_host": "smtp.resend.com",
  "smtp_port": "465",
  "smtp_user": "resend",
  "smtp_pass": "${RESEND_SMTP_PASSWORD}",
  "smtp_sender_name": "MotoVault"
}
JSON
)

if [[ "${http_code}" == "200" ]]; then
  echo "✅ SMTP configured. Test by signing up with a brand-new email address."
else
  echo "❌ Failed (HTTP ${http_code}). Response:"
  cat /tmp/smtp-patch-resp.json
  exit 1
fi
