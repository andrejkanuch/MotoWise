'use client';

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
