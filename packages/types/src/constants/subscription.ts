/** RevenueCat entitlement identifier — must match the RC dashboard configuration.
 *  Dashboard Identifier: "MotoWise Pro" (immutable, set before rebrand)
 *  Dashboard Display Name: "MotoVault Pro" (updated for branding)
 */
export const REVENUECAT_ENTITLEMENT_PRO = 'MotoWise Pro' as const;

/** Client-side Pro subscription status exposed by useProStatus hook (web) and subscription store (mobile). */
export type ProStatus = {
  isPro: boolean;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  isLoading: boolean;
};

/**
 * RevenueCat customer attribute flipped by the API on the first TRIAL webhook
 * (any store) and by the mobile client as a fallback when CustomerInfo shows a
 * prior Pro purchase. RevenueCat Targeting reads it to serve the no-trial
 * offering — the only cross-store "one trial per person" mechanism, since
 * Apple scopes eligibility to a subscription group and Google to a product.
 */
export const RC_ATTRIBUTE_HAS_HAD_TRIAL = 'has_had_trial' as const;
export const RC_ATTRIBUTE_TRUE = 'true' as const;

/**
 * `users.subscription_status` values under which the store has already
 * revoked access. Every other status (active, trialing, cancelled, past_due)
 * keeps Pro until `subscription_expires_at`: a cancelled subscriber paid
 * through the period end, and a past_due one is inside the store's grace
 * period (Apple 16 days, Google 7/14 days) with the entitlement still live.
 */
export const SUBSCRIPTION_STATUS_REVOKED = ['free', 'expired'] as const;
