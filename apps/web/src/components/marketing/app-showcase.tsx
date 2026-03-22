import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const CAPABILITIES = [
  {
    titleKey: 'cap1Title',
    descKey: 'cap1Desc',
    screenshot: '/images/features/diagnose-flow/result-overview.png',
    altKey: 'cap1Alt',
    accentColor: 'oklch(0.76 0.13 70 / 0.12)',
    href: '/features/ai-diagnostics',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
  },
  {
    titleKey: 'cap2Title',
    descKey: 'cap2Desc',
    screenshot: '/images/features/maintenance.png',
    altKey: 'cap2Alt',
    accentColor: 'oklch(0.65 0.15 160 / 0.12)',
    href: '/features/garage-management',
    icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  },
  {
    titleKey: 'cap3Title',
    descKey: 'cap3Desc',
    screenshot: '/images/features/home.png',
    altKey: 'cap3Alt',
    accentColor: 'oklch(0.65 0.14 230 / 0.12)',
    href: '/features/learning-paths',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
] as const;

export async function AppShowcase() {
  const t = await getTranslations('AppShowcase');

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('sectionLabel')}
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('sectionTitle')}
          </h2>
        </div>

        {/* Capability cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {CAPABILITIES.map((cap, index) => (
            <Link
              key={cap.titleKey}
              href={cap.href as '/features/ai-diagnostics'}
              className="card-lift reveal-on-scroll group relative overflow-hidden rounded-2xl border border-neutral-800/60 bg-neutral-900/50 transition-colors hover:border-warm-500/30"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Glow on hover */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${cap.accentColor}, transparent 70%)`,
                }}
                aria-hidden="true"
              />

              {/* Phone screenshot */}
              <div className="relative mx-auto w-[180px] pt-8">
                <div className="relative rounded-[1.5rem] border-[4px] border-neutral-800 bg-neutral-900 p-1 shadow-xl ring-1 ring-neutral-700/50">
                  <div className="absolute left-1/2 top-0 z-10 h-3 w-14 -translate-x-1/2 rounded-b-lg bg-neutral-800" />
                  <div className="overflow-hidden rounded-[1.2rem]">
                    <Image
                      src={cap.screenshot}
                      alt={t(cap.altKey)}
                      width={1206}
                      height={2622}
                      className="block w-full transition-transform duration-500 group-hover:scale-[1.02]"
                      sizes="180px"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>

              {/* Text content */}
              <div className="relative z-10 p-6 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-800/80 text-warm-400 transition-colors group-hover:bg-warm-500/10">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4"
                      aria-hidden="true"
                    >
                      <path d={cap.icon} />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-50">{t(cap.titleKey)}</h3>
                </div>
                <p className="text-sm leading-relaxed text-neutral-400">{t(cap.descKey)}</p>

                {/* Arrow */}
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-warm-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span>{t('learnMore')}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Bottom accent */}
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
