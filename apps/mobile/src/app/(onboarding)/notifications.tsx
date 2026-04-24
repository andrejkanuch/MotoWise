import { requestNotificationPermission } from '../../lib/notifications';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, ShieldAlert, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

interface NotificationRowProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  color: string;
}

function NotificationRow({
  icon: Icon,
  label,
  description,
  value,
  onValueChange,
  color,
}: NotificationRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 16,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: `${color}22`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: ONBOARDING_COLORS.textPrimary,
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 18,
            color: ONBOARDING_COLORS.textSecondary,
          }}
        >
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: ONBOARDING_COLORS.surface2,
          true: ONBOARDING_COLORS.warm,
        }}
        thumbColor="#fff"
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setMaintenanceReminders = useOnboardingStore((s) => s.setMaintenanceReminders);
  const setRecallAlerts = useOnboardingStore((s) => s.setRecallAlerts);
  const setSeasonalTips = useOnboardingStore((s) => s.setSeasonalTips);

  const [serviceReminders, setServiceReminders] = useState(true);
  const [recalls, setRecalls] = useState(true);
  const [seasonal, setSeasonal] = useState(true);

  const saveToStore = () => {
    setMaintenanceReminders(serviceReminders);
    setRecallAlerts(recalls);
    setSeasonalTips(seasonal);
  };

  const [requesting, setRequesting] = useState(false);

  const handleEnableNotifications = async () => {
    if (requesting) return;
    setRequesting(true);
    saveToStore();

    try {
      await requestNotificationPermission();
    } catch (err) {
      console.warn('Push permission request failed:', err);
    }

    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'notifications',
      step_index: 6,
      service_reminders: serviceReminders,
      recall_alerts: recalls,
      seasonal_tips: seasonal,
      enabled: true,
    });

    router.replace('/(onboarding)/building');
  };

  const handleSkip = () => {
    if (requesting) return;
    saveToStore();

    trackEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, {
      step: 'notifications',
      step_index: 6,
    });

    router.replace('/(onboarding)/building');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={6} totalScreens={TOTAL_SCREENS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.duration(200)}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
          </Pressable>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text
            style={{
              fontFamily: 'InstrumentSerif-Regular',
              fontSize: 40,
              lineHeight: 44,
              color: ONBOARDING_COLORS.textPrimary,
              letterSpacing: -0.8,
              marginBottom: 8,
            }}
          >
            Gentle nudges,{'\n'}
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                color: ONBOARDING_COLORS.warm2,
              }}
            >
              never spam.
            </Text>
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: ONBOARDING_COLORS.textSecondary,
            marginBottom: 32,
          }}
        >
          {t('onboarding.notificationsSubtitle')}
        </Animated.Text>

        {/* Toggle rows */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(300)}
          style={{
            backgroundColor: ONBOARDING_COLORS.cardBg,
            borderWidth: 1,
            borderColor: ONBOARDING_COLORS.cardBorder,
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingHorizontal: 16,
          }}
        >
          <NotificationRow
            icon={Bell}
            label={t('onboarding.serviceReminders')}
            description={t('onboarding.serviceRemindersDesc')}
            value={serviceReminders}
            onValueChange={setServiceReminders}
            color={ONBOARDING_COLORS.warm}
          />

          <View style={{ height: 1, backgroundColor: ONBOARDING_COLORS.line }} />

          <NotificationRow
            icon={ShieldAlert}
            label={t('onboarding.recallAlerts')}
            description={t('onboarding.recallAlertsDesc')}
            value={recalls}
            onValueChange={setRecalls}
            color={ONBOARDING_COLORS.error}
          />

          <View style={{ height: 1, backgroundColor: ONBOARDING_COLORS.line }} />

          <NotificationRow
            icon={Sun}
            label={t('onboarding.seasonalTips')}
            description={t('onboarding.seasonalTipsDesc')}
            value={seasonal}
            onValueChange={setSeasonal}
            color={ONBOARDING_COLORS.success}
          />
        </Animated.View>
      </ScrollView>

      {/* CTA + Skip */}
      <Animated.View
        entering={FadeIn.delay(300).duration(300)}
        style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 12 }}
      >
        <OnboardingContinueButton
          label={t('onboarding.turnOnNotifications')}
          onPress={handleEnableNotifications}
        />

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => ({
            paddingVertical: 10,
            alignItems: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: ONBOARDING_COLORS.textMuted,
            }}
          >
            {t('onboarding.notNow')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
