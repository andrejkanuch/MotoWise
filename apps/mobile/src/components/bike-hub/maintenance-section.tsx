import { useRouter } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import type { HubUnit } from '../../lib/bike-hub/constants';
import { triggerImpact, triggerSelection } from '../../utils/haptics';
import {
  completedTasks,
  groupActiveTasks,
  isCriticalOverdue,
  type ServiceGroup,
  type ServiceTaskItem,
} from './service/group-tasks';
import { HistoryTaskRow, ServiceTaskRow } from './service/task-row';
import type { HubTask } from './shell/use-bike-hub-data';
import { useToday } from './shell/use-today';
import { HubCard } from './ui/hub-card';
import { SectionHeader } from './ui/section-header';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FIGURE_STRONG,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  type HubTheme,
  SYSTEM_WEIGHT,
  useHubTheme,
} from './ui/tokens';

/** Completed tasks shown before "See all" opens the full list. */
const HISTORY_PREVIEW = 5;
const ENTER_MS = 200;
const STAGGER_MS = 15;
const ACTION_LINE_HEIGHT = 18;
const ACTION_SLOP = Math.ceil((HUB_TOUCH_TARGET - ACTION_LINE_HEIGHT) / 2);
const SEE_ALL_FILTER = 'completed';

const SERVICE_TAB = { ACTIVE: 'active', HISTORY: 'history' } as const;
type ServiceTab = (typeof SERVICE_TAB)[keyof typeof SERVICE_TAB];
const SERVICE_TABS: readonly ServiceTab[] = [SERVICE_TAB.ACTIVE, SERVICE_TAB.HISTORY];
const TAB_LABEL_KEY = {
  [SERVICE_TAB.ACTIVE]: 'maintenance.activeTasks',
  [SERVICE_TAB.HISTORY]: 'maintenance.history',
} as const;

interface MaintenanceSectionProps {
  tasks: HubTask[];
  motorcycleId: string;
  /** The bike's odometer, RAW in its own unit — for "3,550 km to target". */
  odometer: number | null | undefined;
  /** The bike's make, for "Honda schedule". */
  make: string;
  /** Deep-link: expand this task once when tasks are available. */
  initialExpandedId?: string | null;
  onComplete: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onEdit?: (id: string) => void;
  /** The bike's unit — a label only, nothing is converted. */
  mileageUnit: HubUnit;
}

/** Active · 10 | History · 10 — a two-option segmented control in hub tokens. */
function ServiceTabs({
  active,
  counts,
  onChange,
}: {
  active: ServiceTab;
  counts: Record<ServiceTab, number>;
  onChange: (tab: ServiceTab) => void;
}) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: 2,
        padding: 2,
        borderRadius: HUB_RADIUS.chip + 1,
        borderCurve: 'continuous',
        backgroundColor: hub.card,
        borderWidth: 1,
        borderColor: hub.hairline,
      }}
    >
      {SERVICE_TABS.map((tab) => {
        const selected = tab === active;
        const label = t(TAB_LABEL_KEY[tab]);
        return (
          <Pressable
            key={tab}
            testID={`service-tab-${tab}`}
            onPress={() => {
              if (selected) return;
              triggerSelection();
              onChange(tab);
            }}
            accessibilityRole="tab"
            accessibilityLabel={`${label}, ${counts[tab]}`}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: HUB_TOUCH_TARGET - 4,
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: HUB_RADIUS.chip - 1,
              borderCurve: 'continuous',
              backgroundColor: selected ? hub.raised : undefined,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Segmented-control chrome: capped like the segment bar, one line —
                "Active · 10" broke into two at accessibility sizes. */}
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              style={{
                textAlign: 'center',
                ...SYSTEM_WEIGHT.semibold,
                fontSize: 13,
                lineHeight: 17,
                color: selected ? hub.text : hub.dim,
              }}
            >
              {label}
              <Text style={{ ...HUB_FIGURE_STRONG }}>{` · ${counts[tab]}`}</Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Empty states sit on a plain card: an icon tile, what is true, what to do. */
function EmptyCard({ title, sub }: { title: string; sub?: string }) {
  const hub = useHubTheme();
  return (
    <Animated.View entering={FadeIn.duration(ENTER_MS)}>
      <HubCard
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 14,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: HUB_RADIUS.tile,
            borderCurve: 'continuous',
            backgroundColor: hub.raised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wrench size={18} color={hub.dim} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              ...SYSTEM_WEIGHT.semibold,
              fontSize: 15,
              lineHeight: 18,
              color: hub.text,
            }}
          >
            {title}
          </Text>
          {sub ? (
            <Text
              style={{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 16, color: hub.dim }}
            >
              {sub}
            </Text>
          ) : null}
        </View>
      </HubCard>
    </Animated.View>
  );
}

function criticalCard(hub: HubTheme) {
  return {
    backgroundColor: hub.rowCritical,
    borderColor: hub.rowCriticalBorder,
    overflow: 'hidden',
  } as const;
}

/**
 * Service segment content (R2 row, interim list): Active tasks in their due
 * groups — Overdue / Due soon / Later / No due date — or the latest completed
 * work. The "Overdue · N" eyebrow is the same number, on the same basis, as the
 * Service badge and Overview's "Needs attention · N overdue" (see
 * `countOverdueTasks` in `lib/bike-hub/attention.ts`): every overdue task is
 * listed here, none is folded away.
 */
export function MaintenanceSection({
  tasks,
  motorcycleId,
  odometer,
  make,
  initialExpandedId = null,
  onComplete,
  onDelete,
  onEdit,
  mileageUnit,
}: MaintenanceSectionProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const today = useToday();
  const [activeTab, setActiveTab] = useState<ServiceTab>(SERVICE_TAB.ACTIVE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasHighlighted = useRef(false);

  const groups = useMemo(
    () => groupActiveTasks(tasks, { odometer, today, unit: mileageUnit }),
    [tasks, odometer, today, mileageUnit],
  );
  const history = useMemo(() => completedTasks(tasks), [tasks]);
  const activeCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  // A task opened from elsewhere (Overview, Home, a notification) is expanded
  // once — on History when it has already been done.
  useEffect(() => {
    if (!initialExpandedId || tasks.length === 0 || hasHighlighted.current) return;
    hasHighlighted.current = true;
    setExpandedId(initialExpandedId);
    if (history.some((task) => task.id === initialExpandedId)) setActiveTab(SERVICE_TAB.HISTORY);
  }, [initialExpandedId, tasks.length, history]);

  const onToggle = useCallback((taskId: string) => {
    setExpandedId((previous) => (previous === taskId ? null : taskId));
  }, []);

  const openAllHistory = () => {
    triggerImpact();
    router.push({
      pathname: '/(tabs)/(garage)/bike-tasks',
      params: { motorcycleId, initialFilter: SEE_ALL_FILTER },
    });
  };

  if (tasks.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16 }}>
        <EmptyCard title={t('maintenance.noTasks')} sub={t('maintenance.addFirstTask')} />
      </View>
    );
  }

  const rowProps = {
    unit: mileageUnit,
    make,
    onToggle,
    onComplete,
    onEdit,
    onDelete,
    motorcycleId,
  };

  const renderRows = (items: readonly ServiceTaskItem[]) =>
    items.map((item, index) => (
      <ServiceTaskRow
        key={item.task.id}
        item={item}
        expanded={expandedId === item.task.id}
        divider={index < items.length - 1}
        {...rowProps}
      />
    ));

  const renderGroup = (group: ServiceGroup, groupIndex: number) => {
    // Spec §2: an overdue Critical task is the only row with a tinted surface,
    // each on its own card above the rest of its group.
    const critical = group.items.filter(isCriticalOverdue);
    const rest = group.items.filter((item) => !isCriticalOverdue(item));
    return (
      <Animated.View
        key={group.state}
        testID={`service-group-${group.state}`}
        entering={FadeInUp.duration(ENTER_MS).delay(groupIndex * STAGGER_MS)}
        style={{ gap: 6 }}
      >
        <SectionHeader label={t(group.labelKey)} count={group.items.length} tone={group.tone} />
        {critical.map((item) => (
          <HubCard key={item.task.id} style={criticalCard(hub)}>
            <ServiceTaskRow
              item={item}
              expanded={expandedId === item.task.id}
              divider={false}
              {...rowProps}
            />
          </HubCard>
        ))}
        {rest.length > 0 ? (
          <HubCard style={{ overflow: 'hidden' }}>{renderRows(rest)}</HubCard>
        ) : null}
      </Animated.View>
    );
  };

  const shownHistory = history.slice(0, HISTORY_PREVIEW);

  return (
    <View style={{ paddingHorizontal: 16, gap: 16 }}>
      <ServiceTabs
        active={activeTab}
        counts={{ [SERVICE_TAB.ACTIVE]: activeCount, [SERVICE_TAB.HISTORY]: history.length }}
        onChange={setActiveTab}
      />

      {activeTab === SERVICE_TAB.ACTIVE ? (
        groups.length === 0 ? (
          <EmptyCard title={t('bikeHub.service.noOpenTasks')} />
        ) : (
          groups.map(renderGroup)
        )
      ) : history.length === 0 ? (
        <EmptyCard title={t('maintenance.noHistory')} />
      ) : (
        <View style={{ gap: 8 }}>
          <HubCard style={{ overflow: 'hidden' }}>
            {shownHistory.map((task, index) => (
              <HistoryTaskRow
                key={task.id}
                task={task}
                unit={mileageUnit}
                expanded={expandedId === task.id}
                divider={index < shownHistory.length - 1}
                onToggle={onToggle}
                onDelete={onDelete}
                motorcycleId={motorcycleId}
              />
            ))}
          </HubCard>
          {history.length > HISTORY_PREVIEW ? (
            <Pressable
              testID="service-history-see-all"
              onPress={openAllHistory}
              accessibilityRole="button"
              hitSlop={{ top: ACTION_SLOP, bottom: ACTION_SLOP }}
              style={({ pressed }) => ({
                alignSelf: 'center',
                paddingHorizontal: 12,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  ...SYSTEM_WEIGHT.semibold,
                  fontSize: 14,
                  lineHeight: ACTION_LINE_HEIGHT,
                  textAlign: 'center',
                  color: hub.copperText,
                }}
              >
                {t('bikeHub.service.seeAllHistory', { count: history.length })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
