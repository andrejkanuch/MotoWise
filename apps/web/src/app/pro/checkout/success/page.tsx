import { BarChart3, Brain, Crown, PartyPopper, Route, Shield, Wrench, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Welcome to Pro!',
  robots: { index: false, follow: false },
};

const PRO_FEATURES = [
  { icon: Brain, label: 'Unlimited AI diagnostics' },
  { icon: Route, label: 'Route discovery & planning' },
  { icon: BarChart3, label: 'Advanced ride analytics' },
  { icon: Wrench, label: 'AI Health Reports' },
  { icon: Zap, label: 'Multi-bike garage' },
  { icon: Shield, label: 'Priority support' },
] as const;

export default function CheckoutSuccessPage() {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-neutral-950 px-4 pb-32 pt-24 text-neutral-50">
      <div className="w-full max-w-[480px] text-center">
        <div className="success-enter rounded-2xl border border-warm-500/30 bg-neutral-900/50 p-8 md:p-10">
          {/* Icon */}
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
        </div>
      </div>
    </div>
  );
}
