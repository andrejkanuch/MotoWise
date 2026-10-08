# Code-only confirmation for app signups: verification

Date: 2026-10-08. This tests one approach: app signups get an email with only a code, and web signups keep the link, using a single Supabase "Confirm signup" template. "Verified" means read in Supabase Auth server source (`supabase/auth` `master`, fetched 2026-10-08), the installed `@supabase/auth-js` 2.108.2, Supabase docs, or the production auth config (Management API, 2026-10-08).

## Verdict

The approach is sound. Every piece it depends on is verified. The plan has to account for three constraints, listed at the end.

## Findings

1. **The template can branch per signup source.** Verified.
   - Templates are Go `html/template` (`internal/mailer/templatemailer/template.go`, `template.New("").Parse`, no custom funcs), so the built-in `eq` and `if/else` work. The docs show `{{ if eq .Data.Domain "..." }}` in "Conditionally render email content".
   - `ConfirmationMail` passes `RedirectTo: referrerURL`, `Token: otp`, `Data: user.UserMetaData` (`templatemailer.go:223-240`).
   - `referrerURL` comes from `utilities.GetReferrer` (`internal/utilities/request.go:75-89`). It is the request's `redirect_to` when that URL is allow-listed, otherwise the Referer header, otherwise **`SiteURL`**.
   - Mobile already sends `https://motovault.app/auth/callback?redirect=motovault://auth/callback`, which is allow-listed in prod. So `{{ if eq .RedirectTo "<that string>" }}` identifies app requests exactly.
   - Branch on `.RedirectTo`, not `.Data`. `.RedirectTo` describes the client that asked for *this* email, so an app signup that later resends from the web still gets a link. `.Data` is fixed on the user at signup.

2. **A typed code confirms a signup and signs the rider in.** Verified.
   - In `verify.go:739-743`, `type: 'email'` checks the code against `ConfirmationToken` and treats a match as `SignupVerification`.
   - The client call is `verifyOtp({ email, token, type: 'email' })`. `EmailOtpType` includes `'email'` in auth-js 2.108.2 (`types.d.ts:693`).
   - It involves no PKCE verifier, no browser and no deep link.

3. **The code already sits behind today's link.** Verified.
   - `sendConfirmation` (`internal/api/mail.go:323-353`) generates `otp` and stores `ConfirmationToken = GenerateTokenHash(email, otp)`. The link carries that hash.
   - Showing the code therefore opens **no new attack surface**: whoever can guess the 6 digits could already build the link.
   - `/verify` is limited to 30 requests per 5 min per IP (Supabase rate-limits docs). Expiry is 3600 s in prod.

4. **Each send replaces the previous code.** Verified.
   - `sendConfirmation` generates a fresh `otp` every time, and `validateSentWithinFrequencyLimit` blocks a second send within `max_frequency` (60 s) with `over_email_send_rate_limit`.
   - `resend({ type: 'signup' })` checks `user.IsConfirmed()` first (`resend.go:101-102`) and accepts `options.emailRedirectTo` (`types.d.ts:694-702`).
   - Signing up again with an unconfirmed email re-sends too (`signup.go:228-250`).

5. **An unconfirmed rider who signs in gets a specific error code.** Verified: auth-js `ErrorCode` includes `email_not_confirmed`. The app can route that rider to the code step, using resend plus the code.

6. **Production values.** Verified via the Management API: `mailer_otp_length = 6` and `mailer_otp_exp = 3600`. Local `supabase/config.toml` has `otp_length = 8`, which should be aligned to 6.

7. **Code auto-fill.** Partly verified.
   - iOS 17+ suggests codes "From Mail" above the keyboard for fields marked `textContentType="oneTimeCode"`. It is documented for Apple Mail; Gmail and other third-party clients are unconfirmed.
   - Android has no email-code auto-fill, so the field must accept paste.
   - Both need a device test.

## Constraints for the plan

1. **Every app auth email must carry the same redirect.** That means `signUp` at all three call sites and every `resend`. Otherwise `GetReferrer` falls back to `SiteURL` and the rider gets the link-only email. Keep the value in one shared constant, matched character for character in the template.
2. **Copy must point riders at the newest email.** Each resend invalidates the previous code.
3. **Shipping order.**
   - Template first: app emails become code-only right away, and today's app has no code field.
   - App first: emails still carry only the broken link.
   - So the switch has to be timed. Either ship the app update first and switch the template once it is live, or let the app branch show **both** code and link during the transition. The link in the app branch is only as good as today's link, but it is no worse.
