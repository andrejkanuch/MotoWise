# Push tokens: Android has never registered one

Investigated 2026-11-12 during the #365 activation research. Read-only: code on `origin/main` 5a497a1c,
production database (SELECT only), PostHog, Expo docs via Context7. Nothing was changed.

## What we saw

- `public.device_push_tokens` holds **105 tokens ever, all `platform = 'ios'`**. Zero Android rows since the
  table went live in July. By month: Jul 11, Aug 27, Sep 33, Oct 24, Nov 10 (all iOS).
  [SOURCE: Supabase prod `select platform, date_trunc('month',created_at), count(*) from device_push_tokens group by 1,2`]
- New sign-ups 2026-08-14 → 11-04: **57 of 443 have a token** [SOURCE: `queries/q08-db-signup-activation.sql`].
- PostHog, same install window: riders who granted notification permission in onboarding — **iOS 57, Android 119**
  [SOURCE: PostHog q02 `push:ios:true`, `push:android:true`]. The iOS count matches the iOS tokens almost exactly;
  the Android tokens that should exist (~119 consenting riders, more who declined analytics) are all missing.
- Android is ~70% of installs (559 of 793) [SOURCE: evidence pack §2].

## Root cause

Android push through Expo needs Firebase Cloud Messaging. Expo's docs: "Add the expo.android.googleServicesFile
property … This file is required for your Android app to be registered with FCM", plus FCM V1 credentials uploaded
to EAS [SOURCE: https://docs.expo.dev/push-notifications/fcm-credentials/ via Context7, 2026-11-12].

- `apps/mobile/app.config.ts` has **no `android.googleServicesFile`**, there is no `google-services.json` in the repo,
  and `git log -S googleServicesFile` finds no commit that ever had one. The `expo-notifications` plugin entry only sets `color`.
- So on Android `Notifications.getExpoPushTokenAsync()` (`apps/mobile/src/lib/push-token.ts:39`) throws (Firebase is not
  initialised), and `registerForPushNotifications()` catches it and calls `logger.warn` (`push-token.ts:77`).
- `logger.warn` is a **no-op in production builds** (`apps/mobile/src/lib/logger.ts:4-23`: "warn … no-ops in production").
  So the failure has been silent on every Android device since July: no Sentry issue, no PostHog event
  (Sentry search for "FirebaseApp is not initialized", 90 days: none).

The server side is fine: the `claim_device_push_token` RPC (00188), the resolver and the iOS path all work.

## What this breaks

- **Server pushes never reach Android riders:** maintenance-due push (#154/#155) and the server idle-ride sweep
  reminder (`apps/api/src/modules/push-tokens/ride-idle.service.ts`). Local notifications scheduled on the device
  (maintenance reminders, document expiry, receipt scan, the on-device forgotten-ride reminder, trial reminder) do
  not use FCM and still work.
- **Any push-based activation experiment from the #365 board would reach iOS only** (~30% of installs) until this is fixed.
- The Android "permission granted" number in PostHog looked like reachable riders, but none of them could be reached by
  server push. Another case of `feedback_metric_measures_something_else`.

## What already exists (checked 2026-11-12, read-only)

| Place | State | Where to see it |
|---|---|---|
| EAS credentials, `@andykeny/motowise`, Android `com.motovault.app` | **FCM V1 key: none. Legacy FCM key: none.** Submissions key: `firebase-adminsdk-fbsvc@lominic.iam.gserviceaccount.com` (borrowed from the Lominic project) | expo.dev → andykeny → motowise → Credentials → Android → com.motovault.app |
| Google Cloud `motowise-489419` ("MotoWise", created 2026-03-06) | Not a Firebase project (the Firebase API is enabled but no Firebase project or apps exist). Holds the Play publisher, Play Console, RevenueCat and Aso.dev service accounts | console.cloud.google.com → project MotoWise |
| Firebase `lominic` | A Firebase project for a **different app** (`com.andykeny.lominic`), FCM enabled. No MotoVault app in it | console.firebase.google.com → Lominic |
| Repo | no `google-services.json`, no `android.googleServicesFile` | `apps/mobile/app.config.ts` |

Signed-in Google account for all of these: <redacted-email> (gcloud active account).

**Update 2026-11-12 (later):** the owner turned `motowise-489419` into a Firebase project ("MotoWise", Spark plan)
and registered the iOS app `com.motovault.app` (`1:276412017775:ios:b89bf92b3ee7a1a9e5f19a`), then the Android app
`com.motovault.app` (`1:276412017775:android:6b2138fe47cf2bf9e5f19a`). `google-services.json` downloaded and verified
(project `motowise-489419`, package matches). Cloud Messaging API (`fcm.googleapis.com`) is enabled.
FCM V1 key uploaded to EAS 2026-11-12 10:53 UTC and verified via the EAS API
(`firebase-adminsdk-fbsvc@motowise-489419`, assigned to `com.motovault.app`).
Still to do (build session): put `google-services.json` in the app and set `android.googleServicesFile` in
`app.config.ts`; failure logging + guard test; Android store build; verify an `android` row lands in `device_push_tokens`.

**Recommendation:** add Firebase to the existing `motowise-489419` Google Cloud project (Firebase console → Add project →
pick the existing "MotoWise" Google Cloud project), then register the Android app `com.motovault.app` there. Don't reuse
`lominic`: that's another app. Separately, the EAS *submissions* key borrowing Lominic's Firebase admin account works but is
cross-project. Moving it to `play-store-publisher@motowise-489419` is a tidy-up, not urgent.

## Proposed fix (for a build session, needs the owner's go-ahead)

1. **Firebase project + Android app** `com.motovault.app` in the Firebase console → download `google-services.json`.
   It holds public identifiers and can be committed (Expo docs), or uploaded as an EAS file env var.
2. **Wire it in `app.config.ts`:** `android.googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'`
   (Expo's documented pattern for EAS file variables).
3. **Upload FCM V1 credentials to EAS:** a Firebase service-account key → `eas credentials` → Android →
   Push Notifications → FCM V1. Without it Android gets a token but Expo cannot deliver to it.
4. **This needs a new Android store build, not an OTA.** The change is native config (runtime version = app version).
   Bundle it with the next Play release.
5. **No backfill code needed:** `_layout.tsx:949` re-registers on every launch when permission is granted, so Android riders
   who already allowed notifications get a token on their first launch of the new build.
6. **Make failures visible:** in `push-token.ts`, replace `logger.warn` with `captureException(err, { extra: { source: 'push-token-register', platform } })`
   and add PostHog events `push_token_registered {platform}` / `push_token_registration_failed {platform, stage, error_code}`.
7. **Guard against regression:** a unit test that `app.config.ts` resolves `android.googleServicesFile`, the same way
   `ONBOARDING_PAYWALL_POSITIONS` is guarded (#326); and a weekly check (or PostHog alert) that Android tokens created in
   the last 7 days > 0 once the build is at 100%.

**Verify:** an Android release build on a device → grant permission → a `device_push_tokens` row with `platform = 'android'`
→ send a test through Expo's push tool → it arrives. Then one maintenance-due push end to end.

**Effort:** S in code (config + logging + one test), plus owner steps in Firebase and EAS, plus a Play release.

## Owner decisions

- ~~Create the Firebase project under which Google account?~~ **Decided 2026-11-12: the Google account that owns the
  Play Console (the owner's second Gmail, the one used to sign in to Play).** Firebase Analytics does not need to be turned on.
- Commit `google-services.json` or keep it as an EAS file variable?
- Ship it in the next Play build, or cut a dedicated build sooner?
