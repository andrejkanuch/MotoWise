/**
 * Turns a purchases-js / RevenueCat checkout failure into copy a rider can act on.
 *
 * Why: a sandbox purchase on 2026-10-05 with test@test.com failed with RevenueCat
 * 422 `{code: 7834, "Email domain is not valid"}` and the rider only saw "Something
 * went wrong (error code 7834)". Most checkout failures have a concrete next step
 * (fix the email, try another card, you're already Pro) — say it.
 *
 * Codes mirror `ErrorCode` and the backend codes in @revenuecat/purchases-js; the
 * test pins the SDK-side ones to the SDK enum so an upgrade cannot drift silently.
 * This module stays SDK-free so the checkout page can keep loading the SDK lazily.
 *
 * purchases-js 1.46 rejects `purchase()` through `getForPurchasesFlowError`, which
 * keeps only the SDK `ErrorCode` (no `extra.backendErrorCode`), and converts its
 * purchase-flow codes first: a failed charge (`ErrorChargingPayment`) arrives as
 * `PaymentPendingError` (20) and a checkout that could not be set up
 * (`ErrorSettingUpPurchase`: gateway, store or sandbox-mode problems) arrives as
 * `StoreProblemError` (2). The SDK mapping below follows that conversion.
 */

export const SUPPORT_EMAIL = 'support@motovault.app';

/** `ErrorCode` values from @revenuecat/purchases-js that need their own copy. */
export const RC_SDK_ERROR = {
  UNKNOWN: 0,
  USER_CANCELLED: 1,
  STORE_PROBLEM: 2,
  PURCHASE_NOT_ALLOWED: 3,
  PURCHASE_INVALID: 4,
  PRODUCT_NOT_AVAILABLE: 5,
  PRODUCT_ALREADY_PURCHASED: 6,
  NETWORK: 10,
  PAYMENT_PENDING: 20,
  INVALID_EMAIL: 38,
} as const;

/** RevenueCat backend error codes (`extra.backendErrorCode`) that need their own copy. */
export const RC_BACKEND_ERROR = {
  INVALID_EMAIL: 7012,
  ALREADY_SUBSCRIBED: 7772,
  PAYMENT_GATEWAY_ERROR: 7773,
  OFFER_NOT_FOUND: 7814,
  /** "Email domain is not valid" — the domain has no MX records (e.g. test.com). */
  NO_MX_RECORDS: 7834,
  PURCHASE_CANNOT_BE_COMPLETED: 7878,
  EMAIL_REQUIRED: 7879,
} as const;

export const CHECKOUT_FAILURE_REASON = {
  INVALID_EMAIL: 'invalid_email',
  ALREADY_SUBSCRIBED: 'already_subscribed',
  PAYMENT_DECLINED: 'payment_declined',
  CHECKOUT_SETUP: 'checkout_setup',
  PLAN_UNAVAILABLE: 'plan_unavailable',
  NETWORK: 'network',
  UNKNOWN: 'unknown',
} as const;

export type CheckoutFailureReason =
  (typeof CHECKOUT_FAILURE_REASON)[keyof typeof CHECKOUT_FAILURE_REASON];

/**
 * Failures the rider cannot fix themselves: our side (merchant setup) or
 * unexplained. These go to Sentry; the rest are tracked in analytics only.
 */
const REPORTABLE_REASONS: ReadonlySet<CheckoutFailureReason> = new Set([
  CHECKOUT_FAILURE_REASON.CHECKOUT_SETUP,
  CHECKOUT_FAILURE_REASON.UNKNOWN,
]);

export function isReportableCheckoutFailure(reason: CheckoutFailureReason): boolean {
  return REPORTABLE_REASONS.has(reason);
}

export interface CheckoutErrorInput {
  errorCode: number | null;
  backendErrorCode: number | null;
}

export interface CheckoutFailure {
  reason: CheckoutFailureReason;
  message: string;
}

const MESSAGES: Record<CheckoutFailureReason, string> = {
  [CHECKOUT_FAILURE_REASON.INVALID_EMAIL]: `Your account email can't be used for billing. Update your email in Profile, or contact ${SUPPORT_EMAIL}.`,
  [CHECKOUT_FAILURE_REASON.ALREADY_SUBSCRIBED]:
    'You already have MotoVault Pro. You can manage your subscription from your Profile.',
  [CHECKOUT_FAILURE_REASON.PAYMENT_DECLINED]:
    "Your payment couldn't be processed. Try another card, or check with your bank.",
  [CHECKOUT_FAILURE_REASON.CHECKOUT_SETUP]: `We couldn't start checkout. You weren't charged. Please try again in a few minutes, or contact ${SUPPORT_EMAIL}.`,
  [CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE]: `This plan can't be purchased right now. Please try again later, or contact ${SUPPORT_EMAIL}.`,
  [CHECKOUT_FAILURE_REASON.NETWORK]: 'Connection problem. Check your internet and try again.',
  [CHECKOUT_FAILURE_REASON.UNKNOWN]: `Something went wrong with checkout. Please try again, or contact ${SUPPORT_EMAIL}.`,
};

const BY_BACKEND_CODE: Record<number, CheckoutFailureReason> = {
  [RC_BACKEND_ERROR.INVALID_EMAIL]: CHECKOUT_FAILURE_REASON.INVALID_EMAIL,
  [RC_BACKEND_ERROR.NO_MX_RECORDS]: CHECKOUT_FAILURE_REASON.INVALID_EMAIL,
  [RC_BACKEND_ERROR.EMAIL_REQUIRED]: CHECKOUT_FAILURE_REASON.INVALID_EMAIL,
  [RC_BACKEND_ERROR.ALREADY_SUBSCRIBED]: CHECKOUT_FAILURE_REASON.ALREADY_SUBSCRIBED,
  [RC_BACKEND_ERROR.PAYMENT_GATEWAY_ERROR]: CHECKOUT_FAILURE_REASON.CHECKOUT_SETUP,
  [RC_BACKEND_ERROR.OFFER_NOT_FOUND]: CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE,
  [RC_BACKEND_ERROR.PURCHASE_CANNOT_BE_COMPLETED]: CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE,
};

const BY_SDK_CODE: Record<number, CheckoutFailureReason> = {
  [RC_SDK_ERROR.INVALID_EMAIL]: CHECKOUT_FAILURE_REASON.INVALID_EMAIL,
  [RC_SDK_ERROR.PRODUCT_ALREADY_PURCHASED]: CHECKOUT_FAILURE_REASON.ALREADY_SUBSCRIBED,
  // ErrorSettingUpPurchase: the checkout could not be prepared (merchant side).
  [RC_SDK_ERROR.STORE_PROBLEM]: CHECKOUT_FAILURE_REASON.CHECKOUT_SETUP,
  // ErrorChargingPayment ("Payment charge failed"): the charge was declined.
  [RC_SDK_ERROR.PAYMENT_PENDING]: CHECKOUT_FAILURE_REASON.PAYMENT_DECLINED,
  [RC_SDK_ERROR.PURCHASE_NOT_ALLOWED]: CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE,
  [RC_SDK_ERROR.PURCHASE_INVALID]: CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE,
  [RC_SDK_ERROR.PRODUCT_NOT_AVAILABLE]: CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE,
  [RC_SDK_ERROR.NETWORK]: CHECKOUT_FAILURE_REASON.NETWORK,
};

/** The backend code is more specific than the SDK code, so it wins when both map. */
export function describeCheckoutError({
  errorCode,
  backendErrorCode,
}: CheckoutErrorInput): CheckoutFailure {
  const reason =
    (backendErrorCode !== null ? BY_BACKEND_CODE[backendErrorCode] : undefined) ??
    (errorCode !== null ? BY_SDK_CODE[errorCode] : undefined) ??
    CHECKOUT_FAILURE_REASON.UNKNOWN;
  const code = backendErrorCode ?? errorCode;
  const message =
    reason === CHECKOUT_FAILURE_REASON.UNKNOWN && code !== null
      ? `${MESSAGES[reason]} (code ${code})`
      : MESSAGES[reason];
  return { reason, message };
}
