# RevenueCat identity and transfer: email confirmation vs. onboarding paywall

Researched 2026-10-08. Primary sources are RevenueCat docs, fetched as markdown (`<page>.md`). Anything not taken from a primary source is marked **[unverified]**. Nothing was changed in RevenueCat; the only call was the read-only `list-projects`, which returned MotoVault = `proj46e69448`.

Sources:
- [IC] https://www.revenuecat.com/docs/customers/identifying-customers
- [RB] https://www.revenuecat.com/docs/projects/restore-behavior
- [RP] https://www.revenuecat.com/docs/getting-started/restoring-purchases
- [CA] https://www.revenuecat.com/docs/customers/customer-attributes
- [CC] https://www.revenuecat.com/docs/tools/customer-center
- [RL] https://www.revenuecat.com/docs/web/redemption-links
- [WPL] https://www.revenuecat.com/docs/web/web-billing/web-purchase-links
- [C7706] https://community.revenuecat.com/sdks-51/login-not-aliasing-anonymous-id-when-account-already-has-a-prior-alias-is-this-expected-7706 (RevenueCat Developer Support Engineer, 2026-06-04)

## 1. Identity model

- **Anonymous IDs.** "If you don't provide an App User ID when configuring the Purchases SDK, RevenueCat will generate a new random App User ID (prefixed with `$RCAnonymousID:`)… cache it on the device." Reinstalling the app produces a new anonymous ID. [IC]
- **`logIn()` alias table** [IC]:

| Current ID | Provided ID exists? | Provided ID already has an anonymous alias? | Result |
|---|---|---|---|
| Anonymous | No | N/A | The two IDs' CustomerInfo is **merged** |
| Anonymous | Yes | No | **Merged** |
| Anonymous | Yes | Yes | The current user is logged out and the provided user is logged in. "**No merge or purchase transfer occurs.**" |
| Non-anonymous | Any | Any | Logged out and logged in. **No merge or transfer.** |

- **What happens to a purchase made anonymously, then `logIn` to a new account.** That is row 1: the anonymous ID is aliased into the new custom ID, so the purchase follows. RB says the same: "If the purchase is currently associated with an anonymous App User ID, that App User ID will be aliased with the new App User ID instead (ie. the purchase is shared)." The transfer setting does **not** apply to purchases that sit on an anonymous ID. [RB]
- **Catch.** Each custom ID gets one anonymous alias. On a second device or reinstall, the anonymous purchase is **not** carried over by `logIn`. Support's guidance: "`logIn()` resolves identity, it doesn't pull a purchase across." Purchases move only through restore, a new purchase, or sync, so call `syncPurchases()` after login when the rider has no active entitlement. [C7706]
- **Transfer behavior setting** (Project settings > General; it applies project-wide and also to **new purchases**, not only restores) [RB]:
  - **Transfer to new App User ID (default).** "Only one customer at a time can have access."
  - **Transfer if there are no active subscriptions.**
  - **Keep with original App User ID ("Use with caution").** Returns a `receipt_already_in_use` error. It "is only allowed for apps that require every customer to create an account before purchasing," and "your support team should be prepared to guide customers through an account recovery process."
  - **Share between App User IDs (legacy).** Not available to new projects.
- **Recommended setting.** In RB's table, every app type gets **Transfer to new App User ID**: no login, optional login or purchase before an account, and account required before purchase ("to help customers restore transactions even if they forget previous account information"). Only "strict business logic" apps get Keep-with-original. When accounts may be abandoned or never confirmed, the setting should be **Transfer**. **[unverified]** MotoVault's current value: the API v2 tools do not appear to expose it, so check the dashboard.

## 2. Risk: the rider buys before confirming and never confirms

In the app, `logIn(supabaseUserId)` runs at `src/lib/subscription.ts:390`. The receipt therefore belongs to an *identified* ID for an account the rider may never be able to sign into.

- **Under Transfer (default).** The rider later signs up with Google, Apple or a fixed email, gets a new Supabase uid, and the app calls `logIn(newUid)`. That is a non-anonymous login, so nothing moves on its own. The rider must tap **Restore**, or the app calls `syncPurchases()`, and then the receipt transfers to the new ID. [IC][RB][RP] So the entitlement is recoverable, but only through restore. The orphaned uid keeps the history, and webhooks fire a TRANSFER **[unverified: event name not checked against the webhook docs]**.
- **Under Keep-with-original.** The rider is permanently blocked with `receipt_already_in_use` until they get into the unconfirmed account, which is a support ticket. Avoid this setting.
- **Same store account, other device.** With the default setting, Restore works the same way. RP: "all apps [should] have some way for users to trigger the `restorePurchases` method, even if you require all customers to create accounts"; use `syncPurchases` for programmatic restores, never `restorePurchases`.
- **Support load.** RevenueCat "strongly recommend[s] revealing the App User ID… in a settings screen." [IC] Customer Center gives riders self-serve restore and a contact-support path, but it requires the Pro or Enterprise plan. [CC]
- **Backend side [unverified, inference].** RevenueCat webhooks will carry a Supabase uid whose `public.users` row may be in a not-confirmed state. Check that the webhook's RPC still grants Pro.

## 3. Account first, or anonymous first?

RevenueCat does not require either. It documents "optional login and/or purchase before account" as fully supported with the default setting. [RB] Community support suggests requiring sign-in before purchase only to avoid the multiple-anonymous-alias edge case. [C7706] Placing the paywall after account creation (the current flow) is the cleanest identity model: the purchase lands directly on a known ID. RevenueCat warns against hard-coded or guessable IDs and against email addresses as IDs. [IC] **[unverified]** I found no official RevenueCat statement on email confirmation before a paywall.

## 4. Restore across App User IDs

| Restoring ID → receipt owner | Transfer (default) | Transfer if no active sub | Keep with original |
|---|---|---|---|
| identified → anonymous owner | aliased (merged) | aliased | aliased |
| anonymous → anonymous | aliased | aliased | aliased |
| anonymous → identified owner | transferred to the anonymous ID | transferred only if no active sub | error |
| identified → identified | transferred; the old ID loses access | blocked if the sub is active | `receipt_already_in_use` |

Source: [RB]. Rows 1–2 hold under every setting ("only applies to purchases associated with an identified App User ID").

## 5. Features that help

- **`$email` reserved attribute** (`Purchases.setEmail` / `setAttributes({$email})`). The app does not set it today. Setting it lets support find an orphaned purchase by email even when the rider never confirmed. [CA]
- **Show the App User ID** in Settings. [IC]
- **Customer Center**: restore plus contact support (Pro or Enterprise plan). [CC]
- **`syncPurchases()` after login** when no entitlement is active: a silent recovery with no OS prompt. [RP][C7706]
- **Redemption Links / Web Purchase Links** (web only). An anonymous web checkout produces a 60-minute deep link that aliases the web purchase to whatever ID the app holds. When both IDs are identified, the project's restore behavior applies. [RL][WPL] These do not solve the in-app email confirmation problem.
- **[unverified]** I found no RevenueCat setting called "Allow sharing app store account". The Transfer dropdown is the relevant control.

## 6. Recommendation, from RevenueCat's perspective

RevenueCat is indifferent to whether the email is confirmed. It only needs a stable, unique, non-guessable ID, and a Supabase uid qualifies even before confirmation.

- **(d) Proceed before confirming** is safe on the RevenueCat side **if** the project stays on **Transfer to new App User ID**, the app calls `syncPurchases` after any login that has no entitlement, and a Restore button exists. Add `$email` for support. Under Keep-with-original, (d) is dangerous.
- **(b) In-app OTP code** or **(a) PKCE deep link** produce a confirmed account before purchase, which is the identity model in RB rows 3–4. Of the two, (b) keeps the rider in the paywall flow, while (a) depends on the deep link round-trip working **[unverified UX inference]**.
- **(c) Disable confirmation** is equivalent to (d) for RevenueCat purposes. The risk is typo'd emails, which is a Supabase problem, not a RevenueCat one.

Overall: (b), or (d) with the guardrails above. Either way, verify the Transfer setting in the dashboard and add `syncPurchases` plus `$email`.
