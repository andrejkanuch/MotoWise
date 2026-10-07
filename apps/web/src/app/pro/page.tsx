import {
  ChevronDown,
  Download,
  type LucideIcon,
  MapPin,
  Receipt,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FREE_VS_PRO,
  PRO_FEATURE_KEYS,
  PRO_FEATURES,
  type ProFeatureKey,
  WEB_OFFER_COPY,
} from '@/lib/pro-plan';
import { STATIC_WEB_PLANS } from '@/lib/web-pricing';
import { PricingCard } from './pricing-card';

export const metadata: Metadata = {
  title: 'Pro — More Bikes, Unlimited AI | MotoVault',
  description: `MotoVault Pro adds unlimited bikes, unlimited AI diagnostics, unlimited receipt scans, GPX export and offline trip maps. Maintenance and expense logging stay free. ${WEB_OFFER_COPY.metaCallToAction}`,
  alternates: { canonical: 'https://motovault.app/pro' },
};

/* ── Data ─────────────────────────────────────────────────────── */

/** Icon per Pro feature; the copy itself lives in lib/pro-plan.ts. */
const FEATURE_ICONS: Record<ProFeatureKey, LucideIcon> = {
  [PRO_FEATURE_KEYS.BIKES]: Zap,
  [PRO_FEATURE_KEYS.AI_DIAGNOSTICS]: Search,
  [PRO_FEATURE_KEYS.AI_EXTRAS]: Sparkles,
  [PRO_FEATURE_KEYS.RECEIPT_SCANS]: Receipt,
  [PRO_FEATURE_KEYS.GPX_EXPORT]: Download,
  [PRO_FEATURE_KEYS.OFFLINE_MAPS]: MapPin,
};

const FAQ = [
  WEB_OFFER_COPY.billingFaq,
  {
    q: 'How do I cancel my subscription?',
    a: 'If you subscribed on the web, open your Profile and click \u201cManage subscription\u201d on the Pro banner \u2014 that opens the billing portal where you can cancel in one click. If you subscribed on iPhone or iPad, cancel in Settings \u203a your name \u203a Subscriptions; on Android, in Google Play \u203a Payments & subscriptions. Your Pro features stay active until the end of the current billing period.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes \u2014 there\u2019s no lock-in. Cancel whenever you like from the same place you subscribed (see \u201cHow do I cancel my subscription?\u201d above), and you keep Pro until the end of the period you\u2019ve already paid for.',
  },
  {
    q: 'Why subscribe vs. pay once?',
    a: 'AI diagnostics, receipt scanning and offline map data all cost us something every time you use them (AI models, Mapbox, Supabase). A subscription pays for that usage and lets us keep shipping, while logging maintenance and expenses stays free for everyone.',
  },
  {
    q: 'Is my data private?',
    a: 'Diagnostic photos are processed in real time and deleted within 24\u00a0hours. We never sell or rent personal data. Read the full privacy policy at motovault.app/privacy.',
  },
  {
    q: 'Does Pro work offline?',
    a: 'Yes \u2014 Pro lets you download a trip\u2019s maps for offline use, and your garage and maintenance log work offline on every plan. AI diagnostics, receipt scans and route discovery need a connection.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Switch from monthly to annual (or back) anytime. We pro-rate the difference automatically.',
  },
] as const;

/* ── Helpers ───────────────────────────────────────────────────── */

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-neutral-300">{value}</span>;
  }
  if (value) {
    return (
      <span className="mx-auto flex size-5 items-center justify-center rounded-full bg-warm-500/20">
        <span className="size-2.5 rounded-full bg-warm-500" />
      </span>
    );
  }
  return (
    <span className="mx-auto flex size-5 items-center justify-center text-neutral-600">
      &mdash;
    </span>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function ProPage() {
  return (
    <div className="min-h-screen text-neutral-50">
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden px-6 pt-12 pb-16 md:pt-20 md:pb-20">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-start md:gap-16">
          {/* Left: headline */}
          <div className="max-w-lg">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-4 py-1.5">
              <span className="size-2 rounded-full bg-warm-500" />
              <span className="font-mono text-[10px] tracking-[0.14em] text-neutral-400 uppercase">
                {WEB_OFFER_COPY.eyebrow}
              </span>
            </div>

            <h1 className="text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl lg:text-6xl">
              More bikes. <span className="font-serif italic text-warm-400">More AI.</span>
              <br />
              Logging stays free.
            </h1>

            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-neutral-400">
              One subscription. Unlimited bikes, unlimited AI diagnostics and receipt scans, GPX
              export and offline trip maps. Maintenance, expenses, rides and trips are free for
              every rider, forever.
            </p>

            <ul className="mt-8 space-y-2.5">
              {[
                ...WEB_OFFER_COPY.heroBullets,
                'Secure checkout \u00b7 works on iOS, Android, Web',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-neutral-300">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-warm-500/20">
                    <span className="size-1.5 rounded-full bg-warm-500" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: pricing card (client component for plan toggle) */}
          <PricingCard />
        </div>
      </section>

      {/* ═══ EVERYTHING UNLOCKED ═══ */}
      <section className="px-6 pt-20 pb-16 md:pt-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.1]">
            What Pro <span className="font-serif italic text-warm-400">adds.</span>
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-400">
            Pro is one bundle, not a tier ladder. It lifts the limits on bikes and AI, and adds GPX
            export and offline maps. Everything you log stays free.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRO_FEATURES.map((f) => {
              const Icon = FEATURE_ICONS[f.key];
              return (
                <div
                  key={f.key}
                  className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-6"
                >
                  <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-warm-500/30 bg-warm-500/10">
                    <Icon className="size-5 text-warm-400" />
                  </div>
                  <h3 className="text-[15px] font-medium">{f.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FREE vs PRO ═══ */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-3xl font-medium tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.1]">
            <span className="font-serif italic text-warm-400">Free</span> vs{' '}
            <span className="font-serif italic text-warm-400">Pro</span>
          </h2>

          <div className="overflow-hidden rounded-xl border border-neutral-800/50">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_120px] border-b border-neutral-800/50 px-6 py-3.5 sm:grid-cols-[1fr_160px_160px]">
              <span className="font-mono text-[10px] tracking-[0.14em] text-neutral-600 uppercase">
                Feature
              </span>
              <span className="text-center font-mono text-[10px] tracking-[0.14em] text-neutral-600 uppercase">
                Free
              </span>
              <span className="text-center font-mono text-[10px] tracking-[0.14em] text-warm-400 uppercase">
                Pro
              </span>
            </div>

            {FREE_VS_PRO.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-[1fr_120px_120px] items-center px-6 py-3.5 sm:grid-cols-[1fr_160px_160px] ${
                  i < FREE_VS_PRO.length - 1 ? 'border-b border-neutral-800/30' : ''
                }`}
              >
                <span className="text-sm text-neutral-300">{row.name}</span>
                <div className="text-center">
                  <FeatureValue value={row.free} />
                </div>
                <div className="text-center">
                  <FeatureValue value={row.pro} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-3xl font-medium tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.1]">
            <span className="font-serif italic text-warm-400">Questions,</span> honestly{' '}
            <span className="font-serif italic text-warm-400">answered.</span>
          </h2>

          <div className="divide-y divide-neutral-800/50 border-t border-neutral-800/50">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer items-center justify-between py-5 text-[15px] font-medium text-neutral-200 [&::-webkit-details-marker]:hidden list-none">
                  {item.q}
                  <ChevronDown className="size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-neutral-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="px-6 pt-8 pb-24 text-center md:pt-16 md:pb-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-4xl font-medium tracking-tight sm:text-5xl lg:text-7xl lg:leading-[1.05]">
            Ready when <span className="font-serif italic text-warm-400">you are.</span>
          </h2>
          <p className="mt-5 text-sm text-neutral-500">{WEB_OFFER_COPY.finalLine}</p>

          <Link
            href="/pro/checkout?plan=annual"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-8 py-4 text-sm font-medium text-neutral-200 transition-colors hover:border-warm-500/40 hover:bg-neutral-800"
          >
            {WEB_OFFER_COPY.finalCta}
          </Link>

          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 px-6 py-3">
            <span className="text-xs font-medium text-neutral-300">
              MotoVault Pro &middot; Annual
            </span>
            <span className="text-lg font-bold tabular-nums text-neutral-100">
              {STATIC_WEB_PLANS.plans.annual.price}
            </span>
            <span className="text-xs text-neutral-500">
              {STATIC_WEB_PLANS.plans.annual.period} &middot; {STATIC_WEB_PLANS.plans.annual.sub}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
