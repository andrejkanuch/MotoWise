import { BarChart3, Brain, Check, Crown, Route, Shield, Wrench, X, Zap } from 'lucide-react';
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
  {
    name: 'Motorcycles in garage',
    free: '1',
    pro: 'Unlimited',
  },
  {
    name: 'AI diagnostic scans',
    free: '3 / month',
    pro: 'Unlimited',
  },
  {
    name: 'Ride recording & history',
    free: '5 rides',
    pro: 'Unlimited',
  },
  {
    name: 'Maintenance reminders',
    free: true,
    pro: true,
  },
  {
    name: 'Expense tracking',
    free: true,
    pro: true,
  },
  {
    name: 'Advanced ride analytics',
    free: false,
    pro: true,
  },
  {
    name: 'AI Health Reports',
    free: false,
    pro: true,
  },
  {
    name: 'Route discovery & planning',
    free: false,
    pro: true,
  },
  {
    name: 'Export data (CSV / PDF)',
    free: false,
    pro: true,
  },
  {
    name: 'Priority support',
    free: false,
    pro: true,
  },
] as const;

const HIGHLIGHTS = [
  {
    icon: Brain,
    title: 'Unlimited AI Diagnostics',
    description: 'Snap a photo of any issue and get instant AI-powered troubleshooting.',
  },
  {
    icon: Route,
    title: 'Route Discovery',
    description: 'Find the best riding roads near you with curated route recommendations.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Detailed ride stats, speed profiles, elevation charts, and trend tracking.',
  },
  {
    icon: Wrench,
    title: 'AI Health Reports',
    description: 'Comprehensive motorcycle health assessments with predictive maintenance alerts.',
  },
  {
    icon: Zap,
    title: 'Multi-Bike Garage',
    description: 'Track maintenance, expenses, and rides across your entire fleet.',
  },
  {
    icon: Shield,
    title: 'Priority Support',
    description: 'Get help faster with dedicated support for Pro members.',
  },
] as const;

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-neutral-300">{value}</span>;
  }
  if (value) {
    return <Check className="mx-auto size-5 text-accent-400" aria-label="Included" />;
  }
  return <X className="mx-auto size-5 text-neutral-600" aria-label="Not included" />;
}

export default function ProPage() {
  return (
    <div className="dark min-h-screen bg-neutral-950 text-neutral-50">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-24 md:pb-24 md:pt-32">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 20%, oklch(0.55 0.17 230 / 0.12), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-warm-500/30 bg-warm-500/10 px-4 py-1.5">
            <Crown className="size-4 text-warm-400" />
            <span className="text-sm font-semibold text-warm-400">MotoVault Pro</span>
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Unlock Every Feature
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            Get unlimited AI diagnostics, advanced ride analytics, multi-bike garage management, and
            everything you need to ride smarter.
          </p>

          <div className="mt-4 h-1 mx-auto w-24 rounded-full bg-signature-500" />
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`card-lift relative rounded-2xl border p-8 ${
                  plan.id === 'annual'
                    ? 'border-warm-500/50 bg-warm-500/5'
                    : 'border-neutral-800 bg-neutral-900/50'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 right-6 rounded-full bg-warm-500 px-3 py-1 text-xs font-bold text-neutral-950">
                    {plan.badge}
                  </span>
                )}
                <p className="text-sm font-medium text-neutral-400">{plan.name}</p>
                <p className="mt-2">
                  <span className="text-4xl font-bold text-neutral-50">{plan.price}</span>
                  <span className="text-neutral-500">{plan.period}</span>
                </p>
                {plan.id === 'annual' && (
                  <p className="mt-1 text-sm text-warm-400">Just $4.17/mo billed annually</p>
                )}
                <Link
                  href={`/pro/checkout?plan=${plan.id}`}
                  className="cta-primary mt-6 block w-full rounded-full bg-warm-500 px-6 py-3 text-center font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
                >
                  Start 7-day free trial
                </Link>
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Cancel anytime during trial
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">Free vs Pro</h2>

          <div className="overflow-hidden rounded-2xl border border-neutral-800">
            {/* Header */}
            <div className="grid grid-cols-3 border-b border-neutral-800 bg-neutral-900/80 px-6 py-4">
              <div className="text-sm font-medium text-neutral-400">Feature</div>
              <div className="text-center text-sm font-medium text-neutral-400">Free</div>
              <div className="text-center text-sm font-medium text-warm-400">Pro</div>
            </div>

            {/* Rows */}
            {FEATURES.map((feature, i) => (
              <div
                key={feature.name}
                className={`grid grid-cols-3 items-center px-6 py-4 ${
                  i < FEATURES.length - 1 ? 'border-b border-neutral-800/60' : ''
                } ${i % 2 === 0 ? 'bg-neutral-900/30' : ''}`}
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

      {/* Feature Highlights Grid */}
      <section className="px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-2xl font-bold sm:text-3xl">Everything in Pro</h2>
          <p className="mx-auto mb-12 max-w-xl text-center text-neutral-400">
            All the tools you need to maintain, track, and enjoy your motorcycle.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="card-lift rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-warm-500/10">
                    <Icon className="size-5 text-warm-400" />
                  </div>
                  <h3 className="text-base font-semibold text-neutral-50">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-2xl rounded-2xl border border-warm-500/20 bg-warm-500/5 p-8 text-center md:p-12">
          <Crown className="mx-auto mb-4 size-8 text-warm-400" />
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to ride smarter?</h2>
          <p className="mx-auto mt-3 max-w-md text-neutral-400">
            Start your 7-day free trial today. No credit card required until trial ends.
          </p>
          <Link
            href="/pro/checkout?plan=annual"
            className="cta-primary cta-glow mt-8 inline-block rounded-full bg-warm-500 px-8 py-3.5 font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
          >
            Start 7-day free trial
          </Link>
        </div>
      </section>

      {/* Back link */}
      <div className="px-6 pb-12 text-center">
        <Link
          href="/"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
