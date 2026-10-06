'use client';

import { GetTrialEligibilityDocument } from '@motovault/graphql';
import type { Offering, Package } from '@revenuecat/purchases-js';
import * as Sentry from '@sentry/nextjs';
import { createBrowserClient } from '@supabase/ssr';
import { Crown, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { getCampaignParams } from '@/lib/campaign';
import {
  describeCheckoutError,
  isReportableCheckoutFailure,
  SUPPORT_EMAIL,
} from '@/lib/checkout-errors';
import { gqlFetcher } from '@/lib/graphql-client';
import {
  annualSavingsPercent,
  WEB_PLAN_IDS,
  type WebPlanId,
  type WebPrice,
} from '@/lib/web-pricing';

/**
 * Display names and billing periods only. Prices come from the RevenueCat
 * package (`webBillingProduct.currentPrice`) — what Stripe will actually charge.
 */
const PLAN_CONFIG = {
  [WEB_PLAN_IDS.MONTHLY]: { name: 'Pro Monthly', period: 'month' },
  [WEB_PLAN_IDS.ANNUAL]: { name: 'Pro Annual', period: 'year' },
} as const;

type PlanId = WebPlanId;

const OFFERING_STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
} as const;

type OfferingStatus = (typeof OFFERING_STATUS)[keyof typeof OFFERING_STATUS];

const PRICE_PLACEHOLDER = '\u2014';

function packageFor(offering: Offering | null, plan: PlanId): Package | null {
  if (!offering) return null;
  return (plan === WEB_PLAN_IDS.ANNUAL ? offering.annual : offering.monthly) ?? null;
}

function priceOf(pkg: Package | null): WebPrice | null {
  const price = pkg?.webBillingProduct.currentPrice;
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

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual';
  const redirectAfter = searchParams.get('redirect');
  // RevenueCat's own query-param name, so a per-platform code in a bio link
  // (e.g. /pro/checkout?plan=annual&discount_code=INSTA20) arrives pre-applied.
  const discountCode = searchParams.get('discount_code') ?? undefined;

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    [],
  );

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
  const planPrice = rcPackage?.webBillingProduct.currentPrice.formattedPrice ?? PRICE_PLACEHOLDER;
  const savingsPercent = annualSavingsPercent(
    priceOf(packageFor(webOffering, WEB_PLAN_IDS.MONTHLY)),
    priceOf(packageFor(webOffering, WEB_PLAN_IDS.ANNUAL)),
  );
  const canPurchase = offeringStatus === OFFERING_STATUS.READY && rcPackage !== null;
  const trialDays = hasUsedTrial
    ? null
    : durationToDays(rcPackage?.webBillingProduct.freeTrialPhase?.periodDuration);

  const trialEndDate = useMemo(() => {
    if (!trialDays) return null;
    const date = new Date();
    date.setDate(date.getDate() + trialDays);
    return date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
        throw new Error('No offerings available. Please try again later.');
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="size-8 animate-spin rounded-full border-2 border-neutral-700 border-t-warm-500" />
      </div>
    );
  }

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-neutral-950 px-4 pb-32 pt-24 text-neutral-50">
      <div className="w-full max-w-[480px]">
        <Link
          href="/pro"
          className="mb-6 inline-block text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          &larr; Back to plans
        </Link>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warm-500/10">
              <Crown className="size-5 text-warm-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-50">Upgrade to Pro</h1>
              <p className="text-sm text-neutral-400">
                {trialDays ? `Start your ${trialDays}-day free trial` : 'Upgrade to MotoVault Pro'}
              </p>
            </div>
          </div>

          {/* Plan Toggle */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-neutral-800/50 p-1">
            {(Object.entries(PLAN_CONFIG) as [PlanId, (typeof PLAN_CONFIG)[PlanId]][]).map(
              ([id, cfg]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedPlan(id)}
                  className={`relative rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    selectedPlan === id
                      ? 'bg-neutral-700 text-neutral-50 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-300'
                  }`}
                >
                  {cfg.name}
                  {id === WEB_PLAN_IDS.ANNUAL && savingsPercent !== null && (
                    <span className="ml-1.5 inline-block rounded-full bg-warm-500/20 px-1.5 py-0.5 text-[10px] font-bold text-warm-400">
                      -{savingsPercent}%
                    </span>
                  )}
                </button>
              ),
            )}
          </div>

          {/* Order Summary */}
          <div className="mb-6 rounded-xl border border-neutral-800/60 bg-neutral-900/80 p-5">
            <h2 className="mb-4 text-sm font-medium text-neutral-400">Order summary</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">{plan.name}</span>
                <span className="font-semibold text-neutral-50">
                  {planPrice}/{plan.period}
                </span>
              </div>

              <div className="h-px bg-neutral-800" />

              {trialDays && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-300">{trialDays}-day free trial</span>
                  <span className="text-sm font-medium text-accent-400">Free</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">Due today</span>
                <span className="text-lg font-bold text-neutral-50">
                  {trialDays ? '$0.00' : planPrice}
                </span>
              </div>

              <div className="h-px bg-neutral-800" />

              {trialDays ? (
                <p className="text-xs text-neutral-500">
                  After your trial ends on {trialEndDate}, you will be charged{' '}
                  <span className="text-neutral-400">
                    {planPrice}/{plan.period}
                  </span>
                  . Cancel anytime before then and you won&apos;t be charged.
                </p>
              ) : (
                <p className="text-xs text-neutral-500">
                  Billed{' '}
                  <span className="text-neutral-400">
                    {planPrice}/{plan.period}
                  </span>{' '}
                  today and on each renewal. Cancel anytime.
                </p>
              )}
            </div>
          </div>

          {/* Offering could not be loaded: say so instead of a dead Pay button. */}
          {offeringStatus === OFFERING_STATUS.UNAVAILABLE && !error && (
            <div role="alert" className="mb-4 text-sm text-danger-500">
              <p>
                Checkout is temporarily unavailable. Please try again in a few minutes, or contact{' '}
                {SUPPORT_EMAIL}.
              </p>
              <button
                type="button"
                onClick={retryOfferingLoad}
                className="mt-2 font-medium text-neutral-300 underline underline-offset-2 transition-colors hover:text-neutral-50"
              >
                Try again
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="mb-4 text-sm text-danger-500">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading || !canPurchase}
            className="cta-primary flex w-full items-center justify-center gap-2 rounded-full bg-warm-500 px-6 py-3.5 font-semibold text-neutral-950 transition-colors hover:bg-warm-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="size-5 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950" />
                Processing...
              </>
            ) : (
              <>
                <Lock className="size-4" />
                Confirm &amp; Pay
              </>
            )}
          </button>

          {/* Security note */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
            <ShieldCheck className="size-3.5" />
            <span>Secured by Stripe via RevenueCat</span>
          </div>

          {/* Legal */}
          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <Link href="/terms" className="transition-colors hover:text-neutral-300">
              Terms of Service
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-neutral-300">
              Privacy Policy
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="transition-colors hover:text-neutral-300"
            >
              Refund Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-950">
          <div className="size-8 animate-spin rounded-full border-2 border-neutral-700 border-t-warm-500" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
