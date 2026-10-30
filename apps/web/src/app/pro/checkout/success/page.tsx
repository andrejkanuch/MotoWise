'use client';

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import {
  Bike,
  Clock,
  Download,
  type LucideIcon,
  MapPin,
  Receipt,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BikePlate } from '@/components/marketing/bike-plate';
import { MvLoader } from '@/components/marketing/loader';
import { clearProStatusCache } from '@/hooks/use-pro-status';
import { SUPPORT_EMAIL } from '@/lib/checkout-errors';
import { PRO_FEATURE_KEYS, PRO_FEATURES, type ProFeatureKey } from '@/lib/pro-plan';
import { getRevenueCatCustomerInfo } from '@/lib/revenuecat';
import { safeRedirectPath } from '@/lib/safe-redirect';
import '../../pro.css';

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

/** Icon per Pro feature; labels come from lib/pro-plan.ts so they match /pro. */
const FEATURE_ICONS: Record<ProFeatureKey, LucideIcon> = {
  [PRO_FEATURE_KEYS.BIKES]: Bike,
  [PRO_FEATURE_KEYS.AI_DIAGNOSTICS]: ScanSearch,
  [PRO_FEATURE_KEYS.AI_EXTRAS]: Sparkles,
  [PRO_FEATURE_KEYS.RECEIPT_SCANS]: Receipt,
  [PRO_FEATURE_KEYS.GPX_EXPORT]: Download,
  [PRO_FEATURE_KEYS.OFFLINE_MAPS]: MapPin,
};

/** The Bike Plate that settles in once Pro is live: the page's one authored moment. */
const PRO_PLATE = {
  figure: 'Unlimited',
  unit: 'bikes',
  racingNumber: '27',
} as const;

type Status = 'polling' | 'activated' | 'timeout' | 'already_pro';

/** Pro entitlement state after checkout; `trialing` drives the welcome copy. */
async function checkProEntitlement(
  userId: string,
): Promise<{ isPro: boolean; isTrialing: boolean }> {
  try {
    const customerInfo = await getRevenueCatCustomerInfo(userId);
    const entitlement = customerInfo?.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
    return { isPro: entitlement !== undefined, isTrialing: entitlement?.periodType === 'trial' };
  } catch {
    return { isPro: false, isTrialing: false };
  }
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get('redirect'));
  const [status, setStatus] = useState<Status>('polling');
  const [isTrialing, setIsTrialing] = useState(false);
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

    const { isPro, isTrialing: trialing } = await checkProEntitlement(userId);
    if (cancelledRef.current) return;

    if (isPro) {
      setIsTrialing(trialing);
      setStatus('activated');
      sessionStorage.removeItem(SESSION_KEY);
      clearProStatusCache();
      // checkout_completed fires once, on the checkout page when the purchase
      // resolves (with plan, transaction id and source) — not again here.
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
        const { isPro: alreadyPro } = await checkProEntitlement(userId);
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

  const continueLabel = redirectTo === '/garage' ? 'Open your garage' : 'Back to the trip';

  return (
    <section className="mvp-section mvp-section--operate">
      {/* Already Pro — redirect notice */}
      {status === 'already_pro' && (
        <div className="mvp-operate-head">
          <h1 className="mvp-h2 mvp-h2--operate">You already have Pro</h1>
          <p className="mvp-operate-sub">Taking you back to the plan page.</p>
        </div>
      )}

      {/* Polling — waiting for activation */}
      {status === 'polling' && (
        <>
          <div className="mvp-operate-head">
            <h1 className="mvp-h2 mvp-h2--operate">Activating Pro</h1>
            <p className="mvp-operate-sub">
              Confirming your subscription. This usually takes a few seconds.
            </p>
          </div>
          <div className="mvp-progress" aria-live="polite">
            <MvLoader size="sm" />
            <span>
              Check {pollIndex + 1} of {POLL_SCHEDULE.length}
            </span>
          </div>
        </>
      )}

      {/* Activated — success state: the plate settles in */}
      {status === 'activated' && (
        <>
          <div className="mvp-operate-head">
            <h1 className="mvp-h2 mvp-h2--operate">Pro is active</h1>
            <p className="mvp-operate-sub">
              {isTrialing
                ? 'Your free trial has started. Every Pro limit is lifted on this account.'
                : 'Your subscription is live. Every Pro limit is lifted on this account.'}
            </p>
          </div>

          <div className="mvp-success-plate" aria-hidden="true">
            <BikePlate
              figure={PRO_PLATE.figure}
              unit={PRO_PLATE.unit}
              caption={isTrialing ? 'Pro trial active' : 'Pro active'}
              racingNumber={PRO_PLATE.racingNumber}
              identity="MotoVault Pro · every device"
              state="ready"
            />
          </div>

          <ul className="mvp-unlocked" aria-label="Unlocked with Pro">
            {PRO_FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.key];
              return (
                <li key={feature.key}>
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {feature.title}
                </li>
              );
            })}
          </ul>

          <div className="mvp-actions">
            <Link href={redirectTo} className="mv-btn mv-btn-primary">
              {continueLabel}
            </Link>
          </div>

          <p className="mvp-after">
            Manage or cancel the subscription any time from your{' '}
            <Link href="/profile" className="mvp-quiet-link">
              profile
            </Link>
            .
          </p>
        </>
      )}

      {/* Timeout — still processing */}
      {status === 'timeout' && (
        <>
          <div className="mvp-operate-head">
            <h1 className="mvp-h2 mvp-h2--operate">Still activating</h1>
            <p className="mvp-operate-sub">
              Your payment went through, but activation is taking longer than usual. Pro switches on
              within a few minutes.
            </p>
          </div>
          <div className="mvp-progress">
            <Clock size={16} strokeWidth={2} aria-hidden="true" />
            <span>Checked {POLL_SCHEDULE.length} times</span>
          </div>

          <div className="mvp-actions">
            <Link href={redirectTo} className="mv-btn mv-btn-primary">
              {continueLabel}
            </Link>
            <Link href="/pro" className="mv-btn mv-btn-ghost">
              View Pro plans
            </Link>
          </div>

          <p className="mvp-after">
            If nothing has changed after 10 minutes, write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mvp-quiet-link">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </>
      )}
    </section>
  );
}
