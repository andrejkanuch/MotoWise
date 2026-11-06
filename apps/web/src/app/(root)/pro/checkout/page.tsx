'use client';

import { GetTrialEligibilityDocument } from '@motovault/graphql';
import type { Offering, Package } from '@revenuecat/purchases-js';
import * as Sentry from '@sentry/nextjs';
import { ArrowLeft, CircleAlert, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MvLoader } from '@/components/marketing/loader';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { getCampaignParams } from '@/lib/campaign';
import {
  describeCheckoutError,
  isReportableCheckoutFailure,
  SUPPORT_EMAIL,
} from '@/lib/checkout-errors';
import { gqlFetcher } from '@/lib/graphql-client';
import { CUSTOM_PAYWALL_IDS, trackCustomPaywallImpression } from '@/lib/revenuecat';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import {
  annualSavingsPercent,
  formatMicros,
  WEB_PLAN_IDS,
  type WebPlanId,
  type WebPrice,
} from '@/lib/web-pricing';
import '../pro.css';

/**
 * Display names and billing periods only. Prices come from the RevenueCat
 * package (`product.currentPrice`) — what Stripe will actually charge.
 */
const PLAN_CONFIG = {
  [WEB_PLAN_IDS.MONTHLY]: { name: 'Pro monthly', period: 'month' },
  [WEB_PLAN_IDS.ANNUAL]: { name: 'Pro annual', period: 'year' },
} as const;

type PlanId = WebPlanId;

const OFFERING_STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
} as const;

type OfferingStatus = (typeof OFFERING_STATUS)[keyof typeof OFFERING_STATUS];

const PRICE_PLACEHOLDER = '—';
const PRICES_PENDING = 'Loading prices…';

function packageFor(offering: Offering | null, plan: PlanId): Package | null {
  if (!offering) return null;
  return (plan === WEB_PLAN_IDS.ANNUAL ? offering.annual : offering.monthly) ?? null;
}

function priceOf(pkg: Package | null): WebPrice | null {
  const price = pkg?.product.currentPrice;
  return price ? { amountMicros: price.amountMicros, currency: price.currency } : null;
}

const WEB_OFFERING_ID = process.env.NODE_ENV === 'development' ? 'default-web-test' : 'default-web';

/** ISO 8601 duration → days, for the trial phase RevenueCat reports (P7D, P1W, P1M). */
function durationToDays(iso: string | null | undefined): number | null {
  const match = iso?.match(/^P(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/);
  if (!match) return null;
  const [, months, weeks, days] = match;
  return Number(months ?? 0) * 30 + Number(weeks ?? 0) * 7 + Number(days ?? 0) || null;
}

async function loadWebOffering(userId: string): Promise<Offering | null> {
  const { Purchases } = await import('@revenuecat/purchases-js');
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
  if (!apiKey) {
    throw new Error('RevenueCat Web API key is not configured.');
  }
  if (!Purchases.isConfigured()) {
    Purchases.configure({ apiKey, appUserId: userId });
  }
  const offerings = await Purchases.getSharedInstance().getOfferings();
  return offerings.all[WEB_OFFERING_ID] ?? offerings.current ?? null;
}

function Waiting() {
  return (
    <div className="mvp-wait" role="status" aria-live="polite">
      <MvLoader size="sm" label="Loading" />
    </div>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual';
  const redirectAfter = searchParams.get('redirect');
  // RevenueCat's own query-param name, so a per-platform code in a bio link
  // (e.g. /pro/checkout?plan=annual&discount_code=INSTA20) arrives pre-applied.
  const discountCode = searchParams.get('discount_code') ?? undefined;

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [webOffering, setWebOffering] = useState<Offering | null>(null);
  const [offeringStatus, setOfferingStatus] = useState<OfferingStatus>(OFFERING_STATUS.LOADING);
  // Bumped by "Try again" so a transient offering-load failure is recoverable
  // without a full page reload.
  const [offeringAttempt, setOfferingAttempt] = useState(0);
  // One trial per person, on any platform (docs/RevenueCat-Trial-Audit-2026-09-19.md).
  // Starts true so the page never promises a trial before the answer is in.
  const [hasUsedTrial, setHasUsedTrial] = useState(true);
  // One RevenueCat impression per visit: "Try again" and Strict Mode re-run the
  // offering effect, and every call would count as another paywall view.
  const impressionTracked = useRef(false);

  // Check auth on mount
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Keep every query param (plan, redirect, discount_code) across sign-in.
        const params = new URLSearchParams(searchParams.toString());
        params.set('plan', selectedPlan);
        const checkoutUrl = `/pro/checkout?${params.toString()}`;
        router.replace(`/login?redirect=${encodeURIComponent(checkoutUrl)}`);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);
      setAuthChecked(true);
    })();
  }, [supabase, router, selectedPlan, searchParams]);

  // Resolve what this customer can actually buy: the RevenueCat offering (whose
  // trial phase reflects Web Billing's own eligibility) and our cross-store
  // trial history. Either failing leaves the no-trial copy, never the reverse.
  // biome-ignore lint/correctness/useExhaustiveDependencies: offeringAttempt is the "Try again" trigger, intentionally not read
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [offering, eligibility] = await Promise.all([
        loadWebOffering(userId).catch((err: unknown) => {
          // Without an offering nobody can buy — never swallow this silently.
          trackEvent(WebEvent.CHECKOUT_OFFERING_UNAVAILABLE, {
            offering_id: WEB_OFFERING_ID,
            reason: 'load_failed',
          });
          Sentry.captureException(err, {
            tags: { area: 'checkout', op: 'loadWebOffering' },
            extra: { offeringId: WEB_OFFERING_ID },
          });
          return undefined;
        }),
        gqlFetcher(GetTrialEligibilityDocument).catch(() => null),
      ]);
      if (cancelled) return;
      const resolved = offering ?? null;
      if (offering === null) {
        trackEvent(WebEvent.CHECKOUT_OFFERING_UNAVAILABLE, {
          offering_id: WEB_OFFERING_ID,
          reason: 'not_found',
        });
        Sentry.captureMessage('Web checkout offering not found', {
          level: 'error',
          tags: { area: 'checkout', op: 'loadWebOffering' },
          extra: { offeringId: WEB_OFFERING_ID },
        });
      }
      setWebOffering(resolved);
      setOfferingStatus(resolved ? OFFERING_STATUS.READY : OFFERING_STATUS.UNAVAILABLE);
      // The paywall is on screen once its prices are: report the view to
      // RevenueCat so its paywall analytics count this visitor.
      if (resolved && !impressionTracked.current) {
        impressionTracked.current = true;
        void trackCustomPaywallImpression(CUSTOM_PAYWALL_IDS.WEB_CHECKOUT, resolved).then(
          (tracked) => {
            if (!tracked) {
              Sentry.captureMessage('RevenueCat custom paywall impression not tracked', {
                level: 'warning',
                tags: { area: 'checkout', op: 'trackCustomPaywallImpression' },
                extra: { offeringId: resolved.identifier },
              });
            }
          },
        );
      }
      setHasUsedTrial(eligibility?.me.hasUsedTrial !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, offeringAttempt]);

  const retryOfferingLoad = useCallback(() => {
    setOfferingStatus(OFFERING_STATUS.LOADING);
    setOfferingAttempt((attempt) => attempt + 1);
  }, []);

  const plan = PLAN_CONFIG[selectedPlan];
  const rcPackage = packageFor(webOffering, selectedPlan);
  const planPrice = rcPackage?.product.currentPrice.formattedPrice ?? PRICE_PLACEHOLDER;
  // Zero in the package's own currency: the trial rows must never show "$" to a
  // rider who is billed in euros.
  const nothingDue = rcPackage
    ? formatMicros(0, rcPackage.product.currentPrice.currency)
    : PRICE_PLACEHOLDER;
  const savingsPercent = annualSavingsPercent(
    priceOf(packageFor(webOffering, WEB_PLAN_IDS.MONTHLY)),
    priceOf(packageFor(webOffering, WEB_PLAN_IDS.ANNUAL)),
  );
  const canPurchase = offeringStatus === OFFERING_STATUS.READY && rcPackage !== null;
  const trialDays = hasUsedTrial
    ? null
    : durationToDays(rcPackage?.product.freeTrialPhase?.periodDuration);

  // The trial ends on a local day, in the rider's own locale: a UTC date
  // showed yesterday east of UTC after 22:00. `undefined` = the browser's
  // default locale (the locale-contract test forbids a dynamic tag here).
  const trialEndDate = useMemo(() => {
    if (!trialDays) return null;
    const date = new Date();
    date.setDate(date.getDate() + trialDays);
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }, [trialDays]);

  const handleCheckout = useCallback(async () => {
    if (loading || !userId || !canPurchase) return;
    setLoading(true);
    setError('');

    // First-touch source rides along on both events and into the purchase
    // metadata, so a web purchase can be traced back to the social post.
    const campaign = getCampaignParams() ?? {};
    trackEvent(WebEvent.CHECKOUT_INITIATED, { plan: selectedPlan, ...campaign });

    try {
      const offering = webOffering ?? (await loadWebOffering(userId));
      if (!offering) {
        throw new Error(
          `The plans didn't load. Try again in a few minutes, or write to ${SUPPORT_EMAIL}.`,
        );
      }

      const pkg = selectedPlan === 'annual' ? offering.annual : offering.monthly;
      if (!pkg) {
        throw new Error(`The ${selectedPlan} plan is not available right now.`);
      }

      const { Purchases } = await import('@revenuecat/purchases-js');
      const result = await Purchases.getSharedInstance().purchase({
        rcPackage: pkg,
        customerEmail: userEmail ?? undefined,
        metadata: { ...campaign, ...(discountCode ? { discount_code: discountCode } : {}) },
        ...(discountCode ? { discountCode, showDiscountCodeField: true } : {}),
      });

      trackEvent(WebEvent.CHECKOUT_COMPLETED, {
        plan: selectedPlan,
        transaction_id: result.storeTransaction.storeTransactionId,
        ...campaign,
        ...(discountCode ? { discount_code: discountCode } : {}),
      });

      const successUrl = redirectAfter
        ? `/pro/checkout/success?redirect=${encodeURIComponent(redirectAfter)}`
        : '/pro/checkout/success';
      router.push(successUrl);
    } catch (err: unknown) {
      const { PurchasesError, ErrorCode } = await import('@revenuecat/purchases-js');
      const isPurchasesError = err instanceof PurchasesError;

      if (isPurchasesError && err.errorCode === ErrorCode.UserCancelledError) {
        trackEvent(WebEvent.CHECKOUT_CANCELLED, { plan: selectedPlan });
        router.push('/pro/checkout/cancel');
        return;
      }

      const errorCode = isPurchasesError ? err.errorCode : null;
      const backendErrorCode = isPurchasesError ? (err.extra?.backendErrorCode ?? null) : null;
      const statusCode = isPurchasesError ? (err.extra?.statusCode ?? null) : null;
      const failure = describeCheckoutError({ errorCode, backendErrorCode });

      trackEvent(WebEvent.CHECKOUT_FAILED, {
        plan: selectedPlan,
        reason: failure.reason,
        error_code: errorCode,
        backend_error_code: backendErrorCode,
        status_code: statusCode,
      });
      if (isReportableCheckoutFailure(failure.reason)) {
        Sentry.captureException(err, {
          tags: { area: 'checkout', op: 'purchase' },
          extra: { plan: selectedPlan, errorCode, backendErrorCode, statusCode },
        });
      }
      setError(failure.message);
      setLoading(false);
    }
  }, [
    loading,
    userId,
    userEmail,
    selectedPlan,
    router,
    redirectAfter,
    webOffering,
    discountCode,
    canPurchase,
  ]);

  if (!authChecked) {
    return <Waiting />;
  }

  const pricesLoading = offeringStatus === OFFERING_STATUS.LOADING;
  const priceLine = `${planPrice} / ${plan.period}`;
  /** A figure slot while the offering loads: says so instead of a dash. */
  const figureOrPending = (figure: string) =>
    pricesLoading ? (
      <span className="mvp-summary-pending">{PRICES_PENDING}</span>
    ) : (
      <span className="mv-figure">{figure}</span>
    );

  return (
    <section className="mvp-section mvp-section--operate">
      <Link href="/pro" className="mv-link is-quiet is-tall mvp-back">
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        Back to plans
      </Link>

      <div className="mvp-operate-head">
        <h1 className="mv-section-title mvp-operate-title">
          {trialDays ? `Start your ${trialDays}-day free trial` : 'Upgrade to Pro'}
        </h1>
        <p className="mvp-operate-sub">
          {trialDays
            ? 'Full Pro access from today. Nothing is charged until the trial ends.'
            : 'Full Pro access the moment you subscribe. Cancel any time from your profile.'}
        </p>
      </div>

      <div className="mvp-operate-stack">
        {/* Plan toggle */}
        <fieldset className="mv-segmented mvp-seg">
          <legend className="mvp-sr-only">Plan</legend>
          {(Object.entries(PLAN_CONFIG) as [PlanId, (typeof PLAN_CONFIG)[PlanId]][]).map(
            ([id, cfg]) => (
              <button
                key={id}
                type="button"
                aria-pressed={selectedPlan === id}
                onClick={() => setSelectedPlan(id)}
              >
                {cfg.name}
                {id === WEB_PLAN_IDS.ANNUAL && savingsPercent !== null && (
                  <span className="mvp-seg-saving">&minus;{savingsPercent}%</span>
                )}
              </button>
            ),
          )}
        </fieldset>

        {/* Order summary: the one card */}
        <div className="mvp-summary" aria-live="polite" aria-busy={pricesLoading || undefined}>
          <div className="mvp-summary-row">
            <strong>{plan.name}</strong>
            {figureOrPending(priceLine)}
          </div>
          {trialDays && (
            <div className="mvp-summary-row">
              <span>{trialDays}-day free trial</span>
              <span className="mv-figure">{nothingDue}</span>
            </div>
          )}
          <div className="mvp-summary-row mvp-summary-row--total">
            <strong>Due today</strong>
            {figureOrPending(trialDays ? nothingDue : planPrice)}
          </div>
          {/* Without a trial the "Due today" row says it all. */}
          {trialDays && (
            <p className="mvp-summary-note">
              After the trial ends on {trialEndDate} you are charged <strong>{priceLine}</strong>.
              Cancel before then and nothing is charged.
            </p>
          )}
        </div>

        {/* Offering could not be loaded: say so instead of a dead Pay button. */}
        {offeringStatus === OFFERING_STATUS.UNAVAILABLE && !error && (
          <div role="alert" className="mv-alert mvp-alert">
            <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
            <div>
              <p>The plans didn't load. Try again in a few minutes, or write to {SUPPORT_EMAIL}.</p>
              <button
                type="button"
                onClick={retryOfferingLoad}
                className="mv-link is-quiet is-tall mvp-alert-action"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mv-alert mvp-alert">
            <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || !canPurchase}
            aria-busy={loading || undefined}
            className="mv-btn mv-btn-primary mv-btn-block"
          >
            {loading ? (
              <>
                <svg
                  className="mvp-spinner"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                </svg>
                Opening secure checkout…
              </>
            ) : (
              <>
                <Lock size={16} strokeWidth={2} aria-hidden="true" />
                {trialDays ? 'Start free trial' : 'Confirm and pay'}
              </>
            )}
          </button>
          <p className="mvp-secure">
            <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
            Secured by Stripe via RevenueCat
          </p>
          <div className="mvp-legal">
            <Link href="/terms">Terms of service</Link>
            <Link href="/privacy">Privacy policy</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Refunds: email {SUPPORT_EMAIL}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Waiting />}>
      <CheckoutContent />
    </Suspense>
  );
}
