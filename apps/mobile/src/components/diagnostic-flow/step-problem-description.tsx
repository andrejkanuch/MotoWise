import { palette } from '@motovault/design-system';
import { MeDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CircleOff,
  Cloud,
  Cog,
  Disc,
  Droplets,
  Eye,
  Flame,
  Fuel,
  Move,
  Navigation,
  Palette,
  Pause,
  Plus,
  Power,
  Shield,
  Thermometer,
  Timer,
  TrendingDown,
  Volume2,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import {
  PREDEFINED_LOCATION,
  PREDEFINED_SYMPTOMS,
  PREDEFINED_TIMING,
  useDiagnosticFlowStore,
} from '../../stores/diagnostic-flow.store';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';
import { WizardOptionChip } from './wizard-option-chip';

const SYMPTOM_OPTIONS = [
  'noise',
  'grinding',
  'clicking',
  'backfiring',
  'squealing',
  'vibration',
  'wobble',
  'hardToSteer',
  'spongyBrakes',
  'leak',
  'smoke',
  'rustCorrosion',
  'smell',
  'discoloration',
  'performanceIssue',
  'wontStart',
  'stalling',
  'poorFuelEconomy',
  'overheating',
  'warningLight',
  'visualDamage',
] as const;
type SymptomOption = (typeof SYMPTOM_OPTIONS)[number];

const SYMPTOM_ICONS: Record<SymptomOption, LucideIcon> = {
  noise: Volume2,
  grinding: Disc,
  clicking: Timer,
  backfiring: Zap,
  squealing: AlertCircle,
  vibration: Activity,
  wobble: Move,
  hardToSteer: Navigation,
  spongyBrakes: CircleOff,
  leak: Droplets,
  smoke: Cloud,
  rustCorrosion: Shield,
  smell: Wind,
  discoloration: Palette,
  performanceIssue: TrendingDown,
  wontStart: Power,
  stalling: Pause,
  poorFuelEconomy: Fuel,
  overheating: Thermometer,
  warningLight: AlertTriangle,
  visualDamage: Eye,
};

const SYMPTOM_GROUPS = [
  {
    label: 'Sounds',
    options: ['noise', 'grinding', 'clicking', 'backfiring', 'squealing'] as const,
  },
  { label: 'Sensations', options: ['vibration', 'wobble', 'hardToSteer', 'spongyBrakes'] as const },
  {
    label: 'Visual / Smell',
    options: ['leak', 'smoke', 'rustCorrosion', 'smell', 'discoloration'] as const,
  },
  {
    label: 'Performance',
    options: [
      'performanceIssue',
      'wontStart',
      'stalling',
      'poorFuelEconomy',
      'overheating',
    ] as const,
  },
  { label: 'Indicators', options: ['warningLight', 'visualDamage'] as const },
] as const;

const WIZARD_STEPS = [
  {
    key: 'symptoms' as const,
    titleKey: 'diagnoseV2.symptoms',
    options: [...SYMPTOM_OPTIONS],
    icons: SYMPTOM_ICONS as Record<string, LucideIcon>,
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
    } as Record<string, LucideIcon>,
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
    icons: {} as Record<string, LucideIcon>,
  },
];

const PREDEFINED_SETS: Record<string, ReadonlySet<string>> = {
  symptoms: new Set(PREDEFINED_SYMPTOMS),
  location: new Set(PREDEFINED_LOCATION),
  timing: new Set(PREDEFINED_TIMING),
};

const sanitizeInput = (text: string) => text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

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
    setWizardSubStep,
    setFreeTextDescription,
    toggleWizardOption,
    addCustomValue,
    removeCustomValue,
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
      setWizardSubStep: s.setWizardSubStep,
      setFreeTextDescription: s.setFreeTextDescription,
      toggleWizardOption: s.toggleWizardOption,
      addCustomValue: s.addCustomValue,
      removeCustomValue: s.removeCustomValue,
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
  const selectionSet = useMemo(() => new Set(currentSelections), [currentSelections]);
  const isDontKnow = selectionSet.has('dont_know');

  const predefinedSet = PREDEFINED_SETS[currentKey] ?? new Set<string>();
  const customValues = currentSelections.filter((v) => v !== 'dont_know' && !predefinedSet.has(v));
  const canAddCustom = customValues.length < 3;

  const [customInput, setCustomInput] = useState('');

  const handleWizardNext = () => {
    if (wizardSubStep < WIZARD_STEPS.length - 1) {
      setWizardSubStep((wizardSubStep + 1) as 0 | 1 | 2);
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

  const customInputSection = (
    <>
      {/* Custom values */}
      {customValues.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {customValues.map((value) => (
            <Animated.View key={value} entering={FadeIn.duration(200)}>
              <WizardOptionChip
                label={value}
                selected={true}
                variant="custom"
                onPress={() => toggleWizardOption(currentKey, value)}
                onRemove={() => removeCustomValue(currentKey, value)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* Custom input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: DIAGNOSTIC_COLORS.cardBg,
          borderWidth: 1,
          borderColor: DIAGNOSTIC_COLORS.cardBorder,
          borderRadius: 12,
          borderCurve: 'continuous',
          opacity: canAddCustom ? 1 : 0.5,
        }}
      >
        <Plus size={16} color={DIAGNOSTIC_COLORS.textMuted} strokeWidth={2} />
        <TextInput
          value={customInput}
          onChangeText={(text) => setCustomInput(sanitizeInput(text.slice(0, 50)))}
          placeholder={canAddCustom ? 'Type your own...' : 'Maximum reached'}
          placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
          accessibilityLabel={t('diagnoseV2.customOption')}
          style={{
            flex: 1,
            color: DIAGNOSTIC_COLORS.textPrimary,
            fontSize: 14,
          }}
          editable={canAddCustom}
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={() => {
            const success = addCustomValue(currentKey, customInput);
            if (success) setCustomInput('');
          }}
        />
      </View>
    </>
  );

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
            <View
              className="flex-row gap-2 mb-4 justify-center"
              accessibilityRole="tablist"
              accessibilityLabel={t('diagnoseV2.wizardProgress')}
            >
              {WIZARD_STEPS.map((step, i) => (
                <View
                  key={`dot-${step.key}`}
                  className={`w-2 h-2 rounded-full ${
                    i === wizardSubStep ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                  accessibilityLabel={t('diagnoseV2.wizardSubStep', { current: i + 1, total: WIZARD_STEPS.length })}
                  accessibilityState={{ selected: i === wizardSubStep }}
                />
              ))}
            </View>

            <Text className="text-lg font-semibold text-neutral-950 dark:text-neutral-50 mb-4">
              {t(currentStep.titleKey)}
            </Text>

            {/* Symptom chips — grouped layout */}
            {wizardSubStep === 0 ? (
              <View style={{ gap: 24 }}>
                {SYMPTOM_GROUPS.map((group, groupIndex) => (
                  <Animated.View
                    key={group.label}
                    entering={FadeInUp.delay(groupIndex * 60).duration(250)}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        color: DIAGNOSTIC_COLORS.textMuted,
                        marginBottom: 12,
                        paddingHorizontal: 4,
                      }}
                    >
                      {group.label}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {group.options.map((option) => (
                        <WizardOptionChip
                          key={option}
                          label={t(`diagnoseV2.option.${option}`)}
                          subtitle={isBeginner ? t(`diagnoseV2.subtitle.${option}`) : undefined}
                          selected={selectionSet.has(option)}
                          IconComponent={SYMPTOM_ICONS[option]}
                          onPress={() => toggleWizardOption(currentKey, option)}
                        />
                      ))}
                    </View>
                  </Animated.View>
                ))}

                {/* I'm not sure — at the bottom for symptoms */}
                <Animated.View entering={FadeInUp.delay(SYMPTOM_GROUPS.length * 60).duration(250)}>
                  <WizardOptionChip
                    label={t('diagnoseV2.imNotSure')}
                    selected={isDontKnow}
                    variant="dont-know"
                    onPress={() => toggleWizardOption(currentKey, 'dont_know')}
                  />
                </Animated.View>

                {customInputSection}
              </View>
            ) : (
              /* Location and timing — flat rendering */
              <View>
                {/* I don't know chip */}
                <Animated.View entering={FadeInUp.duration(250)} className="mb-3">
                  <WizardOptionChip
                    label={t('diagnoseV2.imNotSure')}
                    selected={isDontKnow}
                    variant="dont-know"
                    onPress={() => toggleWizardOption(currentKey, 'dont_know')}
                  />
                </Animated.View>

                {/* Option chips */}
                <View className="flex-row flex-wrap gap-3">
                  {currentStep.options.map((option, index) => {
                    const IconComp = currentStep.icons[option];
                    return (
                      <Animated.View
                        key={option}
                        entering={FadeInUp.delay(50 + index * 40).duration(300)}
                        style={{ width: '47%' }}
                      >
                        <WizardOptionChip
                          label={t(`diagnoseV2.option.${option}`)}
                          subtitle={isBeginner ? t(`diagnoseV2.subtitle.${option}`) : undefined}
                          selected={selectionSet.has(option)}
                          IconComponent={IconComp}
                          onPress={() => toggleWizardOption(currentKey, option)}
                        />
                      </Animated.View>
                    );
                  })}
                </View>

                {customInputSection}
              </View>
            )}
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
              accessibilityLabel={t('diagnoseV2.describeProblem')}
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
            onPress={() => setWizardSubStep((wizardSubStep - 1) as 0 | 1 | 2)}
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
