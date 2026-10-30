import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { BikePlate } from './bike-plate';

type FeatureKey = 'expenses' | 'maintenance' | 'rides' | 'trip';

/** Ordered by validated demand (PostHog): expenses → maintenance → rides → trips.
 *  AI diagnostics has its own section (DiagnosticsDemo) further down the page. */
const KEYS: readonly FeatureKey[] = ['expenses', 'maintenance', 'rides', 'trip'];

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

interface Figure {
  value: string;
  label: string;
}

/**
 * The four records, as an editorial sequence rather than a scrubbed stage:
 * server-rendered, no JavaScript, each block a condensed headline, two or
 * three sentences in the logbook voice, two honest figures in the condensed
 * face, and one depiction of the app. The composition alternates so adjacent
 * blocks differ — the page's single full device frame (expenses), a Bike
 * Plate instead of a screenshot (maintenance), a deeper band with a screen
 * bled off its bottom edge (rides), a screen bled off the right edge (trips).
 * Entrances: visible by default; `.mv-reveal` lifts the plate block only.
 */
export function FeaturesGrid() {
  const t = useTranslations('Features');

  const copy = (key: FeatureKey) => ({
    title: t(`grid.${key}.title`),
    body: t(`grid.${key}.body`),
    figures: [
      { value: t(`grid.${key}.fig1Value`), label: t(`grid.${key}.fig1Label`) },
      { value: t(`grid.${key}.fig2Value`), label: t(`grid.${key}.fig2Label`) },
    ] satisfies Figure[],
    alt: t('grid.screenshotAlt', { feature: t(`grid.${key}.badge`) }),
  });

  const [expenses, maintenance, rides, trip] = KEYS.map(copy);

  return (
    <section id="features" className="fx-section">
      <div className="fx-container">
        <div className="fx-head">
          <h2 className="mv-section-title">
            {t('grid.sectionTitleLead')}{' '}
            <span className="mv-muted">{t('grid.sectionTitleEmphasis')}</span>
          </h2>
          <p className="mv-section-sub">{t('grid.sectionSub')}</p>
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
          <div className="fx-art fx-art-plate mv-reveal">
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
  figures,
  className,
}: {
  title: string;
  body: string;
  figures: Figure[];
  className?: string;
}) {
  return (
    <div className={className ? `fx-copy ${className}` : 'fx-copy'}>
      <h3 className="fx-title">{title}</h3>
      <p className="fx-body">{body}</p>
      <dl className="fx-figures">
        {figures.map((figure) => (
          <div key={figure.label} className="fx-figure">
            <dt className="mv-figure fx-figure-value">{figure.value}</dt>
            <dd className="fx-figure-label">{figure.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const FEATURES_CSS = `
.fx-section { padding: 120px 0 0; }
.fx-container { max-width: var(--mv-container); margin: 0 auto; padding: 0 40px; }
.fx-head { max-width: 880px; }

.fx-block {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
  padding: 72px 0;
}
.fx-head + .fx-block { margin-top: 64px; }
.fx-block-rev .fx-copy { order: 2; }
.fx-block-rev .fx-art { order: 1; }
.fx-block-trips { padding: 120px 0 0; align-items: start; }

.fx-copy { max-width: 520px; }
.fx-title {
  font-family: var(--mv-font-display);
  font-weight: 600;
  font-size: clamp(34px, 3.8vw, 56px);
  line-height: 1;
  letter-spacing: 0.002em;
  color: var(--mv-ink);
  margin: 0;
  text-wrap: balance;
}
.fx-body {
  margin: 20px 0 0;
  font-size: 17px;
  line-height: 1.6;
  color: var(--mv-ink-2);
  letter-spacing: -0.01em;
  max-width: 46ch;
}
.fx-figures {
  display: flex;
  gap: 48px;
  margin: 36px 0 0;
  padding: 0;
}
.fx-figure { margin: 0; max-width: 220px; }
.fx-figure-value {
  font-size: 44px;
  line-height: 1;
  color: var(--mv-ink);
}
.fx-figure-label {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--mv-ink-3);
  letter-spacing: -0.005em;
}

.fx-art { position: relative; }
.fx-art-phone { display: flex; justify-content: center; }
.fx-screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 35px;
  overflow: hidden;
  background: var(--mv-surface);
}
.fx-art-plate { display: flex; justify-content: flex-start; }

/* Rides: a deeper step of the ramp, full width; the screen is cut by the
   band's bottom edge, keyline on the three visible sides. */
.fx-band { background: var(--mv-bg-2); margin-top: 72px; overflow: hidden; }
.fx-band-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: end;
}
.fx-band-copy { padding: 120px 0; }
.fx-art-cut {
  align-self: end;
  width: 380px;
  max-width: 100%;
  margin: 96px auto 0;
  height: 520px;
  overflow: hidden;
  border: 1px solid var(--mv-line);
  border-bottom: 0;
  border-radius: 28px 28px 0 0;
  background: var(--mv-surface);
}
.fx-cut-img { width: 100%; height: auto; display: block; }

/* Trips: the screen runs off the right edge of the viewport. */
.fx-art-bleed {
  margin-right: calc(-1 * ((100vw - min(100vw, var(--mv-container))) / 2 + 40px));
  height: 560px;
  overflow: hidden;
  border: 1px solid var(--mv-line);
  border-right: 0;
  border-radius: 28px 0 0 28px;
  background: var(--mv-surface);
}
.fx-bleed-img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }

@media (max-width: 900px) {
  .fx-container { padding: 0 24px; }
  .fx-section { padding-top: 100px; }
  .fx-block { grid-template-columns: 1fr; gap: 40px; padding: 56px 0; }
  .fx-head + .fx-block { margin-top: 40px; }
  .fx-block-rev .fx-copy { order: 1; }
  .fx-block-rev .fx-art { order: 2; }
  .fx-block-trips { padding: 72px 0 0; }
  .fx-art-phone { justify-content: flex-start; }
  .fx-band { margin-top: 40px; }
  .fx-band-grid { grid-template-columns: 1fr; gap: 0; }
  .fx-band-copy { padding: 80px 0 0; }
  .fx-art-cut { width: 300px; height: 380px; margin: 48px 0 0; }
  .fx-art-bleed { margin-right: 0; height: 420px; border-right: 1px solid var(--mv-line); border-radius: 28px; }
  .fx-figures { gap: 32px; }
  .fx-figure-value { font-size: 36px; }
}
@media (max-width: 480px) {
  .fx-figures { flex-direction: column; gap: 20px; }
  .fx-art-cut { width: 100%; height: 320px; }
  .fx-art-bleed { height: 340px; }
}
`;
