import { type MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type AccessibilityActionEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useCurrency } from '../../../hooks/use-currency';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { formatOdometer, formatShortDate, hasOdometer } from '../../../lib/bike-hub/format';
import { formatMoney, serviceTypeLabel } from '../../../lib/expense-constants';
import { triggerImpact } from '../../../utils/haptics';
import { TaskPhotoGallery } from '../../task-photo-gallery';
import type { HubTask } from '../shell/use-bike-hub-data';
import { DueLine, describeDue } from '../ui/due-line';
import { PriorityTag } from '../ui/priority-tag';
import {
  HUB_FONT,
  HUB_RADIUS,
  HUB_STACK_FONT_SCALE,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  hub,
} from '../ui/tokens';
import { effectiveTaskTotal, isCriticalOverdue, type ServiceTaskItem } from './group-tasks';

const CIRCLE_SIZE = 26;
const CIRCLE_BORDER = 1.5;
const DATE_COLUMN = 46;
const DETAILS_FADE_MS = 180;
const MARK_DONE_ACTION = 'markDone';
const ACTIVATE_ACTION = 'activate';
const SEPARATOR = '. ';

const PRIORITY_NAME_KEY: Record<MaintenancePriority, HubCopyKey> = {
  critical: 'bikeHub.priority.critical',
  high: 'bikeHub.priority.high',
  medium: 'bikeHub.priority.medium',
  low: 'bikeHub.priority.low',
};

/** True at accessibility text sizes: rows stack their parts instead of sitting side by side. */
function useStacked(): boolean {
  return useWindowDimensions().fontScale >= HUB_STACK_FONT_SCALE;
}

const TITLE_STYLE = {
  fontFamily: HUB_FONT.sansSemiBold,
  fontSize: 15,
  lineHeight: 18,
  color: hub.text,
} as const;

const SUB_STYLE = {
  fontFamily: HUB_FONT.sans,
  fontSize: 13,
  lineHeight: 16,
  color: hub.dim,
} as const;

function rowDivider(divider: boolean): ViewStyle {
  return { borderBottomWidth: divider ? 1 : 0, borderBottomColor: hub.hairline };
}

// ---------------------------------------------------------------------------
// Active task row
// ---------------------------------------------------------------------------

interface ServiceTaskRowProps {
  item: ServiceTaskItem;
  unit: HubUnit;
  /** The bike's make, for "Honda schedule". */
  make: string;
  expanded: boolean;
  /** Hairline under the row — off for the last row of a card. */
  divider: boolean;
  onToggle: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  onDelete: (taskId: string, title: string) => void;
  motorcycleId: string;
}

/**
 * `[priority tag] [title / due line] [mark-done circle]` (DESIGN-SPEC §2 Task
 * row). Two sibling pressables — the title block opens the task (expands it
 * until the TaskDetail screen lands), the circle completes it — never a button
 * inside a pressable. Priority is always the tag; lateness is always the due
 * line. At accessibility sizes the tag moves above the title so the title keeps
 * the full width.
 */
export const ServiceTaskRow = memo(function ServiceTaskRow({
  item,
  unit,
  make,
  expanded,
  divider,
  onToggle,
  onComplete,
  onEdit,
  onDelete,
  motorcycleId,
}: ServiceTaskRowProps) {
  const { t, i18n } = useTranslation();
  const stacked = useStacked();
  const { task, due } = item;
  const critical = isCriticalOverdue(item);
  const copy = describeDue(due, { t, unit, language: i18n.language, scheduleName: make });
  const priorityName = t(PRIORITY_NAME_KEY[task.priority]);
  const rowLabel = [
    task.title,
    copy.primary,
    copy.secondary,
    t('bikeHub.service.priorityA11y', { priority: priorityName }),
  ]
    .filter(Boolean)
    .join(SEPARATOR);
  const markDoneLabel = t('bikeHub.service.markDoneA11y', { title: task.title });

  const complete = () => {
    triggerImpact();
    onComplete(task.id);
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === MARK_DONE_ACTION) onComplete(task.id);
    if (event.nativeEvent.actionName === ACTIVATE_ACTION) onToggle(task.id);
  };

  const tag = <PriorityTag priority={task.priority} fixedWidth={!stacked} />;
  const text = (
    <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
      <Text style={TITLE_STYLE}>{task.title}</Text>
      <DueLine due={due} unit={unit} scheduleName={make} />
    </View>
  );

  return (
    <View style={rowDivider(divider)}>
      <View style={{ flexDirection: 'row', alignItems: stacked ? 'flex-start' : 'center' }}>
        <Pressable
          testID={`service-task-${task.id}`}
          onPress={() => {
            triggerImpact();
            onToggle(task.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={rowLabel}
          accessibilityState={{ expanded }}
          accessibilityActions={[
            { name: ACTIVATE_ACTION },
            { name: MARK_DONE_ACTION, label: t('bikeHub.service.markDone') },
          ]}
          onAccessibilityAction={onAccessibilityAction}
          style={({ pressed }) => ({
            flex: 1,
            minWidth: 0,
            minHeight: HUB_TOUCH_TARGET,
            flexDirection: stacked ? 'column' : 'row',
            alignItems: stacked ? 'flex-start' : 'center',
            gap: stacked ? 6 : 12,
            paddingVertical: 10,
            paddingLeft: 12,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {tag}
          {text}
        </Pressable>
        <Pressable
          testID={`service-task-done-${task.id}`}
          onPress={complete}
          accessibilityRole="button"
          accessibilityLabel={markDoneLabel}
          style={({ pressed }) => ({
            width: HUB_TOUCH_TARGET,
            height: HUB_TOUCH_TARGET,
            marginRight: 6,
            marginTop: stacked ? 4 : 0,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
              borderWidth: CIRCLE_BORDER,
              borderColor: critical ? hub.late : hub.muted,
            }}
          />
        </Pressable>
      </View>
      {expanded ? (
        <TaskDetails task={task} motorcycleId={motorcycleId} onEdit={onEdit} onDelete={onDelete} />
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// History row
// ---------------------------------------------------------------------------

interface HistoryTaskRowProps {
  task: HubTask;
  unit: HubUnit;
  expanded: boolean;
  divider: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string, title: string) => void;
  motorcycleId: string;
}

/**
 * Completed work: `[date column] [title / odometer] [cost]` (DESIGN-SPEC §2
 * History rows) — full-contrast text, no strikethrough. Tapping expands it.
 */
export const HistoryTaskRow = memo(function HistoryTaskRow({
  task,
  unit,
  expanded,
  divider,
  onToggle,
  onDelete,
  motorcycleId,
}: HistoryTaskRowProps) {
  const { t, i18n } = useTranslation();
  const stacked = useStacked();
  const { currency: displayCurrency } = useCurrency();
  const language = i18n.language;
  const completedAt = task.completedAt ? new Date(task.completedAt) : null;
  const shortDate = completedAt ? formatShortDate(completedAt, language) : '';
  const year = completedAt ? String(completedAt.getFullYear()) : '';
  const fullDate = completedAt
    ? completedAt.toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const odometer = hasOdometer(task.completedMileage)
    ? t('bikeHub.due.atDistance', {
        distance: formatOdometer(task.completedMileage, language),
        unit,
      })
    : null;
  const total = effectiveTaskTotal(task);
  const cost = total > 0 ? formatMoney(total, task.currency, displayCurrency) : null;
  const label = [
    task.title,
    fullDate ? t('bikeHub.service.doneOn', { date: fullDate }) : null,
    odometer,
    cost,
  ]
    .filter(Boolean)
    .join(SEPARATOR);

  const date = completedAt ? (
    <View
      style={{
        width: stacked ? undefined : DATE_COLUMN,
        flexDirection: stacked ? 'row' : 'column',
        gap: stacked ? 6 : 1,
      }}
    >
      <Text
        style={{ fontFamily: HUB_FONT.monoMedium, fontSize: 13, lineHeight: 16, color: hub.text }}
      >
        {shortDate}
      </Text>
      <Text style={{ fontFamily: HUB_FONT.mono, fontSize: 11, lineHeight: 16, color: hub.muted }}>
        {year}
      </Text>
    </View>
  ) : null;
  const money = cost ? (
    <Text
      style={{ fontFamily: HUB_FONT.monoMedium, fontSize: 14, lineHeight: 18, color: hub.text }}
    >
      {cost}
    </Text>
  ) : null;

  return (
    <View style={rowDivider(divider)}>
      <Pressable
        testID={`service-history-${task.id}`}
        onPress={() => {
          triggerImpact();
          onToggle(task.id);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          minHeight: HUB_TOUCH_TARGET,
          flexDirection: stacked ? 'column' : 'row',
          alignItems: stacked ? 'flex-start' : 'center',
          gap: stacked ? 4 : 12,
          paddingVertical: 11,
          paddingLeft: 14,
          paddingRight: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {date}
        <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 2 }}>
          <Text style={TITLE_STYLE}>{task.title}</Text>
          {odometer ? <Text style={SUB_STYLE}>{odometer}</Text> : null}
        </View>
        {money}
      </Pressable>
      {expanded ? (
        <TaskDetails task={task} motorcycleId={motorcycleId} onDelete={onDelete} />
      ) : null}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Expanded details (until the TaskDetail screen lands in R3)
// ---------------------------------------------------------------------------

function DetailLabel({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: HUB_FONT.mono,
        fontSize: 11,
        letterSpacing: 11 * 0.08,
        textTransform: 'uppercase',
        color: hub.muted,
      }}
    >
      {children}
    </Text>
  );
}

const BODY_STYLE = {
  fontFamily: HUB_FONT.sans,
  fontSize: 14,
  lineHeight: 19,
  color: hub.textSoft,
} as const;

function TextAction({
  label,
  color,
  onPress,
  testID,
}: {
  label: string;
  color: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: HUB_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color }}>{label}</Text>
    </Pressable>
  );
}

interface TaskDetailsProps {
  task: HubTask;
  motorcycleId: string;
  onEdit?: (taskId: string) => void;
  onDelete: (taskId: string, title: string) => void;
}

function TaskDetails({ task, motorcycleId, onEdit, onDelete }: TaskDetailsProps) {
  const { t } = useTranslation();
  const { currency: displayCurrency } = useCurrency();
  const parts = task.partsNeeded ?? [];
  const lineItems = task.lineItems ?? [];
  const editable = task.status !== MaintenanceTaskStatus.Completed && onEdit;

  return (
    <Animated.View
      entering={FadeIn.duration(DETAILS_FADE_MS)}
      testID={`service-task-details-${task.id}`}
      style={{ paddingLeft: 14, paddingRight: 12, paddingBottom: 4, gap: 12 }}
    >
      {task.description ? <Text style={BODY_STYLE}>{task.description}</Text> : null}
      {task.notes ? (
        <View style={{ gap: 4 }}>
          <DetailLabel>{t('maintenance.notes')}</DetailLabel>
          <Text selectable style={BODY_STYLE}>
            {task.notes}
          </Text>
        </View>
      ) : null}
      {parts.length > 0 ? (
        <View style={{ gap: 4 }}>
          <DetailLabel>{t('maintenance.partsNeeded')}</DetailLabel>
          {parts.map((part) => (
            <Text key={`${task.id}-part-${part}`} style={BODY_STYLE}>
              {`• ${part}`}
            </Text>
          ))}
        </View>
      ) : null}
      {lineItems.length > 0 ? (
        <View style={{ gap: 6 }}>
          <DetailLabel>{t('bikeHub.service.serviceItems')}</DetailLabel>
          {lineItems.map((line) => (
            <View
              key={line.id}
              style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
            >
              {line.serviceType && line.serviceType !== 'other' ? (
                <View
                  style={{
                    backgroundColor: hub.raised,
                    borderRadius: HUB_RADIUS.tag,
                    borderCurve: 'continuous',
                    paddingVertical: 2,
                    paddingHorizontal: 6,
                  }}
                >
                  <Text style={{ fontFamily: HUB_FONT.sansMedium, fontSize: 12, color: hub.dim }}>
                    {serviceTypeLabel(line.serviceType, t)}
                  </Text>
                </View>
              ) : null}
              <Text style={[BODY_STYLE, { flex: 1, minWidth: 120 }]}>{line.label}</Text>
              {line.lineTotal != null ? (
                <Text style={{ fontFamily: HUB_FONT.monoMedium, fontSize: 13, color: hub.text }}>
                  {formatMoney(line.lineTotal, task.currency, displayCurrency)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <TaskPhotoGallery
        taskId={task.id}
        userId={task.userId}
        motorcycleId={motorcycleId}
        photos={task.photos ?? []}
        isDark
      />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          columnGap: 16,
          borderTopWidth: 1,
          borderTopColor: hub.hairline,
        }}
      >
        {editable ? (
          <TextAction
            testID={`service-task-edit-${task.id}`}
            label={t('common.edit')}
            color={hub.copperText}
            onPress={() => onEdit(task.id)}
          />
        ) : null}
        <TextAction
          testID={`service-task-delete-${task.id}`}
          label={t('common.delete')}
          color={hub.late}
          onPress={() => onDelete(task.id, task.title)}
        />
      </View>
    </Animated.View>
  );
}
