'use client';

import { Bike } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  BetterInAppCard,
  BetterInAppDensity,
  BetterInAppLayout,
  BetterInAppList,
  calmReasonsFor,
  type HandoffAccount,
  type PromotedHandoff,
  QrHandoff,
  QrHandoffVariant,
  SignInText,
  StoreButtons,
  StoreTextLinks,
} from '@/components/garage-ui';

/**
 * The "Start in the app" hero of the empty garage (no bike yet). It IS the
 * handoff, so the page renders no rail, band or bar beside it: a condensed
 * headline and one copper action on the page surface.
 * ≥768 → QR + copy link (copper Copy; "On this tablet?" links 768–1023);
 * <768 → store buttons (copper App Store; no QR on a phone). The reasons
 * follow the page's one promoted reason (no rides yet › …), then the calm ones.
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
    <section className="gv-start" aria-labelledby="gv-start-h">
      <h2 id="gv-start-h" className="mv-section-title gv-start-title">
        {t('startTitle')}
      </h2>

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

      {/* ≥768: the three reasons in a row, text and inline icon, no tiles. */}
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
    </section>
  );
}

/** "This is where your bike lives": a dashed ghost of the Bike Plate. */
export function BikePreview() {
  const t = useTranslations('GarageV2');
  return (
    <section className="gv-preview" aria-label={t('previewRegion')}>
      <div className="gv-preview-art" aria-hidden="true">
        <div className="gv-preview-photo gv-stripes">
          <Bike size={40} strokeWidth={1.25} />
        </div>
        <div className="gv-preview-plate">
          <span
            className="gv-preview-bar gv-preview-bar--strong"
            style={{ width: 150, height: 40 }}
          />
          <span className="gv-preview-bar" style={{ width: 200, height: 12 }} />
          <span className="gv-preview-rule" />
          <span className="gv-preview-bar" style={{ width: 120, height: 10 }} />
        </div>
      </div>
      <span className="gv-preview-pill">
        <span className="gv-preview-dot" aria-hidden="true" />
        {t('previewLabel')}
      </span>
    </section>
  );
}
