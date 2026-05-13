import { palette } from '@motovault/design-system';
import { MeDocument, UpdateUserDocument } from '@motovault/graphql';
import { RidingGoal } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Bike,
  Check,
  Compass,
  Flame,
  Gauge,
  MapPin,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { tint, useEditorialTheme } from '../../../theme/editorial';

/* ─── Experience levels ─── */

const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

const EXPERIENCE_CONFIG: Record<
  ExperienceLevel,
  { labelKey: string; icon: typeof Bike; color: string }
> = {
  beginner: { labelKey: 'settings.experienceBeginner', icon: Bike, color: '#A3B18A' },
  intermediate: { labelKey: 'settings.experienceIntermediate', icon: Gauge, color: '#D4884A' },
  advanced: { labelKey: 'settings.experienceAdvanced', icon: Flame, color: '#C4634A' },
};

/* ─── V2 Riding goals ─── */

const V2_GOALS = [
  { key: RidingGoal.TRACK_RIDES, labelKey: 'settings.goalTrackRides', icon: MapPin },
  { key: RidingGoal.MANAGE_EXPENSES, labelKey: 'settings.goalManageExpenses', icon: Wallet },
  { key: RidingGoal.DISCOVER_ROUTES, labelKey: 'settings.goalDiscoverRoutes', icon: Compass },
  { key: RidingGoal.MAINTAIN_BIKE, labelKey: 'settings.goalMaintainBike', icon: Wrench },
  { key: RidingGoal.JUST_EXPLORING, labelKey: 'settings.goalJustExploring', icon: Sparkles },
] as const;

/* ─── Helpers ─── */

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

type UserPreferences = {
  experienceLevel?: string;
  ridingGoals?: string[];
};

/* ─── Section label component ─── */

function SectionLabel({
  children,
  theme,
}: {
  children: string;
  theme: ReturnType<typeof useEditorialTheme>['t'];
}) {
  return (
    <Text
      style={{
        fontFamily: 'GeistMono-Medium',
        fontSize: 10,
        fontWeight: '700',
        color: theme.ink3,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 12,
        marginLeft: 2,
      }}
    >
      {children}
    </Text>
  );
}

/* ═══════════════════════════════════════════════════════════
   Settings Screen — V2/V3 aligned
   ═══════════════════════════════════════════════════════════ */

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });

  const user = meQuery.data?.me;
  const preferences = user?.preferences as UserPreferences | null | undefined;

  const [fullName, setFullName] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (user && !isInitialized) {
      setFullName(user.fullName ?? '');
      setExperienceLevel((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner');
      setSelectedGoals(preferences?.ridingGoals ?? []);
      setIsInitialized(true);
    }
  }, [user, preferences, isInitialized]);

  const updateMutation = useMutation({
    mutationFn: (input: { fullName?: string; preferences?: Record<string, unknown> }) =>
      gqlFetcher(UpdateUserDocument, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const toggleGoal = useCallback((goal: string) => {
    haptic();
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  }, []);

  const handleSave = useCallback(() => {
    haptic();
    const input: { fullName?: string; preferences?: Record<string, unknown> } = {};

    const trimmedName = fullName.trim();
    if (trimmedName && trimmedName !== (user?.fullName ?? '')) {
      input.fullName = trimmedName;
    }

    const prefsChanged =
      experienceLevel !== ((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner') ||
      JSON.stringify([...selectedGoals].sort()) !==
        JSON.stringify([...(preferences?.ridingGoals ?? [])].sort());

    if (prefsChanged) {
      input.preferences = {
        experienceLevel,
        ridingGoals: selectedGoals,
      };
    }

    if (Object.keys(input).length > 0) {
      updateMutation.mutate(input);
      trackEvent(AnalyticsEvent.SETTINGS_CHANGED, {
        experience_level: experienceLevel,
        goals_count: selectedGoals.length,
      });
    }
  }, [fullName, experienceLevel, selectedGoals, updateMutation, user, preferences]);

  const hasChanges =
    isInitialized &&
    (fullName.trim() !== (user?.fullName ?? '') ||
      experienceLevel !== ((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner') ||
      JSON.stringify([...selectedGoals].sort()) !==
        JSON.stringify([...(preferences?.ridingGoals ?? [])].sort()));

  if (meQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.warm} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.line,
        }}
      >
        <Pressable
          onPress={() => {
            haptic();
            router.back();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surface2,
          }}
        >
          <ArrowLeft size={20} color={theme.ink} strokeWidth={2} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '600',
            color: theme.ink,
            marginRight: 36,
          }}
        >
          {t('settings.title', { defaultValue: 'Settings' })}
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Full Name ─── */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <SectionLabel theme={theme}>
            {t('settings.fullNameLabel', { defaultValue: 'Full Name' })}
          </SectionLabel>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: theme.line,
            }}
          >
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('settings.fullNamePlaceholder', {
                defaultValue: 'Enter your full name',
              })}
              placeholderTextColor={theme.ink3}
              autoCapitalize="words"
              autoCorrect={false}
              style={{ fontSize: 16, color: theme.ink, padding: 0 }}
            />
          </View>
        </Animated.View>

        {/* ─── Experience Level ─── */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <SectionLabel theme={theme}>
            {t('settings.experienceLevelLabel', { defaultValue: 'Experience Level' })}
          </SectionLabel>
          <View style={{ gap: 8 }}>
            {EXPERIENCE_LEVELS.map((level) => {
              const config = EXPERIENCE_CONFIG[level];
              const selected = experienceLevel === level;
              const Icon = config.icon;
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    haptic();
                    setExperienceLevel(level);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: selected ? `${config.color}1A` : theme.surface,
                    borderWidth: 1.5,
                    borderColor: selected ? config.color : theme.line,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: selected ? config.color : `${config.color}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color={selected ? '#1a0f08' : config.color} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: '600',
                      color: selected ? theme.ink : theme.ink3,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t(config.labelKey, { defaultValue: level })}
                  </Text>
                  {selected && (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: config.color,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={14} color="#1a0f08" strokeWidth={3} />
                      </View>
                    </Animated.View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ─── Riding Goals ─── */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <SectionLabel theme={theme}>
            {t('settings.ridingGoalsLabel', { defaultValue: 'Riding Goals' })}
          </SectionLabel>
          <View style={{ gap: 8 }}>
            {V2_GOALS.map((goal) => {
              const selected = selectedGoals.includes(goal.key);
              const Icon = goal.icon;
              return (
                <Pressable
                  key={goal.key}
                  onPress={() => toggleGoal(goal.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: selected ? tint(theme.warm, 0.12) : theme.surface,
                    borderWidth: 1.5,
                    borderColor: selected ? theme.warm : theme.line,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      backgroundColor: selected ? `${theme.warm}30` : theme.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} color={selected ? theme.warm : theme.ink3} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: selected ? '600' : '500',
                      color: selected ? theme.ink : theme.ink3,
                    }}
                  >
                    {t(goal.labelKey, { defaultValue: goal.key })}
                  </Text>
                  {selected && (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <Check size={18} color={theme.warm} strokeWidth={2.5} />
                    </Animated.View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ─── Save Button ─── */}
        <Animated.View
          entering={FadeInUp.delay(240).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 36 }}
        >
          <Pressable
            onPress={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            style={{
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor:
                hasChanges && !updateMutation.isPending ? theme.warm : theme.surface2,
              opacity: hasChanges && !updateMutation.isPending ? 1 : 0.5,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : updateMutation.isSuccess && !hasChanges ? (
              <>
                <Check size={18} color={palette.white} strokeWidth={2.5} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                  {t('settings.saved', { defaultValue: 'Saved' })}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: hasChanges ? palette.white : theme.ink3,
                }}
              >
                {t('settings.saveChanges', { defaultValue: 'Save Changes' })}
              </Text>
            )}
          </Pressable>

          {updateMutation.isError && (
            <Text style={{ fontSize: 13, color: theme.danger, textAlign: 'center', marginTop: 12 }}>
              {t('settings.saveError', { defaultValue: 'Something went wrong. Please try again.' })}
            </Text>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}
