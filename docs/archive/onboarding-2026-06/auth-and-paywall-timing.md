# Auth & the Paywall — How to Handle Sign-up / Sign-in Around Purchase

**Question being answered:** Does a user need an account to access the paid version? And if we defer auth, does asking them to sign up *after* the paywall make sense?
**Stack context:** Supabase Auth (Apple/Google/email, JWT validated locally via jose) + RevenueCat (native paywall). Companion to `onboarding-restructure-proposal.md`.
**Date:** 9 June 2026

---

## The short answer

**No — a user does not need a MotoVault account to unlock the paid version.** A subscription purchase is tied to the user's **Apple ID / Google account** and to RevenueCat's **anonymous App User ID**, and the entitlement unlocks **immediately** at purchase, with or without an app account. ([RevenueCat — Identifying Customers](https://www.revenuecat.com/docs/customers/identifying-customers))

So a MotoVault account is **not a gate for paid access**. It exists to do three other things:

1. **Sync the subscription across devices** (phone + tablet, or a new phone).
2. **Reliably restore** after delete/reinstall (anonymous IDs are wiped on reinstall).
3. **Link the purchase to your backend** (the Supabase user row) so server logic and RLS work.

That reframing dissolves the discomfort: asking someone to sign up *after* the paywall is **not** "sign up to get what you paid for." The thing they paid for is already active. The post-purchase account ask is **"create an account to save and sync your subscription"** — a benefit, not a toll. Apple itself works this way: your purchase is bound to your Apple ID first; the app account is for the app's own continuity.

---

## How RevenueCat identity actually works (the mechanics)

- **Anonymous by default.** If you configure the SDK without an App User ID, RevenueCat generates an anonymous ID (`$RCAnonymousID:…`) and caches it on device. Good enough to purchase and unlock entitlements on one platform. Wiped on uninstall. ([docs](https://www.revenuecat.com/docs/customers/identifying-customers))
- **`logIn(appUserID)` aliases anonymous → identified.** When the user later creates/*enters* your account, you call `logIn()` with your own stable user ID. RevenueCat merges (aliases) the anonymous ID into the identified customer, **preserving purchase history and entitlements**. The anonymous ID stays as `original_app_user_id`; your ID becomes `app_user_id`. ([docs](https://www.revenuecat.com/docs/customers/identifying-customers))
- **Alias edge case:** if the custom ID you log into *already exists and already has its own anonymous alias*, no merge/transfer happens (the current anonymous purchase would not move). This only bites when a brand-new anonymous purchase is logged into a pre-existing account that already transacted — rare in a sign-up-after-purchase flow, but handle it (see Edge Cases).
- **Restore Behavior must be "Transfer to new App User ID" (the default).** RevenueCat's own guidance: *"Has an optional login mechanism and/or allows customers to purchase before creating an account → **Transfer to new App User ID**."* Do **not** use "Keep with original App User ID" — that one *requires* every customer to create an account *before* purchasing, which is the opposite of what we want. ([RevenueCat — Restore Behavior](https://www.revenuecat.com/docs/projects/restore-behavior))
- **Identifier hygiene:** use the **Supabase user UUID** as the App User ID. RevenueCat recommends a non-guessable UUID (RFC 4122 v4), explicitly says **don't use email** (guessability + GDPR), and don't hardcode strings. Supabase's `auth.users.id` UUID is a perfect fit. ([docs](https://www.revenuecat.com/docs/customers/identifying-customers))

---

## The three placement patterns (and their trade-offs)

### Pattern A — Account *before* paywall (auth gate)
Configure RevenueCat with the Supabase UUID from launch; no anonymous IDs.
- ✅ Simplest identity model; purchase is always bound to the account; cleanest backend linking.
- ❌ Puts the **account wall before any value** — the exact top-of-funnel friction we're trying to remove. Hurts the day-0 window where ~82% of trials happen.
- Use if: backend/account is genuinely required to render the core experience.

### Pattern B — Anonymous through onboarding + paywall, **account created right after purchase** (Recommended)
Configure anonymous at launch → user onboards, hits paywall, can purchase anonymously → entitlement unlocks instantly → **success screen** asks them to create an account to *save & sync* → `logIn(supabaseUUID)` aliases the purchase.
- ✅ Removes the early wall; value-first; purchase friction is just the Buy button.
- ✅ The account ask lands at a high-trust moment (they just committed money) and is framed as protection/sync, not a gate.
- ✅ Fully supported and is RevenueCat's documented "purchase before account" path.
- ⚠️ Must handle the user who buys and then *dismisses* the account step (still entitled anonymously) — prompt again at next launch / in settings, and expose **Restore Purchases**.

### Pattern C — Account *at* the purchase tap (account-at-purchase)
Anonymous through the paywall, but tapping "Subscribe" first triggers a lightweight account creation, then completes the purchase against the identified ID.
- ✅ Every purchase is bound to an account from the start; no aliasing edge cases.
- ➖ Adds a step between intent and payment (mild conversion cost), but far less harmful than a wall *before* the paywall.
- Good middle ground if you dislike any window of anonymous-but-unsynced purchases.

---

## Recommendation for MotoVault

**Use Pattern B, with Pattern C as the fallback if you want zero anonymous-purchase window.**

Concretely:

1. **Configure RevenueCat anonymously** at app launch. Let users go through the whole new onboarding (bike → reveal → goals → maintenance → commitment) and reach the paywall **without an account**.
2. **Paywall purchase requires only the Buy button.** Entitlement unlocks immediately against the anonymous ID. (Don't gate the unlock on account creation — it's both worse UX and unnecessary.)
3. **Immediately after a successful purchase, show a "Secure your subscription" account step**, not a generic "sign up." Copy like: *"You're Pro. Create your account to save your subscription and sync your garage across devices."* On submit, call `Purchases.logIn(supabaseUUID)` so the purchase aliases onto the Supabase user.
4. **For users who DON'T buy** (continue free): don't force an account at all there. Let them into the app and ask for an account at a **contextual, value-linked moment** (e.g. when they save a ride/expense, or from the home checklist), or at next session — consistent with the "value before signup" principle.
5. **Always expose two recovery affordances** on the paywall/account screens: **"Already have an account? Sign in"** (→ `logIn`, entitlements follow the identified customer) and **"Restore purchases"** (store-account path, for reinstalls/new devices).
6. **Restore Behavior = "Transfer to new App User ID"** in RevenueCat project settings.
7. **App User ID = Supabase `auth.users.id` (UUID).** Never email. Call `logIn` on sign-in and after sign-up; call `logOut` on sign-out (or, if you decide to *require* accounts later, you can move to custom-ID-only — but keep anonymous for the value-first flow).

This keeps the funnel value-first (the whole point of the restructure) **and** makes the account ask feel logical because it arrives as "protect what you just unlocked," not "pay, then prove who you are."

### Where this lands in the proposed flow
Replace the standalone "Auth at step 10" with two precise moments:
- **Purchasers:** account step on the **post-purchase success screen** (right after the paywall).
- **Non-purchasers:** **no wall** — account requested later, contextually.
- Add **Sign in** + **Restore** entry points on the paywall and in Settings for returning users.

---

## Edge cases to design/QA

- **Buys anonymously, never makes an account, then reinstalls:** anonymous ID is gone → entitlement appears lost until they tap **Restore Purchases** (works on the same Apple ID/Google account). This is the main reason to *encourage* the account right after purchase. Make Restore easy to find.
- **Cross-device without an account:** won't sync — only an account (custom App User ID) shares entitlements across devices. Another reason for the post-purchase nudge.
- **Signs into a pre-existing account that already transacted:** per the alias table, the just-made anonymous purchase may **not** merge. Detect this and fall back to **Restore Purchases** / support. Rare in practice.
- **Account switching:** call `logIn(newID)` directly (no `logOut` first needed).
- **`appAccountToken` / Apple S2S "track new purchases" feature:** if you ever enable server-to-server purchase tracking, the docs warn it can misroute entitlements unless your `appAccountToken` matches the RevenueCat App User ID (a valid UUID) — another reason to standardize on the Supabase UUID. ([Restore Behavior — S2S considerations](https://www.revenuecat.com/docs/projects/restore-behavior))
- **GDPR/PII:** Supabase UUID as App User ID keeps PII out of RevenueCat; don't pass email.

---

## Store-policy notes (Apple/Google)

- **Purchases are tied to the store account, not your app account** — so unlocking immediately on purchase, account-optional, is both allowed and standard.
- **Don't force account creation to use features that don't require it.** Apple's rules push apps *away* from mandatory registration when an account isn't needed for the core function; gating already-purchased content behind sign-up is exactly what to avoid. Account-optional-with-encouragement is the safe, compliant pattern. (See Apple App Review Guidelines §3.1 / §5.1.1; [guidelines](https://developer.apple.com/app-store/review/guidelines/).)
- If you offer **Sign in with Apple** alongside Google/email (you do), keep it compliant with Apple's equivalent-option requirement.

---

## TL;DR for the team

- Account is **not** required to access paid features — entitlement is store + RevenueCat-anonymous based.
- Go **value-first**: anonymous through onboarding + paywall.
- Ask for the account **right after purchase**, framed as *save & sync*, and `logIn(supabaseUUID)` to alias the purchase.
- Don't wall free users; ask contextually later.
- Set Restore Behavior to **Transfer to new App User ID**; use the **Supabase UUID** (never email) as the App User ID; expose **Sign in** + **Restore purchases**.

---

*Sources: [RevenueCat — Identifying Customers](https://www.revenuecat.com/docs/customers/identifying-customers) · [RevenueCat — Restore Behavior](https://www.revenuecat.com/docs/projects/restore-behavior) · [RevenueCat — What is a Customer? (user IDs)](https://www.revenuecat.com/docs/customers/user-ids) · [RevenueCat — Restoring Purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases) · [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · context from RevenueCat "guide to mobile paywalls" and Airbridge "App Onboarding Before the Paywall."*
