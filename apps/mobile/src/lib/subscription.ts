import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import type { JsonType } from '@posthog/core';
import Constants from 'expo-constants';
import type { CustomVariables } from 'react-native-purchases-ui';
import { useSubscriptionStore } from '../stores/subscription.store';
import { AnalyticsEvent, addBreadcrumb, captureException, trackEvent } from './analytics';
import { getStoredAnalyticsConsent } from './analytics-consent';
import { logger } from './logger';
import { getStoredUtmProperties } from './meta-attribution';
import { isNetworkError } from './network-error';
import { isExpectedRevenueCatError } from './revenuecat-errors';

// Module-level cached import — resolve once, reuse everywhere
let PurchasesModule: typeof import('react-native-purchases') | null = null;

async function getPurchases() {
  if (!PurchasesModule) {
    // Dynamic import for lazy loading; require fallback for Jest (where import() is unsupported)
    try {
      PurchasesModule = await import('react-native-purchases');
    } catch {
      PurchasesModule =
        require('react-native-purchases') as typeof import('react-native-purchases');
    }
  }
  return PurchasesModule?.default;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

// Shared init promise — loginRevenueCat awaits this before calling logIn
let initPromise: Promise<(() => void) | null> | null = null;

/**
 * Single error policy for every RevenueCat catch block in this module.
 * Expected user/device/store-environment errors (see revenuecat-errors.ts) and
 * transient connectivity failures are downgraded to a warn + breadcrumb;
 * anything else — a genuine integration bug — is captured to Sentry.
 * (Sentry MOTO-VAULT-REACT-NATIVE-7 / -M / -24 / -1A)
 */
function reportRevenueCatError(e: unknown, source: string): void {
  if (isNetworkError(e) || isExpectedRevenueCatError(e)) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`[RevenueCat] ${source} expected error:`, msg);
    addBreadcrumb(msg, source);
    return;
  }
  captureException(e, { source });
}

type PaywallResult = 'purchased' | 'restored' | 'cancelled' | 'not_presented' | 'error';

/**
 * Whether the bundled react-native-purchases-ui can safely receive `customVariables`.
 *
 * Currently `false`: passing them crashes the app natively on present (RN
 * purchases-ui #1622 — an uncatchable crash fixed only in native code, so it
 * cannot be delivered via OTA). Flip to `true` once the SDK is upgraded in a new
 * store build. See the gate in {@link presentPaywall}.
 */
const CUSTOM_VARIABLES_SUPPORTED = false;

type PaywallAnalyticsOptions = {
  source?: string;
  feature?: string;
  surface?: string;
  metadata?: Record<string, JsonType>;
};

type PresentPaywallOptions = PaywallAnalyticsOptions & {
  requiredEntitlementIdentifier?: string;
  offeringIdentifier?: string;
  placement?: string;
  /**
   * Onboarding answers used to personalize V2 paywall copy via custom variables
   * (`{{ custom.<key> }}` in the RC editor). Only non-empty answers are sent — any
   * absent one falls back to the default value configured for that variable in the
   * paywall editor, so copy never renders a blank.
   */
  personalization?: OnboardingAttributes;
};

function paywallProperties(
  options: PresentPaywallOptions,
  extra: Record<string, JsonType> = {},
): Record<string, JsonType> {
  return {
    source: options.source ?? 'unknown',
    feature: options.feature ?? null,
    surface: options.surface ?? null,
    placement: options.placement ?? null,
    offering_identifier: options.offeringIdentifier ?? null,
    required_entitlement_identifier: options.requiredEntitlementIdentifier ?? null,
    platform: process.env.EXPO_OS ?? 'unknown',
    sdk: 'revenuecat',
    ...(options.metadata ?? {}),
    ...extra,
  };
}

function trackPaywallResult(options: PresentPaywallOptions, result: PaywallResult) {
  const properties = paywallProperties(options, { paywall_result: result });
  trackEvent(AnalyticsEvent.PAYWALL_RESULT, properties);

  if (result === 'purchased') {
    trackEvent(AnalyticsEvent.PURCHASE_COMPLETED, properties);
  } else if (result === 'restored') {
    trackEvent(AnalyticsEvent.SUBSCRIPTION_RESTORED, properties);
  } else if (result === 'cancelled') {
    trackEvent(AnalyticsEvent.PAYWALL_DISMISSED, {
      ...properties,
      reason: 'user_cancelled',
    });
    trackEvent(AnalyticsEvent.PURCHASE_CANCELLED, properties);
  }
}

export function initRevenueCat(): Promise<(() => void) | null> {
  if (isExpoGo()) {
    return Promise.resolve(null);
  }
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}

// Exported for unit testing — sole source of isPro/isTrialing/trialDaysLeft.
export function updateStoreFromCustomerInfo(info: {
  entitlements: { active: Record<string, { periodType?: string; expirationDate?: string | null }> };
}) {
  const store = useSubscriptionStore.getState();
  const isPro = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO] !== undefined;
  store.setPro(isPro);

  const proEntitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
  if (proEntitlement?.periodType === 'TRIAL') {
    const expirationDate = proEntitlement.expirationDate;
    if (expirationDate) {
      const daysLeft = Math.ceil(
        (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      store.setTrialing(true, daysLeft);
    }
  } else {
    store.setTrialing(false);
  }
  store.setVerified(true);
}

/**
 * Restore previous purchases (e.g. from the sign-in surface). Updates the
 * subscription store from the restored entitlements and resolves to whether Pro
 * is now active. No-op in Expo Go (RC native module unavailable).
 */
export async function restorePurchases(): Promise<boolean> {
  if (isExpoGo()) return false;
  try {
    const Purchases = await getPurchases();
    if (!Purchases) return false;
    const info = await Purchases.restorePurchases();
    updateStoreFromCustomerInfo(info);
    const isPro = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO] !== undefined;
    trackEvent(AnalyticsEvent.SUBSCRIPTION_RESTORED, { is_pro: isPro });
    return isPro;
  } catch (e) {
    reportRevenueCatError(e, 'revenuecat.restorePurchases');
    return false;
  }
}

async function doInit(): Promise<(() => void) | null> {
  try {
    const Purchases = await getPurchases();

    const apiKey =
      process.env.EXPO_OS === 'ios'
        ? process.env.EXPO_PUBLIC_RC_IOS_KEY
        : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

    if (!apiKey) {
      logger.warn('[RevenueCat] No API key configured');
      return null;
    }

    await Purchases.configure({ apiKey });
    useSubscriptionStore.getState().setAvailable(true);

    // Best-effort attribution wiring (consent-gated, KTD-9), run before any
    // paywall/purchase so the write-once $mediaSource stamps the transaction
    // (KTD-6). Uses the local Purchases directly — calling configureRcAttribution()
    // here would re-await this in-flight init promise and deadlock. Never breaks init.
    if (getStoredAnalyticsConsent()) {
      await applyRcAttribution(Purchases).catch((e) =>
        reportRevenueCatError(e, 'revenuecat.doInit.attribution'),
      );
    }

    // Set up listener — store the reference for cleanup
    const listener = (info: {
      entitlements: {
        active: Record<string, { periodType?: string; expirationDate?: string | null }>;
      };
    }) => {
      updateStoreFromCustomerInfo(info);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    // Hydrate store with initial state
    const customerInfo = await Purchases.getCustomerInfo();
    updateStoreFromCustomerInfo(customerInfo);

    // Return cleanup function for useEffect
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  } catch (e) {
    reportRevenueCatError(e, 'revenuecat.doInit');
    return null;
  }
}

/**
 * Configure RevenueCat ANONYMOUSLY at launch for users who reach the paywall
 * without an account (onboarding A/B 2026 — anonymous through purchase). The
 * SDK generates an anonymous App User ID; the purchase later aliases onto the
 * Supabase UUID via {@link loginRevenueCat} when the account is created.
 *
 * Stamps `$posthogUserId` with the PostHog anonymous distinct_id so server-side
 * RevenueCat → PostHog purchase events join the same person before sign-in.
 */
export async function configureRevenueCatAnonymously(posthogDistinctId?: string): Promise<void> {
  if (isExpoGo()) return;
  const cleanup = await initRevenueCat();
  if (!cleanup || !posthogDistinctId) return;
  try {
    const Purchases = await getPurchases();
    // Only stamp while still anonymous — never clobber an identified customer.
    if (await Purchases.isAnonymous()) {
      await Purchases.setAttributes({ $posthogUserId: posthogDistinctId });
    }
  } catch (e) {
    reportRevenueCatError(e, 'revenuecat.configureRevenueCatAnonymously');
  }
}

export async function loginRevenueCat(userId: string) {
  if (isExpoGo()) return;
  // Wait for configure() to complete before calling logIn()
  const cleanup = await initRevenueCat();
  if (!cleanup) return;
  try {
    const Purchases = await getPurchases();
    await Purchases.logIn(userId);
    // Set PostHog user ID so the RevenueCat → PostHog integration can
    // match server-side subscription events to the correct PostHog user.
    await Purchases.setAttributes({ $posthogUserId: userId });
    await Purchases.syncAttributesAndOfferingsIfNeeded?.();
  } catch (e) {
    reportRevenueCatError(e, 'revenuecat.loginRevenueCat');
  }
}

/**
 * Run a RevenueCat operation behind the shared readiness guard + error policy.
 * Replaces the repeated `isExpoGo / await init / getPurchases / try-catch /
 * error-downgrade` ladder that every attribute writer otherwise copies.
 * No-op (resolves) in Expo Go or before init completes; errors follow the
 * shared {@link reportRevenueCatError} policy. Never throws — RC attribute
 * writes are best-effort.
 */
async function withRevenueCat(
  label: string,
  run: (Purchases: NonNullable<Awaited<ReturnType<typeof getPurchases>>>) => Promise<void>,
): Promise<void> {
  if (isExpoGo()) return;
  const cleanup = await initRevenueCat();
  if (!cleanup) return;
  try {
    const Purchases = await getPurchases();
    await run(Purchases);
  } catch (e) {
    reportRevenueCatError(e, `revenuecat.${label}`);
  }
}

/**
 * Custom (non-reserved) RevenueCat customer attribute holding the user's
 * self-reported acquisition channel ("How did you hear about us?"). It is a
 * plain custom key — NOT a reserved `$`-prefixed attribution key — because the
 * reserved keys (`$mediaSource`, `$campaign`, …) are WRITE-ONCE and reserved
 * for real ad/deep-link attribution (see {@link configureRcAttribution}).
 * A self-reported value must stay mutable, so it lives in its own custom key.
 */
export const SELF_REPORTED_SOURCE_ATTRIBUTE = 'self_reported_source';

/**
 * Push the self-reported acquisition channel to RevenueCat as a custom customer
 * attribute. Best-effort and safe to skip: the durable HDYHAU→paid join is the
 * PostHog person (stitched via `$posthogUserId`); this attribute is a convenience
 * for RC-dashboard segmentation. No-op for empty values or in Expo Go.
 */
export async function setSelfReportedSource(source: string | null | undefined): Promise<void> {
  const value = source?.trim();
  if (!value) return;
  await withRevenueCat('setSelfReportedSource', (Purchases) =>
    Purchases.setAttributes({ [SELF_REPORTED_SOURCE_ATTRIBUTE]: value }),
  );
}

/**
 * Apply attribution collection on an already-resolved Purchases instance:
 * device identifiers + the Apple AdServices (ASA) token, plus the reserved
 * write-once `$mediaSource`/`$campaign` from a REAL deep-link UTM only.
 *
 * Never set `$mediaSource` for organic (`organic_unknown` or absent): the key is
 * write-once and a manual organic value would permanently block the ASA token
 * from attributing a real Apple Search Ads install (KTD-5).
 */
async function applyRcAttribution(
  Purchases: NonNullable<Awaited<ReturnType<typeof getPurchases>>>,
): Promise<void> {
  await Purchases.collectDeviceIdentifiers();
  // iOS-only; documented no-op elsewhere, but guard to keep intent explicit.
  if (process.env.EXPO_OS === 'ios') {
    await Purchases.enableAdServicesAttributionTokenCollection();
  }
  const utm = await getStoredUtmProperties();
  const mediaSource = utm?.utm_source;
  if (mediaSource && mediaSource !== 'organic_unknown') {
    await Purchases.setAttributes({
      $mediaSource: mediaSource,
      ...(utm?.utm_campaign ? { $campaign: utm.utm_campaign } : {}),
    });
  }
}

/**
 * Wire RevenueCat attribution, gated on the persisted analytics consent (device
 * identifiers `$idfv`/`$ip` are personal data — KTD-9). Idempotent: RC ignores
 * write-once overwrites, so this is safe to call from `doInit`, from
 * {@link setAnalyticsEnabled} on opt-in, and again at the paywall as a fallback
 * for tagged second-launch installs (KTD-6). Routes through {@link withRevenueCat},
 * so it must NOT be called from inside `doInit` itself (that would re-await the
 * in-flight init promise) — `doInit` calls {@link applyRcAttribution} directly.
 */
let rcAttributionPromise: Promise<void> | null = null;

export async function configureRcAttribution(): Promise<void> {
  if (!getStoredAnalyticsConsent()) return;
  // Dedup overlapping calls — rapid consent toggles and the paywall fallback can
  // invoke this concurrently, and we must not issue concurrent native RC attribute
  // writes (collectDeviceIdentifiers / setAttributes). Share one in-flight run, then
  // release so a genuinely later call can run again.
  if (!rcAttributionPromise) {
    rcAttributionPromise = withRevenueCat('configureRcAttribution', applyRcAttribution).finally(
      () => {
        rcAttributionPromise = null;
      },
    );
  }
  await rcAttributionPromise;
}

/**
 * RevenueCat customer-attribute keys used for paywall personalization.
 *
 * ⚠️ Single source of truth — these strings MUST match the `{{ subscriber.<key> }}`
 * variables referenced in the RevenueCat dashboard paywall editor. Renaming a key
 * here without updating the dashboard (or vice-versa) silently breaks substitution.
 */
export const PAYWALL_ATTRIBUTE = {
  PRIMARY_GOAL: 'primary_goal',
  PRIMARY_BIKE_MAKE: 'primary_bike_make',
  PRIMARY_BIKE_MODEL: 'primary_bike_model',
  PRIMARY_BIKE_YEAR: 'primary_bike_year',
  RIDING_EXPERIENCE: 'riding_experience',
} as const;

export type PaywallAttribute = (typeof PAYWALL_ATTRIBUTE)[keyof typeof PAYWALL_ATTRIBUTE];

/** Onboarding answers projected onto RevenueCat customer attributes. */
export type OnboardingAttributes = {
  /** Primary riding goal (e.g. 'track_rides') — drives the goal-specific copy variant. */
  primaryGoal?: string | null;
  bikeMake?: string | null;
  bikeModel?: string | null;
  bikeYear?: number | null;
  /** Experience level (e.g. 'beginner') — tone variant. */
  experience?: string | null;
};

/**
 * Declarative projection from onboarding answers → RevenueCat attributes.
 *
 * To add a new personalization attribute: add its key to {@link PAYWALL_ATTRIBUTE},
 * add the source field to {@link OnboardingAttributes}, then add one entry here.
 * Nothing else in the pipeline changes — {@link setOnboardingAttributes} is fully
 * data-driven off this spec.
 */
const ONBOARDING_ATTRIBUTE_SPEC: ReadonlyArray<{
  key: PaywallAttribute;
  select: (a: OnboardingAttributes) => string | number | null | undefined;
}> = [
  { key: PAYWALL_ATTRIBUTE.PRIMARY_GOAL, select: (a) => a.primaryGoal },
  { key: PAYWALL_ATTRIBUTE.PRIMARY_BIKE_MAKE, select: (a) => a.bikeMake },
  { key: PAYWALL_ATTRIBUTE.PRIMARY_BIKE_MODEL, select: (a) => a.bikeModel },
  { key: PAYWALL_ATTRIBUTE.PRIMARY_BIKE_YEAR, select: (a) => a.bikeYear },
  { key: PAYWALL_ATTRIBUTE.RIDING_EXPERIENCE, select: (a) => a.experience },
];

/** Coerce an onboarding value into an RC attribute string, or null to delete it. */
function toAttributeValue(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Push onboarding answers to RevenueCat as **customer attributes**.
 *
 * NOTE: customer attributes are NOT substituted into paywall text — RC has no
 * `{{ subscriber.* }}` variable. They drive **targeting**: Placements, Audiences,
 * Experiments, and segmentation/export. Paywall *copy* is personalized separately,
 * via custom variables — see {@link buildPaywallCustomVariables} and the
 * `personalization` option on {@link presentPaywall}.
 *
 * Empty / missing answers are sent as `null`, which *deletes* the attribute, so
 * stale answers from a previous run never leak into targeting.
 *
 * Call before presenting the onboarding paywall. Idempotent and safe to repeat.
 */
export async function setOnboardingAttributes(attrs: OnboardingAttributes): Promise<void> {
  // Transient connectivity failures are non-critical and SDK-retried — withRevenueCat
  // downgrades them to a warn + breadcrumb so they don't flood Sentry. (MOTO-VAULT-REACT-NATIVE-M)
  await withRevenueCat('setOnboardingAttributes', async (Purchases) => {
    const payload = Object.fromEntries(
      ONBOARDING_ATTRIBUTE_SPEC.map(({ key, select }) => [key, toAttributeValue(select(attrs))]),
    );
    await Purchases.setAttributes(payload);
    await Purchases.syncAttributesAndOfferingsIfNeeded?.();
  });
}

/**
 * Project onboarding answers onto RC Paywalls v2 **custom variables** for copy
 * substitution (`{{ custom.<key> }}`). Reuses {@link ONBOARDING_ATTRIBUTE_SPEC} so
 * the variable names match the customer-attribute keys one-to-one.
 *
 * Only non-empty values are included: an omitted key falls back to the default value
 * set for that variable in the paywall editor, so the copy never renders blank.
 *
 * Takes the `CustomVariableValue` factory as an argument so this stays a pure mapping
 * (the factory comes from the dynamically-imported `react-native-purchases-ui`).
 */
function buildPaywallCustomVariables(
  attrs: OnboardingAttributes,
  factory: typeof import('react-native-purchases-ui').CustomVariableValue,
): CustomVariables {
  const entries = ONBOARDING_ATTRIBUTE_SPEC.flatMap(({ key, select }) => {
    const value = toAttributeValue(select(attrs));
    return value === null ? [] : ([[key, factory.string(value)]] as const);
  });
  return Object.fromEntries(entries);
}

/**
 * Present the RevenueCat remote paywall.
 * Uses the paywall configured in the RevenueCat dashboard.
 *
 * By default uses `offerings.current` which is controlled by RevenueCat
 * Experiments — if an experiment is active, the user is automatically
 * assigned a variant and the correct offering is returned as `current`.
 *
 * @param options.requiredEntitlementIdentifier - Only show if user lacks this entitlement
 * @param options.offeringIdentifier - Force a specific offering (bypasses experiments)
 * @param options.placement - Use a RevenueCat Placement to serve the offering for this
 *   paywall location. Placements allow per-location A/B tests (e.g. "onboarding",
 *   "settings", "feature_gate"). Falls back to `offerings.current` if no placement
 *   is configured in the RC dashboard.
 * @returns 'purchased' | 'restored' | 'cancelled' | 'not_presented' | 'error'
 */
export async function presentPaywall(options: PresentPaywallOptions = {}): Promise<PaywallResult> {
  trackEvent(AnalyticsEvent.PAYWALL_PRESENT_REQUESTED, paywallProperties(options));

  if (isExpoGo()) {
    logger.warn('[RevenueCat] Paywall not available in Expo Go');
    trackPaywallResult(options, 'not_presented');
    return 'not_presented';
  }

  // Ensure RevenueCat is configured before calling getOfferings() — fixes
  // race condition where presentPaywall is called before init completes.
  await initRevenueCat();

  // Fallback attribution wiring (KTD-6): covers the case where a tagged deep link
  // only landed on a later launch (after doInit already ran with an empty store).
  // Consent-gated + idempotent (write-once keys ignore re-sets); fire-and-forget.
  void configureRcAttribution();

  try {
    const Purchases = await getPurchases();
    const RevenueCatUI = await import('react-native-purchases-ui');
    const { PAYWALL_RESULT } = RevenueCatUI;

    const offerings = await Purchases.getOfferings();

    // Resolve the offering to present:
    // 1. Explicit offeringIdentifier (bypasses experiments — use for one-off products like health_report)
    // 2. Placement-based offering (for per-location A/B tests via RC dashboard)
    // 3. offerings.current (controlled by RC Experiments — default path)
    let offering: (typeof offerings)['current'] | undefined;
    if (options.offeringIdentifier) {
      offering = offerings.all[options.offeringIdentifier] ?? offerings.current ?? undefined;
    } else if (options.placement) {
      offering =
        (await Purchases.getCurrentOfferingForPlacement(options.placement)) ??
        offerings.current ??
        undefined;
    } else {
      offering = offerings.current ?? undefined;
    }

    trackEvent(
      AnalyticsEvent.PAYWALL_VIEWED,
      paywallProperties(options, {
        resolved_offering_identifier:
          (offering as { identifier?: string } | undefined)?.identifier ?? null,
      }),
    );

    // Personalize V2 paywall copy via custom variables ({{ custom.* }}).
    // Omitted keys fall back to the editor's default value for that variable.
    //
    // ⚠️ Passing customVariables to the native paywall hard-crashes the app on the
    // currently bundled react-native-purchases-ui — an uncatchable native crash
    // (not a JS error we can try/catch), triggered on every present that supplies
    // them. Only the onboarding paywall passes `personalization`, so it was the
    // only surface that crashed (RN purchases-ui #1622). The upstream fix lives in
    // native code (PaywallViewWrapper), so it can only ship with a new store build,
    // never via OTA — hence this gate. Keep it off until the SDK is bumped in a
    // native build, then flip CUSTOM_VARIABLES_SUPPORTED to re-enable copy
    // substitution. Targeting personalization via setOnboardingAttributes (customer
    // attributes) is unaffected; only {{ custom.* }} copy falls back to editor
    // defaults, which every variable already has.
    const customVariables =
      CUSTOM_VARIABLES_SUPPORTED && options.personalization
        ? buildPaywallCustomVariables(options.personalization, RevenueCatUI.CustomVariableValue)
        : undefined;

    const result = options.requiredEntitlementIdentifier
      ? await RevenueCatUI.default.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: options.requiredEntitlementIdentifier,
          offering,
          customVariables,
        })
      : await RevenueCatUI.default.presentPaywall({ offering, customVariables });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        trackPaywallResult(options, 'purchased');
        return 'purchased';
      case PAYWALL_RESULT.RESTORED:
        trackPaywallResult(options, 'restored');
        return 'restored';
      case PAYWALL_RESULT.NOT_PRESENTED:
        trackPaywallResult(options, 'not_presented');
        return 'not_presented';
      case PAYWALL_RESULT.ERROR:
        trackPaywallResult(options, 'error');
        return 'error';
      default:
        trackPaywallResult(options, 'cancelled');
        return 'cancelled';
    }
  } catch (e) {
    reportRevenueCatError(e, 'revenuecat.presentPaywall');
    trackPaywallResult(options, 'error');
    return 'error';
  }
}

export async function logoutRevenueCat() {
  if (isExpoGo()) return;
  const cleanup = await initRevenueCat();
  if (!cleanup) return;
  try {
    const Purchases = await getPurchases();
    const anonymous = await Purchases.isAnonymous();
    if (anonymous) return;
    await Purchases.logOut();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Suppress known non-fatal error when logOut is called for anonymous users
    const isAnonymousError = msg.toLowerCase().includes('anonymous');
    logger.warn('[RevenueCat] logOut skipped:', msg);
    if (!isAnonymousError) {
      reportRevenueCatError(e, 'revenuecat.logoutRevenueCat');
    }
  }
}
