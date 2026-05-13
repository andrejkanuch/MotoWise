import type { OemSchedulesPreviewQuery } from '@motovault/graphql';
import { Droplets, Fuel, Gauge, Shield, Sun, Thermometer, Wrench, Zap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

type OemTask = OemSchedulesPreviewQuery['oemSchedulesPreview'][number];

import { ONBOARDING_COLORS } from '../onboarding-colors';

const PRIORITY_TONE = {
  critical: {
    labelKey: 'onboarding.v2TaskCardCritical',
    color: ONBOARDING_COLORS.rejectRed,
    bg: ONBOARDING_COLORS.rejectBgTint,
  },
  high: {
    labelKey: 'onboarding.v2TaskCardCritical',
    color: ONBOARDING_COLORS.rejectRed,
    bg: ONBOARDING_COLORS.rejectBgTint,
  },
  medium: {
    labelKey: 'onboarding.v2TaskCardRecommended',
    color: ONBOARDING_COLORS.warm,
    bg: ONBOARDING_COLORS.accentBg,
  },
  low: {
    labelKey: 'onboarding.v2TaskCardOptional',
    color: ONBOARDING_COLORS.accentBlue,
    bg: ONBOARDING_COLORS.blueBgTint,
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

function formatIntervalKey(task: OemTask): { key: string; opts?: Record<string, unknown> } {
  if (task.intervalKm && task.intervalDays) {
    return {
      key: 'onboarding.v2TaskCardEveryKmMo',
      opts: { km: task.intervalKm.toLocaleString(), months: Math.round(task.intervalDays / 30) },
    };
  }
  if (task.intervalKm)
    return { key: 'onboarding.v2TaskCardEveryKm', opts: { km: task.intervalKm.toLocaleString() } };
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
  brandColor: string;
  dragDirection: SharedValue<'left' | 'right' | null>;
}

export function TaskCard({ task, brandColor, dragDirection }: TaskCardProps) {
  const { t } = useTranslation();
  const tone = PRIORITY_TONE[task.priority as keyof typeof PRIORITY_TONE] ?? PRIORITY_TONE.medium;
  const Icon = getTaskIcon(task.taskName);
  const { key: intervalKey, opts: intervalOpts } = formatIntervalKey(task);
  const interval = t(intervalKey as 'onboarding.v2TaskCardAsNeeded', intervalOpts);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor:
      dragDirection.value === 'right'
        ? ONBOARDING_COLORS.acceptGreen
        : dragDirection.value === 'left'
          ? ONBOARDING_COLORS.rejectRed
          : ONBOARDING_COLORS.borderFaint,
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
          borderRadius: 22,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: ONBOARDING_COLORS.surfaceCard,
          borderWidth: 1.5,
          padding: 20,
          paddingBottom: 18,
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
          marginBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 4,
            paddingHorizontal: 9,
            borderRadius: 999,
            backgroundColor: tone.bg,
            borderWidth: 1,
            borderColor: `${tone.color}40`,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: tone.color }} />
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 9.5,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: tone.color,
            }}
          >
            {t(tone.labelKey)}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 10,
            color: ONBOARDING_COLORS.textLabel,
            letterSpacing: 1,
          }}
        >
          {t('onboarding.v2TaskCardOem')}
        </Text>
      </View>

      {/* Icon */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: brandColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          ...(process.env.EXPO_OS === 'ios'
            ? {
                shadowColor: brandColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.55,
                shadowRadius: 12,
              }
            : {}),
        }}
      >
        <Icon size={26} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={1.8} />
      </View>

      {/* Title */}
      <Text
        style={{
          fontFamily: 'InstrumentSerif-Italic',
          fontSize: 26,
          lineHeight: 28,
          letterSpacing: -0.4,
          color: ONBOARDING_COLORS.textWhite,
          marginBottom: 12,
        }}
      >
        {task.taskName}
      </Text>

      {/* Interval */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 9,
            fontWeight: '600',
            letterSpacing: 1.3,
            textTransform: 'uppercase',
            color: ONBOARDING_COLORS.textMutedIcon,
            marginBottom: 4,
          }}
        >
          {t('onboarding.v2TaskCardInterval')}
        </Text>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: ONBOARDING_COLORS.textWhite,
            letterSpacing: -0.1,
          }}
        >
          {interval}
        </Text>
      </View>

      {/* Description */}
      {task.description && (
        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 18,
            color: ONBOARDING_COLORS.textBody,
            marginBottom: 10,
          }}
        >
          {task.description}
        </Text>
      )}

      {/* Swipe stamps */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 60,
            right: 20,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 8,
            borderWidth: 3,
            borderColor: ONBOARDING_COLORS.acceptGreen,
            backgroundColor: ONBOARDING_COLORS.surfaceOverlayDark,
            transform: [{ rotate: '-12deg' }],
          },
          addStampStyle,
        ]}
      >
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontWeight: '800',
            fontSize: 16,
            letterSpacing: 2,
            color: ONBOARDING_COLORS.acceptGreen,
          }}
        >
          {t('onboarding.v2TaskCardAdd')}
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 60,
            left: 20,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 8,
            borderWidth: 3,
            borderColor: ONBOARDING_COLORS.rejectRed,
            backgroundColor: ONBOARDING_COLORS.surfaceOverlayDark,
            transform: [{ rotate: '12deg' }],
          },
          skipStampStyle,
        ]}
      >
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontWeight: '800',
            fontSize: 16,
            letterSpacing: 2,
            color: ONBOARDING_COLORS.rejectRed,
          }}
        >
          {t('onboarding.v2TaskCardSkip')}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
