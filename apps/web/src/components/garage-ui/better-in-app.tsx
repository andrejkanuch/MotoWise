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
  /** A hairline row: icon inline, text beside it (rail and band lists). */
  Row: 'row',
  /** The same row without its hairline, for a grid (the empty-garage hero). */
  Tile: 'tile',
} as const;
export type BetterInAppLayout = (typeof BetterInAppLayout)[keyof typeof BetterInAppLayout];

export const BetterInAppDensity = {
  /** Rail / desktop. */
  Regular: 'regular',
  /** Tablet band. Rows keep the site's one row padding; the modifier is a hook only. */
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
      /** Calm row: informational, not a link. */
      reason: HandoffReason;
      promoted?: undefined;
      showCta?: undefined;
    }
  | {
      /** Promoted row: the whole row is one link to motovault.app/get. */
      promoted: PromotedHandoff;
      /** Adds the "Open in the app" line (desktop rail only). */
      showCta?: boolean;
      reason?: undefined;
    }
);

/**
 * One "Better in the app" reason as a row: icon inline next to the text, no
 * tile, no box. Calm by default; at most one promoted row per page (overdue
 * service › no rides › nothing logged this year — see `pickPromotedHandoff`),
 * and that row is the section's copper action.
 */
export function BetterInAppCard(props: BetterInAppCardProps) {
  const { layout = BetterInAppLayout.Row, density = BetterInAppDensity.Regular } = props;
  const classes = (promoted: boolean) =>
    [
      'mv-row',
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
      />
    );
  }
  return <CalmCard reason={props.reason} className={classes(false)} />;
}

function ReasonIcon({ reason }: { reason: HandoffReason }) {
  const Icon = REASON_ICON[reason];
  return (
    <span className="mvg-reason-icon" aria-hidden="true">
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}

function CalmCard({ reason, className }: { reason: HandoffReason; className: string }) {
  const t = useTranslations('AppHandoff');
  const copy = CALM_COPY[reason];
  return (
    <div className={className}>
      <ReasonIcon reason={reason} />
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
}: {
  promoted: PromotedHandoff;
  showCta: boolean;
  className: string;
}) {
  const t = useTranslations('AppHandoff');
  const { title, body } = usePromotedCopy(promoted);
  return (
    <a href={APP_HANDOFF_URL} className={className}>
      <ReasonIcon reason={promoted.reason} />
      <span className="mvg-reason-text">
        <span className="mvg-reason-title">{title}</span>
        <span className="mvg-reason-body">{body}</span>
        {showCta && <span className="mv-link is-quiet mvg-reason-cta">{t('openMotoVault')}</span>}
      </span>
    </a>
  );
}

/**
 * The "Better in the app" list: the promoted row (if any) first, then the
 * calm reasons, never repeating the promoted one. Hairline rows (.mv-rows), no card.
 */
export function BetterInAppList({
  promoted,
  density = BetterInAppDensity.Regular,
  showLabel = true,
  showCta = false,
}: {
  promoted: PromotedHandoff | null;
  density?: BetterInAppDensity;
  /** The "Better in the app" caption above the list (rail: yes, band: no). */
  showLabel?: boolean;
  /** "Open in the app" inside the promoted row (rail only). */
  showCta?: boolean;
}) {
  const t = useTranslations('AppHandoff');
  const listClass =
    density === BetterInAppDensity.Compact
      ? 'mv-rows is-open mvg-reasons mvg-reasons--compact'
      : 'mv-rows is-open mvg-reasons';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
