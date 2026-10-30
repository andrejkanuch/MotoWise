import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BikePlate } from './bike-plate';

type FeatureKey = 'expenses' | 'maintenance' | 'rides' | 'trip';

/** Ordered by validated demand (PostHog): expenses → maintenance → rides → trips. */
const KEYS: readonly FeatureKey[] = ['expenses', 'maintenance', 'rides', 'trip'];

/** Each block's one verb: the link to its feature page (the badge key is the
 *  page's name, so the link text says where it goes). */
const FEATURE_PAGES: Record<FeatureKey, string> = {
  expenses: '/features/expense-tracking',
  maintenance: '/features/maintenance',
  rides: '/features/ride-tracking',
  trip: '/features/trip-planning',
};

/** Screenshot paths are a contract: the files are replaced 1:1 with Race Plate
 *  captures, so the src strings never change here. */
const SCREENSHOTS: Record<FeatureKey, string> = {
  expenses: '/images/marketing/mw/flow-add-expense.png',
  maintenance: '/images/marketing/mw/flow-add-maintenance.png',
  rides: '/images/marketing/mw/home-rides-expenses.png',
  trip: '/images/marketing/mw/trip-detail-hero.png',
};

const SCREENSHOT_WIDTH = 1206;
const SCREENSHOT_HEIGHT = 2622;

/**
 * The four records, as an editorial sequence rather than a scrubbed stage:
 * server-rendered, no JavaScript, each block a condensed headline, two or
 * three sentences in the logbook voice, one link to the feature page, and
 * one depiction of the app. One stat row per page: the proof row above
 * carries the numbers, so no block repeats them. The
 * composition alternates so adjacent blocks differ — the page's single full
 * device frame (expenses), a Bike Plate instead of a screenshot (maintenance),
 * a deeper band with a screen bled off its bottom edge (rides), a screen bled
 * off the right edge (trips). Each block headline is the section's real
 * heading (`.mv-h2`); the intro statement above them is a sentence, not a
 * heading. Motion: visible by default; the maintenance plate lays its stripe
 * on its own scroll timeline (no `.mv-reveal` on that object).
 */
export function FeaturesGrid() {
  const t = useTranslations('Features');

  const copy = (key: FeatureKey) => ({
    title: t(`grid.${key}.title`),
    body: t(`grid.${key}.body`),
    link: { href: FEATURE_PAGES[key], label: t(`grid.${key}.badge`) },
    alt: t('grid.screenshotAlt', { feature: t(`grid.${key}.badge`) }),
  });

  const [expenses, maintenance, rides, trip] = KEYS.map(copy);

  return (
    <section id="features" className="fx-section">
      <div className="fx-container">
        <div className="fx-head">
          <p className="mv-h2">
            {t('grid.sectionTitleLead')}{' '}
            <span className="fx-muted">{t('grid.sectionTitleEmphasis')}</span>
          </p>
        </div>

        {/* 1 · Expenses — copy left, the page's one full device frame right */}
        <article className="fx-block">
          <FeatureCopy {...expenses} />
          <div className="fx-art fx-art-phone">
            <div className="mv-phone-mockup">
              <div className="fx-screen">
                <Image
                  src={SCREENSHOTS.expenses}
                  alt={expenses.alt}
                  fill
                  sizes="(max-width: 900px) 260px, 320px"
                  style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>
            </div>
          </div>
        </article>

        {/* 2 · Maintenance — the Bike Plate left, copy right */}
        <article className="fx-block fx-block-rev">
          <FeatureCopy {...maintenance} />
          <div className="fx-art fx-art-plate fx-plate-lay">
            <BikePlate
              figure={t('grid.maintenance.plateFigure')}
              unit={t('grid.maintenance.plateUnit')}
              caption={t('grid.maintenance.plateCaption')}
              racingNumber="27"
              identity={t('grid.maintenance.plateIdentity')}
              state="due"
              style={{ width: '100%', maxWidth: '440px' }}
            />
          </div>
        </article>
      </div>

      {/* 3 · Rides — a deeper band; the screen is cut by the band's bottom edge */}
      <article className="fx-band">
        <div className="fx-container fx-band-grid">
          <FeatureCopy {...rides} className="fx-band-copy" />
          <div className="fx-art fx-art-cut">
            <Image
              src={SCREENSHOTS.rides}
              alt={rides.alt}
              width={SCREENSHOT_WIDTH}
              height={SCREENSHOT_HEIGHT}
              sizes="(max-width: 900px) 300px, 380px"
              className="fx-cut-img"
            />
          </div>
        </div>
      </article>

      {/* 4 · Trips — copy left, the screen bled off the right edge */}
      <div className="fx-container">
        <article className="fx-block fx-block-trips">
          <FeatureCopy {...trip} />
          <div className="fx-art fx-art-bleed">
            <Image
              src={SCREENSHOTS.trip}
              alt={trip.alt}
              width={SCREENSHOT_WIDTH}
              height={SCREENSHOT_HEIGHT}
              sizes="(max-width: 900px) 100vw, 620px"
              className="fx-bleed-img"
            />
          </div>
        </article>
      </div>

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{ __html: FEATURES_CSS }}
      />
    </section>
  );
}

function FeatureCopy({
  title,
  body,
  link,
  className,
}: {
  title: string;
  body: string;
  link: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={className ? `fx-copy ${className}` : 'fx-copy'}>
      <h2 className="mv-h2">{title}</h2>
      <p className="fx-body">{body}</p>
      <p className="fx-link">
        <Link href={link.href} className="mv-link is-tall">
          {link.label}
        </Link>
      </p>
    </div>
  );
}

const FEATURES_CSS = `
.fx-section { padding: 120px 0 0; overflow-x: clip; container-type: inline-size; }
.fx-container { max-width: var(--mv-container); margin: 0 auto; padding: 0 40px; }
.fx-head { max-width: 880px; }
.fx-muted { color: var(--mv-ink-3); }

.fx-block {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 64px;
  align-items: center;
  padding: 64px 0;
}
.fx-head + .fx-block { margin-top: 48px; }
.fx-block-rev .fx-copy { order: 2; }
.fx-block-rev .fx-art { order: 1; }
.fx-block-trips { padding: 120px 0 96px; align-items: start; }

.fx-copy { max-width: 520px; }
.fx-body {
  margin: 20px 0 0;
  font-size: 17px;
  line-height: 1.6;
  color: var(--mv-ink-2);
  letter-spacing: 0;
  text-wrap: pretty;
}
.fx-link { margin: 16px 0 0; font-size: 15px; line-height: 20px; }

.fx-art { position: relative; }
.fx-art-phone { display: flex; justify-content: center; }
.fx-screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--mv-radius-screen);
  overflow: hidden;
  background: var(--mv-surface);
}
.fx-art-plate { display: flex; justify-content: flex-start; }

/* Rides: a deeper step of the ramp, full width; the screen is cut by the
   band's bottom edge, keyline on the three visible sides. The crop starts
   below the capture's status bar. */
.fx-band { background: var(--mv-bg-2); margin-top: 96px; overflow: hidden; }
.fx-band-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 64px;
  align-items: end;
}
.fx-band-copy { padding: 120px 0; }
.fx-art-cut {
  align-self: end;
  justify-self: start;
  width: 380px;
  max-width: 100%;
  margin: 96px 0 0;
  height: 520px;
  overflow: hidden;
  border: 1px solid var(--mv-line);
  border-bottom: 0;
  border-radius: var(--mv-radius-crop) var(--mv-radius-crop) 0 0;
  background: var(--mv-surface);
}
.fx-cut-img { width: 100%; height: 100%; object-fit: cover; object-position: center 8%; display: block; }

/* Trips: the screen runs off the right edge of the viewport; the section
   clips the overshoot so the page never relies on body overflow. Container
   units measure the section, never the scrollbar. */
.fx-art-bleed {
  margin-right: calc(-1 * (max(0px, (100cqw - var(--mv-container)) / 2) + 40px));
  height: 560px;
  overflow: hidden;
  border: 1px solid var(--mv-line);
  border-right: 0;
  border-radius: var(--mv-radius-crop) 0 0 var(--mv-radius-crop);
  background: var(--mv-surface);
}
.fx-bleed-img { width: 100%; height: 100%; object-fit: cover; object-position: center 8%; display: block; }

/* The stripe is laid down by the scroll. The plate's two signature
   keyframes (mv-plate-settle, mv-plate-stripe-lay) run on the plate's own
   view timeline: the settle over the first part of its entry, the stripe
   over the rest. Entrance only, transform only, clipped by the plate.
   Without scroll-timeline support the plate is simply complete. The fill
   never animates: the state is a record. */
@supports (animation-timeline: view()) {
  .fx-plate-lay .mv-plate {
    view-timeline: --fx-plate block;
    animation: mv-plate-settle var(--mv-ease-expo) both;
    animation-duration: auto;
    animation-timeline: --fx-plate;
    animation-range: entry 5% entry 45%;
  }
  .fx-plate-lay .mv-plate-stripe {
    animation: mv-plate-stripe-lay var(--mv-ease-expo) both;
    animation-duration: auto;
    animation-timeline: --fx-plate;
    animation-range: entry 15% entry 70%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fx-plate-lay .mv-plate,
  .fx-plate-lay .mv-plate-stripe { animation: none; }
  .fx-plate-lay .mv-plate-stripe { transform: rotate(45deg); }
}

/* Tablet keeps the two-up pairs (a 260px phone beside 328px of copy fits
   from 768); only the gutter steps down. */
@media (max-width: 900px) {
  .fx-container { padding: 0 24px; }
  .fx-section { padding-top: 96px; }
  .fx-block { gap: 40px; padding: 48px 0; }
  .fx-head + .fx-block { margin-top: 40px; }
  .fx-block-trips { padding: 72px 0 64px; }
  .fx-band { margin-top: 64px; }
  .fx-band-grid { gap: 40px; }
  .fx-band-copy { padding: 96px 0; }
  .fx-art-cut { width: 300px; height: 380px; margin: 64px 0 0; }
  .fx-art-bleed { margin-right: -24px; height: 420px; }
}
@media (max-width: 767px) {
  .fx-block { grid-template-columns: minmax(0, 1fr); }
  .fx-block-rev .fx-copy { order: 1; }
  .fx-block-rev .fx-art { order: 2; }
  .fx-art-phone { justify-content: flex-start; }
  .fx-band-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .fx-band-copy { padding: 96px 0 0; }
  .fx-art-cut { margin: 48px 0 0; }
  .fx-art-bleed { margin-right: 0; border-right: 1px solid var(--mv-line); border-radius: var(--mv-radius-crop); }
}
@media (max-width: 480px) {
  .fx-container { padding: 0 20px; }
  .fx-art-cut { width: 100%; height: 320px; }
  .fx-art-bleed { height: 340px; }
}
`;
