# Email-confirmation stranding: research synthesis (2026-10-08)

## Problem (confirmed)

Production Supabase requires email confirmation (`mailer_autoconfirm: false`). The "Confirm signup" template uses `{{ .ConfirmationURL }}`. The mobile client runs the implicit flow: it sets no `flowType` and has `detectSessionInUrl: false`.

When a rider taps the link, Supabase verifies it and redirects to `https://motovault.app/auth/callback?redirect=motovault://auth/callback` with the session in the `#fragment`. The server route (`apps/web/src/app/auth/callback/route.ts`) cannot read the fragment. It finds no `?code=` and redirects to `/login`. The rider is stranded outside the app, so an email signup never reaches the onboarding paywall.

Three call sites are affected: `(onboarding)/account.tsx`, `(auth)/register.tsx` and `components/account-prompt-sheet.tsx`. None of them offers resend, code entry or a "please confirm" state.

Reports, each with primary-source citations:
- [Apple](research-apple.md): App Review Guidelines (June 2026 edition), HIG, developer docs
- [RevenueCat](research-revenuecat.md): identity, transfer behavior, restore
- [Supabase](research-supabase.md): PKCE, OTP, auto-confirm risks, universal links, and file:line references in this repo

## What each party allows

| | Apple | RevenueCat | Supabase / security |
|---|---|---|---|
| Account required before the paywall | Allowed. A synced garage is account-based (5.1.1(v)). Don't put a registration wall in front of non-personal content. | Fine; it's the cleanest order because the purchase lands on a known user. | n/a |
| Block until the email is confirmed | No rule against it. The real risk is **2.1 completeness**: a reviewer who hits today's broken link can reject. | Doesn't care whether the email is confirmed. A Supabase UUID is a valid App User ID. | Standard. |
| Let riders in (and buy) before confirming | Allowed. Account deletion must still work for unconfirmed accounts (5.1.1(v)), and Restore Purchases is required (3.1.1). | OK on the default transfer setting ("transfer to new App User ID") with `syncPurchases()` after login and `$email` set. | Needs `mailer_autoconfirm` on, or an "unverified but signed in" session model. |
| Turn confirmation off | Allowed. | Same as above. | **Not recommended.** Supabase warns that auto-linking to an unverified email allows pre-account takeover. |
| Deep-link style | Universal links are "strongly recommended" over custom schemes. | n/a | The AASA / assetlinks files exist but don't cover `/auth`. |

## Recommendation (all three reports agree)

1. **Now, by OTA:** add `flowType: 'pkce'` to `apps/mobile/src/lib/supabase.ts`. Make the web callback render a page instead of blindly redirecting to `motovault://`, and handle its error links. Catch `AuthPKCECodeVerifierMissingError` in `_layout.tsx` and show "Email confirmed, please sign in". This works when the link is opened on the same phone. Estimate: 0.5–1 day.
2. **Next:** add in-app code entry on the account step. Add `{{ .Token }}` to the template next to the link, so web signup keeps working. Verify with `verifyOtp({ email, token, type: 'email' })`, and resend with `auth.resend({ type: 'signup' })` (minimum 60 s apart). Read the production code length before building the UI; local config says 8, so don't hardcode 6. Works from any device and keeps the rider in onboarding. Estimate: 2–3 days.
3. **Skip** turning confirmation off (takeover risk). **Defer** universal links: they need a store build plus a rewrite of web signup.
4. **RevenueCat hardening alongside:** confirm the transfer setting is the default in the dashboard (the API doesn't expose it). Set `$email` with `Purchases.setEmail`, call `syncPurchases()` after a login that finds no active subscription, and keep Restore visible.

## Still unverified

- Production OTP length, OTP expiry and the exact template text.
- The RevenueCat transfer setting for project `proj46e69448`.
- Whether the email is confirmed even when the PKCE code exchange fails on another device.
- Whether Gmail's in-app browser follows the redirect into the app.
