import { palette } from '@motovault/design-system';
import { MeDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ScreenHeader } from '../../../components/profile/shared';
import { useUpdateUserPreferences } from '../../../hooks/use-update-user-preferences';
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
  learn_maintenance: 'Learn maintenance',
  improve_riding: 'Improve riding',
  track_maintenance: 'Track maintenance',
  save_money: 'Save money',
  find_community: 'Find community',
  safety: 'Safety',
  save_on_maintenance: 'Save on maintenance',
  track_bike_health: 'Track bike health',
};

const LEARNING_FORMATS = [
  'quick_tips',
  'deep_dives',
  'video_walkthroughs',
  'hands_on_quizzes',
] as const;
type LearningFormat = (typeof LEARNING_FORMATS)[number];

const LEARNING_FORMAT_LABEL_KEYS: Record<LearningFormat, string> = {
  quick_tips: 'settings.formatQuickTips',
  deep_dives: 'settings.formatDeepDives',
  video_walkthroughs: 'settings.formatVideoWalkthroughs',
  hands_on_quizzes: 'settings.formatHandsOnQuizzes',
};

const LEARNING_FORMAT_DEFAULT_LABELS: Record<LearningFormat, string> = {
  quick_tips: 'Quick tips',
  deep_dives: 'Deep dives',
  video_walkthroughs: 'Video walkthroughs',
  hands_on_quizzes: 'Hands-on quizzes',
};

const RIDING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'seasonally'] as const;
type RidingFrequency = (typeof RIDING_FREQUENCIES)[number];

const RIDING_FREQUENCY_LABEL_KEYS: Record<RidingFrequency, string> = {
  daily: 'settings.frequencyDaily',
  weekly: 'settings.frequencyWeekly',
  monthly: 'settings.frequencyMonthly',
  seasonally: 'settings.frequencySeasonally',
};

const MAINTENANCE_STYLES = ['diy', 'sometimes', 'mechanic'] as const;
type MaintenanceStyle = (typeof MAINTENANCE_STYLES)[number];

const MAINTENANCE_STYLE_LABEL_KEYS: Record<MaintenanceStyle, string> = {
  diy: 'settings.maintenanceDiy',
  sometimes: 'settings.maintenanceSometimes',
  mechanic: 'settings.maintenanceMechanic',
};

const MAINTENANCE_STYLE_DEFAULT_LABELS: Record<MaintenanceStyle, string> = {
  diy: 'DIY',
  sometimes: 'Mix',
  mechanic: 'Mechanic',
};

type UserPreferences = {
  experienceLevel?: string;
  ridingGoals?: string[];
  learningFormats?: string[];
  ridingFrequency?: string;
  maintenanceStyle?: string;
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function SectionHeading({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <Text
      style={{
        fontSize: 17,
        fontWeight: '600',
        color: isDark ? palette.neutral100 : palette.neutral950,
        marginBottom: 12,
      }}
    >
      {title}
    </Text>
  );
}

export default function RiderProfileScreen() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });

  const user = meQuery.data?.me;
  const preferences = user?.preferences as UserPreferences | null | undefined;

  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('beginner');
  const [selectedGoals, setSelectedGoals] = useState<RidingGoal[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<LearningFormat[]>([]);
  const [ridingFrequency, setRidingFrequency] = useState<RidingFrequency | null>(null);
  const [maintenanceStyle, setMaintenanceStyle] = useState<MaintenanceStyle | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (user && !isInitialized) {
      setExperienceLevel((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner');
      const storedGoals = (preferences?.ridingGoals as string[]) ?? [];
      setSelectedGoals(
        storedGoals.filter((g): g is RidingGoal => (RIDING_GOALS as readonly string[]).includes(g)),
      );
      const storedFormats = (preferences?.learningFormats as string[]) ?? [];
      setSelectedFormats(
        storedFormats.filter((f): f is LearningFormat =>
          (LEARNING_FORMATS as readonly string[]).includes(f),
        ),
      );
      const storedFrequency = preferences?.ridingFrequency as string | undefined;
      if (storedFrequency && (RIDING_FREQUENCIES as readonly string[]).includes(storedFrequency)) {
        setRidingFrequency(storedFrequency as RidingFrequency);
      }
      const storedMaintStyle = preferences?.maintenanceStyle as string | undefined;
      if (
        storedMaintStyle &&
        (MAINTENANCE_STYLES as readonly string[]).includes(storedMaintStyle)
      ) {
        setMaintenanceStyle(storedMaintStyle as MaintenanceStyle);
      }
      setIsInitialized(true);
    }
  }, [user, preferences, isInitialized]);

  const { update, isPending, isError } = useUpdateUserPreferences();

  const toggleGoal = useCallback((goal: RidingGoal) => {
    haptic();
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  }, []);

  const toggleFormat = useCallback((format: LearningFormat) => {
    haptic();
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  }, []);

  const hasChanges =
    isInitialized &&
    (experienceLevel !== ((preferences?.experienceLevel as ExperienceLevel) ?? 'beginner') ||
      JSON.stringify([...selectedGoals].sort()) !==
        JSON.stringify([...((preferences?.ridingGoals as RidingGoal[]) ?? [])].sort()) ||
      JSON.stringify([...selectedFormats].sort()) !==
        JSON.stringify([...((preferences?.learningFormats as LearningFormat[]) ?? [])].sort()) ||
      ridingFrequency !== (preferences?.ridingFrequency ?? null) ||
      maintenanceStyle !== (preferences?.maintenanceStyle ?? null));

  const handleSave = useCallback(() => {
    haptic();
    update({
      preferences: {
        experienceLevel,
        ridingGoals: selectedGoals,
        learningFormats: selectedFormats,
        ...(ridingFrequency && { ridingFrequency }),
        ...(maintenanceStyle && { maintenanceStyle }),
      },
    });
  }, [update, experienceLevel, selectedGoals, selectedFormats, ridingFrequency, maintenanceStyle]);

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
      <ScreenHeader title={t('settings.aboutYouTitle', { defaultValue: 'About You' })} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 24 }}
        >
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: isDark ? palette.neutral400 : palette.neutral500,
            }}
          >
            {t('settings.aboutYouIntro', {
              defaultValue:
                'We use these answers to tailor articles, diagnostics, and reminders. You can change them any time.',
            })}
          </Text>
        </Animated.View>

        {/* Experience Level */}
        <Animated.View
          entering={FadeInUp.delay(60).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <SectionHeading
            title={t('settings.experienceLevelLabel', { defaultValue: 'Experience level' })}
            isDark={isDark}
          />
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

        {/* Riding Goals */}
        <Animated.View
          entering={FadeInUp.delay(120).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <SectionHeading
            title={t('settings.ridingGoalsLabel', { defaultValue: 'Riding goals' })}
            isDark={isDark}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {RIDING_GOALS.map((goal, index) => {
              const selected = selectedGoals.includes(goal);
              return (
                <Animated.View key={goal} entering={FadeInUp.delay(120 + index * 40).duration(350)}>
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
                          ? palette.controlBg
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

        {/* Learning Formats */}
        <Animated.View
          entering={FadeInUp.delay(180).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <SectionHeading
            title={t('settings.learningFormatsLabel', { defaultValue: 'How you like to learn' })}
            isDark={isDark}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {LEARNING_FORMATS.map((format, index) => {
              const selected = selectedFormats.includes(format);
              return (
                <Animated.View
                  key={format}
                  entering={FadeInUp.delay(180 + index * 40).duration(350)}
                >
                  <Pressable
                    onPress={() => toggleFormat(format)}
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
                          ? palette.controlBg
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
                      {t(LEARNING_FORMAT_LABEL_KEYS[format], {
                        defaultValue: LEARNING_FORMAT_DEFAULT_LABELS[format],
                      })}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Riding Frequency */}
        <Animated.View
          entering={FadeInUp.delay(240).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <SectionHeading
            title={t('settings.ridingFrequencyLabel', { defaultValue: 'How often you ride' })}
            isDark={isDark}
          />
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
            {RIDING_FREQUENCIES.map((freq) => {
              const selected = ridingFrequency === freq;
              return (
                <Pressable
                  key={freq}
                  onPress={() => {
                    haptic();
                    setRidingFrequency(freq);
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
                      fontSize: 13,
                      fontWeight: '600',
                      color: selected
                        ? palette.white
                        : isDark
                          ? palette.neutral400
                          : palette.neutral600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t(RIDING_FREQUENCY_LABEL_KEYS[freq], { defaultValue: freq })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Maintenance Style */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 32 }}
        >
          <SectionHeading
            title={t('settings.maintenanceStyleLabel', { defaultValue: 'Who does the wrenching' })}
            isDark={isDark}
          />
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
            {MAINTENANCE_STYLES.map((style) => {
              const selected = maintenanceStyle === style;
              return (
                <Pressable
                  key={style}
                  onPress={() => {
                    haptic();
                    setMaintenanceStyle(style);
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
                      fontSize: 13,
                      fontWeight: '600',
                      color: selected
                        ? palette.white
                        : isDark
                          ? palette.neutral400
                          : palette.neutral600,
                    }}
                  >
                    {t(MAINTENANCE_STYLE_LABEL_KEYS[style], {
                      defaultValue: MAINTENANCE_STYLE_DEFAULT_LABELS[style],
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Save button */}
        <Animated.View
          entering={FadeInUp.delay(360).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 40 }}
        >
          <Pressable
            onPress={handleSave}
            disabled={isPending || !hasChanges}
            style={{ borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' }}
          >
            <View
              style={{
                backgroundColor:
                  hasChanges && !isPending
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
              {isPending ? (
                <ActivityIndicator size="small" color={palette.white} />
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
                  {t('settings.saveChanges', { defaultValue: 'Save changes' })}
                </Text>
              )}
            </View>
          </Pressable>

          {isError && (
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
