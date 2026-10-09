import type { OemSchedulesPreviewQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { Droplets, Fuel, Gauge, Shield, Sun, Thermometer, Wrench, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type OemTask = OemSchedulesPreviewQuery['oemSchedulesPreview'][number];

import { radius, space, type } from '../../../theme/type';
import { convertIntervalDistance, intervalDistanceUnit } from '../../../utils/maintenance-interval';
import { useOnboardingColors } from '../onboarding-colors';

const PRIORITY_TONE = {
  critical: {
    labelKey: 'onboarding.v2TaskCardCritical',
    color: 'rejectRed',
    bg: 'rejectBgTint',
  },
  high: {
    labelKey: 'onboarding.v2TaskCardCritical',
    color: 'rejectRed',
    bg: 'rejectBgTint',
  },
  medium: {
    labelKey: 'onboarding.v2TaskCardRecommended',
    color: 'textSecondary',
    bg: 'surface2',
  },
  low: {
    labelKey: 'onboarding.v2TaskCardOptional',
    color: 'textMuted',
    bg: 'surface2',
  },
} as const;

function getTaskIcon(taskName: string) {
  const lower = taskName.toLowerCase();
  if (lower.includes('oil') || lower.includes('filter')) return Fuel;
  if (lower.includes('chain') || lower.includes('lube')) return Droplets;
  if (lower.includes('tire') || lower.includes('tyre')) return Gauge;
  if (lower.includes('brake')) return Shield;
  if (lower.includes('valve')) return Wrench;
  if (lower.includes('air')) return Sun;
  if (lower.includes('spark') || lower.includes('plug')) return Zap;
  if (lower.includes('coolant') || lower.includes('radiator')) return Thermometer;
  if (lower.includes('battery')) return Zap;
  return Wrench;
}

function formatIntervalKey(
  task: OemTask,
  system: MeasurementSystem,
): { key: string; opts?: Record<string, unknown> } {
  // Distance intervals render in the user's measurement system using the same
  // km→mi derivation the web article uses, so the displayed string matches the
  // article per unit system (unit parity — plan U7 / audit P0-4).
  if (task.intervalKm && task.intervalDays) {
    return {
      key: 'onboarding.v2TaskCardEveryKmMo',
      opts: {
        distance: convertIntervalDistance(task.intervalKm, system).toLocaleString(),
        unit: intervalDistanceUnit(system),
        months: Math.round(task.intervalDays / 30),
      },
    };
  }
  if (task.intervalKm)
    return {
      key: 'onboarding.v2TaskCardEveryKm',
      opts: {
        distance: convertIntervalDistance(task.intervalKm, system).toLocaleString(),
        unit: intervalDistanceUnit(system),
      },
    };
  if (task.intervalDays) {
    const months = Math.round(task.intervalDays / 30);
    if (months >= 12) {
      return { key: 'onboarding.v2TaskCardEveryYears', opts: { count: Math.round(months / 12) } };
    }
    return { key: 'onboarding.v2TaskCardEveryMonths', opts: { months } };
  }
  return { key: 'onboarding.v2TaskCardAsNeeded' };
}

interface TaskCardProps {
  task: OemTask;
  dragDirection: SharedValue<'left' | 'right' | null>;
  measurementSystem: MeasurementSystem;
}

export function TaskCard({ task, dragDirection, measurementSystem }: TaskCardProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const tone = PRIORITY_TONE[task.priority as keyof typeof PRIORITY_TONE] ?? PRIORITY_TONE.medium;
  const Icon = getTaskIcon(task.taskName);
  const { key: intervalKey, opts: intervalOpts } = formatIntervalKey(task, measurementSystem);
  const interval = t(intervalKey as 'onboarding.v2TaskCardAsNeeded', intervalOpts);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor:
      dragDirection.value === 'right'
        ? oc.acceptGreen
        : dragDirection.value === 'left'
          ? oc.rejectRed
          : oc.borderFaint,
  }));

  const addStampStyle = useAnimatedStyle(() => ({
    opacity: dragDirection.value === 'right' ? 1 : 0,
  }));

  const skipStampStyle = useAnimatedStyle(() => ({
    opacity: dragDirection.value === 'left' ? 1 : 0,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: radius.plate,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: oc.surface,
          borderWidth: 1.5,
          padding: space.lg,
          justifyContent: 'space-between',
        },
        borderStyle,
      ]}
    >
      {/* Priority badge + OEM label */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: space.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            minHeight: 24,
            paddingHorizontal: space.xs,
            borderRadius: radius.pill,
            backgroundColor: oc[tone.bg],
          }}
        >
          <View
            style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: oc[tone.color] }}
          />
          <Text style={[type.label, { color: oc[tone.color] }]}>{t(tone.labelKey)}</Text>
        </View>
        <Text style={[type.caption, { color: oc.textMuted }]}>{t('onboarding.v2TaskCardOem')}</Text>
      </View>

      {/* Icon */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: oc.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.md,
        }}
      >
        <Icon size={24} color={oc.textPrimary} strokeWidth={1.8} />
      </View>

      {/* Title */}
      <Text style={[type.sheetTitle, { color: oc.textPrimary, marginBottom: space.sm }]}>
        {task.taskName}
      </Text>

      {/* Interval */}
      <View style={{ marginBottom: space.sm, gap: space.xxs }}>
        <Text style={[type.label, { color: oc.textMuted }]}>
          {t('onboarding.v2TaskCardInterval')}
        </Text>
        <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>{interval}</Text>
      </View>

      {/* Description */}
      {task.description && (
        <Text style={[type.subhead, { color: oc.textSecondary }]}>{task.description}</Text>
      )}

      {/* Swipe stamps */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 60,
            right: 20,
            paddingVertical: space.xxs,
            paddingHorizontal: space.sm,
            borderRadius: radius.chip,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderColor: oc.acceptGreen,
            backgroundColor: oc.surfaceOverlayDark,
          },
          addStampStyle,
        ]}
      >
        <Text style={[type.bodyStrong, { color: oc.acceptGreen }]}>
          {t('onboarding.v2TaskCardAdd')}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 60,
            left: 20,
            paddingVertical: space.xxs,
            paddingHorizontal: space.sm,
            borderRadius: radius.chip,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderColor: oc.rejectRed,
            backgroundColor: oc.surfaceOverlayDark,
          },
          skipStampStyle,
        ]}
      >
        <Text style={[type.bodyStrong, { color: oc.rejectRed }]}>
          {t('onboarding.v2TaskCardSkip')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
