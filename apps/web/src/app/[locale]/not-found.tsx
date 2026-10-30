import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import '@/components/marketing/design-system.css';
import { GoBackButton, TelemetryPath } from '@/components/not-found-client';

/* The four places a lost rider is most likely heading. `/explore` is a
   root-only section: a locale-prefixed href 308-consolidates to it. */
const WHERE_TO_LINKS = [
  { key: 'explore', href: '/explore' },
  { key: 'trips', href: '/features/trip-planning' },
  { key: 'garage', href: '/features/garage-management' },
  { key: 'maintenance', href: '/features/maintenance' },
] as const;

/*
 * The same stage as app/not-found.tsx (which serves root-only routes and has
 * no translations): two columns on the ramp, the message on the ground in
 * the shared hero shell, a quiet map stage one step deeper. H1 at the
 * page-title size, body face, one copper action, the links as one hairline
 * row list. The route drawing is authored SVG in tokens and does not move.
 * On phones the stage shrinks so the 404 itself is above the fold.
 */
const NOT_FOUND_CSS = `
.nf { min-height: 100svh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
.nf-msg {
  display: flex; flex-direction: column; justify-content: center;
  background: var(--mv-bg);
}
.nf-status {
  display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline;
  margin: 0 0 24px;
  font-size: 15px; line-height: 20px; color: var(--mv-ink-3);
}
.nf-status .mv-figure { font-size: 20px; color: var(--mv-ink-2); }
.nf-title { margin: 0 0 20px; color: var(--mv-ink); }
.nf-lede { max-width: 46ch; margin: 0 0 12px; font-size: 17px; line-height: 1.55; color: var(--mv-ink-2); text-wrap: pretty; }
.nf-path { margin: 0 0 32px; font-size: 15px; line-height: 20px; color: var(--mv-ink-3); overflow-wrap: anywhere; }
.nf-telemetry-val { font-family: var(--mv-font-mono); font-size: 13px; color: var(--mv-ink-2); }
.nf-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 48px; }
.nf-whereto-label { margin: 0 0 8px; font-size: 13px; line-height: 18px; font-weight: 500; color: var(--mv-ink-3); }
.nf-links { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 40px; max-width: 560px; }
.nf-stage { position: relative; overflow: hidden; background: var(--mv-bg-2); border-left: 1px solid var(--mv-line); }
.nf-stage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.nf-topo path { fill: none; stroke: var(--mv-line-step); stroke-width: .7; opacity: .45; }
.nf-topo .far { opacity: .18; }
.nf-road { fill: none; stroke: var(--mv-ink-3); stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 8 7; }
.nf-pin { fill: var(--mv-ink-3); }
.nf-cross { stroke: var(--mv-ink); stroke-width: 2.4; stroke-linecap: round; }
@media (max-width: 900px) {
  .nf { grid-template-columns: minmax(0, 1fr); }
  .nf-stage { order: -1; min-height: 38vh; border-left: 0; border-bottom: 1px solid var(--mv-line); }
  .nf-msg.mv-section-hero { padding: 48px 24px 64px; }
}
@media (max-width: 600px) { .nf-links { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 480px) {
  .nf-stage { min-height: 24vh; }
  .nf-msg.mv-section-hero { padding: 48px 20px 64px; }
}
/* A landscape phone: the message keeps the first screen, the stage sits beside it. */
@media (max-height: 500px) {
  .nf { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
  .nf-stage { order: 0; min-height: 0; border-left: 1px solid var(--mv-line); border-bottom: 0; }
}
`;

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="mv-marketing">
      <style>{NOT_FOUND_CSS}</style>
      <main className="nf">
        <section className="nf-msg mv-section-hero">
          <p className="nf-status">
            <span className="mv-figure">{t('code')}</span>
            <span>{t('label')}</span>
          </p>

          <h1 className="mv-section-title nf-title">{t('message')}</h1>

          <p className="nf-lede">{t('lede')}</p>
          <p className="nf-path">
            {t('nothingAt')} <TelemetryPath />
          </p>

          <div className="nf-actions">
            <Link className="mv-btn mv-btn-primary" href="/">
              {t('backHome')}
            </Link>
            <GoBackButton label={t('goBack')} />
          </div>

          <div>
            <p className="nf-whereto-label">{t('whereTo')}</p>
            <ul className="mv-rows nf-links">
              {WHERE_TO_LINKS.map((link) => (
                <li key={link.key}>
                  <Link className="mv-row" href={link.href}>
                    <span>
                      <span className="mv-row-title">{t(`links.${link.key}.title`)}</span>
                      <span className="mv-row-sub">{t(`links.${link.key}.desc`)}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
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
