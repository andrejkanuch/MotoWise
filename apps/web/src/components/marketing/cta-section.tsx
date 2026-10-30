import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { CtaPageType, CtaPlacement, StorePlatform } from '@/lib/cta-taxonomy';
import { StoreLink } from './store-buttons';

const CTA_PHOTO = '/images/marketing/cta-night.jpg';

/** Final CTA — the one section allowed to center, the home page's one
 *  headline at H1 scale (the manifesto statement is the other allowed
 *  exception; nothing but the hero goes larger), and the page's closing
 *  photo moment: a night ride under graphite scrims mixed from the ramp
 *  (dark scheme). In the light scheme the photo steps out and the band is
 *  the deeper paper step, so bone ink never has to be forced over paper
 *  tokens. Copper goes to the primary action only; the secondary is a ghost. */
export async function CtaSection() {
  const t = await getTranslations('Cta');

  return (
    // The edge colours are read on this wrapper, OUTSIDE the dark scene, so
    // the band blends into the page ground above and below in both schemes.
    <div
      style={
        {
          '--cta-edge-top': 'var(--mv-bg-2)',
          '--cta-edge-bottom': 'var(--mv-bg)',
        } as CSSProperties
      }
    >
      <section id="download" className="mv-section-cta cta-band mv-dark-scene">
        <div className="cta-photo" aria-hidden="true">
          <Image src={CTA_PHOTO} alt="" fill sizes="100vw" className="cta-photo-img" />
        </div>
        <div className="cta-scrim" aria-hidden="true" />

        <div
          style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', position: 'relative' }}
        >
          <h2 className="mv-section-title" style={{ color: 'var(--mv-ink)' }}>
            {t('headlineLead')} <span className="mv-muted">{t('headlineEmphasis')}</span>
          </h2>

          <p className="mv-section-sub" style={{ margin: '28px auto 0', maxWidth: '500px' }}>
            {t('subtitleDownload')}
          </p>

          <div
            style={{
              marginTop: '48px',
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <StoreLink
              platform={StorePlatform.Ios}
              pageType={CtaPageType.Home}
              placement={CtaPlacement.Inline}
              className="mv-btn mv-btn-primary"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <span>{t('appStore')}</span>
            </StoreLink>
            <StoreLink
              platform={StorePlatform.Android}
              pageType={CtaPageType.Home}
              placement={CtaPlacement.Inline}
              className="mv-btn mv-btn-ghost"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
              </svg>
              {t('googlePlay')}
            </StoreLink>
          </div>

          {/* Trust line: plain, true sentences in the body face */}
          <div
            style={{
              marginTop: '32px',
              color: 'var(--mv-ink-3)',
              fontSize: '13px',
              lineHeight: '18px',
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>{t('trustFree')}</span>
            <span aria-hidden="true" style={{ color: 'var(--mv-ink-4)' }}>
              ·
            </span>
            <span>{t('trustNoCreditCard')}</span>
            <span aria-hidden="true" style={{ color: 'var(--mv-ink-4)' }}>
              ·
            </span>
            <span>{t('trustPlatforms')}</span>
          </div>
        </div>

        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
          dangerouslySetInnerHTML={{
            __html: `
            .cta-band { background: var(--mv-bg-2); }
            .cta-photo { position: absolute; inset: 0; z-index: -2; }
            .cta-photo-img {
              object-fit: cover;
              object-position: center 40%;
            }
            /* Graphite scrims mixed from the ramp: fade in from the page
               above, hold the photo readable behind the copy, fade out to
               the footer's ground below. */
            .cta-scrim {
              position: absolute;
              inset: 0;
              z-index: -1;
              background:
                linear-gradient(
                  180deg,
                  var(--cta-edge-top) 0%,
                  rgba(17, 18, 20, 0.58) 38%,
                  rgba(17, 18, 20, 0.58) 62%,
                  var(--cta-edge-bottom) 100%
                );
            }
          `,
          }}
        />
      </section>
    </div>
  );
}
