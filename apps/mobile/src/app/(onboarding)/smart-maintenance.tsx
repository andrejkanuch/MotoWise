import { palette } from '@motovault/design-system';
import type { MaintenanceStyle } from '@motovault/types';
import { LastServiceDate, ReminderChannel } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Bell,
  Building2,
  HelpCircle,
  ShieldAlert,
  Sun,
  Wrench,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { NativeToggle } from '../../components/ui/native-toggle';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const MAINTENANCE_STYLE_OPTIONS: {
  value: MaintenanceStyle;
  icon: typeof Wrench;
  color: string;
}[] = [
  { value: 'diy', icon: Wrench, color: ONBOARDING_COLORS.success },
  { value: 'sometimes', icon: HelpCircle, color: palette.moduleSuspension },
  { value: 'mechanic', icon: Building2, color: '#A78BFA' },
];

const TOGGLE_ROWS = [
  {
    key: 'maintenanceReminders',
    icon: Bell,
    labelKey: 'maintenanceRemindersLabel',
    descKey: 'maintenanceRemindersDesc',
    color: ONBOARDING_COLORS.accent,
  },
  {
    key: 'seasonalTips',
    icon: Sun,
    labelKey: 'seasonalTipsLabel',
    descKey: 'seasonalTipsDesc',
    color: ONBOARDING_COLORS.warning,
  },
  {
    key: 'recallAlerts',
    icon: ShieldAlert,
    labelKey: 'recallAlertsLabel',
    descKey: 'recallAlertsDesc',
    color: palette.danger500,
  },
  {
    key: 'weeklySummary',
    icon: BarChart3,
    labelKey: 'weeklySummaryLabel',
    descKey: 'weeklySummaryDesc',
    color: ONBOARDING_COLORS.success,
  },
] as const;

const LAST_SERVICE_OPTIONS = [
  { value: LastServiceDate.UNDER_1MO, labelKey: 'lastService_under_1mo' },
  { value: LastServiceDate.BETWEEN_1_3MO, labelKey: 'lastService_1_3mo' },
  { value: LastServiceDate.BETWEEN_3_6MO, labelKey: 'lastService_3_6mo' },
  { value: LastServiceDate.OVER_6MO, labelKey: 'lastService_6mo_plus' },
  { value: LastServiceDate.UNSURE, labelKey: 'lastService_unsure' },
] as const;

const REMINDER_CHANNEL_OPTIONS = [
  {
    value: ReminderChannel.PUSH,
    labelKey: 'reminderChannel_push',
    icon: Bell,
    color: ONBOARDING_COLORS.accent,
  },
  {
    value: ReminderChannel.EMAIL,
    labelKey: 'reminderChannel_email',
    icon: Bell,
    color: palette.moduleSuspension,
  },
  {
    value: ReminderChannel.BOTH,
    labelKey: 'reminderChannel_both',
    icon: Bell,
    color: ONBOARDING_COLORS.success,
  },
] as const;

type ToggleKey = 'maintenanceReminders' | 'seasonalTips' | 'recallAlerts' | 'weeklySummary';

export default function SmartMaintenanceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const store = useOnboardingStore();

  const bikeData = store.bikeData;
  const bikeName =
    bikeData?.nickname ??
    (bikeData?.make && bikeData?.model
      ? `${bikeData.make} ${bikeData.model}`
      : t('common.appName'));

  const [maintStyle, setMaintStyle] = useState<MaintenanceStyle | null>(store.maintenanceStyle);

  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    maintenanceReminders: store.maintenanceReminders,
    seasonalTips: store.seasonalTips,
    recallAlerts: store.recallAlerts,
    weeklySummary: store.weeklySummary,
  });

  const [lastService, setLastService] = useState<LastServiceDate | null>(store.lastServiceDate);
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel | null>(
    store.reminderChannel,
  );

  const handleMaintStylePress = (value: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMaintStyle(value as MaintenanceStyle);
  };

  const handleToggle = (key: ToggleKey) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLastServicePress = (value: string) => {
    setLastService(value as LastServiceDate);
  };

  const handleReminderChannelPress = (value: string) => {
    setReminderChannel(value as ReminderChannel);
  };

  const canContinue =
    maintStyle !== null &&
    lastService !== null &&
    (!toggles.maintenanceReminders || reminderChannel !== null);

  const handleContinue = () => {
    if (!canContinue) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (maintStyle) store.setMaintenanceStyle(maintStyle);
    store.setMaintenanceReminders(toggles.maintenanceReminders);
    store.setSeasonalTips(toggles.seasonalTips);
    store.setRecallAlerts(toggles.recallAlerts);
    store.setWeeklySummary(toggles.weeklySummary);
    store.setLastServiceDate(lastService);
    if (toggles.maintenanceReminders && reminderChannel) {
      store.setReminderChannel(reminderChannel);
    }
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'smart_maintenance',
      step_index: 8,
      maintenance_style: maintStyle,
      maintenance_reminders: toggles.maintenanceReminders,
      seasonal_tips: toggles.seasonalTips,
      recall_alerts: toggles.recallAlerts,
      weekly_summary: toggles.weeklySummary,
      last_service: lastService,
      reminder_channel: reminderChannel,
    });
    router.replace('/(onboarding)/insights');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={8} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.5,
            marginBottom: 32,
          }}
        >
          {t('onboarding.smartMaintenanceTitle', { bike: bikeName })}
        </Animated.Text>

        {/* Maintenance style — merged from maintenance-style screen */}
        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: ONBOARDING_COLORS.textPrimary,
            marginBottom: 12,
          }}
        >
          {t('onboarding.maintenanceStyleTitle')}
        </Animated.Text>

        <View style={{ gap: 8, marginBottom: 32 }}>
          {MAINTENANCE_STYLE_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min(150 + index * 50, 400)).duration(300)}
            >
              <OnboardingCard
                value={option.value}
                icon={option.icon}
                label={t(`onboarding.maintenanceStyle_${option.value}`)}
                subtitle={t(`onboarding.maintenanceStyleDesc_${option.value}`)}
                color={option.color}
                selected={maintStyle === option.value}
                onPress={handleMaintStylePress}
              />
            </Animated.View>
          ))}
        </View>

        {/* Toggle rows */}
        <View style={{ gap: 16, marginBottom: 32 }}>
          {TOGGLE_ROWS.map((row, index) => {
            const Icon = row.icon;
            return (
              <Animated.View
                key={row.key}
                entering={FadeInUp.delay(Math.min(index * 50, 400)).duration(300)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderCurve: 'continuous',
                    backgroundColor: `${row.color}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={18} color={row.color} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: ONBOARDING_COLORS.textPrimary,
                      fontSize: 17,
                      fontWeight: '600',
                    }}
                  >
                    {t(`onboarding.${row.labelKey}`)}
                  </Text>
                  <Text
                    style={{ color: ONBOARDING_COLORS.textSecondary, fontSize: 14, marginTop: 2 }}
                  >
                    {t(`onboarding.${row.descKey}`)}
                  </Text>
                </View>

                <NativeToggle
                  value={toggles[row.key]}
                  onValueChange={() => handleToggle(row.key)}
                />
              </Animated.View>
            );
          })}
        </View>

        {/* Last service date */}
        <Animated.Text
          entering={FadeInUp.delay(250).duration(300)}
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: ONBOARDING_COLORS.textPrimary,
            marginBottom: 12,
          }}
        >
          {t('onboarding.lastServiceTitle')}
        </Animated.Text>

        <View style={{ gap: 8, marginBottom: 32 }}>
          {LAST_SERVICE_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min(300 + index * 50, 600)).duration(300)}
            >
              <OnboardingCard
                value={option.value}
                icon={Bell}
                label={t(`onboarding.${option.labelKey}`)}
                color={ONBOARDING_COLORS.accent}
                selected={lastService === option.value}
                onPress={handleLastServicePress}
              />
            </Animated.View>
          ))}
        </View>

        {/* Reminder channel — only if maintenance reminders ON */}
        {toggles.maintenanceReminders && (
          <>
            <Animated.Text
              entering={FadeInUp.duration(300)}
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: ONBOARDING_COLORS.textPrimary,
                marginBottom: 12,
              }}
            >
              {t('onboarding.reminderChannelTitle')}
            </Animated.Text>

            <View style={{ gap: 8, marginBottom: 32 }}>
              {REMINDER_CHANNEL_OPTIONS.map((option, index) => (
                <Animated.View
                  key={option.value}
                  entering={FadeInUp.delay(Math.min(index * 50, 400)).duration(300)}
                >
                  <OnboardingCard
                    value={option.value}
                    icon={option.icon}
                    label={t(`onboarding.${option.labelKey}`)}
                    color={option.color}
                    selected={reminderChannel === option.value}
                    onPress={handleReminderChannelPress}
                  />
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => ({
            backgroundColor: canContinue
              ? ONBOARDING_COLORS.textPrimary
              : ONBOARDING_COLORS.textDimmed,
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: canContinue ? ONBOARDING_COLORS.background : ONBOARDING_COLORS.textMuted,
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
