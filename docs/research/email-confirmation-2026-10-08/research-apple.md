# Apple rules for the MotoVault account wall, email confirmation and deep links

Researched 2026-10-08. The App Review Guidelines page shows **"Last updated June 8, 2026"**. Quotes are verbatim from the primary sources unless a quote is marked **[secondary]** or **[unverified]**.

Sources:
- ARG: App Review Guidelines, https://developer.apple.com/app-store/review/guidelines/
- HIG-MA: HIG "Managing accounts", https://developer.apple.com/design/human-interface-guidelines/managing-accounts
- HIG-SIWA: HIG "Sign in with Apple", https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- HIG-OB: HIG "Onboarding", https://developer.apple.com/design/human-interface-guidelines/onboarding
- DEL: "Offering account deletion in your app", https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Restore: StoreKit "Restoring purchased products", https://developer.apple.com/documentation/storekit/restoring-purchased-products
- Relay: "Communicating using the private email relay service", https://developer.apple.com/documentation/signinwithapple/communicating-using-the-private-email-relay-service
- Scheme: "Defining a custom URL scheme for your app", https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app
- UL: "Allowing apps and websites to link to your content", https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content, and "Supporting universal links in your app", https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app
- ASWAS: ASWebAuthenticationSession, https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession, and "Authenticating a user through a web service", https://developer.apple.com/documentation/authenticationservices/authenticating-a-user-through-a-web-service

---

## 1. Can the app require an account before the paywall, or before any use?

### What the rules say

**ARG 5.1.1(v) Account Sign-In:**
> "If your app doesn't include significant account-based features, let people use it without a login. If your app supports account creation, you must also offer account deletion within the app. Apps may not require users to enter personal information to function, except when directly relevant to the core functionality of the app or required by law."

**ARG 3.1.2(a)** has two relevant passages:
> "the subscription period must last at least seven days and be available across all of the user's devices."

> "As with all apps, those offering subscriptions should allow a user to get what they've paid for without performing additional tasks, such as posting on social media, uploading contacts, checking in to the app a certain number of times, etc."

**ARG 3.1.2(c):**
> "Before asking a customer to subscribe, you should clearly describe what the user will get for the price."

The current guidelines contain **no explicit "no registration before purchase" rule**. That rule is applied through 5.1.1 rejection boilerplate. Apple's 5.1.1 rejection text, as quoted on Apple Developer Forums (https://developer.apple.com/forums/thread/731471 and https://developer.apple.com/forums/thread/724336), reads:
> "Apps cannot require user registration prior to allowing access to app content and features that are not associated specifically to the user. User registration that requires the sharing of personal information must be optional or tied to account-specific functionality. … please revise your app to not require users to register before purchasing in-app purchase products that are not account based. … Please note that although App Store Review Guideline 3.1.2 requires an app to make subscription content available to all the iOS devices owned by a single user, it is not appropriate to force user registration to meet this requirement; such user registration must be optional."

On appeal, the App Review Board added (thread 724336):
> "Users should be allowed to access non account-based features before registration and login … Once the user decides to use account-based features, the app may present the registration or login feature at that time."

**HIG-MA:**
> "Ask people to create an account only if your core functionality requires it; otherwise, let people enjoy your app or game without one."

> "Delay sign-in for as long as possible. People often abandon apps when they're forced to sign in before they can do anything useful."

HIG-SIWA gives the same advice ("Delay sign-in as long as possible", "Ask people to sign in only in exchange for value"). It adds:
> "If you require an account, ask people to set it up before offering any sign-in options. Start by explaining the reasons for requiring an account."

**HIG-OB:**
> "Prefer letting people experience your app or game before prompting them for ratings or purchases."

This is advice. It is not something App Review enforces.

### What this means for MotoVault (my interpretation)

- **Account first, then paywall, is allowed** when Pro unlocks features that depend on the account. MotoVault's core features are account-based and synced: the personal garage, maintenance and expense records, rides and cross-device access. That fits the "tied to account-specific functionality" carve-out. The rejections reported on the forums target non-account IAP, such as game currency or content packs.
- **The risk comes from content, not the order of the screens.** A reviewer could reject under 5.1.1(v) if:
  - Pro features look device-local (for example offline maps or calculators), or
  - parts of the app that are not personal (articles, route discovery, diagnostics, learning) cannot be reached without signing up.
- To reduce that risk:
  - Explain on the account screen why an account is needed (HIG-SIWA requires "explaining the reasons").
  - Keep public content browsable where that is practical.
  - Do not justify the account wall with "so your subscription works on all devices". The rejection text above calls that justification inappropriate.
- **Unverified:** whether App Review currently flags hard account walls in garage or sync apps. Many comparable apps (Strava, Komoot, Drivvo-style loggers) ship this way. That is anecdote, not a rule.

## 2. Can the app block riders until they confirm their email?

- **ARG has no rule about email verification.** I searched the guideline text for "verify", "verification" and "email" and found nothing that mentions verifying an email before use.
- The only Apple text that touches it, indirectly, is in HIG-SIWA:
  > "Supporting Sign in with Apple lets people … skip filling out forms, verifying email addresses, and choosing passwords."

  Apple presents skipping email verification as a benefit, but nothing requires or bans gating on it.
- **The practical review risk is ARG 2.1(a) App Completeness:**
  > "Make sure your app has been tested on-device for bugs and stability before you submit it, and include demo account info (and turn on your back-end service!) if your app includes a login."

  If a reviewer signs up with email and the confirmation link leaves them stuck on a web /login page (today's bug), a 2.1 "bug / unable to proceed" rejection is plausible. The pre-confirmed demo account in App Store Connect covers the review login, but reviewers also try fresh signups.
- **Reported rejections for "must verify email": unverified.** I found no primary or credible report of a rejection whose cited reason was the verification gate itself. Reported cases are 2.1 failures where the reviewer could not complete signup or login.
- 5.1.1(v) says apps may not require personal information "except when directly relevant to the core functionality". Collecting an email address for an account system is generally accepted. A verification gate adds friction but does not add any data collection.

## 3. Sign in with Apple, Google and email (ARG 4.8) and Hide My Email

**ARG 4.8 Login Services:**
> "Apps that use a third-party or social login service (such as Facebook Login, Google Sign-In, …) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service with the following features:
> - the login service limits data collection to the user's name and email address;
> - the login service allows users to keep their email address private as part of setting up their account; and
> - the login service does not collect interactions with your app for advertising purposes without consent."

MotoVault offers Google, so it needs one equivalent privacy-preserving login. Sign in with Apple satisfies that, so the current setup complies. Email and password do not count as that equivalent service.

**Button placement, from HIG-SIWA:**
> "Prominently display a Sign in with Apple button. Make a Sign in with Apple button no smaller than other sign-in buttons, and avoid making people scroll to see the button."

**Hide My Email (Relay doc).** Relay addresses:
> "route emails to one of the Apple Account's verified email addresses."

Domains: "@private.icloud.com, @privaterelay.appleid.com, or @icloud.com". There is a "daily limit of 100 emails" per relay address. Sending also has a requirement:
> "To send emails to users with private email addresses, you must register your outbound emails or email domains and use Sender Policy Framework (SPF)."

The sender domain must therefore be registered in the Apple Developer portal, or relay mail is dropped.

**Is a Sign in with Apple email pre-verified?** The identity-token claim `email_verified` has been documented by Apple as "always true, because the servers only return verified email addresses". **[secondary]** That wording comes via the next-auth type definitions and search snippets. I could not retrieve the current Apple claim table directly, and Apple may have added a caveat for Apple at Work & School accounts.

Implications:
- Sign in with Apple and Google sign-ins should **never** be sent through an email-confirmation step.
- With `signInWithIdToken`, Supabase creates the user already confirmed. **[unverified for Supabase; check `email_confirmed_at` on an Apple user]**
- HIG-SIWA warns:
  > "Avoid asking for a personal email address when people supply a private relay address."

  So do not ask a Sign in with Apple user to confirm or replace their email.
- The confirmation problem only affects the email and password path.

## 4. Universal Links vs custom URL schemes for confirmation links

**Scheme doc:**
> "While custom URL schemes are an acceptable form of deep linking, universal links are strongly recommended."

> "Although using a reverse DNS string is a best practice, it doesn't prevent other apps from registering the same scheme … Use universal links instead of custom URL schemes to define links that are uniquely associated with your website."

> "If multiple apps register the same scheme, the app the system targets is undefined."

**UL doc:**
> "When users tap or click a universal link, the system redirects the link directly to your app without routing through the person's default web browser or your website. … If the person hasn't installed your app, the system opens the URL in their default web browser, allowing your website to handle it."

> "When a user browses your website in Safari and taps a universal link in the same domain, the system opens that link in Safari … If the user taps a universal link in a different domain, the system opens the link in your app."

Both docs also say:
> "validate all URL parameters … don't allow universal links to directly delete content or access sensitive information."

**Failure modes:**
- **Different device or desktop.** A universal link falls back to the website. That is correct behaviour, so the web page must be a real landing page, for example "Email confirmed — return to the app on your phone", not /login. A custom-scheme link opened on a desktop simply fails.
- **Same-domain navigation.** If the emailed link first lands on `motovault.app` and that page then redirects to another `motovault.app` URL, the second URL stays in Safari by design. Today's chain is `<project>.supabase.co/auth/v1/verify`, which redirects to the website, which redirects to /login. In that chain the email link is not a universal link at all.
  - For a universal link to fire, the URL in the email must itself be the app's universal-link domain, for example a custom Supabase template linking straight to `https://motovault.app/auth/confirm?token_hash=…&type=signup`. The app then calls `verifyOtp({ token_hash, type })` itself.
  - **[unverified]** Whether iOS opens a universal link reached through a server-side 302 from another domain varies by context and is not documented by Apple.
- **Gmail, Outlook and in-app browsers.** **[unverified; not documented by Apple]** Gmail for iOS can open links in its in-app browser or in Chrome depending on user settings, and these may not hand off to universal links. Mail.app does honour them. A custom-scheme hop from a web page needs a user tap ("Open MotoVault" button). Automatic JavaScript redirects to a custom scheme are commonly blocked or prompt the user. **[unverified]**
- **ASWebAuthenticationSession** applies only to flows the app starts itself (OAuth or web login). It does not help with a link the rider opens from an email client. ASWAS doc:
  > "ensures that only the calling app's session receives the authentication callback, even when more than one app registers the same callback URL scheme."

  That makes it the right tool for browser-based OAuth, but the app already uses native `signInWithIdToken`. **It does not fix email confirmation.**
- **PKCE cross-device caveat (Supabase, not Apple):** **[unverified, from Supabase docs knowledge]** A PKCE `?code=` can only be exchanged on the device and app instance that holds the `code_verifier`. A rider who opens the email on a laptop cannot complete it there. A `token_hash` link or a 6-digit OTP does not have this limit.

## 5. Purchases before verification, Restore, and account deletion

- **Purchases by an unverified user:** Apple says nothing about this. StoreKit purchases are tied to the Apple Account. Your account state is your own concern. One relevant constraint from the rejection text: do not make purchase or restore *depend* on completing extra non-account steps. 3.1.2(a) says "get what they've paid for without performing additional tasks".
  - Practical risk: if a rider pays while unconfirmed and is then locked out pending confirmation, they have paid but cannot use the app. That is a 3.1.2(a) / 2.1 complaint and refund risk.
  - So **do not show the paywall to an account that cannot sign in yet**. Confirm the email, or let them in first.
- **Restore (ARG 3.1.1):**
  > "you should make sure you have a restore mechanism for any restorable in-app purchases."

  Auto-renewable subscriptions are restorable. Restore doc:
  > "Include some mechanism in your app, such as a Restore Purchases button … Don't automatically restore purchases, especially when your app launches."

  Put "Restore Purchases" on the onboarding paywall and in settings. With RevenueCat, a restore made under a different app account transfers or aliases according to the project's restore behaviour. Make sure it works when the Supabase user is not confirmed yet.
- **Account deletion (ARG 5.1.1(v) and DEL):**
  > "If your app supports account creation, you must also offer account deletion within the app."

  DEL adds:
  > "If a person has an auto-renewable subscription, notify them that billing will continue through Apple and ask them to cancel their subscription before continuing."

  > "Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens."

  > "It's appropriate to confirm the user genuinely intends to delete their account … such as by entering a code from an email … However, apps that make it unnecessarily difficult for someone to delete their account will not pass review."

  The interaction with confirmation: an account that is created but never confirmed is still an account. The rider must be able to delete it, so deletion should not be reachable only after confirmation. If unconfirmed riders cannot sign in, they cannot reach Settings, and orphaned unconfirmed accounts holding personal data become a GDPR and 5.1.1(v) loose end. Auto-purge unconfirmed accounts, or let riders in.

## 6. Recommendation from the rules' perspective

No Apple rule forces any of options (a) to (d), and none forbids them. The ranking below rests on Apple's stated preferences: universal links over schemes, delay friction, never strand a payer, and the 2.1 completeness risk.

1. **Best: (d) + (b), let the rider in now and confirm in the background, with in-app code entry as the confirmation mechanism.**
   - Allow sign-in before confirmation (Supabase "allow unverified email sign-ins", or confirm-off plus a soft verify).
   - Show a non-blocking "Confirm your email" banner with a 6-digit code field.
   - Gate only actions where an unverified email actually matters, such as password reset, email changes and anything public.
   - This matches HIG "Delay sign-in for as long as possible". The paywall then reaches a usable account, so there is no paid-but-locked-out case. There are no deep links to break and no cross-device problem.
   - The OTP code needs no universal link, works in any mail client and on any device, and gives a clean 2.1 review path.
2. **Good: (b) alone, blocking until the code is entered.** It is compliant and robust. It costs one extra step before the paywall, a known drop-off, but nothing in the rules prevents it.
3. **Acceptable if done with universal links: (a′).** The email links directly to `https://motovault.app/auth/confirm?token_hash=…`, with an apple-app-site-association file covering `/auth/*`. The app verifies the `token_hash` itself, and the web fallback page confirms the email and tells the rider to return to the app.
   - Prefer `token_hash` to a PKCE `?code=`, which fails across devices.
   - **Avoid the plan as specified in (a)**: a web callback forwarding into the app via a custom scheme. Apple calls custom schemes the inferior choice, they cannot be uniquely claimed, and the hop fails silently in in-app browsers and on desktop.
4. **(c) confirmation off entirely** is fully compliant with Apple. The trade-offs are product and security ones, not App Review ones: typo emails become unrecoverable accounts, password reset goes to the wrong inbox, and spam signups increase. If you choose it, add a later soft verification step.

Under every option:
- Never send Sign in with Apple or Google users through email confirmation.
- Register the sending domain for the private relay service.
- Keep Restore Purchases on the paywall.
- Keep in-app account deletion reachable for any account that exists.
- Give App Review a pre-confirmed demo account plus a note on how signup confirmation works.
