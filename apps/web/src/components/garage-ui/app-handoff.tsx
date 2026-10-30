'use client';

import { Bell, Camera, CircleCheck, type LucideIcon, Route, Smartphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { BetterInAppDensity, BetterInAppList, usePromotedCopy } from './better-in-app';
import {
  APP_HANDOFF_URL,
  browserStorage,
  type HandoffAccount,
  HandoffReason,
  isAppBarDismissed,
  type PromotedHandoff,
  rememberAppBarDismissed,
} from './handoff';
import { CardTone, GarageCard } from './primitives';
import { QrHandoff, QrHandoffVariant } from './qr-handoff';
import { StoreTextLinks } from './store-buttons';
import './garage-ui.css';

type HandoffProps = {
  /** Who is signed in, for "Sign in with the same account". */
  account: HandoffAccount;
  /** The page's one promoted reason (`pickPromotedHandoff`), or null. */
  promoted: PromotedHandoff | null;
};

/** "Open in the app" (an .mv-h3), shared by the rail and the band; the QR tile and store links below say where. */
function HandoffHeading({ id }: { id: string }) {
  const t = useTranslations('AppHandoff');
  return (
    <h2 id={id} className="mv-h3 mvg-handoff-heading">
      {t('openInTheApp')}
    </h2>
  );
}

/**
 * ≥ 1024 px: the sticky 320 px "Open in the app" rail with the QR code and the
 * "Better in the app" rows. Place it as the last child of a flex row beside the
 * content column (`display: flex; gap: 40px; align-items: flex-start`); it
 * never overlays the content. Hidden below 1024 px by CSS.
 */
export function AppHandoffRail({ account, promoted }: HandoffProps) {
  const headingId = useId();
  return (
    <aside className="mvg-rail" aria-labelledby={headingId}>
      <GarageCard as="div" tone={CardTone.Card} padding="none" className="mvg-handoff-panel">
        <HandoffHeading id={headingId} />
        <QrHandoff account={account} variant={QrHandoffVariant.Rail} />
      </GarageCard>
      <BetterInAppList promoted={promoted} showCta />
    </aside>
  );
}

/**
 * 768–1023 px: the rail becomes an inline band below the sections. QR + copy
 * link + "On this tablet?" store links on the left, the reasons on the right.
 * Hidden outside 768–1023 px by CSS.
 */
export function AppHandoffBand({ account, promoted }: HandoffProps) {
  const headingId = useId();
  return (
    <GarageCard
      tone={CardTone.Card}
      padding="none"
      className="mvg-band"
      aria-labelledby={headingId}
    >
      <div className="mvg-band-main">
        <HandoffHeading id={headingId} />
        <QrHandoff account={account} variant={QrHandoffVariant.Band} />
        <StoreTextLinks />
      </div>
      <BetterInAppList promoted={promoted} density={BetterInAppDensity.Compact} showLabel={false} />
    </GarageCard>
  );
}

const BAR_ICON: Record<HandoffReason, LucideIcon> = {
  [HandoffReason.MarkServiceDone]: CircleCheck,
  [HandoffReason.RecordRides]: Route,
  [HandoffReason.ServiceReminders]: Bell,
  [HandoffReason.ScanReceipts]: Camera,
};

function BarCopy({ promoted }: { promoted: PromotedHandoff }) {
  const t = useTranslations('AppHandoff');
  const { body } = usePromotedCopy(promoted);
  const lead =
    promoted.reason === HandoffReason.MarkServiceDone
      ? t('barOverdue', { task: promoted.taskTitle })
      : promoted.reason === HandoffReason.RecordRides
        ? t('barNoRides')
        : t('barNoExpenses', { year: promoted.year });
  return (
    <>
      {lead} <span>{body}</span>
    </>
  );
}

/**
 * < 768 px: a slim, dismissible bottom bar (no QR on a phone), opaque and one
 * step up the ramp, offset by the cookie banner's height. Copy follows the
 * promoted reason, or names what lives in the app with none. Dismissal is remembered per device (localStorage, every
 * access wrapped).
 *
 * Renders nothing on the server and until mounted: whether it was dismissed
 * is only knowable in the browser, so reading it during render would break
 * hydration. It then enters from below (250 ms; none under reduced motion). Includes a
 * spacer so the bar never covers the end of the page. Hidden ≥ 768 px by CSS.
 */
export function AppHandoffBar({ promoted }: { promoted: PromotedHandoff | null }) {
  const t = useTranslations('AppHandoff');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isAppBarDismissed(browserStorage()));
  }, []);

  if (!visible) return null;

  const Icon = promoted ? BAR_ICON[promoted.reason] : Smartphone;
  function dismiss() {
    rememberAppBarDismissed(browserStorage());
    setVisible(false);
  }

  return (
    <>
      <div className="mvg-bar-spacer" aria-hidden="true" />
      <section className="mvg-bar" aria-label={t('barRegion')}>
        <span className="mvg-bar-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <p className="mvg-bar-text" style={{ margin: 0 }}>
          {promoted ? <BarCopy promoted={promoted} /> : t('barDefault')}
        </p>
        <a href={APP_HANDOFF_URL} className="mv-btn mv-btn-primary mvg-bar-open">
          {t('barOpen')}
        </a>
        <button
          type="button"
          className="mv-icon-btn mvg-bar-dismiss"
          aria-label={t('barDismiss')}
          onClick={dismiss}
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </section>
    </>
  );
}
