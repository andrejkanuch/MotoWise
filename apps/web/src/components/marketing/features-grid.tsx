const FEATURES = [
  {
    key: 'diag',
    title: 'AI Diagnostics',
    tagline: 'Snap a photo. Get answers.',
    description:
      'Point your camera at any part, warning light, or issue. Our AI identifies components, diagnoses problems, and suggests fixes — all in seconds.',
    accentClass: 'text-primary-400',
    glowColor: 'oklch(0.65 0.14 230 / 0.05)',
    hoverGlow: 'oklch(0.65 0.14 230 / 0.1)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M3 9V6a3 3 0 0 1 3-3h3" />
        <path d="M15 3h3a3 3 0 0 1 3 3v3" />
        <path d="M21 15v3a3 3 0 0 1-3 3h-3" />
        <path d="M9 21H6a3 3 0 0 1-3-3v-3" />
      </svg>
    ),
  },
  {
    key: 'learn',
    title: 'Learning Paths',
    tagline: 'Structured courses for every skill level.',
    description:
      'Dive into Engine Internals, Suspension Tuning, Electrical Systems, and Routine Maintenance — each with lessons, quizzes, and hands-on challenges.',
    accentClass: 'text-accent-400',
    glowColor: 'oklch(0.65 0.15 160 / 0.05)',
    hoverGlow: 'oklch(0.65 0.15 160 / 0.1)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M9 7h6" />
        <path d="M9 11h4" />
      </svg>
    ),
  },
  {
    key: 'garage',
    title: 'Garage Management',
    tagline: 'Track your bikes.',
    description:
      'Store every bike by make, model, and year. Log maintenance, set service reminders, and keep a complete history so nothing gets missed.',
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.76 0.13 70 / 0.05)',
    hoverGlow: 'oklch(0.76 0.13 70 / 0.1)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94L6.73 20.2a2 2 0 0 1-2.83 0l-.1-.1a2 2 0 0 1 0-2.83l6.73-6.73A6 6 0 0 1 18.47 2.53" />
      </svg>
    ),
  },
  {
    key: 'progress',
    title: 'Progress Tracking',
    tagline: 'Master your knowledge.',
    description:
      'Level up as you complete lessons and ace quizzes. Earn badges, track scores across modules, and watch your expertise grow over time.',
    accentClass: 'text-accent-400',
    glowColor: 'oklch(0.65 0.15 160 / 0.05)',
    hoverGlow: 'oklch(0.65 0.15 160 / 0.1)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 5 5-9" />
      </svg>
    ),
  },
  {
    key: 'community',
    title: 'Community',
    tagline: 'Join fellow riders.',
    description:
      'Share your garage, compare progress, and learn alongside riders at every level. Motorcycle knowledge is better together.',
    accentClass: 'text-primary-300',
    glowColor: 'oklch(0.76 0.1 230 / 0.05)',
    hoverGlow: 'oklch(0.76 0.1 230 / 0.1)',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
] as const;

export function FeaturesGrid() {
  return (
    <section id="features" className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="reveal-on-scroll mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            Built for Riders
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">
            Everything you need to learn, maintain, and master your motorcycle.
          </p>
        </div>

        {/* Bento grid */}
        <div className="features-bento grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.key}
              className={`reveal-on-scroll group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 md:p-8 ${
                feature.key === 'diag'
                  ? 'md:col-span-2 lg:[grid-area:diag]'
                  : feature.key === 'learn'
                    ? 'lg:row-span-2 lg:[grid-area:learn]'
                    : feature.key === 'garage'
                      ? 'lg:row-span-2 lg:[grid-area:garage]'
                      : feature.key === 'progress'
                        ? 'lg:row-span-2 lg:[grid-area:progress]'
                        : 'lg:[grid-area:community]'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Inner radial glow */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${feature.glowColor}, transparent 70%)`,
                }}
              />

              {/* Hover glow overlay */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${feature.hoverGlow}, transparent 70%)`,
                }}
              />

              {/* Content */}
              <div className="relative z-10 flex h-full flex-col">
                {/* Icon */}
                <div
                  className={`mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 ${feature.accentClass}`}
                >
                  {feature.icon}
                </div>

                <h3 className="text-lg font-semibold text-neutral-50">{feature.title}</h3>
                <p className={`mt-1 text-sm font-medium ${feature.accentClass}`}>
                  {feature.tagline}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
