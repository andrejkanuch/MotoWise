'use client';

import { useTranslations } from 'next-intl';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { BikePlate } from './bike-plate';
import { storeAnchorProps } from './store-buttons';

const HERO_IMAGE = '/images/marketing/hero-dusk-ride.jpg';
const HERO_IMAGE_PORTRAIT = '/images/marketing/hero-dusk-ride-portrait.jpg';

/**
 * Trackside hero: full-bleed ride photography carrying the emotion, the
 * Race Plate system carrying the voice — condensed headline, a real Bike
 * Plate as the shared object, copper strictly on the action. One settle
 * animation, no loops, no theatre (CSS only; honours Reduce Motion).
 */
export function Hero() {
  const t = useTranslations('Hero');
  const heroCtx = { pageType: CtaPageType.Home, placement: CtaPlacement.Hero };
  const iosLink = storeAnchorProps(StorePlatform.Ios, heroCtx);
  const androidLink = storeAnchorProps(StorePlatform.Android, heroCtx);

  const stripItems = [
    { label: t('tickerExpensesLabel'), sub: t('tickerExpensesSub') },
    { label: t('tickerMaintenanceLabel'), sub: t('tickerMaintenanceSub') },
    { label: t('tickerTripsLabel'), sub: t('tickerTripsSub') },
    { label: t('tickerFreeLabel'), sub: t('tickerFreeSub') },
  ];

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100svh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '120px 40px 120px',
        isolation: 'isolate',
      }}
      className="hero-section mv-dark-scene"
    >
      {/* Background photo — desktop landscape / mobile portrait */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -3 }}>
        <picture>
          <source media="(max-aspect-ratio: 4/5)" srcSet={HERO_IMAGE_PORTRAIT} />
          <img
            src={HERO_IMAGE}
            alt=""
            fetchPriority="high"
            decoding="async"
            className="hero-photo"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 60%',
            }}
          />
        </picture>
      </div>

      {/* Graphite scrims: text contrast left, fade to the page ground below */}
      <div className="hero-scrim" aria-hidden="true" />

      {/* Main content */}
      <div
        style={{
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}
      >
        <a href="#features" className="hero-hook">
          {t('badgeExpensesHook')}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>

        <h1 className="hero-headline">
          <span style={{ display: 'block' }}>{t('titleLine1')}</span>
          <span style={{ display: 'block' }}>{t('titleLine2')}</span>
        </h1>

        <p className="hero-desc">{t('description')}</p>

        {/* The shared object: a real Bike Plate, exactly as the app draws it */}
        <div className="hero-plate-slot">
          <BikePlate
            figure="24,318"
            unit="km"
            caption={t('plateCaption')}
            racingNumber="27"
            identity={t('plateIdentity')}
            state="ready"
          />
        </div>

        <div className="hero-cta-row">
          <a {...iosLink} className="mv-btn hero-btn-copper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span>{t('downloadIos')}</span>
          </a>
          <a {...androidLink} className="mv-btn mv-btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
            </svg>
            Google Play
          </a>
        </div>

        <div className="hero-trust">
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--mv-go)',
              flexShrink: 0,
            }}
          />
          <span>{t('trustLineStrip')}</span>
        </div>
      </div>

      {/* Static figure strip on the ground band (no loops) */}
      <div className="hero-strip">
        <div className="hero-strip-inner">
          {stripItems.map((item) => (
            <span key={item.label} className="hero-strip-item">
              <span className="hero-strip-figure">{item.label}</span>
              <span className="hero-strip-label">{item.sub}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
