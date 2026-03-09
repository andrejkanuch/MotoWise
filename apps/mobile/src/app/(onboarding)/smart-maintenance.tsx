import { LastServiceDate, ReminderChannel } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { BarChart3, Bell, ShieldAlert, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

const TOGGLE_ROWS = [
  {
    key: 'maintenanceReminders',
    icon: Bell,
    labelKey: 'maintenanceRemindersLabel',
    descKey: 'maintenanceRemindersDesc',
    color: '#818CF8',
  },
  {
    key: 'seasonalTips',
    icon: Sun,
    labelKey: 'seasonalTipsLabel',
    descKey: 'seasonalTipsDesc',
    color: '#F59E0B',
  },
  {
    key: 'recallAlerts',
    icon: ShieldAlert,
    labelKey: 'recallAlertsLabel',
    descKey: 'recallAlertsDesc',
    color: '#EF4444',
  },
  {
    key: 'weeklySummary',
    icon: BarChart3,
    labelKey: 'weeklySummaryLabel',
    descKey: 'weeklySummaryDesc',
    color: '#34D399',
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
  { value: ReminderChannel.PUSH, labelKey: 'reminderChannel_push', icon: Bell, color: '#818CF8' },
  { value: ReminderChannel.EMAIL, labelKey: 'reminderChannel_email', icon: Bell, color: '#60A5FA' },
  { value: ReminderChannel.BOTH, labelKey: 'reminderChannel_both', icon: Bell, color: '#34D399' },
] as const;

type ToggleKey = 'maintenanceReminders' | 'seasonalTips' | 'recallAlerts' | 'weeklySummary';

export default function SmartMaintenanceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const store = useOnboardingStore();

  const bikeData = store.bikeData;
  const bikeName = bikeData?.nickname
    ? bikeData.nickname
    : bikeData?.make && bikeData?.model
      ? `${bikeData.make} ${bikeData.model}`
      : t('onboarding.type_other').toLowerCase() === 'other'
        ? 'motorcycle'
        : 'motorcycle';

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
    lastService !== null && (!toggles.maintenanceReminders || reminderChannel !== null);

  const handleContinue = () => {
    if (!canContinue) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    store.setMaintenanceReminders(toggles.maintenanceReminders);
    store.setSeasonalTips(toggles.seasonalTips);
    store.setRecallAlerts(toggles.recallAlerts);
    store.setWeeklySummary(toggles.weeklySummary);
    store.setLastServiceDate(lastService);
    if (toggles.maintenanceReminders && reminderChannel) {
      store.setReminderChannel(reminderChannel);
    }
    router.replace('/(onboarding)/insights');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={13} totalScreens={TOTAL_SCREENS} />

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
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 32,
          }}
        >
          {t('onboarding.smartMaintenanceTitle', { bike: bikeName })}
        </Animated.Text>

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
                  <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
                    {t(`onboarding.${row.labelKey}`)}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 2 }}>
                    {t(`onboarding.${row.descKey}`)}
                  </Text>
                </View>

                <Switch
                  value={toggles[row.key]}
                  onValueChange={() => handleToggle(row.key)}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#818CF8' }}
                  thumbColor="#FFFFFF"
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
            color: '#FFFFFF',
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
                color="#818CF8"
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
                color: '#FFFFFF',
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
            backgroundColor: canContinue ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
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
              color: canContinue ? '#0F172A' : 'rgba(255,255,255,0.4)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
