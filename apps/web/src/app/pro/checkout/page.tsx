'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Crown, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';

const PLAN_CONFIG = {
  monthly: {
    name: 'Pro Monthly',
    price: '$5.99',
    period: 'month',
    rcPackageId: '$rc_monthly',
  },
  annual: {
    name: 'Pro Annual',
    price: '$49.99',
    period: 'year',
    rcPackageId: '$rc_annual',
  },
} as const;

type PlanId = keyof typeof PLAN_CONFIG;

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get('plan') === 'monthly' ? 'monthly' : 'annual';
  const redirectAfter = searchParams.get('redirect');

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

  // Check auth on mount
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const checkoutUrl = redirectAfter
          ? `/pro/checkout?plan=${selectedPlan}&redirect=${encodeURIComponent(redirectAfter)}`
          : `/pro/checkout?plan=${selectedPlan}`;
        router.replace(`/login?redirect=${encodeURIComponent(checkoutUrl)}`);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);
      setAuthChecked(true);
    })();
  }, [supabase, router, selectedPlan, redirectAfter]);

  const plan = PLAN_CONFIG[selectedPlan];

  const trialEndDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const handleCheckout = useCallback(async () => {
    if (loading || !userId) return;
    setLoading(true);
    setError('');

    trackEvent(WebEvent.CHECKOUT_INITIATED, { plan: selectedPlan });

    try {
      const { Purchases } = await import('@revenuecat/purchases-js');

      const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
      if (!apiKey) {
        throw new Error('RevenueCat Web API key is not configured.');
      }

      if (!Purchases.isConfigured()) {
        Purchases.configure({ apiKey, appUserId: userId });
      }

      const purchases = Purchases.getSharedInstance();
      const offerings = await purchases.getOfferings();
      const offeringId =
        process.env.NODE_ENV === 'development' ? 'default-web-test' : 'default-web';
      const webOffering = offerings.all[offeringId] ?? offerings.current;

      if (!webOffering) {
        throw new Error('No offerings available. Please try again later.');
      }

      const rcPackage = selectedPlan === 'annual' ? webOffering.annual : webOffering.monthly;

      if (!rcPackage) {
        throw new Error(`The ${selectedPlan} plan is not available right now.`);
      }

      const result = await purchases.purchase({
        rcPackage,
        customerEmail: userEmail ?? undefined,
      });

      trackEvent(WebEvent.CHECKOUT_COMPLETED, {
        plan: selectedPlan,
        transaction_id: result.storeTransaction.storeTransactionId,
      });

      const successUrl = redirectAfter
        ? `/pro/checkout/success?redirect=${encodeURIComponent(redirectAfter)}`
        : '/pro/checkout/success';
      router.push(successUrl);
    } catch (err: unknown) {
      const { PurchasesError, ErrorCode } = await import('@revenuecat/purchases-js');

      if (err instanceof PurchasesError) {
        if (err.errorCode === ErrorCode.UserCancelledError) {
          trackEvent(WebEvent.CHECKOUT_CANCELLED, { plan: selectedPlan });
          router.push('/pro/checkout/cancel');
          return;
        }
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }, [loading, userId, userEmail, selectedPlan, router, redirectAfter]);

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
              <p className="text-sm text-neutral-400">Start your 7-day free trial</p>
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
                  {id === 'annual' && (
                    <span className="ml-1.5 inline-block rounded-full bg-warm-500/20 px-1.5 py-0.5 text-[10px] font-bold text-warm-400">
                      -30%
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
                  {plan.price}/{plan.period}
                </span>
              </div>

              <div className="h-px bg-neutral-800" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">7-day free trial</span>
                <span className="text-sm font-medium text-accent-400">Free</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">Due today</span>
                <span className="text-lg font-bold text-neutral-50">$0.00</span>
              </div>

              <div className="h-px bg-neutral-800" />

              <p className="text-xs text-neutral-500">
                After your trial ends on {trialEndDate}, you will be charged{' '}
                <span className="text-neutral-400">
                  {plan.price}/{plan.period}
                </span>
                . Cancel anytime before then and you won&apos;t be charged.
              </p>
            </div>
          </div>

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
            disabled={loading}
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
              href="mailto:support@motovault.app"
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
