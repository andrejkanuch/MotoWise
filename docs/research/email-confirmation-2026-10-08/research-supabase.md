# Email confirmation strands mobile riders: options research

Date: 2026-10-08. Read-only research. "Verified" means checked against a primary source (Supabase docs, the supabase/auth PR, or the installed `@supabase/auth-js` 2.108.2 source in `node_modules/@supabase/auth-js/dist/module`). Anything else is marked **unverified**.

## 0. Repo facts (verified by reading the code)

- Mobile client: `apps/mobile/src/lib/supabase.ts:14-24`. It sets no `flowType`, so it uses the auth-js default (`implicit`) with `detectSessionInUrl: false`, and storage is `secureStoreAuthAdapter` (`apps/mobile/src/lib/secure-store.ts:329-337`, keychain with AFTER_FIRST_UNLOCK). The comment at `secure-store.ts:56-59` already expects "the PKCE verifier" to pass through this adapter.
- Three mobile `signUp` call sites use the same `emailRedirectTo: 'https://motovault.app/auth/callback?redirect=motovault://auth/callback'`. The brief named two; there is a third:
  - `apps/mobile/src/app/(onboarding)/account.tsx:156-163`
  - `apps/mobile/src/app/(auth)/register.tsx:41-47`
  - `apps/mobile/src/components/account-prompt-sheet.tsx:117-124`. **This one was missing from the brief.**
- After signup the mobile UI shows `Alert(auth.checkEmail, auth.confirmationSent)` (`account.tsx:178`, `register.tsx:52`, `account-prompt-sheet.tsx:130`). The copy is "We sent a confirmation link…" (`apps/mobile/src/i18n/locales/en.json:44-45`). There is no resend button and no code entry anywhere on mobile: grep finds no `auth.resend`, `verifyOtp` or "Email not confirmed" handling in `apps/mobile/src`. `signInWithPassword` (`(auth)/login.tsx:39`, `(onboarding)/sign-in.tsx:86`) gives no special message for an unconfirmed email.
- `register.tsx:51` fires `USER_SIGNED_UP` before confirmation. `account.tsx` does not. This is an analytics inconsistency, separate from this bug.
- Deep-link handler: `apps/mobile/src/app/_layout.tsx:724-748`. It handles only `motovault://auth/callback?code=` and calls `exchangeCodeForSession`. It ignores `#access_token`, `token_hash` and `error_description`.
- Web callback: `apps/web/src/app/auth/callback/route.ts:8-21`. With no `?code` it redirects to `/login` (line 11-13). A `motovault://` redirect gets a blind 302 to the custom scheme (line 17-21), even on a desktop.
- Web uses `createBrowserClient` from `@supabase/ssr` (`apps/web/src/lib/supabase-browser.ts`), which defaults to PKCE (**unverified**: the @supabase/ssr default was not re-checked in its docs). Web signup (`apps/web/src/app/signup/page.tsx:79-90`) and resend (`signup/page.tsx:138`, `login/page.tsx:101`, `components/auth-modal.tsx:110`) depend on the **same "Confirm signup" template** returning a `?code=` to `/auth/callback`. **Any template change hits web and mobile together.**
- Password reset happens **only on the web**: `apps/web/src/app/forgot-password/page.tsx:27-28` → `/auth/callback?redirect=/reset-password` → `apps/web/src/app/reset-password/`. Mobile has no `resetPasswordForEmail`, even though the `_layout.tsx:724` comment mentions password reset.
- Local `supabase/config.toml:33-38` has `enable_confirmations = true`, `max_frequency = "1m0s"`, `otp_length = 8`, `otp_expiry = 3600`. **Prod values are unverified.** `scripts/setup-supabase-smtp.sh` only PATCHes SMTP, so prod templates, OTP length and expiry live only in the dashboard. Prod sends through Resend custom SMTP.
- No crypto polyfill on mobile: `apps/mobile/index.ts` has none, and `expo-crypto` is used directly but not installed as `globalThis.crypto`. auth-js `generatePKCEVerifier` / `generatePKCEChallenge` (`lib/helpers.js:206-240`) fall back to a `Math.random` verifier and the `plain` challenge method when `crypto` / `crypto.subtle` are missing. Whether Hermes in Expo 57 exposes `globalThis.crypto.subtle` is **unverified**.

## 1. Option (a): PKCE on mobile

**Config.** Add one line in `apps/mobile/src/lib/supabase.ts`:

```ts
auth: { storage: secureStoreAuthAdapter, autoRefreshToken: true, persistSession: true,
        detectSessionInUrl: false, flowType: 'pkce' }
```

The verifier is stored automatically. In PKCE mode, `signUp` calls `getCodeChallengeAndMethod(this.storage, this.storageKey)`, which writes `${storageKey}-code-verifier` through the configured storage (verified: `GoTrueClient.js:692-694`, `helpers.js:241-251`). For us that is the keychain adapter, so no extra code is needed. `resend`, `resetPasswordForEmail`, `signInWithOtp`, `updateUser({email})` and `signInWithOAuth` all do the same (verified: `GoTrueClient.js:2200, 3648-3650, 2784, 1779`). The recovery verifier is suffixed `/recovery`.

**Flow.** The email link is still `{{ .ConfirmationURL }}`. Supabase `/verify` redirects to `redirect_to?code=…`. The existing web route forwards `code` to `motovault://auth/callback?code=…`, and the existing `_layout.tsx:734` exchange works. **The template does not change and web signup is untouched.** The auth code is valid for 5 minutes and can be exchanged once (verified: [PKCE flow docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow)).

**Different device or verifier missing.** Docs: "the code exchange must be initiated on the same browser and device where the flow was started" (verified, same page). `_exchangeCodeForSession` throws `AuthPKCECodeVerifierMissingError` when no verifier is stored (verified: `GoTrueClient.js:1543-1548`).
- Link opened on a desktop: the web route 302s to `motovault://` and the browser does nothing.
- The verifier is overwritten if the rider taps signUp/resend twice: only the last email works. It is also cleared by a reinstall.
- The email is probably already confirmed by `/verify` before the redirect. In that case the rider can still sign in with their password; they are just not auto-signed-in. **Unverified**: inferred from GoTrue behaviour and the [MakerKit cross-device write-up](https://makerkit.dev/docs/next-supabase-turbo/authentication-emails), not from a Supabase doc.
- **In-app mail browsers** (Gmail or Outlook webviews): the verifier sits in the app keychain, not in the browser, so it is *not* lost. The risk is only whether the webview follows a 302 to a custom scheme. Behaviour varies, and it often prompts or blocks (**unverified**).

**Password reset.** Unaffected: mobile has no reset flow, and web reset uses the web client.

**OAuth.** `signInWithIdToken` posts straight to `/token?grant_type=id_token` and never touches the verifier (verified: `GoTrueClient.js:1660-1673`). Apple and Google in `apps/mobile/src/lib/oauth.ts:140,179` are **unaffected**.

**Web callback changes needed.**
1. For `motovault://` redirects, return a small HTML interstitial ("Email confirmed. Open MotoVault" button plus "On another device? Open the app and sign in") instead of a blind 302. This fixes desktop and webview dead ends.
2. Handle `?error=…&error_description=…` (expired or used link) instead of always sending to `/login`.
3. App: catch `AuthPKCECodeVerifierMissingError` and other exchange errors in `_layout.tsx` and show "Email confirmed, please sign in" rather than only calling Sentry.

**Security.** PKCE also closes the custom-scheme interception risk. On Android any app can register `motovault://`, and a forwarded code is useless without the verifier.

**Crypto caveat.** Without `crypto` the challenge is `plain`. It still works, but PKCE then gives less protection against interception. Fix: `import 'react-native-get-random-values'` plus a SHA-256 polyfill, or verify that Hermes has `crypto.subtle` (**unverified**).

## 2. Option (b): in-app OTP code

- **Template.** Add `{{ .Token }}` to the "Confirm signup" template. Docs: "`{{ .Token }}` Contains a 6-digit One-Time-Password (OTP)"; `{{ .TokenHash }}` is a hashed version of it (verified: [email templates](https://supabase.com/docs/guides/auth/auth-email-templates)). The docs suggest exactly this to work around link-prefetching scanners: "Include `{{ .Token }}`… direct users to a custom page where they manually enter the OTP".
- **Link and code in one template.** The template is free HTML, so `{{ .ConfirmationURL }}` and `{{ .Token }}` can both appear. Web keeps the link and mobile uses the code. Both carry the same single confirmation token, so whichever is used first wins. The docs recommend including `{{ .Token }}` but do not explicitly show both together (**partly unverified**).
- **Verify call.** `supabase.auth.verifyOtp({ email, token, type: 'email' })` returns a session (verified: [passwordless docs](https://supabase.com/docs/guides/auth/auth-email-passwordless)). Prefer `type: 'email'` over `'signup'`: supabase/auth [PR #885](https://github.com/supabase/auth/pull/885) added `email` because "it's impossible to tell whether the verification type should be set to 'signup' or 'magiclink'", and deprecated `signup`/`magiclink` (verified). With `type: 'email'` and `token_hash`, no email is needed. **No PKCE verifier is involved, so it works across devices and webviews.**
- **Length and expiry.**
  - Default 6 digits; local config has `otp_length = 8`.
  - Allowed range believed to be 6–10 (**unverified**).
  - Expiry defaults to 1 hour; values above 86400 s are discouraged (verified, passwordless docs).
  - Prod length and expiry are unknown; read them in the dashboard. The UI must not hard-code 6 digits.
- **Rate limits** (verified: [rate limits](https://supabase.com/docs/guides/auth/rate-limits)):
  - `/otp`: 60 s per user.
  - `/verify`: 30 requests per 5 min, burst 30.
  - Email sending: 2/h on built-in SMTP, configurable on custom SMTP. We use Resend; the prod value is unverified.
- **Resend.** `supabase.auth.resend({ type: 'signup', email })` (web already uses it: `auth-modal.tsx:110`). The 60 s `max_frequency` applies, so show a countdown.
- **Onboarding UX.** After `signUp` returns `user && !session`, keep the rider on `account.tsx`. Show "Enter the 6-digit code we sent to x@y" with an auto-filling code field (`textContentType="oneTimeCode"` on iOS) and a "Resend code" control (60 s cooldown). On success the session appears, `onAuthStateChange` fires, and the existing session effect advances (`account.tsx:~110-131`). Fire `USER_SIGNED_UP` on verify.
- **Same for `register.tsx` and `account-prompt-sheet.tsx`.** Extract a shared `EmailCodeVerify` component/hook. Also add "Email not confirmed" handling on sign-in (send a code there).
- **Web fallback.** Mobile signups that tap the link in the email still hit the broken implicit path, so also apply option (a) or a web fallback: route.ts with no code and `redirect=motovault://` → a "Enter the code in the app" page. Ideally do (a) and (b) together.

## 3. Option (c): turn confirmation off

**Consequences.**
- Typos create accounts the rider can never recover: no password reset reaches them.
- Fake or throwaway emails pass.
- Resend reputation drops from bounces.
- Marketing and receipt email is sent to unverified addresses.

**Pre-account takeover.** With autoconfirm, a password signup is "confirmed" immediately. Supabase auto-links a later Google or Apple sign-in with the same email to the existing user. An attacker who registers `victim@gmail.com` first therefore keeps password access to the account the victim later builds through Google. Supabase's own statement: "It would also be an insecure practice to automatically link an identity to a user with an unverified email address since that could lead to pre-account takeover attacks". With confirmation on, "Supabase Auth will remove any other unconfirmed identities linked to an existing user" (verified: [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)). Turning confirmation off removes exactly this protection. Apple private-relay emails make collisions rarer but not impossible.

**Supabase's stance.** Confirmation is "true by default" on hosted projects (verified: [passwords](https://supabase.com/docs/guides/auth/passwords)). No doc found recommends turning it off for production (**unverified**: absence of evidence).

**Effort.** A dashboard toggle plus copy changes. Not recommended.

## 4. Option (d): universal links / app links

**Exists today (verified).**
- `apps/web/src/app/.well-known/apple-app-site-association/route.ts` uses `apps/web/src/lib/aasa.ts:23-40`. Components cover `/t/*, /r/*, /ride/*, /routes/*, /route/*, /trips/*`; **no `/auth/*`**. It needs the `APPLE_TEAM_ID` env.
- `apps/web/src/app/.well-known/assetlinks.json/route.ts` needs `ANDROID_CERT_SHA256`.
- iOS `associatedDomains: ['applinks:motovault.app','applinks:www.motovault.app']` (`apps/mobile/app.config.ts:289`).
- Android `intentFilters` with `autoVerify` for `/t/ /r/ /ride/ /routes/ /route/` only (`app.config.ts:401-414`; `/trips/` is missing on Android).

**Limits.** Universal links do not fix the root cause on their own.
1. The email link is the Supabase `…supabase.co/auth/v1/verify` URL, which then redirects to motovault.app. iOS generally does not hand redirect hops to the app (**unverified**). Gmail and Outlook webviews often ignore universal links.
2. If the app did open, it would still need to read `#access_token` (implicit) or exchange a code (PKCE).

The robust version of (d) is a template link straight to `https://motovault.app/auth/confirm?token_hash={{ .TokenHash }}&type=email`:
- The app, via universal link or the web page's "Open app" button, calls `verifyOtp({ token_hash, type: 'email' })`. This needs no verifier and works across devices.
- The web page verifies server-side for desktop users. Use a button, not GET-time verification, so link scanners do not consume the token.

The Astro quickstart shows this template form (verified via Context7 `/supabase/supabase`). Costs:
- A native build for the Android intent filter.
- An Expo Router route or `+native-intent` handling (there is no `app/auth` route; `apps/mobile/src/app/` has no `+native-intent`).
- Web callback changes.
- A template change that **also rewrites web signup** (web must switch from `?code` to `token_hash` handling).

## 5. Effort and files per option

| Option | Effort | OTA-able | Files |
|---|---|---|---|
| (a) PKCE | ~0.5–1 day | Yes (JS only; runtime 3.21.0) plus a Vercel deploy | `apps/mobile/src/lib/supabase.ts` (flowType; optional crypto polyfill in `apps/mobile/index.ts` + package.json); `apps/mobile/src/app/_layout.tsx:724-748` (error → "email confirmed, sign in" UI; handle `error_description`); `apps/web/src/app/auth/callback/route.ts` (interstitial for `motovault://`, error params); new `apps/web/src/app/auth/open-app/page.tsx` (or HTML response); copy in 7 mobile locale files `apps/mobile/src/i18n/locales/*.json` plus web messages; tests for route + deep link |
| (b) OTP code | ~2–3 days | Yes, plus a dashboard template edit (prod, all template locales) | `apps/mobile/src/app/(onboarding)/account.tsx`, `apps/mobile/src/app/(auth)/register.tsx`, `apps/mobile/src/components/account-prompt-sheet.tsx`, `apps/mobile/src/app/(auth)/login.tsx` + `(onboarding)/sign-in.tsx` (unconfirmed → code), new shared `apps/mobile/src/components/email-code-verify.tsx` (+ hook), mobile locales ×7, analytics event constants (verify/resend), Supabase "Confirm signup" template (add `{{ .Token }}`, keep the link), Maestro onboarding flow in `apps/mobile/.maestro/` |
| (c) Disable | ~1 h | Dashboard plus copy | Dashboard toggle; copy in the 3 signup sites; `supabase/config.toml:34` for parity |
| (d) Universal links + token_hash | ~3–4 days plus a store build | No (Android intent filter, verify AASA) | `apps/web/src/lib/aasa.ts`, `apps/mobile/app.config.ts` (intentFilters), new mobile route/`+native-intent`, `_layout.tsx`, `apps/web/src/app/auth/callback/route.ts` + new `auth/confirm` route/page, web signup/resend (`signup/page.tsx`, `login/page.tsx`, `auth-modal.tsx`), Supabase template |

## 6. Recommendation

1. **Ship (a) PKCE now, by OTA.** It is a one-line client change plus error handling. The template and web signup stay untouched, `signInWithIdToken` is unaffected, and it fixes the common case: a rider on the same phone taps the link and lands signed in. Add the web interstitial so desktop and webview opens are no longer dead ends, and catch `AuthPKCECodeVerifierMissingError` with "Email confirmed, sign in". Before relying on PKCE's security benefit, verify the crypto situation (plain vs S256).
2. **Follow with (b) in onboarding.** Add `{{ .Token }}` alongside the existing link in the template and give `account.tsx` a code-entry state. This removes the context switch out of onboarding, which is the activation cliff the analytics keep pointing to. It works across devices and webviews and survives link-prefetch scanners. Use `type: 'email'` and `auth.resend({ type: 'signup' })`.
3. **Do not do (c):** it gives up the pre-account-takeover protection Supabase cites. **Defer (d):** it needs a store build and a web-signup rewrite, and on its own fixes less than (a) and (b).
4. Before any template edit, read the prod values for `mailer_otp_length` and `mailer_otp_exp` and the current template HTML via the Management API (**not read in this research**).
