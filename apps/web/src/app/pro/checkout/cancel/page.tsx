import { ArrowLeft, Crown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutTracker } from '@/components/checkout-tracker';
import { WebEvent } from '@/lib/analytics';

export const metadata: Metadata = {
  title: 'Checkout Cancelled',
  robots: { index: false, follow: false },
};

export default function CheckoutCancelPage() {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-neutral-950 px-4 pb-32 pt-24 text-neutral-50">
      <CheckoutTracker event={WebEvent.CHECKOUT_CANCELLED} />
      <div className="w-full max-w-[420px] text-center">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 md:p-10">
          {/* Icon */}
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-neutral-800/80">
            <Crown className="size-7 text-neutral-500" />
          </div>

          <h1 className="text-2xl font-bold">Checkout cancelled</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-neutral-400">
            No worries — you haven&apos;t been charged. Your free account is still active with all
            current features.
          </p>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/pro"
              className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-full bg-warm-500 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
            >
              <ArrowLeft className="size-4" />
              View plans again
            </Link>

            <Link
              href="/garage"
              className="cta-secondary inline-block w-full rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-50"
            >
              Continue with Free
            </Link>
          </div>

          <p className="mt-6 text-xs text-neutral-500">
            Questions?{' '}
            <a
              href="mailto:support@motovault.app"
              className="text-warm-500 transition-colors hover:text-warm-400"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
