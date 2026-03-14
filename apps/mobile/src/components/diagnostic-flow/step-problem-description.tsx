import { palette } from '@motovault/design-system';
import { MeDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  AlertTriangle,
  Cog,
  Droplets,
  Eye,
  Flame,
  Gauge,
  Lightbulb,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useDiagnosticFlowStore } from '../../stores/diagnostic-flow.store';
import { WizardOptionChip } from './wizard-option-chip';

const WIZARD_STEPS = [
  {
    key: 'symptoms' as const,
    titleKey: 'diagnoseV2.symptoms',
    options: [
      'noise',
      'vibration',
      'leak',
      'smoke',
      'warningLight',
      'performanceIssue',
      'visualDamage',
      'smell',
    ],
    icons: {
      noise: Volume2,
      vibration: Activity,
      leak: Droplets,
      smoke: Flame,
      warningLight: AlertTriangle,
      performanceIssue: Gauge,
      visualDamage: Eye,
      smell: Lightbulb,
    } as Record<string, typeof Volume2>,
  },
  {
    key: 'location' as const,
    titleKey: 'diagnoseV2.location',
    options: [
      'engine',
      'brakes',
      'exhaust',
      'tires',
      'electrical',
      'suspension',
      'chainDrivetrain',
      'bodywork',
    ],
    icons: {
      engine: Cog,
      brakes: Activity,
      exhaust: Flame,
      tires: Activity,
      electrical: Zap,
      suspension: Activity,
      chainDrivetrain: Wrench,
      bodywork: Eye,
    } as Record<string, typeof Cog>,
  },
  {
    key: 'timing' as const,
    titleKey: 'diagnoseV2.timing',
    options: [
      'always',
      'atSpeed',
      'idle',
      'coldStart',
      'hotEngine',
      'braking',
      'acceleration',
      'turning',
    ],
    icons: {} as Record<string, typeof Cog>,
  },
] as const;

export function StepProblemDescription() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const {
    inputMode,
    wizardAnswers,
    wizardSubStep,
    freeTextDescription,
    editingFromReview,
    setInputMode,
    setWizardAnswers,
    setWizardSubStep,
    setFreeTextDescription,
    goNext,
    backToReview,
  } = useDiagnosticFlowStore(
    useShallow((s) => ({
      inputMode: s.inputMode,
      wizardAnswers: s.wizardAnswers,
      wizardSubStep: s.wizardSubStep,
      freeTextDescription: s.freeTextDescription,
      editingFromReview: s.editingFromReview,
      setInputMode: s.setInputMode,
      setWizardAnswers: s.setWizardAnswers,
      setWizardSubStep: s.setWizardSubStep,
      setFreeTextDescription: s.setFreeTextDescription,
      goNext: s.goNext,
      backToReview: s.backToReview,
    })),
  );

  const { data: meData } = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const experienceLevel = meData?.me?.preferences?.experienceLevel ?? 'beginner';
  const isBeginner = experienceLevel === 'beginner';

  // Set default mode based on experience
  useEffect(() => {
    if (experienceLevel === 'advanced') setInputMode('freetext');
  }, [experienceLevel, setInputMode]);

  const currentStep = WIZARD_STEPS[wizardSubStep];
  const currentKey = currentStep?.key ?? 'symptoms';
  const currentSelections = wizardAnswers[currentKey];
  const isDontKnow = currentSelections.includes('dont_know');

  const toggleOption = (option: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...wizardAnswers };
    if (option === 'dont_know') {
      updated[currentKey] = isDontKnow ? [] : ['dont_know'];
    } else {
      const filtered = currentSelections.filter((o) => o !== 'dont_know');
      updated[currentKey] = filtered.includes(option)
        ? filtered.filter((o) => o !== option)
        : [...filtered, option];
    }
    setWizardAnswers(updated);
  };

  const handleWizardNext = () => {
    if (wizardSubStep < WIZARD_STEPS.length - 1) {
      setWizardSubStep(wizardSubStep + 1);
    } else if (editingFromReview) {
      backToReview();
    } else {
      goNext();
    }
  };

  const handleModeSwitch = (mode: 'wizard' | 'freetext') => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputMode(mode);
  };

  const handleFreeTextNext = () => {
    if (editingFromReview) backToReview();
    else goNext();
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-2">
          <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-4">
            {t('diagnoseV2.describeProblem')}
          </Text>

          {/* Mode toggle */}
          <View className="flex-row gap-2 mb-5">
            <Pressable
              className={`flex-1 py-3 rounded-xl items-center ${
                inputMode === 'wizard' ? 'bg-primary-500' : 'bg-neutral-100 dark:bg-neutral-800'
              }`}
              style={{ borderCurve: 'continuous' }}
              onPress={() => handleModeSwitch('wizard')}
            >
              <Text
                className={`text-sm font-semibold ${inputMode === 'wizard' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
              >
                {t('diagnoseV2.guideMe')}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-3 rounded-xl items-center ${
                inputMode === 'freetext' ? 'bg-primary-500' : 'bg-neutral-100 dark:bg-neutral-800'
              }`}
              style={{ borderCurve: 'continuous' }}
              onPress={() => handleModeSwitch('freetext')}
            >
              <Text
                className={`text-sm font-semibold ${inputMode === 'freetext' ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'}`}
              >
                {t('diagnoseV2.describeMyself')}
              </Text>
            </Pressable>
          </View>
        </View>

        {inputMode === 'wizard' && currentStep ? (
          <Animated.View entering={FadeIn.duration(200)} className="px-5">
            {/* Sub-step dots */}
            <View className="flex-row gap-2 mb-4 justify-center">
              {WIZARD_STEPS.map((_, i) => (
                <View
                  key={`dot-${WIZARD_STEPS[i].key}`}
                  className={`w-2 h-2 rounded-full ${
                    i === wizardSubStep ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                />
              ))}
            </View>

            <Text className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 mb-4">
              {t(currentStep.titleKey)}
            </Text>

            {/* I don't know chip */}
            <Animated.View entering={FadeInUp.duration(250)} className="mb-3">
              <WizardOptionChip
                label={t('diagnoseV2.imNotSure')}
                selected={isDontKnow}
                isIDontKnow
                onPress={() => toggleOption('dont_know')}
              />
            </Animated.View>

            {/* Option chips */}
            <View className="flex-row flex-wrap gap-3">
              {currentStep.options.map((option, index) => {
                const IconComponent = currentStep.icons[option];
                const icon: ReactNode = IconComponent ? (
                  <IconComponent
                    size={16}
                    color={
                      currentSelections.includes(option) ? palette.primary500 : palette.neutral400
                    }
                    strokeWidth={1.5}
                  />
                ) : null;
                return (
                  <Animated.View
                    key={option}
                    entering={FadeInUp.delay(50 + index * 40).duration(300)}
                    style={{ width: '47%' }}
                  >
                    <WizardOptionChip
                      label={t(`diagnoseV2.option.${option}`)}
                      subtitle={isBeginner ? t(`diagnoseV2.subtitle.${option}`) : undefined}
                      selected={currentSelections.includes(option)}
                      icon={icon}
                      onPress={() => toggleOption(option)}
                    />
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        ) : inputMode === 'freetext' ? (
          <Animated.View entering={FadeIn.duration(200)} className="px-5">
            <TextInput
              className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-4 text-base text-neutral-950 dark:text-neutral-50"
              style={{ borderCurve: 'continuous', textAlignVertical: 'top', minHeight: 120 }}
              placeholder={
                isBeginner
                  ? t('diagnoseV2.freeTextPlaceholderBeginner')
                  : t('diagnoseV2.freeTextPlaceholderAdvanced')
              }
              placeholderTextColor={palette.neutral400}
              value={freeTextDescription}
              onChangeText={(text) => setFreeTextDescription(text.slice(0, 1000))}
              multiline
              maxLength={1000}
            />
            <Text className="text-xs text-neutral-400 mt-1 text-right">
              {t('diagnoseV2.charCount', { count: freeTextDescription.length, max: 1000 })}
            </Text>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Bottom button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-5"
        style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
      >
        {inputMode === 'wizard' && wizardSubStep > 0 && (
          <Pressable
            className="mb-2 py-3 items-center"
            onPress={() => setWizardSubStep(wizardSubStep - 1)}
          >
            <Text className="text-sm text-neutral-500">{t('diagnoseV2.back')}</Text>
          </Pressable>
        )}
        <Pressable
          className="bg-primary-500 rounded-2xl py-4 items-center"
          style={{ borderCurve: 'continuous' }}
          onPress={inputMode === 'wizard' ? handleWizardNext : handleFreeTextNext}
        >
          <Text className="text-white font-semibold text-base">
            {editingFromReview ? t('diagnoseV2.backToReview') : t('diagnoseV2.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
