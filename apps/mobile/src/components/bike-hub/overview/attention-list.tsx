import type { MaintenancePriority } from '@motovault/graphql';
import type { TFunction } from 'i18next';
import { FileText, type LucideIcon, Shield, ShieldAlert, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import {
  type AttentionItem,
  type AttentionOverflow,
  type AttentionResult,
  countOverdueAttentionItems,
  type DocumentAttentionItem,
  type RecallAttentionItem,
  type TaskAttentionItem,
} from '../../../lib/bike-hub/attention';
import {
  ATTENTION_KIND,
  type AttentionKind,
  type HubUnit,
  type RIDE_BLOCKING_DOCUMENT_CATEGORIES,
} from '../../../lib/bike-hub/constants';
import { formatShortDate } from '../../../lib/bike-hub/format';
import { DueLine, describeDue } from '../ui/due-line';
import type { RowIcon } from '../ui/list-row';
import { PriorityTag } from '../ui/priority-tag';
import { REFRESH_BLOCK, RefreshFailed } from '../ui/refresh-failed';
import { SectionHeader } from '../ui/section-header';
import {
  HUB_RADIUS,
  HUB_ROW_SUB_LINES,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  type HubTheme,
  PRIORITY_TAG,
  SYSTEM_WEIGHT,
  TAG_VARIANT,
  useHubTheme,
} from '../ui/tokens';
import { AttentionRow } from './attention-row';

const SEPARATOR = ' · ';
const SKELETON_ROWS = 3;

const PRIORITY_NAME_KEY: Record<MaintenancePriority, HubCopyKey> = {
  critical: 'bikeHub.priority.critical',
  high: 'bikeHub.priority.high',
  medium: 'bikeHub.priority.medium',
  low: 'bikeHub.priority.low',
};

interface RowContext {
  t: TFunction;
  language: string;
  unit: HubUnit;
  make: string;
  onPress: (item: AttentionItem) => void;
}

function tone(hub: HubTheme, critical: boolean): { fg: string; bg: string } {
  return critical ? { fg: hub.late, bg: hub.tagCritBg } : { fg: hub.soon, bg: hub.tagHighBg };
}

function subLine(hub: HubTheme, lead: string, leadColor: string, rest?: string) {
  return (
    <Text
      numberOfLines={HUB_ROW_SUB_LINES}
      style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 16 }}
    >
      <Text style={{ color: leadColor }}>{lead}</Text>
      {rest ? (
        <Text style={{ color: hub.muted }}>
          {SEPARATOR}
          {rest}
        </Text>
      ) : null}
    </Text>
  );
}

type BlockingCategory = (typeof RIDE_BLOCKING_DOCUMENT_CATEGORIES)[number];

/** A riding-blocking document's own icon and what the rider should do about it. */
const BLOCKING_DOCUMENT_ROW: Partial<
  Record<BlockingCategory, { icon: LucideIcon; actionKey: HubCopyKey }>
> = {
  Insurance: { icon: Shield, actionKey: 'bikeHub.attention.docActionInsurance' },
};

function blockingDocumentRow(item: DocumentAttentionItem) {
  const { blocksRiding, categoryName } = item.signal;
  if (!blocksRiding || !categoryName) return undefined;
  return BLOCKING_DOCUMENT_ROW[categoryName as BlockingCategory];
}

function RecallRow({ item, context }: { item: RecallAttentionItem; context: RowContext }) {
  const hub = useHubTheme();
  const { t } = context;
  const colors = tone(hub, item.critical);
  const components = item.components.join(SEPARATOR);
  const title =
    item.count === 1
      ? components
        ? t('bikeHub.attention.recallOne', { component: components })
        : t('bikeHub.attention.recallOneNoDetail')
      : t('bikeHub.attention.recallMany', { count: item.count });
  const sub = t('bikeHub.attention.recallSub');
  // One recall names its component in the title; several list them on the sub-line.
  const listed = item.count > 1 ? item.components : [];
  const icon: RowIcon = { icon: ShieldAlert, color: colors.fg, background: colors.bg };
  return (
    <AttentionRow
      testID="attention-recall"
      icon={icon}
      title={title}
      sub={subLine(hub, sub, colors.fg, listed.join(SEPARATOR))}
      trailing={<PriorityTag variant={TAG_VARIANT.SAFETY} critical={item.critical} />}
      accessibilityLabel={[title, sub, listed.join(', ')].filter(Boolean).join('. ')}
      onPress={() => context.onPress(item)}
    />
  );
}

function TaskRow({ item, context }: { item: TaskAttentionItem; context: RowContext }) {
  const hub = useHubTheme();
  const { t, language, unit, make } = context;
  const tag = PRIORITY_TAG[item.task.priority];
  const copy = describeDue(item.due, { t, unit, language, scheduleName: make });
  const icon: RowIcon = { icon: Wrench, color: hub[tag.fg], background: hub[tag.bg] };
  return (
    <AttentionRow
      testID={`attention-task-${item.id}`}
      icon={icon}
      title={item.task.title}
      sub={<DueLine due={item.due} unit={unit} scheduleName={make} />}
      trailing={<PriorityTag priority={item.task.priority} />}
      accessibilityLabel={[item.task.title, copy.primary, copy.secondary, t(tag.labelKey)]
        .filter(Boolean)
        .join('. ')}
      onPress={() => context.onPress(item)}
    />
  );
}

function DocumentRow({ item, context }: { item: DocumentAttentionItem; context: RowContext }) {
  const hub = useHubTheme();
  const { t, language } = context;
  const { signal } = item;
  const colors = tone(hub, signal.expired);
  const category = signal.categoryName ?? t('documents.uncategorized');
  const date = signal.document.expiryDate
    ? formatShortDate(signal.document.expiryDate, language)
    : '';
  const title = signal.expired
    ? t('bikeHub.attention.docExpired', { category, date })
    : t('bikeHub.attention.docExpires', { category, date });
  const lead = signal.expired
    ? t('bikeHub.attention.docDaysAgo', { count: signal.days })
    : signal.days === 0
      ? t('bikeHub.attention.docToday')
      : t('bikeHub.due.inDays', { count: signal.days });
  const blocking = blockingDocumentRow(item);
  const rest = [signal.document.title, blocking ? t(blocking.actionKey) : null]
    .filter(Boolean)
    .join(SEPARATOR);
  const icon: RowIcon = {
    icon: blocking?.icon ?? FileText,
    color: colors.fg,
    background: colors.bg,
  };
  return (
    <AttentionRow
      testID={`attention-document-${item.id}`}
      icon={icon}
      title={title}
      sub={subLine(hub, lead, colors.fg, rest)}
      trailing={<PriorityTag variant={TAG_VARIANT.DOC} critical={signal.expired} />}
      accessibilityLabel={`${title}. ${lead}. ${rest}`}
      onPress={() => context.onPress(item)}
    />
  );
}

const ROW: {
  [K in AttentionKind]: (props: {
    item: Extract<AttentionItem, { kind: K }>;
    context: RowContext;
  }) => React.JSX.Element;
} = {
  [ATTENTION_KIND.RECALL]: RecallRow,
  [ATTENTION_KIND.TASK]: TaskRow,
  [ATTENTION_KIND.DOCUMENT]: DocumentRow,
};

/** "medium and low" — the priorities an overflow row covers. */
function joinPriorities(priorities: readonly MaintenancePriority[], t: TFunction): string {
  const names = priorities.map((priority) => t(PRIORITY_NAME_KEY[priority]));
  if (names.length <= 1) return names[0] ?? '';
  const last = names[names.length - 1] ?? '';
  return t('bikeHub.attention.listAnd', { first: names.slice(0, -1).join(', '), last });
}

function overflowTitle(overflow: AttentionOverflow, t: TFunction): string {
  if (overflow.allOverdue && overflow.priorities.length > 0) {
    return t('bikeHub.attention.moreOverdue', {
      count: overflow.count,
      priorities: joinPriorities(overflow.priorities, t),
    });
  }
  return t('bikeHub.attention.more', { count: overflow.count });
}

function SkeletonRow() {
  const hub = useHubTheme();
  return (
    <View
      style={{
        height: 62,
        borderRadius: HUB_RADIUS.card,
        borderCurve: 'continuous',
        backgroundColor: hub.card,
        borderWidth: 1,
        borderColor: hub.hairline,
        opacity: 0.6,
      }}
    />
  );
}

interface AttentionListProps {
  result: AttentionResult;
  unit: HubUnit;
  make: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Rows are from the cache: the latest refetch failed. */
  refreshFailed?: boolean;
  onPressItem: (item: AttentionItem) => void;
  /** "All" and the overflow row: open the Service segment. */
  onPressAll: () => void;
}

/**
 * "Needs attention · N overdue": the ranked rows (max three) and one "N more" row.
 * Hidden entirely when nothing needs attention.
 */
export function AttentionList({
  result,
  unit,
  make,
  isLoading,
  isError,
  onRetry,
  refreshFailed = false,
  onPressItem,
  onPressAll,
}: AttentionListProps) {
  const hub = useHubTheme();
  const { t, i18n } = useTranslation();
  const title = t('bikeHub.attention.title');

  if (isLoading) {
    return (
      <View testID="attention-loading" style={{ gap: 8 }} accessibilityLabel={t('common.loading')}>
        <SectionHeader label={title} />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => `skeleton-${index}`).map((key) => (
          <SkeletonRow key={key} />
        ))}
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ gap: 8 }}>
        <SectionHeader label={title} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 2,
          }}
        >
          <Text style={{ flex: 1, ...SYSTEM_WEIGHT.regular, fontSize: 14, color: hub.dim }}>
            {t('bikeHub.attention.loadError')}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={{ minHeight: HUB_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 14, color: hub.copperText }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (result.total === 0) return null;

  const context: RowContext = { t, language: i18n.language, unit, make, onPress: onPressItem };
  const { overflow } = result;
  // The eyebrow counts overdue tasks only — the hub's one count, the same
  // number as the Service badge and Service's "Overdue · N" (see
  // `countOverdueTasks`). Recall, document and due-soon rows are listed but
  // not counted, so the number means one thing wherever it appears.
  const overdue = countOverdueAttentionItems(result.items);
  const eyebrow =
    overdue > 0
      ? `${title}${SEPARATOR}${t('bikeHub.attention.overdueCount', { count: overdue })}`
      : title;

  return (
    <View testID="attention-list" style={{ gap: 8 }}>
      <SectionHeader
        label={eyebrow}
        action={{
          label: t('bikeHub.attention.all'),
          accessibilityLabel: t('bikeHub.attention.allA11y'),
          onPress: onPressAll,
        }}
      />
      {refreshFailed ? (
        <RefreshFailed
          block={REFRESH_BLOCK.ATTENTION}
          testID="attention-refresh-failed"
          onRetry={onRetry}
        />
      ) : null}
      {result.visible.map((item) => {
        const Row = ROW[item.kind] as (props: {
          item: AttentionItem;
          context: RowContext;
        }) => React.JSX.Element;
        return <Row key={item.id} item={item} context={context} />;
      })}
      {overflow ? (
        <AttentionRow
          testID="attention-overflow"
          icon={{ icon: Wrench, color: hub.dim, background: hub.raised }}
          title={overflowTitle(overflow, t)}
          sub={overflow.titles.join(SEPARATOR)}
          accessibilityLabel={`${overflowTitle(overflow, t)}. ${overflow.titles.join(', ')}`}
          onPress={onPressAll}
        />
      ) : null}
    </View>
  );
}
