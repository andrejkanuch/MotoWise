import { getTranslations } from 'next-intl/server';

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4 text-warm-500"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

const TESTIMONIAL_KEYS = [0, 1, 2, 3, 4] as const;

export async function Testimonials() {
  const t = await getTranslations('Testimonials');

  return (
    <section className="py-32">
      <div className="mx-auto max-w-7xl px-4">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl">
            {t('sectionTitle')}
          </h2>
        </div>
      </div>

      {/* Horizontal scroll */}
      <section
        aria-label={t('sectionTitle')}
        className="reveal-on-scroll overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-lg"
      >
        <div className="flex gap-5 px-4 md:px-[max(1rem,calc((100vw-80rem)/2+1rem))]">
          {TESTIMONIAL_KEYS.map((index) => (
            <article
              key={index}
              className="card-lift group relative w-[340px] shrink-0 rounded-2xl border-2 border-neutral-800 bg-neutral-900/70 p-6 transition-colors hover:border-warm-500/40"
            >
              {/* Glow on hover */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 0%, oklch(0.65 0.14 230 / 0.06), transparent 70%)',
                }}
                aria-hidden="true"
              />

              <div className="relative z-10">
                {/* Stars */}
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static star list
                    <StarIcon key={i} />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="line-clamp-4 text-base leading-relaxed text-neutral-300 italic">
                  &ldquo;{t(`items.${index}.quote`)}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="mt-4 border-t border-neutral-800 pt-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-50">{t(`items.${index}.name`)}</p>
                    <span className="rounded-full bg-warm-500/15 px-2 py-0.5 text-xs font-medium text-warm-400 border border-warm-500/30">
                      {t('badge')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">{t(`items.${index}.bike`)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
