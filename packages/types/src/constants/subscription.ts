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
