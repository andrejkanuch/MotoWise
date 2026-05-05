'use client';

import {
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Crown,
  PartyPopper,
  Route,
  Shield,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Polling configuration — progressive back-off via setTimeout chaining
// ---------------------------------------------------------------------------
const POLL_SCHEDULE = [
  2000,
  2000,
  2000, // polls 1-3: 2s
  4000,
  4000,
  4000,
  4000,
  4000, // polls 4-8: 4s
  6000,
  6000,
  6000,
  6000,
  6000,
  6000,
  6000, // polls 9-15: 6s
] as const;

const SESSION_KEY = 'mv_pro_poll_start';

const PRO_FEATURES = [
  { icon: Brain, label: 'Unlimited AI diagnostics' },
  { icon: Route, label: 'Route discovery & planning' },
  { icon: BarChart3, label: 'Advanced ride analytics' },
  { icon: Wrench, label: 'AI Health Reports' },
  { icon: Zap, label: 'Multi-bike garage' },
  { icon: Shield, label: 'Priority support' },
] as const;

type Status = 'polling' | 'activated' | 'timeout' | 'already_pro';

/** Check RevenueCat entitlements for 'pro' */
async function checkProEntitlement(userId: string): Promise<boolean> {
  try {
    const { Purchases } = await import('@revenuecat/purchases-js');

    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
    if (!apiKey) return false;

    if (!Purchases.isConfigured()) {
      Purchases.configure({ apiKey, appUserId: userId });
    }

    const purchases = Purchases.getSharedInstance();
    const customerInfo = await purchases.getCustomerInfo();
    const proEntitlement = customerInfo.entitlements.active.pro;
    return proEntitlement !== undefined;
  } catch {
    return false;
  }
}

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('polling');
  const [pollIndex, setPollIndex] = useState(0);
  const cancelledRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Persist poll start time for tab-resume
  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, Date.now().toString());
    }
  }, []);

  // Resolve user ID on mount
  useEffect(() => {
    (async () => {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userIdRef.current = user.id;
      }
    })();
  }, []);

  const runPoll = useCallback(async (index: number) => {
    if (cancelledRef.current) return;

    const userId = userIdRef.current;
    if (!userId) {
      // User not resolved yet — retry in 1s
      setTimeout(() => {
        if (!cancelledRef.current) runPoll(index);
      }, 1000);
      return;
    }

    const isPro = await checkProEntitlement(userId);
    if (cancelledRef.current) return;

    if (isPro) {
      setStatus('activated');
      sessionStorage.removeItem(SESSION_KEY);
      trackEvent(WebEvent.CHECKOUT_COMPLETED);
      return;
    }

    const nextIndex = index + 1;
    if (nextIndex >= POLL_SCHEDULE.length) {
      setStatus('timeout');
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    setPollIndex(nextIndex);
    const delay = POLL_SCHEDULE[nextIndex];
    setTimeout(() => {
      if (!cancelledRef.current) runPoll(nextIndex);
    }, delay);
  }, []);

  // Check if already Pro on mount, then start polling
  useEffect(() => {
    cancelledRef.current = false;

    const init = async () => {
      // Wait briefly for userId to resolve
      await new Promise((r) => setTimeout(r, 500));
      if (cancelledRef.current) return;

      const userId = userIdRef.current;
      if (userId) {
        const alreadyPro = await checkProEntitlement(userId);
        if (cancelledRef.current) return;
        if (alreadyPro) {
          setStatus('already_pro');
          sessionStorage.removeItem(SESSION_KEY);
          return;
        }
      }

      // Start polling chain
      runPoll(0);
    };

    init();

    return () => {
      cancelledRef.current = true;
    };
  }, [runPoll]);

  // Redirect for already-pro users after a brief message
  useEffect(() => {
    if (status !== 'already_pro') return;
    const timer = setTimeout(() => router.push('/pro'), 2500);
    return () => clearTimeout(timer);
  }, [status, router]);

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-neutral-950 px-4 pb-32 pt-24 text-neutral-50">
      <div className="w-full max-w-[480px] text-center">
        <div className="success-enter rounded-2xl border border-warm-500/30 bg-neutral-900/50 p-8 md:p-10">
          {/* Already Pro — redirect notice */}
          {status === 'already_pro' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-accent-500/10">
                <CheckCircle2 className="size-8 text-accent-400" />
              </div>
              <h1 className="text-3xl font-bold">You&apos;re already a Pro member</h1>
              <p className="mx-auto mt-3 max-w-sm text-neutral-400">
                Redirecting you to your Pro dashboard...
              </p>
            </>
          )}

          {/* Polling — waiting for activation */}
          {status === 'polling' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-warm-500/10">
                <div className="size-8 animate-spin rounded-full border-[3px] border-neutral-700 border-t-warm-400" />
              </div>
              <h1 className="text-3xl font-bold">Activating your Pro membership...</h1>
              <p className="mx-auto mt-3 max-w-sm text-neutral-400">
                We&apos;re confirming your subscription. This usually takes a few seconds.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500">
                <Clock className="size-3.5" />
                <span>
                  Check {pollIndex + 1} of {POLL_SCHEDULE.length}
                </span>
              </div>
            </>
          )}

          {/* Activated — success state */}
          {status === 'activated' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-warm-500/10">
                <PartyPopper className="size-8 text-warm-400" />
              </div>

              <h1 className="text-3xl font-bold">Welcome to Pro!</h1>
              <p className="mx-auto mt-3 max-w-sm text-neutral-400">
                Your 7-day free trial is active. All Pro features are now unlocked.
              </p>

              {/* Features unlocked */}
              <div className="mt-8 rounded-xl border border-neutral-800/60 bg-neutral-900/80 p-5">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <Crown className="size-4 text-warm-400" />
                  <span className="text-sm font-semibold text-warm-400">Features unlocked</span>
                </div>
                <ul className="space-y-3">
                  {PRO_FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <li key={feature.label} className="flex items-center gap-3 text-left">
                        <Icon className="size-4 shrink-0 text-accent-400" />
                        <span className="text-sm text-neutral-300">{feature.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* CTA */}
              <Link
                href="/feed"
                className="cta-primary mt-8 inline-block w-full rounded-full bg-warm-500 px-6 py-3.5 font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
              >
                Start exploring
              </Link>

              <p className="mt-4 text-xs text-neutral-500">
                Manage your subscription anytime in Settings.
              </p>
            </>
          )}

          {/* Timeout — still processing */}
          {status === 'timeout' && (
            <>
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-warm-500/10">
                <Clock className="size-8 text-warm-400" />
              </div>

              <h1 className="text-3xl font-bold">Still processing...</h1>
              <p className="mx-auto mt-3 max-w-sm text-neutral-400">
                Your payment was received but activation is taking longer than usual. Your Pro
                features will activate within a few minutes.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  href="/feed"
                  className="cta-primary inline-block w-full rounded-full bg-warm-500 px-6 py-3.5 font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
                >
                  Continue to feed
                </Link>
                <Link
                  href="/pro"
                  className="inline-block w-full rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-200"
                >
                  View Pro plans
                </Link>
              </div>

              <p className="mt-4 text-xs text-neutral-500">
                If features don&apos;t activate within 10 minutes, contact{' '}
                <a
                  href="mailto:support@motovault.app"
                  className="underline transition-colors hover:text-neutral-300"
                >
                  support@motovault.app
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
