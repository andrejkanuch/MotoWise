'use client';

import { Bike } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  BetterInAppCard,
  BetterInAppDensity,
  BetterInAppLayout,
  BetterInAppList,
  CardTone,
  calmReasonsFor,
  GarageCard,
  type HandoffAccount,
  MonoLabel,
  type PromotedHandoff,
  QrHandoff,
  QrHandoffVariant,
  SignInText,
  StoreButtons,
  StoreTextLinks,
} from '@/components/garage-ui';

/**
 * The "Start in the app" hero of the empty garage (no bike yet). It IS the
 * handoff, so the page renders no rail, band or bar beside it:
 * ≥768 → QR + copy link (+ "On this tablet?" links 768–1023);
 * <768 → store buttons (no QR on a phone). The reasons follow the page's one
 * promoted reason (no rides yet › …), then the calm ones.
 */
export function EmptyStartHero({
  account,
  promoted,
}: {
  account: HandoffAccount;
  promoted: PromotedHandoff | null;
}) {
  const t = useTranslations('GarageV2');
  return (
    <GarageCard
      tone={CardTone.Raised}
      padding="none"
      className="gv-start"
      aria-labelledby="gv-start-h"
    >
      <div className="gv-start-head">
        <MonoLabel accent>{t('startEyebrow')}</MonoLabel>
        <h2 id="gv-start-h" className="gv-start-title">
          {t('startTitle')}
        </h2>
      </div>

      {/* ≥768: scan the QR code. */}
      <div className="gv-start-qr">
        <QrHandoff account={account} variant={QrHandoffVariant.Hero} />
        <div className="gv-start-tablet-links">
          <StoreTextLinks />
        </div>
      </div>

      {/* <768: the stores, then the account to sign in with. */}
      <div className="gv-start-phone">
        <StoreButtons />
        <p className="gv-start-signin">
          <SignInText account={account} />
        </p>
      </div>

      {/* ≥768: a 3-up row of tiles. */}
      <ul className="gv-start-tiles">
        {promoted && (
          <li>
            <BetterInAppCard promoted={promoted} layout={BetterInAppLayout.Tile} />
          </li>
        )}
        {calmReasonsFor(promoted).map((reason) => (
          <li key={reason}>
            <BetterInAppCard reason={reason} layout={BetterInAppLayout.Tile} />
          </li>
        ))}
      </ul>

      {/* <768: the same reasons as a list. */}
      <div className="gv-start-list">
        <BetterInAppList
          promoted={promoted}
          density={BetterInAppDensity.Compact}
          showLabel={false}
        />
      </div>
    </GarageCard>
  );
}

/** "This is where your bike lives": a decorative outline of the bike card. */
export function BikePreview() {
  const t = useTranslations('GarageV2');
  return (
    <section className="gv-preview" aria-label={t('previewRegion')}>
      <div className="gv-preview-art" aria-hidden="true">
        <div className="gv-preview-photo gv-stripes gv-stripes--dim">
          <Bike size={40} strokeWidth={1.25} />
        </div>
        <div className="gv-preview-body">
          <span className="gv-preview-bar" style={{ width: 110, height: 10 }} />
          <span
            className="gv-preview-bar gv-preview-bar--strong"
            style={{ width: 220, height: 30 }}
          />
          <span className="gv-preview-rule" />
          <span className="gv-preview-bar" style={{ width: 70, height: 10 }} />
          <span
            className="gv-preview-bar gv-preview-bar--strong"
            style={{ width: 160, height: 26 }}
          />
        </div>
      </div>
      <span className="gv-preview-pill">
        <span className="gv-preview-dot" aria-hidden="true" />
        {t('previewLabel')}
      </span>
    </section>
  );
}
