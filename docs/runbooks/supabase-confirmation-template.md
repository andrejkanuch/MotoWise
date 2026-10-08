# Runbook: Supabase confirmation email template (production)

Applies `supabase/templates/confirmation.html` and the confirmation subject from
`supabase/config.toml` (`[auth.email.template.confirmation]`) to the production
project `tpsoneenbrmdwvzcbifw` through the Supabase Management API.

Plan: `docs/plans/2026-10-08-1038-fix-email-signup-code-confirmation-plan.md` (U6, KTD1, KTD3, KTD10).

## What the template does

The template branches on `.RedirectTo`:

- `.RedirectTo` equals `https://motovault.app/auth/callback?redirect=motovault://auth/callback`
  (the app constant in `apps/mobile/src/config/auth.ts`, matched byte for byte) → the
  app email: the 6-digit `{{ .Token }}`, "valid for 1 hour", "use the newest email",
  and a small fallback `{{ .ConfirmationURL }}` link for older app versions.
  Subject: `Your MotoVault code: <code>`.
- Anything else (web signup, web resend, a missing or non-allow-listed `redirect_to`,
  which falls back to `SiteURL`) → today's link email, unchanged. Subject: `Confirm Your Signup`.

If the app constant ever changes, change it in the template **and** in the subject
in `config.toml` in the same PR, then re-run this runbook.

## Ship order (KTD3)

1. **Template first** (this runbook).
2. **Then** the app release (store build or OTA), with the owner's go-ahead.

Template first gives old apps a code they cannot type, but the same fallback link
as today, so they are no worse off. App first would show a code field with no code
in the inbox.

## Prerequisites

- `curl`, `jq`, `python3`.
- Management API token from the macOS keychain (the Supabase CLI login). Load it
  into a variable; **never echo or print it**:

```bash
export SUPABASE_ACCESS_TOKEN="$(security find-generic-password -s "Supabase CLI" -a supabase -w | sed 's/^go-keyring-base64://' | base64 -d)"
export REF=tpsoneenbrmdwvzcbifw
export API="https://api.supabase.com/v1/projects/$REF/config/auth"
export SNAP_DIR="$HOME/.motovault-ops/auth-template-$(date +%Y%m%d-%H%M%S)"   # outside the repo
mkdir -p "$SNAP_DIR"
```

Run every command below from the repo root.

## 1. Snapshot the current production values

```bash
curl -sf "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | jq '{mailer_subjects_confirmation, mailer_templates_confirmation_content}' \
  > "$SNAP_DIR/before.json"

jq -r '.mailer_subjects_confirmation' "$SNAP_DIR/before.json"
jq -r '.mailer_templates_confirmation_content' "$SNAP_DIR/before.json"
```

Expected today: subject `Confirm Your Signup`, body:

```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

If the body differs from that, **stop**: the template's else-branch reproduces this
exact body, and a different production body means someone changed it out of band.
Update the else-branch in the repo first.

`before.json` is the rollback payload. Keep it until the change has been live for a
few days.

## 2. Owner approval gate

Do not continue without the owner's explicit go-ahead at this moment. Show them
`before.json` and the repo diff of `supabase/templates/confirmation.html`.

## 3. PATCH both fields from the repo files

Build the payload from the repo, so the HTML is JSON-encoded exactly (no hand copying):

```bash
python3 - <<'PY' > "$SNAP_DIR/patch.json"
import json, tomllib
cfg = tomllib.load(open("supabase/config.toml", "rb"))
tpl = cfg["auth"]["email"]["template"]["confirmation"]
print(json.dumps({
    "mailer_subjects_confirmation": tpl["subject"],
    "mailer_templates_confirmation_content": open("supabase/templates/confirmation.html", encoding="utf-8").read(),
}))
PY
```

(jq alternative for the body alone:
`jq -n --rawfile c supabase/templates/confirmation.html --arg s "$SUBJECT" '{mailer_subjects_confirmation:$s, mailer_templates_confirmation_content:$c}'`.)

```bash
curl -sf -X PATCH "$API" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @"$SNAP_DIR/patch.json" \
  | jq '{mailer_subjects_confirmation}'
```

## 4. Read back and diff against the repo

```bash
curl -sf "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | jq '{mailer_subjects_confirmation, mailer_templates_confirmation_content}' \
  > "$SNAP_DIR/after.json"

cmp <(jq -j '.mailer_templates_confirmation_content' "$SNAP_DIR/after.json") supabase/templates/confirmation.html \
  && echo "BODY MATCHES"
diff <(jq -r '.mailer_subjects_confirmation' "$SNAP_DIR/after.json") \
     <(jq -r '.mailer_subjects_confirmation' "$SNAP_DIR/patch.json") \
  && echo "SUBJECT MATCHES"
```

(`jq -j` prints the body without adding a newline, so `cmp` is byte exact.)

Both must print `MATCHES`. Otherwise roll back (step 5).

## 5. Rollback

PATCH the snapshot back:

```bash
curl -sf -X PATCH "$API" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @"$SNAP_DIR/before.json" \
  | jq '{mailer_subjects_confirmation}'
```

Then read back as in step 4, diffing against `before.json`.

## 6. Verify in production

Use fresh addresses you control (e.g. `+alias` addresses), then delete the test users.

1. **App signup**: sign up with email from the app. Its `redirect_to` is the app
   constant. The email subject is `Your MotoVault code: NNNNNN`, the body shows the
   6-digit code, "valid for 1 hour", the newest-email line, and the small fallback link.
   Before the new app is out, tap the fallback link and confirm the old behaviour
   (web callback, then sign in in the app) still works.
2. **Web signup**: sign up on https://motovault.app/signup. The email is unchanged:
   subject `Confirm Your Signup`, the original link body.
3. After the app release: enter the code in the app and confirm the rider lands back in
   onboarding signed in, and `email_code_sent` / `email_code_verified` arrive in PostHog.

## Local parity

`supabase/config.toml` wires the same file locally (`content_path` is relative to the
project root) and sets `otp_length = 6` to match production (`mailer_otp_length = 6`,
`mailer_otp_exp = 3600`). With `npx supabase start`, sign up via
`POST http://127.0.0.1:54321/auth/v1/signup?redirect_to=<url-encoded constant>` and read
the email in Mailpit at http://127.0.0.1:54324. A `redirect_to` of any other allow-listed
URL, or none, renders the link email.
