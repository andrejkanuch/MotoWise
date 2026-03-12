import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument, SubmitDiagnosticDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

type DiagStage = 'start' | 'wizard' | 'photo' | 'analyzing';

interface WizardAnswers {
  symptoms: string[];
  location: string[];
  timing: string[];
}

const WIZARD_STEPS = [
  {
    key: 'symptoms' as const,
    i18nKey: 'wizard.symptoms',
    options: [
      'noise',
      'vibration',
      'leak',
      'smoke',
      'warning_light',
      'performance_issue',
      'visual_damage',
      'smell',
    ],
  },
  {
    key: 'location' as const,
    i18nKey: 'wizard.location',
    options: [
      'engine',
      'brakes',
      'exhaust',
      'tires',
      'electrical',
      'suspension',
      'chain_drivetrain',
      'bodywork',
    ],
  },
  {
    key: 'timing' as const,
    i18nKey: 'wizard.timing',
    options: [
      'always',
      'at_speed',
      'idle',
      'cold_start',
      'hot_engine',
      'braking',
      'acceleration',
      'turning',
    ],
  },
] as const;

export default function NewDiagnosticScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<DiagStage>('start');
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<WizardAnswers>({
    symptoms: [],
    location: [],
    timing: [],
  });
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesData?.myMotorcycles ?? [];
  const primaryBike = motorcycles.find((m) => m.isPrimary) ?? motorcycles[0];

  const submitMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(SubmitDiagnosticDocument, {
        input: {
          motorcycleId: primaryBike?.id ?? '',
          photoBase64: photoBase64 ?? '',
          description: description || undefined,
          wizardAnswers: {
            symptoms: wizardAnswers.symptoms.join(','),
            location: wizardAnswers.location.join(','),
            timing: wizardAnswers.timing.join(','),
          },
          dataSharingOptedIn: false,
        },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.all });
      router.replace(`/(diagnose)/${data.submitDiagnostic.id}` as `/${string}`);
    },
    onError: () => {
      setStage('photo');
    },
  });

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ?? null);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ?? null);
    }
  };

  const handleAnalyze = () => {
    setStage('analyzing');
    submitMutation.mutate();
  };

  const currentStep = WIZARD_STEPS[wizardStep];
  const currentStepKey = currentStep?.key ?? 'symptoms';
  const currentSelection = wizardAnswers[currentStepKey];

  const toggleOption = (option: string) => {
    setWizardAnswers((prev) => {
      const current = prev[currentStepKey];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [currentStepKey]: updated };
    });
  };

  const handleWizardNext = () => {
    if (wizardStep < WIZARD_STEPS.length - 1) {
      setWizardStep((s) => s + 1);
    } else {
      setStage('photo');
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 0) {
      setWizardStep((s) => s - 1);
    } else {
      setStage('start');
    }
  };

  // START stage
  if (stage === 'start') {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 justify-center items-center p-6">
        <Animated.View entering={FadeIn.duration(300)} className="items-center w-full">
          <View
            className="w-20 h-20 rounded-3xl bg-primary-100 dark:bg-primary-900 items-center justify-center mb-6"
            style={{ borderCurve: 'continuous' }}
          >
            <ScanLine size={40} color={palette.primary500} strokeWidth={1.5} />
          </View>
          <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50 mb-2">
            {t('diagnose.wizardTitle')}
          </Text>
          <Text className="text-base text-neutral-500 dark:text-neutral-400 text-center mb-8">
            {t('diagnose.wizardSubtitle')}
          </Text>

          <Pressable
            className="w-full bg-primary-500 rounded-2xl py-4 items-center mb-3"
            style={{ borderCurve: 'continuous' }}
            onPress={() => {
              setStage('wizard');
              setWizardStep(0);
            }}
          >
            <Text className="text-white font-semibold text-base">{t('diagnose.useWizard')}</Text>
          </Pressable>

          <Pressable
            className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-2xl py-4 items-center"
            style={{ borderCurve: 'continuous' }}
            onPress={() => setStage('photo')}
          >
            <Text className="text-neutral-700 dark:text-neutral-300 font-semibold text-base">
              {t('diagnose.skipToPhoto')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // WIZARD stage
  if (stage === 'wizard' && currentStep) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress bar */}
          <Animated.View entering={FadeIn.duration(200)} className="px-5 pt-4">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('wizard.step', { current: wizardStep + 1, total: WIZARD_STEPS.length })}
              </Text>
            </View>
            <View className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${((wizardStep + 1) / WIZARD_STEPS.length) * 100}%` }}
              />
            </View>
          </Animated.View>

          {/* Question */}
          <Animated.View
            key={`wizard-${wizardStep}`}
            entering={SlideInRight.duration(250)}
            className="px-5 mt-6"
          >
            <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-5">
              {t(currentStep.i18nKey)}
            </Text>

            {/* Options Grid */}
            <View className="flex-row flex-wrap gap-3">
              {currentStep.options.map((option, index) => {
                const isSelected = currentSelection.includes(option);
                return (
                  <Animated.View
                    key={option}
                    entering={FadeInUp.delay(index * 40).duration(300)}
                    style={{ width: '47%' }}
                  >
                    <Pressable
                      className={`rounded-2xl p-4 border-2 ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                      }`}
                      style={{ borderCurve: 'continuous' }}
                      onPress={() => toggleOption(option)}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          isSelected
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {t(`wizard.option.${option}`)}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom buttons */}
        <View
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-5 flex-row gap-3"
          style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
        >
          <Pressable
            className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl py-4 items-center flex-row justify-center gap-2"
            style={{ borderCurve: 'continuous' }}
            onPress={handleWizardBack}
          >
            <ArrowLeft size={16} color={palette.neutral600} strokeWidth={2} />
            <Text className="text-neutral-700 dark:text-neutral-300 font-semibold text-sm">
              {t('wizard.back')}
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
              currentSelection.length > 0 ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
            style={{ borderCurve: 'continuous' }}
            onPress={handleWizardNext}
            disabled={currentSelection.length === 0}
          >
            <Text
              className={`font-semibold text-sm ${
                currentSelection.length > 0
                  ? 'text-white'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {t('wizard.next')}
            </Text>
            <ArrowRight
              size={16}
              color={currentSelection.length > 0 ? palette.white : palette.neutral400}
              strokeWidth={2}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // PHOTO stage
  if (stage === 'photo') {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-4">
            <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-2">
              {t('diagnose.wizardTitle')}
            </Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
              {t('diagnose.wizardSubtitle')}
            </Text>
          </Animated.View>

          {/* Photo preview or capture buttons */}
          {photoUri ? (
            <Animated.View entering={FadeInUp.duration(300)} className="px-5">
              <View
                className="rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800"
                style={{ borderCurve: 'continuous' }}
              >
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: '100%', height: 280, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <Pressable
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 items-center justify-center"
                  onPress={() => {
                    setPhotoUri(null);
                    setPhotoBase64(null);
                  }}
                >
                  <X size={16} color={palette.white} strokeWidth={2} />
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(300)} className="px-5 gap-3">
              <Pressable
                className="bg-primary-500 rounded-2xl py-5 items-center flex-row justify-center gap-3"
                style={{ borderCurve: 'continuous' }}
                onPress={handleTakePhoto}
              >
                <Camera size={22} color={palette.white} strokeWidth={2} />
                <Text className="text-white font-semibold text-base">
                  {t('diagnose.takePhoto')}
                </Text>
              </Pressable>

              <Pressable
                className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl py-5 items-center flex-row justify-center gap-3"
                style={{ borderCurve: 'continuous' }}
                onPress={handlePickImage}
              >
                <ImageIcon size={22} color={palette.neutral600} strokeWidth={2} />
                <Text className="text-neutral-700 dark:text-neutral-300 font-semibold text-base">
                  {t('diagnose.chooseFromGallery')}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Description input */}
          <Animated.View entering={FadeInUp.delay(100).duration(300)} className="px-5 mt-4">
            <TextInput
              className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-4 text-base text-neutral-950 dark:text-neutral-50 min-h-[100px]"
              style={{ borderCurve: 'continuous', textAlignVertical: 'top' }}
              placeholder={t('diagnose.descriptionPlaceholder')}
              placeholderTextColor={palette.neutral400}
              value={description}
              onChangeText={(text) => setDescription(text.slice(0, 500))}
              multiline
              maxLength={500}
            />
            <Text className="text-xs text-neutral-400 mt-1 text-right">
              {description.length}/500
            </Text>
          </Animated.View>
        </ScrollView>

        {/* Analyze button */}
        <View
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-5"
          style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
        >
          <Pressable
            className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
              photoUri ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
            }`}
            style={{ borderCurve: 'continuous' }}
            onPress={handleAnalyze}
            disabled={!photoUri}
          >
            <Sparkles
              size={18}
              color={photoUri ? palette.white : palette.neutral400}
              strokeWidth={2}
            />
            <Text
              className={`font-semibold text-base ${
                photoUri ? 'text-white' : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {t('diagnose.analyze')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ANALYZING stage
  return (
    <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center p-6">
      <Animated.View entering={FadeIn.duration(400)} className="items-center">
        <View
          className="w-20 h-20 rounded-3xl bg-primary-100 dark:bg-primary-900 items-center justify-center mb-6"
          style={{ borderCurve: 'continuous' }}
        >
          <ActivityIndicator size="large" color={palette.primary500} />
        </View>
        <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-2">
          {t('diagnose.analyzing')}
        </Text>
        {submitMutation.isError && (
          <View className="mt-4 items-center">
            <Text className="text-sm text-danger-500 mb-3">{t('diagnose.failed')}</Text>
            <Pressable
              className="bg-primary-500 rounded-xl px-6 py-3"
              style={{ borderCurve: 'continuous' }}
              onPress={() => setStage('photo')}
            >
              <Text className="text-white font-semibold text-sm">{t('diagnose.retry')}</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
