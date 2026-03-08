import { ExternalLink } from '@/components/marketing/external-link';

function AppleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 20.5v-17c0-.97 1.06-1.58 1.91-1.1l14.27 8.5c.83.49.83 1.7 0 2.2L4.91 21.6c-.85.48-1.91-.13-1.91-1.1Z" />
    </svg>
  );
}

export function CtaSection() {
  return (
    <>
      {/* Top gradient transition: dark → warm */}
      <div
        className="h-20 w-full"
        style={{
          background: 'linear-gradient(to bottom, var(--color-neutral-950), var(--color-warm-400))',
        }}
      />

      <section id="cta" className="bg-warm-400 px-4 py-20 md:py-28">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-center text-4xl font-extrabold tracking-tight text-primary-950 md:text-5xl">
            Ready to Master Your Motorcycle?
          </h2>

          <p className="mt-4 text-center text-lg text-primary-800">
            Join thousands of riders already learning with AI.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ExternalLink
              href="#"
              className="flex items-center gap-3 rounded-xl bg-primary-950 px-6 py-3 text-neutral-50 transition-transform active:scale-95"
            >
              <AppleIcon />
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium opacity-80">Download on the</span>
                <span className="text-base font-semibold">App Store</span>
              </div>
            </ExternalLink>

            <ExternalLink
              href="#"
              className="flex items-center gap-3 rounded-xl bg-primary-950 px-6 py-3 text-neutral-50 transition-transform active:scale-95"
            >
              <PlayIcon />
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium opacity-80">Get it on</span>
                <span className="text-base font-semibold">Google Play</span>
              </div>
            </ExternalLink>
          </div>

          <p className="mt-6 text-center text-sm text-primary-700">
            Free to download. No credit card required.
          </p>
        </div>
      </section>

      {/* Bottom gradient transition: warm → dark */}
      <div
        className="h-20 w-full"
        style={{
          background: 'linear-gradient(to bottom, var(--color-warm-400), var(--color-neutral-950))',
        }}
      />
    </>
  );
}
