import type { MaintenanceStyle, RidingFrequency, RidingGoal } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Activity,
  Building2,
  Calendar,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  DollarSign,
  HelpCircle,
  PiggyBank,
  Shield,
  Sun,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OptionCard } from '../../components/option-card';
import { ProgressBar } from '../../components/progress-bar';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_STEPS } from './config';

const FREQUENCY_OPTIONS = [
  { value: 'daily' as RidingFrequency, icon: Calendar, color: '#34D399' },
  { value: 'weekly' as RidingFrequency, icon: CalendarDays, color: '#60A5FA' },
  { value: 'monthly' as RidingFrequency, icon: CalendarRange, color: '#A78BFA' },
  { value: 'seasonally' as RidingFrequency, icon: Sun, color: '#F59E0B' },
] as const;

const GOAL_OPTIONS = [
  { value: 'learn_maintenance' as RidingGoal, icon: Wrench, color: '#34D399' },
  { value: 'improve_riding' as RidingGoal, icon: TrendingUp, color: '#60A5FA' },
  { value: 'track_maintenance' as RidingGoal, icon: ClipboardCheck, color: '#A78BFA' },
  { value: 'save_money' as RidingGoal, icon: DollarSign, color: '#F59E0B' },
  { value: 'find_community' as RidingGoal, icon: Users, color: '#EC4899' },
  { value: 'safety' as RidingGoal, icon: Shield, color: '#EF4444' },
  { value: 'save_on_maintenance' as RidingGoal, icon: PiggyBank, color: '#14B8A6' },
  { value: 'track_bike_health' as RidingGoal, icon: Activity, color: '#8B5CF6' },
] as const;

const MAINTENANCE_OPTIONS = [
  { value: 'diy' as MaintenanceStyle, icon: Wrench, color: '#34D399' },
  { value: 'sometimes' as MaintenanceStyle, icon: HelpCircle, color: '#60A5FA' },
  { value: 'mechanic' as MaintenanceStyle, icon: Building2, color: '#A78BFA' },
] as const;

export default function RidingHabitsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setRidingFrequency = useOnboardingStore((s) => s.setRidingFrequency);
  const setRidingGoals = useOnboardingStore((s) => s.setRidingGoals);
  const setMaintenanceStyle = useOnboardingStore((s) => s.setMaintenanceStyle);

  const [frequency, setFrequency] = useState<RidingFrequency | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<Set<RidingGoal>>(new Set());
  const [maintenance, setMaintenance] = useState<MaintenanceStyle | null>(null);

  const handleFrequencyPress = (value: RidingFrequency) => {
    setFrequency(value);
  };

  const handleGoalPress = (value: RidingGoal) => {
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleMaintenancePress = (value: MaintenanceStyle) => {
    setMaintenance(value);
  };

  const canContinue = frequency !== null;

  const handleContinue = () => {
    if (!frequency) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setRidingFrequency(frequency);
    setRidingGoals([...selectedGoals]);
    if (maintenance) {
      setMaintenanceStyle(maintenance);
    }
    router.push('/(onboarding)/learning-preferences');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ProgressBar step={3} total={TOTAL_STEPS} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Riding Frequency */}
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 16,
          }}
        >
          {t('onboarding.ridingFrequencyTitle')}
        </Animated.Text>

        <View style={{ gap: 10, marginBottom: 32 }}>
          {FREQUENCY_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min(index * 60, 400)).duration(300)}
            >
              <OptionCard
                value={option.value}
                icon={option.icon}
                title={t(`onboarding.ridingFrequency_${option.value}`)}
                color={option.color}
                selected={frequency === option.value}
                onPress={handleFrequencyPress}
              />
            </Animated.View>
          ))}
        </View>

        {/* Section 2: Riding Goals */}
        <Animated.Text
          entering={FadeInDown.delay(250).duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 16,
          }}
        >
          {t('onboarding.ridingGoalsTitle')}
        </Animated.Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 32,
          }}
        >
          {GOAL_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min((index + 4) * 60, 400)).duration(300)}
              style={{ width: '48%' }}
            >
              <OptionCard
                value={option.value}
                icon={option.icon}
                title={t(`onboarding.ridingGoal_${option.value}`)}
                color={option.color}
                selected={selectedGoals.has(option.value)}
                onPress={handleGoalPress}
              />
            </Animated.View>
          ))}
        </View>

        {/* Section 3: Maintenance Style */}
        <Animated.Text
          entering={FadeInDown.delay(400).duration(300)}
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 16,
          }}
        >
          {t('onboarding.maintenanceStyleTitle')}
        </Animated.Text>

        <View style={{ gap: 10 }}>
          {MAINTENANCE_OPTIONS.map((option, index) => (
            <Animated.View
              key={option.value}
              entering={FadeInUp.delay(Math.min((index + 12) * 60, 400)).duration(300)}
            >
              <OptionCard
                value={option.value}
                icon={option.icon}
                title={t(`onboarding.maintenanceStyle_${option.value}`)}
                subtitle={t(`onboarding.maintenanceStyleDesc_${option.value}`)}
                color={option.color}
                selected={maintenance === option.value}
                onPress={handleMaintenancePress}
              />
            </Animated.View>
          ))}
        </View>
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
