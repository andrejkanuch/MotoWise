import { Check, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pro — Unlock Every Feature',
  description:
    'Upgrade to MotoVault Pro for unlimited AI diagnostics, advanced ride analytics, multi-bike garage, and more. Start your 7-day free trial.',
};

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$5.99',
    period: '/mo',
    badge: null,
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$49.99',
    period: '/yr',
    badge: 'Save 30%',
  },
] as const;

const FEATURES = [
  { name: 'Motorcycles in garage', free: '1', pro: 'Unlimited' },
  { name: 'AI diagnostic scans', free: '3 / month', pro: 'Unlimited' },
  { name: 'Ride recording & history', free: '5 rides', pro: 'Unlimited' },
  { name: 'Maintenance reminders', free: true, pro: true },
  { name: 'Expense tracking', free: true, pro: true },
  { name: 'Advanced ride analytics', free: false, pro: true },
  { name: 'AI Health Reports', free: false, pro: true },
  { name: 'Route discovery & planning', free: false, pro: true },
  { name: 'Export data (CSV / PDF)', free: false, pro: true },
  { name: 'Priority support', free: false, pro: true },
] as const;

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-neutral-300">{value}</span>;
  }
  if (value) {
    return <Check className="mx-auto size-4 text-accent-400" aria-label="Included" />;
  }
  return <X className="mx-auto size-4 text-neutral-700" aria-label="Not included" />;
}

export default function ProPage() {
  return (
    <div className="min-h-screen text-neutral-50">
      {/* Hero — simple, no gradient glow */}
      <section className="px-6 pt-16 pb-12 md:pt-24">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">MotoVault Pro</h1>
          <p className="mt-3 max-w-xl text-base text-neutral-400">
            Unlimited diagnostics, ride analytics, multi-bike garage, and everything you need to
            ride smarter. Try free for 7 days.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 ${
                  plan.id === 'annual'
                    ? 'border-warm-500/40 bg-warm-500/[0.03]'
                    : 'border-neutral-800/60'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 right-5 rounded-full bg-warm-500 px-2.5 py-0.5 text-xs font-bold text-neutral-950">
                    {plan.badge}
                  </span>
                )}
                <p className="text-sm text-neutral-400">{plan.name}</p>
                <p className="mt-1">
                  <span className="text-3xl font-bold tabular-nums text-neutral-50">
                    {plan.price}
                  </span>
                  <span className="text-sm text-neutral-500">{plan.period}</span>
                </p>
                {plan.id === 'annual' && (
                  <p className="mt-1 text-xs text-warm-400">$4.17/mo billed annually</p>
                )}
                <Link
                  href={`/pro/checkout?plan=${plan.id}`}
                  className="mt-5 block rounded-lg bg-warm-500 px-5 py-2.5 text-center text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
                >
                  Start free trial
                </Link>
                <p className="mt-2 text-center text-xs text-neutral-600">Cancel anytime</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-xl font-semibold">Free vs Pro</h2>

          <div className="overflow-hidden rounded-xl border border-neutral-800/60">
            <div className="grid grid-cols-3 border-b border-neutral-800/60 bg-neutral-900/50 px-5 py-3">
              <div className="text-sm text-neutral-500">Feature</div>
              <div className="text-center text-sm text-neutral-500">Free</div>
              <div className="text-center text-sm font-medium text-warm-400">Pro</div>
            </div>

            {FEATURES.map((feature, i) => (
              <div
                key={feature.name}
                className={`grid grid-cols-3 items-center px-5 py-3 ${
                  i < FEATURES.length - 1 ? 'border-b border-neutral-800/30' : ''
                }`}
              >
                <div className="text-sm text-neutral-300">{feature.name}</div>
                <div className="text-center">
                  <FeatureValue value={feature.free} />
                </div>
                <div className="text-center">
                  <FeatureValue value={feature.pro} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
