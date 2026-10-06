import { Bell, Camera, CircleCheck, type LucideIcon, Route } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { APP_HANDOFF_URL, calmReasonsFor, HandoffReason, type PromotedHandoff } from './handoff';
import { MonoLabel } from './primitives';
import './garage-ui.css';

const REASON_ICON: Record<HandoffReason, LucideIcon> = {
  [HandoffReason.MarkServiceDone]: CircleCheck,
  [HandoffReason.RecordRides]: Route,
  [HandoffReason.ServiceReminders]: Bell,
  [HandoffReason.ScanReceipts]: Camera,
};

/** Message keys (AppHandoff namespace) for each reason's calm title/body. */
const CALM_COPY = {
  [HandoffReason.MarkServiceDone]: {
    title: 'reasonMarkServiceDoneTitle',
    body: 'reasonMarkServiceDoneBody',
  },
  [HandoffReason.RecordRides]: { title: 'reasonRecordRidesTitle', body: 'reasonRecordRidesBody' },
  [HandoffReason.ServiceReminders]: {
    title: 'reasonServiceRemindersTitle',
    body: 'reasonServiceRemindersBody',
  },
  [HandoffReason.ScanReceipts]: {
    title: 'reasonScanReceiptsTitle',
    body: 'reasonScanReceiptsBody',
  },
} as const;

export const BetterInAppLayout = {
  /** Icon left (36px tile), text right: rail and band lists. */
  Row: 'row',
  /** Icon above text (32px tile): the empty-garage hero's 3-up row. */
  Tile: 'tile',
} as const;
export type BetterInAppLayout = (typeof BetterInAppLayout)[keyof typeof BetterInAppLayout];

export const BetterInAppDensity = {
  /** Rail / desktop: 12×16 calm, 16 promoted. */
  Regular: 'regular',
  /** Tablet band: 10×14 calm, 14 promoted. */
  Compact: 'compact',
} as const;
export type BetterInAppDensity = (typeof BetterInAppDensity)[keyof typeof BetterInAppDensity];

/** Resolve a promoted reason's title and body (the data lives in the reason). */
export function usePromotedCopy(promoted: PromotedHandoff): { title: string; body: string } {
  const t = useTranslations('AppHandoff');
  switch (promoted.reason) {
    case HandoffReason.MarkServiceDone:
      return {
        title: t('promotedOverdueTitle', { task: promoted.taskTitle }),
        body: t('reasonMarkServiceDoneBody'),
      };
    case HandoffReason.RecordRides:
      return { title: t('promotedNoRidesTitle'), body: t('promotedNoRidesBody') };
    case HandoffReason.ScanReceipts:
      return {
        title: t('promotedNoExpensesTitle', { year: promoted.year }),
        body: t('promotedNoExpensesBody'),
      };
  }
}

type BetterInAppCardProps = {
  layout?: BetterInAppLayout;
  density?: BetterInAppDensity;
} & (
  | {
      /** Calm card: informational, not a link (spec: no fill, no link). */
      reason: HandoffReason;
      promoted?: undefined;
      showCta?: undefined;
    }
  | {
      /** Promoted card: copper, the whole card is one link to motovault.app/get. */
      promoted: PromotedHandoff;
      /** Adds the "Open MotoVault →" line (desktop rail only). */
      showCta?: boolean;
      reason?: undefined;
    }
);

/**
 * One "Better in the app" reason. Calm by default; at most one promoted card
 * per page (overdue service › no rides › nothing logged this year — see
 * `pickPromotedHandoff`).
 */
export function BetterInAppCard(props: BetterInAppCardProps) {
  const { layout = BetterInAppLayout.Row, density = BetterInAppDensity.Regular } = props;
  const classes = (promoted: boolean) =>
    [
      'mvg-reason',
      promoted ? 'mvg-reason--promoted' : null,
      layout === BetterInAppLayout.Tile ? 'mvg-reason--tile' : null,
      density === BetterInAppDensity.Compact ? 'mvg-reason--compact' : null,
    ]
      .filter(Boolean)
      .join(' ');

  if (props.promoted) {
    return (
      <PromotedCard
        promoted={props.promoted}
        showCta={props.showCta ?? false}
        className={classes(true)}
        layout={layout}
      />
    );
  }
  return <CalmCard reason={props.reason} className={classes(false)} layout={layout} />;
}

function ReasonIcon({ reason, layout }: { reason: HandoffReason; layout: BetterInAppLayout }) {
  const Icon = REASON_ICON[reason];
  const size = layout === BetterInAppLayout.Tile ? 16 : 18;
  return (
    <span className="mvg-reason-icon" aria-hidden="true">
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
}

function CalmCard({
  reason,
  className,
  layout,
}: {
  reason: HandoffReason;
  className: string;
  layout: BetterInAppLayout;
}) {
  const t = useTranslations('AppHandoff');
  const copy = CALM_COPY[reason];
  return (
    <div className={className}>
      <ReasonIcon reason={reason} layout={layout} />
      <span className="mvg-reason-text">
        <span className="mvg-reason-title">{t(copy.title)}</span>
        <span className="mvg-reason-body">{t(copy.body)}</span>
      </span>
    </div>
  );
}

function PromotedCard({
  promoted,
  showCta,
  className,
  layout,
}: {
  promoted: PromotedHandoff;
  showCta: boolean;
  className: string;
  layout: BetterInAppLayout;
}) {
  const t = useTranslations('AppHandoff');
  const { title, body } = usePromotedCopy(promoted);
  return (
    <a href={APP_HANDOFF_URL} className={className}>
      <ReasonIcon reason={promoted.reason} layout={layout} />
      <span className="mvg-reason-text">
        <span className="mvg-reason-title">{title}</span>
        <span className="mvg-reason-body">{body}</span>
        {showCta && <span className="mvg-reason-cta">{t('openMotoVault')}</span>}
      </span>
    </a>
  );
}

/**
 * The "Better in the app" list: the promoted card (if any) first, then the
 * calm reasons, never repeating the promoted one.
 */
export function BetterInAppList({
  promoted,
  density = BetterInAppDensity.Regular,
  showLabel = true,
  showCta = false,
}: {
  promoted: PromotedHandoff | null;
  density?: BetterInAppDensity;
  /** The "Better in the app" mono label above the list (rail: yes, band: no). */
  showLabel?: boolean;
  /** "Open MotoVault →" inside the promoted card (rail only). */
  showCta?: boolean;
}) {
  const t = useTranslations('AppHandoff');
  const listClass =
    density === BetterInAppDensity.Compact ? 'mvg-reasons mvg-reasons--compact' : 'mvg-reasons';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {showLabel && <MonoLabel className="mvg-reasons-label">{t('betterInApp')}</MonoLabel>}
      <ul className={listClass}>
        {promoted && (
          <li>
            <BetterInAppCard promoted={promoted} density={density} showCta={showCta} />
          </li>
        )}
        {calmReasonsFor(promoted).map((reason) => (
          <li key={reason}>
            <BetterInAppCard reason={reason} density={density} />
          </li>
        ))}
      </ul>
    </div>
  );
}
