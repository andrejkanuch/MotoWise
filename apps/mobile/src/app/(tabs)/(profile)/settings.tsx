import { palette } from '@motovault/design-system';
import { MeDocument, UpdateUserDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

const EXPERIENCE_LABEL_KEYS: Record<ExperienceLevel, string> = {
  beginner: 'settings.experienceBeginner',
  intermediate: 'settings.experienceIntermediate',
  advanced: 'settings.experienceAdvanced',
};

const RIDING_GOALS = [
  'learn_maintenance',
  'improve_riding',
  'track_maintenance',
  'save_money',
  'find_community',
  'safety',
  'save_on_maintenance',
  'track_bike_health',
] as const;
type RidingGoal = (typeof RIDING_GOALS)[number];

const GOAL_LABEL_KEYS: Record<RidingGoal, string> = {
  learn_maintenance: 'settings.goalLearnMaintenance',
  improve_riding: 'settings.goalImproveRiding',
  track_maintenance: 'settings.goalTrackMaintenance',
  save_money: 'settings.goalSaveMoney',
  find_community: 'settings.goalFindCommunity',
  safety: 'settings.goalSafety',
  save_on_maintenance: 'settings.goalSaveOnMaintenance',
  track_bike_health: 'settings.goalTrackBikeHealth',
};

const GOAL_DEFAULT_LABELS: Record<RidingGoal, string> = {
  learn_maintenance: 'Learn Maintenance',
  improve_riding: 'Improve Riding',
  track_maintenance: 'Track Maintenance',
  save_money: 'Save Money',
  find_community: 'Find Community',
  safety: 'Safety',
  save_on_maintenance: 'Save on Maintenance',
  track_bike_health: 'Track Bike Health',
};

type UserPreferences = {
  experienceLevel?: string;
  ridingGoals?: string[];
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function hapticSuccess() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });

  const user = meQuery.data?.me;
  const preferences = user?.preferences as UserPreferences | null | undefined;

  const [fullName, setFullName] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner');
  const [selectedGoals, setSelectedGoals] = useState<RidingGoal[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (user && !isInitialized) {
      setFullName(user.fullName ?? '');
      setExperienceLevel((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner');
      const storedGoals = (preferences?.ridingGoals as string[]) ?? [];
      const validGoals = storedGoals.filter((g): g is RidingGoal =>
        (RIDING_GOALS as readonly string[]).includes(g),
      );
      setSelectedGoals(validGoals);
      setIsInitialized(true);
    }
  }, [user, preferences, isInitialized]);

  const updateMutation = useMutation({
    mutationFn: (input: { fullName?: string; preferences?: Record<string, unknown> }) =>
      gqlFetcher(UpdateUserDocument, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      hapticSuccess();
    },
  });

  const toggleGoal = useCallback((goal: RidingGoal) => {
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
        JSON.stringify(
          [...((preferences?.ridingGoals as RidingGoal[]) ?? [])]
            .filter((g): g is RidingGoal => (RIDING_GOALS as readonly string[]).includes(g))
            .sort(),
        );

    if (prefsChanged) {
      input.preferences = {
        experienceLevel,
        ridingGoals: selectedGoals,
      };
    }

    updateMutation.mutate(input);
  }, [fullName, experienceLevel, selectedGoals, updateMutation, user, preferences]);

  const hasChanges =
    isInitialized &&
    (fullName !== (user?.fullName ?? '') ||
      experienceLevel !== ((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner') ||
      JSON.stringify([...selectedGoals].sort()) !==
        JSON.stringify([...((preferences?.ridingGoals as RidingGoal[]) ?? [])].sort()));

  if (meQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          borderBottomWidth: 0.5,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <Pressable
          onPress={() => {
            haptic();
            router.back();
          }}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
          }}
        >
          <ArrowLeft
            size={20}
            color={isDark ? palette.neutral200 : palette.neutral800}
            strokeWidth={2}
          />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '600',
            color: isDark ? palette.neutral50 : palette.neutral950,
            marginRight: 36,
          }}
        >
          {t('settings.title', { defaultValue: 'Profile Settings' })}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full Name Section */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('settings.fullNameLabel', { defaultValue: 'Full Name' })}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 16,
              paddingVertical: 14,
              boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('settings.fullNamePlaceholder', {
                defaultValue: 'Enter your full name',
              })}
              placeholderTextColor={palette.neutral400}
              autoCapitalize="words"
              autoCorrect={false}
              style={{
                fontSize: 16,
                color: isDark ? palette.neutral50 : palette.neutral950,
                padding: 0,
              }}
            />
          </View>
        </Animated.View>

        {/* Experience Level Section */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('settings.experienceLevelLabel', { defaultValue: 'Experience Level' })}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 14,
              borderCurve: 'continuous',
              flexDirection: 'row',
              padding: 4,
              boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            {EXPERIENCE_LEVELS.map((level) => {
              const selected = experienceLevel === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    haptic();
                    setExperienceLevel(level);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    backgroundColor: selected
                      ? isDark
                        ? palette.primary700
                        : palette.primary500
                      : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: selected
                        ? palette.white
                        : isDark
                          ? palette.neutral400
                          : palette.neutral600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t(EXPERIENCE_LABEL_KEYS[level], { defaultValue: level })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Riding Goals Section */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('settings.ridingGoalsLabel', { defaultValue: 'Riding Goals' })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {RIDING_GOALS.map((goal, index) => {
              const selected = selectedGoals.includes(goal);
              return (
                <Animated.View key={goal} entering={FadeInUp.delay(160 + index * 50).duration(350)}>
                  <Pressable
                    onPress={() => toggleGoal(goal)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      borderWidth: 1.5,
                      borderColor: selected
                        ? isDark
                          ? palette.primary600
                          : palette.primary500
                        : isDark
                          ? 'rgba(255,255,255,0.1)'
                          : palette.neutral200,
                      backgroundColor: selected
                        ? isDark
                          ? `${palette.primary500}25`
                          : `${palette.primary500}14`
                        : isDark
                          ? palette.neutral800
                          : palette.white,
                    }}
                  >
                    {selected && (
                      <Check
                        size={14}
                        color={isDark ? palette.primary400 : palette.primary600}
                        strokeWidth={2.5}
                      />
                    )}
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: selected ? '600' : '500',
                        color: selected
                          ? isDark
                            ? palette.primary300
                            : palette.primary700
                          : isDark
                            ? palette.neutral300
                            : palette.neutral600,
                      }}
                    >
                      {t(GOAL_LABEL_KEYS[goal], { defaultValue: GOAL_DEFAULT_LABELS[goal] })}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Save Button */}
        <Animated.View
          entering={FadeInUp.delay(460).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 36 }}
        >
          <Pressable
            onPress={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            style={{ borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}
          >
            <View
              style={{
                backgroundColor:
                  hasChanges && !updateMutation.isPending
                    ? palette.primary700
                    : isDark
                      ? palette.neutral700
                      : palette.neutral300,
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
                    color: hasChanges
                      ? palette.white
                      : isDark
                        ? palette.neutral500
                        : palette.neutral400,
                  }}
                >
                  {t('settings.saveChanges', { defaultValue: 'Save Changes' })}
                </Text>
              )}
            </View>
          </Pressable>

          {updateMutation.isError && (
            <Text
              style={{
                fontSize: 13,
                color: palette.danger500,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              {t('settings.saveError', {
                defaultValue: 'Something went wrong. Please try again.',
              })}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
