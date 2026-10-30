import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import '@/components/marketing/design-system.css';
import { GoBackButton, TelemetryPath } from '@/components/not-found-client';

// Root-level not-found.tsx has no access to the [locale] segment,
// so next-intl translations are unavailable here. Strings are hardcoded in English.
// See: https://next-intl.dev/docs/environments/error-files

const WHERE_TO_LINKS = [
  { href: '/explore', title: 'Explore routes', desc: 'Rides by country and region' },
  { href: '/features/trip-planning', title: 'Trip planning', desc: 'Multi-day routes and GPX' },
  { href: '/features/garage-management', title: 'Garage', desc: 'Every bike, every record' },
  { href: '/features/maintenance', title: 'Maintenance', desc: 'Service history and reminders' },
] as const;

/*
 * Two columns on the ramp: the message on the ground, a quiet map stage one
 * step deeper. Condensed headline, body face, one copper action. The route
 * drawing is authored SVG in tokens and does not move.
 */
const NOT_FOUND_CSS = `
.nf { min-height: 100vh; display: grid; grid-template-columns: 1.1fr 1fr; }
.nf-msg {
  display: flex; flex-direction: column; justify-content: center;
  padding: 140px 72px 80px;
  background: var(--mv-bg);
}
.nf-status {
  display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;
  margin: 0 0 24px;
  font-size: 14px; line-height: 20px; color: var(--mv-ink-3);
}
.nf-status .mv-figure { font-size: 18px; color: var(--mv-ink-2); }
.nf-title {
  margin: 0 0 20px;
  font-family: var(--mv-font-display); font-weight: 700;
  font-size: clamp(64px, 9vw, 128px); line-height: 0.92; letter-spacing: 0.002em;
  color: var(--mv-ink); text-wrap: balance;
}
.nf-lede { max-width: 46ch; margin: 0 0 12px; font-size: 17px; line-height: 1.55; color: var(--mv-ink-2); text-wrap: pretty; }
.nf-path { margin: 0 0 36px; font-size: 14px; line-height: 20px; color: var(--mv-ink-3); overflow-wrap: anywhere; }
.nf-telemetry-val { font-family: var(--mv-font-mono); font-size: 13px; color: var(--mv-ink-2); }
.nf-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 56px; }
.nf-btn {
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 48px; padding: 0 22px;
  border-radius: var(--mv-radius-control);
  font-family: var(--mv-font-body); font-weight: 600; font-size: 14px; cursor: pointer;
}
.nf-btn-ghost {
  background: var(--mv-surface-2); color: var(--mv-ink); border: 1px solid var(--mv-line);
  transition: background .2s, border-color .2s, transform .2s var(--mv-ease);
}
.nf-btn-ghost:hover { background: var(--mv-surface-3); border-color: var(--mv-line-step); transform: translateY(-1px); }
.nf-whereto-label { margin: 0 0 4px; font-size: 14px; font-weight: 500; color: var(--mv-ink-3); }
.nf-links { display: grid; grid-template-columns: 1fr 1fr; column-gap: 40px; max-width: 560px; }
.nf-link {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 60px; padding: 12px 0;
  border-top: 1px solid var(--mv-line);
  color: var(--mv-ink); text-decoration: none;
}
.nf-link-title { font-size: 15px; font-weight: 500; line-height: 20px; }
.nf-link-desc { margin-top: 2px; font-size: 13px; line-height: 18px; color: var(--mv-ink-3); }
.nf-link svg { flex-shrink: 0; color: var(--mv-ink-3); transition: color .15s, transform .25s var(--mv-ease); }
.nf-link:hover svg { color: var(--mv-copper-text); transform: translateX(3px); }
.nf-stage { position: relative; overflow: hidden; background: var(--mv-bg-2); border-left: 1px solid var(--mv-line); }
.nf-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.nf-topo path { fill: none; stroke: var(--mv-line-step); stroke-width: .7; opacity: .45; }
.nf-topo .far { opacity: .18; }
.nf-road { fill: none; stroke: var(--mv-ink-3); stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 8 7; }
.nf-pin { fill: var(--mv-ink-3); }
.nf-cross { stroke: var(--mv-ink); stroke-width: 2.4; stroke-linecap: round; }
@media (max-width: 900px) {
  .nf { grid-template-columns: 1fr; }
  .nf-stage { order: -1; min-height: 38vh; border-left: 0; border-bottom: 1px solid var(--mv-line); }
  .nf-msg { padding: 40px 24px 72px; }
}
@media (max-width: 600px) { .nf-links { grid-template-columns: 1fr; } }
`;

export default function NotFound() {
  return (
    <div className="mv-marketing">
      <style>{NOT_FOUND_CSS}</style>
      <main className="nf">
        <section className="nf-msg">
          <p className="nf-status">
            <span className="mv-figure">404</span>
            <span>Page not found</span>
          </p>

          <h1 className="nf-title">Wrong turn.</h1>

          <p className="nf-lede">
            There is no page at this address. It may have moved, or one letter is off. The rest of
            the site is still open road.
          </p>
          <p className="nf-path">
            Nothing at <TelemetryPath />
          </p>

          <div className="nf-actions">
            <Link className="mv-btn mv-btn-primary" href="/">
              Take me home
            </Link>
            <GoBackButton />
          </div>

          <div>
            <p className="nf-whereto-label">Where to instead</p>
            <div className="nf-links">
              {WHERE_TO_LINKS.map((link) => (
                <Link key={link.href} className="nf-link" href={link.href}>
                  <span>
                    <span className="nf-link-title">{link.title}</span>
                    <span className="nf-link-desc" style={{ display: 'block' }}>
                      {link.desc}
                    </span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* A route that ends nowhere: contour lines and a dashed road to an X */}
        <section className="nf-stage" aria-hidden="true">
          <svg
            className="nf-topo"
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <g className="far">
              <path d="M -20 120 Q 120 60 260 100 T 620 140" />
              <path d="M -20 180 Q 140 110 280 150 T 620 200" />
              <path d="M -20 680 Q 180 600 340 650 T 640 700" />
              <path d="M -20 740 Q 180 660 340 710 T 640 760" />
            </g>
            <path d="M -20 260 Q 160 200 300 240 T 620 300" />
            <path d="M -20 320 Q 180 270 320 300 T 640 360" />
            <path d="M -20 400 Q 200 340 340 380 T 660 440" />
            <path d="M -20 460 Q 220 400 360 440 T 680 500" />
            <path d="M -20 540 Q 220 480 380 520 T 680 580" />
            <path d="M -20 600 Q 240 540 400 580 T 700 640" />
          </svg>
          <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path
              className="nf-road"
              d="M 80 720 C 160 620, 120 500, 240 460 S 380 400, 360 300 S 260 200, 340 120 L 420 100"
            />
            <circle className="nf-pin" cx="80" cy="720" r="6" />
            <g transform="translate(420 100)">
              <circle className="nf-pin" r="7" />
              <line className="nf-cross" x1="-14" y1="-14" x2="14" y2="14" />
              <line className="nf-cross" x1="14" y1="-14" x2="-14" y2="14" />
            </g>
          </svg>
        </section>
      </main>
    </div>
  );
}
