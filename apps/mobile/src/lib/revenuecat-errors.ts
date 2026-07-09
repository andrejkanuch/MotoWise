/**
 * Classifier for RevenueCat SDK errors that are caused by the *user's device,
 * store account, or network* rather than by our integration. These fire in
 * normal operation (rooted devices, parental controls, App Store outages,
 * spotty cellular) and are non-actionable for us, so callers downgrade them to
 * a warn + breadcrumb instead of a Sentry error.
 *
 * RN Purchases rejections carry `code` = PURCHASES_ERROR_CODE (stringified
 * number) plus `userInfo.readableErrorCode`. Values are duplicated here as
 * typed constants instead of importing the enum from `react-native-purchases`,
 * because subscription.ts loads that module lazily (it must not be statically
 * imported — the native module is absent in Expo Go).
 */
const EXPECTED_RC_ERROR_CODE = {
  /** User dismissed the store purchase sheet. */
  PURCHASE_CANCELLED: '1',
  /** Play Store / App Store had a problem completing the request. */
  STORE_PROBLEM: '2',
  /** Device or account not allowed to purchase (parental controls, rooted emulator). (MOTO-VAULT-REACT-NATIVE-7) */
  PURCHASE_NOT_ALLOWED: '3',
  /** Product not available in the user's storefront/region. */
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE: '5',
  /** Transient connectivity failure — the SDK retries. (MOTO-VAULT-REACT-NATIVE-M) */
  NETWORK_ERROR: '10',
  /** RC backend rejected a receipt with an unknown store-side error. (MOTO-VAULT-REACT-NATIVE-1A) */
  UNKNOWN_BACKEND_ERROR: '16',
  /** Deferred/parent-approval payment — resolves later via customer-info listener. */
  PAYMENT_PENDING: '20',
  /**
   * Products not fetchable from the store on THIS device (region/store outage,
   * review builds). A genuine dashboard misconfiguration would show up as a
   * conversion cliff in the RC dashboard, not via per-device Sentry events.
   * (MOTO-VAULT-REACT-NATIVE-24)
   */
  CONFIGURATION_ERROR: '23',
  /** StoreKit product request timed out. */
  PRODUCT_REQUEST_TIMED_OUT: '32',
  /** SDK detected the device offline before issuing the request. */
  OFFLINE_CONNECTION_ERROR: '35',
} as const;

const EXPECTED_RC_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(EXPECTED_RC_ERROR_CODE));

/** `userInfo.readableErrorCode` equivalents of {@link EXPECTED_RC_ERROR_CODE} —
 * matched as a fallback because older SDK paths populate only one of the two. */
const EXPECTED_RC_READABLE_CODES: ReadonlySet<string> = new Set([
  'PurchaseCancelledError',
  'StoreProblemError',
  'PurchaseNotAllowedError',
  'ProductNotAvailableForPurchaseError',
  'NetworkError',
  'UnknownBackendError',
  'PaymentPendingError',
  'ConfigurationError',
  'ProductRequestTimedOutError',
  'OfflineConnectionError',
]);

type RcErrorLike = {
  code?: unknown;
  userInfo?: { readableErrorCode?: unknown };
};

export function isExpectedRevenueCatError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, userInfo } = error as RcErrorLike;
  if (typeof code === 'string' && EXPECTED_RC_ERROR_CODES.has(code)) return true;
  // Some bridge paths surface a numeric code — normalize before matching.
  if (typeof code === 'number' && EXPECTED_RC_ERROR_CODES.has(String(code))) return true;
  const readable = userInfo?.readableErrorCode;
  return typeof readable === 'string' && EXPECTED_RC_READABLE_CODES.has(readable);
}
