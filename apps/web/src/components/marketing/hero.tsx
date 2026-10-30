'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { detectPlatform, type Platform } from '@/lib/store-links';
import { BikePlate } from './bike-plate';
import { storeAnchorProps } from './store-buttons';

const HERO_DIR = '/images/marketing';
const HERO_IMAGE = `${HERO_DIR}/hero-dusk-ride.jpg`;
/** Pre-encoded in the repo (no Vercel transformation on the LCP). */
const HERO_SOURCES = {
  landscape: {
    avif: `${HERO_DIR}/hero-dusk-ride-1600.avif 1600w, ${HERO_DIR}/hero-dusk-ride-2000.avif 2000w`,
    webp: `${HERO_DIR}/hero-dusk-ride-1600.webp 1600w, ${HERO_DIR}/hero-dusk-ride-2000.webp 2000w`,
  },
  portrait: {
    avif: `${HERO_DIR}/hero-dusk-ride-portrait-720.avif 720w, ${HERO_DIR}/hero-dusk-ride-portrait-1080.avif 1080w`,
    webp: `${HERO_DIR}/hero-dusk-ride-portrait-720.webp 720w, ${HERO_DIR}/hero-dusk-ride-portrait-1080.webp 1080w`,
  },
} as const;
/** At 1:1 and taller the landscape frame would lose the road; the portrait keys on the rider. */
const PORTRAIT_MEDIA = '(max-aspect-ratio: 1/1)';
const LANDSCAPE_MEDIA = '(min-aspect-ratio: 1/1)';
const HERO_SIZES = '100vw';
const PLATE_FIGURE = 24318;

const STORE_GLYPH_SIZE = 16;

function AppleGlyph() {
  return (
    <svg
      width={STORE_GLYPH_SIZE}
      height={STORE_GLYPH_SIZE}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg
      width={STORE_GLYPH_SIZE}
      height={STORE_GLYPH_SIZE}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
    </svg>
  );
}

const STORES = {
  ios: { platform: StorePlatform.Ios, Glyph: AppleGlyph },
  android: { platform: StorePlatform.Android, Glyph: PlayGlyph },
} as const;

/** The detected store is the copper action, the other the ghost; iOS first until detected. */
const STORE_ORDER: Record<Platform, readonly [keyof typeof STORES, keyof typeof STORES]> = {
  ios: ['ios', 'android'],
  android: ['android', 'ios'],
  unknown: ['ios', 'android'],
};

/**
 * Preloads for the LCP photo live here, not in the marketing layout, so only
 * the home page fetches it. React 19 hoists these `<link>`s into `<head>`.
 */
function HeroPreloads() {
  return (
    <>
      <link
        rel="preload"
        as="image"
        type="image/avif"
        imageSrcSet={HERO_SOURCES.landscape.avif}
        imageSizes={HERO_SIZES}
        media={LANDSCAPE_MEDIA}
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        type="image/avif"
        imageSrcSet={HERO_SOURCES.portrait.avif}
        imageSizes={HERO_SIZES}
        media={PORTRAIT_MEDIA}
        fetchPriority="high"
      />
    </>
  );
}

/**
 * Trackside hero: full-bleed ride photography carrying the emotion, the
 * Race Plate system carrying the voice — condensed headline, a real Bike
 * Plate as the shared object, copper strictly on the action. One settle
 * animation, no loops, no theatre (CSS only; honours Reduce Motion).
 */
export function Hero() {
  const t = useTranslations('Hero');
  const tCta = useTranslations('Cta');
  const format = useFormatter();
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const heroCtx = { pageType: CtaPageType.Home, placement: CtaPlacement.Hero };
  const labels = { ios: t('downloadIos'), android: tCta('googlePlay') };
  const [primary, secondary] = STORE_ORDER[platform].map((key) => ({ key, ...STORES[key] }));

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100svh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        isolation: 'isolate',
      }}
      className="hero-section mv-dark-scene"
    >
      <HeroPreloads />
      {/* Background photo — landscape frame, portrait at 1:1 and taller */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -3 }}>
        <picture>
          <source
            media={PORTRAIT_MEDIA}
            type="image/avif"
            srcSet={HERO_SOURCES.portrait.avif}
            sizes={HERO_SIZES}
          />
          <source
            media={PORTRAIT_MEDIA}
            type="image/webp"
            srcSet={HERO_SOURCES.portrait.webp}
            sizes={HERO_SIZES}
          />
          <source type="image/avif" srcSet={HERO_SOURCES.landscape.avif} sizes={HERO_SIZES} />
          <source type="image/webp" srcSet={HERO_SOURCES.landscape.webp} sizes={HERO_SIZES} />
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
              objectPosition: '62% 60%',
            }}
          />
        </picture>
      </div>

      {/* Graphite scrims: text contrast left, fade to the page ground below */}
      <div className="hero-scrim" aria-hidden="true" />

      {/* Main content: the container and its gutters live in the kit (.hero-content) */}
      <div className="hero-content">
        <h1 className="hero-headline">
          <span style={{ display: 'block' }}>{t('titleLine1')}</span>
          <span style={{ display: 'block' }}>{t('titleLine2')}</span>
        </h1>

        <p className="hero-desc">{t('description')}</p>

        {/* The shared object: a real Bike Plate, exactly as the app draws it */}
        <div className="hero-plate-slot">
          <BikePlate
            size="hero"
            settle="late"
            figure={format.number(PLATE_FIGURE)}
            unit="km"
            caption={t('plateCaption')}
            racingNumber="27"
            identity={t('plateIdentity')}
            state="ready"
          />
        </div>

        <div className="hero-cta-row">
          <a {...storeAnchorProps(primary.platform, heroCtx)} className="mv-btn mv-btn-primary">
            <primary.Glyph />
            <span>{labels[primary.key]}</span>
          </a>
          <a {...storeAnchorProps(secondary.platform, heroCtx)} className="mv-btn mv-btn-ghost">
            <secondary.Glyph />
            <span>{labels[secondary.key]}</span>
          </a>
        </div>

        <p className="hero-trust">{t('trustLineStrip')}</p>
      </div>
    </section>
  );
}
