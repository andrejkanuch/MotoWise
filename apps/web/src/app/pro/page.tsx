import {
  BarChart3,
  ChevronDown,
  Download,
  Heart,
  Lock,
  MapPin,
  Search,
  Star,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pro — Unlock Every Feature | MotoVault',
  description:
    'Upgrade to MotoVault Pro for unlimited AI diagnostics, advanced ride analytics, multi-bike garage, and more. Start your 7-day free trial.',
};

/* ── Data ─────────────────────────────────────────────────────── */

const HERO_BENEFITS = [
  'Unlimited AI diagnostic scans',
  'Unlimited bikes in your garage',
  'Multi-day trip planning + GPX export',
  'Route discovery & curated rides',
  'Advanced ride analytics & lean angle',
  'AI Health Reports — monthly summary',
  'Export everything (CSV / PDF)',
  'Priority support — 24h reply',
] as const;

const STATS = [
  { value: '1,200', suffix: '+', label: 'Riders on MotoVault' },
  { value: '2,400', suffix: '', label: 'Bikes tracked' },
  { value: '18k', suffix: '', label: 'Service entries' },
  { value: '340k', suffix: 'km', label: 'Kilometres logged' },
] as const;

const PRO_FEATURES = [
  {
    icon: Search,
    title: 'Unlimited AI diagnostics',
    description:
      'Snap a photo of any part or warning light. Get severity, fix steps, and parts cost — no scan limit.',
  },
  {
    icon: MapPin,
    title: 'Multi-day trip planning',
    description:
      'Typed waypoints (fuel, food, passes), rider RSVPs, GPX export, offline-ready maps for the whole route.',
  },
  {
    icon: Zap,
    title: 'Unlimited bikes',
    description:
      'Daily commuter, track day weapon, vintage project — all in one garage, each with its own service history.',
  },
  {
    icon: BarChart3,
    title: 'Advanced ride analytics',
    description:
      'Lean angle, max speed, elevation, sector splits, and cost-per-km. See exactly how you ride and what it costs.',
  },
  {
    icon: Heart,
    title: 'AI Health Reports',
    description:
      "Monthly summary of every bike: what's due, what's overdue, what AI noticed in your photos. Catch issues early.",
  },
  {
    icon: Download,
    title: 'Export everything',
    description:
      'Full CSV / PDF export of garage, service log, expenses, and rides. Your data stays yours, forever.',
  },
] as const;

const COMPARISON = [
  { name: 'Motorcycles in garage', free: '1', pro: 'Unlimited' },
  { name: 'AI diagnostic scans', free: '3 / month', pro: 'Unlimited' },
  { name: 'Ride recording & history', free: '5 rides', pro: 'Unlimited' },
  { name: 'Maintenance reminders', free: true, pro: true },
  { name: 'Expense tracking', free: true, pro: true },
  { name: 'Multi-day trip planning', free: false, pro: true },
  { name: 'Route discovery', free: false, pro: true },
  { name: 'Advanced ride analytics', free: false, pro: true },
  { name: 'AI Health Reports', free: false, pro: true },
  { name: 'Export data (CSV / PDF)', free: false, pro: true },
  { name: 'Priority support', free: false, pro: true },
] as const;

const TESTIMONIALS = [
  {
    text: 'Diagnosed a chain tension issue I\u2019d been ignoring. Saved me a breakdown on a 600\u00a0km trip.',
    highlight: 'Saved me a breakdown',
    author: 'Marek J.',
    bike: 'KTM 790 Adv \u00b7 Slovakia',
  },
  {
    text: 'The trip planner with rider RSVPs is the only reason our group actually shows up on time.',
    highlight: 'actually shows up',
    author: 'Carla P.',
    bike: 'BMW R1250GS \u00b7 Italy',
  },
  {
    text: 'Cost-per-km finally told me my old commuter was costing more than buying a new bike. Sold it the same week.',
    highlight: 'Sold it the same week.',
    author: 'Andrew T.',
    bike: 'Honda CB500F \u00b7 UK',
  },
  {
    text: 'Multi-bike garage means my 1990 SR400 project, my daily, and my track Yamaha all stay separate. Service histories don\u2019t get mixed up.',
    highlight: 'stay separate.',
    author: 'Jules R.',
    bike: '3 bikes \u00b7 France',
  },
] as const;

const FAQ = [
  {
    q: 'How does the 7-day free trial work?',
    a: 'You get full Pro access immediately. We don\u2019t charge until day 7 \u2014 and we send you an email reminder 48\u00a0hours before that. Cancel anytime in your account settings; no questions, no friction.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account settings or the App Store / Google Play subscription panel. Your Pro features stay active until the end of the current billing period.',
  },
  {
    q: 'Why subscribe vs. pay once?',
    a: 'AI diagnostics, route data, and ride analytics all need ongoing infrastructure (Anthropic, Mapbox, Supabase). A subscription lets us keep the model up to date and ship new features instead of charging for every release.',
  },
  {
    q: 'Is my data private?',
    a: 'Diagnostic photos are processed in real time and deleted within 24\u00a0hours. We never sell or rent personal data. Read the full privacy policy at motovault.app/privacy.',
  },
  {
    q: 'Does Pro work offline?',
    a: 'Yes \u2014 your garage, maintenance log, and downloaded GPX routes all work offline. AI diagnostics and route discovery need a connection.',
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
                MotoVault Pro &middot; 7 days free
              </span>
            </div>

            <h1 className="text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl lg:text-6xl">
              Unlock <span className="font-serif italic text-warm-400">every feature.</span>
              <br />
              Ride smarter.
            </h1>

            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-neutral-400">
              One subscription. Unlimited AI diagnostics, multi-day trip planning, advanced ride
              analytics, unlimited bikes. Built specifically for motorcycles, by people who actually
              ride.
            </p>

            <ul className="mt-8 space-y-2.5">
              {[
                '7-day free trial — full Pro access',
                'Cancel anytime, no charge before day 7',
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

          {/* Right: pricing card */}
          <div className="w-full max-w-sm md:ml-auto">
            <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/40 p-6">
              {/* Plan toggle */}
              <div className="flex rounded-full border border-neutral-800 bg-neutral-900/60 p-1">
                <span className="flex-1 rounded-full py-2 text-center text-xs text-neutral-500">
                  Monthly
                </span>
                <span className="flex-1 items-center justify-center gap-2 rounded-full bg-neutral-800 py-2 text-center text-xs font-medium text-neutral-200">
                  Annual{' '}
                  <span className="ml-1.5 inline-flex rounded-full bg-warm-500 px-2 py-0.5 text-[10px] font-bold text-neutral-950">
                    −30%
                  </span>
                </span>
              </div>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-5xl font-bold tabular-nums tracking-tight">$49.99</span>
                <span className="text-sm text-neutral-500">/yr</span>
                <span className="ml-auto text-sm text-neutral-600 line-through">$71.88</span>
              </div>
              <p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] text-warm-400 uppercase">
                $4.17 / month &middot; billed yearly
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
                href="/pro/checkout?plan=annual"
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
        </div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section className="border-y border-neutral-800/50 bg-neutral-950/50 px-6 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold tracking-tight text-warm-400 sm:text-3xl">
                {s.value}
                {s.suffix && <span className="font-serif italic text-warm-400/70">{s.suffix}</span>}
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-neutral-500 uppercase">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ EVERYTHING UNLOCKED ═══ */}
      <section className="px-6 pt-20 pb-16 md:pt-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.1]">
            Everything <span className="font-serif italic text-warm-400">unlocked.</span>
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-400">
            Pro is one bundle, not a tier ladder. Every feature, every bike, every ride — for the
            price of three coffees a month.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRO_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-6"
              >
                <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-warm-500/30 bg-warm-500/10">
                  <f.icon className="size-5 text-warm-400" />
                </div>
                <h3 className="text-[15px] font-medium">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{f.description}</p>
              </div>
            ))}
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

            {COMPARISON.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-[1fr_120px_120px] items-center px-6 py-3.5 sm:grid-cols-[1fr_160px_160px] ${
                  i < COMPARISON.length - 1 ? 'border-b border-neutral-800/30' : ''
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

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-3xl font-medium tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.1]">
            <span className="font-serif italic text-warm-400">Real</span> riders.{' '}
            <span className="font-serif italic text-warm-400">Real</span> saves.
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-6"
              >
                <div className="mb-3 flex gap-0.5 text-warm-400">
                  {['s1', 's2', 's3', 's4', 's5'].map((k) => (
                    <Star key={k} className="size-3.5 fill-warm-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-neutral-300">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-4 border-t border-neutral-800/40 pt-4">
                  <p className="text-sm font-medium">{t.author}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{t.bike}</p>
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
          <p className="mt-5 text-sm text-neutral-500">
            7 days free. No charge today. Cancel with one tap.
          </p>

          <Link
            href="/pro/checkout?plan=annual"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-8 py-4 text-sm font-medium text-neutral-200 transition-colors hover:border-warm-500/40 hover:bg-neutral-800"
          >
            Start free trial &middot; $0 today
          </Link>

          <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 px-6 py-3">
            <span className="text-xs font-medium text-neutral-300">
              MotoVault Pro &middot; Annual
            </span>
            <span className="text-lg font-bold tabular-nums text-neutral-100">$49.99</span>
            <span className="text-xs text-neutral-500">/yr &middot; $4.17/mo</span>
          </div>
        </div>
      </section>
    </div>
  );
}
