'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const HERO_BENEFITS = [
  'Unlimited AI diagnostic scans',
  'Unlimited bikes in your garage',
  'Multi-day trip planning + GPX export',
  'Route discovery & curated rides',
  'Advanced ride analytics & lean angle',
  'AI Health Reports \u2014 monthly summary',
  'Export everything (CSV / PDF)',
  'Priority support \u2014 24h reply',
] as const;

const PLANS = {
  monthly: { price: '$5.99', period: '/mo', sub: '$5.99 / month', crossed: null },
  annual: { price: '$49.99', period: '/yr', sub: '$4.17 / month \u00b7 billed yearly', crossed: '$71.88' },
} as const;

type Plan = keyof typeof PLANS;

export function PricingCard() {
  const [plan, setPlan] = useState<Plan>('annual');
  const p = PLANS[plan];

  return (
    <div className="w-full max-w-sm md:ml-auto">
      <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/40 p-6">
        {/* Plan toggle */}
        <div className="flex rounded-full border border-neutral-800 bg-neutral-900/60 p-1">
          <button
            type="button"
            onClick={() => setPlan('monthly')}
            className={`flex-1 rounded-full py-2 text-center text-xs transition-colors ${
              plan === 'monthly'
                ? 'bg-neutral-800 font-medium text-neutral-200'
                : 'text-neutral-500'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPlan('annual')}
            className={`flex-1 items-center justify-center gap-2 rounded-full py-2 text-center text-xs transition-colors ${
              plan === 'annual'
                ? 'bg-neutral-800 font-medium text-neutral-200'
                : 'text-neutral-500'
            }`}
          >
            Annual{' '}
            <span className="ml-1.5 inline-flex rounded-full bg-warm-500 px-2 py-0.5 text-[10px] font-bold text-neutral-950">
              &minus;30%
            </span>
          </button>
        </div>

        {/* Price */}
        <div className="mt-6 flex items-baseline gap-2">
          <span className="text-5xl font-bold tabular-nums tracking-tight">{p.price}</span>
          <span className="text-sm text-neutral-500">{p.period}</span>
          {p.crossed && <span className="ml-auto text-sm text-neutral-600 line-through">{p.crossed}</span>}
        </div>
        <p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] text-warm-400 uppercase">
          {p.sub}
        </p>

        {/* Benefits list */}
        <ul className="mt-6 space-y-3">
          {HERO_BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3 text-[13px] text-neutral-300">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-warm-500/20">
                <span className="size-1.5 rounded-full bg-warm-500" />
              </span>
              {b}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href={`/pro/checkout?plan=${plan}`}
          className="mt-7 flex items-center justify-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-6 py-3.5 text-sm font-medium text-neutral-200 transition-colors hover:border-warm-500/40 hover:bg-neutral-800"
        >
          Start 7-day free trial &rarr;
        </Link>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-600">
          <Lock className="size-3" />
          Secured by Stripe via RevenueCat &middot; No charge today
        </p>
      </div>
    </div>
  );
}
