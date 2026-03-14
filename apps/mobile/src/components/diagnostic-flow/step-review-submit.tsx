import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { Bike, Pencil, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
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
import type { Step } from '../../stores/diagnostic-flow.store';

interface StepReviewSubmitProps {
  onSubmit: () => void;
}

function ReviewCard({
  title,
  onEdit,
  children,
  delay = 0,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  delay?: number;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(300)} className="mx-5 mb-3">
      <View
        className="bg-white dark:bg-neutral-800 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-700"
        style={{ borderCurve: 'continuous' }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {title}
          </Text>
          <Pressable className="flex-row items-center gap-1 py-1 px-2" onPress={onEdit} hitSlop={8}>
            <Pencil size={14} color={palette.primary500} strokeWidth={2} />
            <Text className="text-xs font-medium text-primary-500">{t('diagnoseV2.edit')}</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

export function StepReviewSubmit({ onSubmit }: StepReviewSubmitProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const store = useDiagnosticFlowStore(
    useShallow((s) => ({
      selectedMotorcycleId: s.selectedMotorcycleId,
      manualBikeInfo: s.manualBikeInfo,
      inputMode: s.inputMode,
      wizardAnswers: s.wizardAnswers,
      freeTextDescription: s.freeTextDescription,
      photoUri: s.photoUri,
      additionalNotes: s.additionalNotes,
      urgency: s.urgency,
      dataSharingOptedIn: s.dataSharingOptedIn,
      isSubmitting: s.isSubmitting,
      submitError: s.submitError,
      goToStepFromReview: s.goToStepFromReview,
      setDataSharingOptedIn: s.setDataSharingOptedIn,
    })),
  );

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesData?.myMotorcycles ?? [];
  const selectedBike = motorcycles.find((m) => m.id === store.selectedMotorcycleId);

  const editStep = (step: Step) => store.goToStepFromReview(step);

  const urgencyLabels: Record<string, string> = {
    stranded: t('diagnoseV2.urgencyStranded'),
    soon: t('diagnoseV2.urgencySoon'),
    preventive: t('diagnoseV2.urgencyPreventive'),
  };

  const ALL_PREDEFINED = new Set([...PREDEFINED_SYMPTOMS, ...PREDEFINED_LOCATION, ...PREDEFINED_TIMING]);
  const wizardTags = Object.entries(store.wizardAnswers)
    .flatMap(([, values]) => (values as string[]).filter((v: string) => v !== 'dont_know'))
    // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key from wizard answers
    .map((v: string) => ALL_PREDEFINED.has(v) ? (t(`diagnoseV2.option.${v}` as any) as string) : `"${v}"`);

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-2 mb-4">
          <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50">
            {t('diagnoseV2.review')}
          </Text>
        </View>

        {/* Bike */}
        <ReviewCard title={t('diagnoseV2.reviewBike')} onEdit={() => editStep(1)} delay={0}>
          <View className="flex-row items-center gap-3">
            {selectedBike?.primaryPhotoUrl ? (
              <Image
                source={{ uri: selectedBike.primaryPhotoUrl }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
              />
            ) : (
              <View
                className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-700 items-center justify-center"
                style={{ borderCurve: 'continuous' }}
              >
                <Bike size={18} color={palette.neutral400} strokeWidth={1.5} />
              </View>
            )}
            <Text className="text-base text-neutral-950 dark:text-neutral-50 font-medium">
              {selectedBike
                ? selectedBike.nickname || `${selectedBike.make} ${selectedBike.model}`
                : store.manualBikeInfo
                  ? t('diagnoseV2.unknownBikeType', { type: store.manualBikeInfo.type })
                  : '—'}
            </Text>
          </View>
        </ReviewCard>

        {/* Problem */}
        <ReviewCard title={t('diagnoseV2.reviewProblem')} onEdit={() => editStep(2)} delay={50}>
          {store.inputMode === 'wizard' ? (
            wizardTags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {wizardTags.map((tag) => (
                  <View
                    key={tag}
                    className="bg-primary-100 dark:bg-primary-900 rounded-lg px-3 py-1"
                    style={{ borderCurve: 'continuous' }}
                  >
                    <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-neutral-400">{t('diagnoseV2.notSureTag')}</Text>
            )
          ) : (
            <Text className="text-sm text-neutral-700 dark:text-neutral-300" numberOfLines={3}>
              {store.freeTextDescription || '—'}
            </Text>
          )}
        </ReviewCard>

        {/* Photo */}
        <ReviewCard title={t('diagnoseV2.reviewPhoto')} onEdit={() => editStep(3)} delay={100}>
          {store.photoUri ? (
            <Image
              source={{ uri: store.photoUri }}
              style={{ width: '100%', height: 120, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : (
            <Text className="text-sm text-neutral-400">{t('diagnoseV2.reviewNoPhoto')}</Text>
          )}
        </ReviewCard>

        {/* Notes */}
        {store.additionalNotes.trim() && (
          <ReviewCard title={t('diagnoseV2.reviewDetails')} onEdit={() => editStep(3)} delay={150}>
            <Text className="text-sm text-neutral-700 dark:text-neutral-300" numberOfLines={2}>
              {store.additionalNotes}
            </Text>
          </ReviewCard>
        )}

        {/* Urgency */}
        <ReviewCard title={t('diagnoseV2.reviewUrgency')} onEdit={() => editStep(3)} delay={200}>
          <Text className="text-sm text-neutral-700 dark:text-neutral-300">
            {store.urgency ? urgencyLabels[store.urgency] : t('diagnoseV2.reviewNoUrgency')}
          </Text>
        </ReviewCard>

        {/* Data sharing toggle */}
        <Animated.View
          entering={FadeInUp.delay(250).duration(300)}
          className="mx-5 mt-2 flex-row items-center justify-between"
        >
          <Text className="text-sm text-neutral-600 dark:text-neutral-400 flex-1 mr-3">
            {t('diagnoseV2.dataSharingLabel')}
          </Text>
          <Switch
            value={store.dataSharingOptedIn}
            onValueChange={store.setDataSharingOptedIn}
            trackColor={{ false: palette.neutral300, true: palette.primary500 }}
          />
        </Animated.View>

        {/* Disclaimer */}
        <Animated.View entering={FadeInUp.delay(300).duration(300)} className="mx-5 mt-4">
          <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center leading-4">
            {t('diagnoseV2.disclaimer')}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Submit button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-5"
        style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
      >
        {store.submitError && (
          <Text className="text-sm text-danger-500 text-center mb-2">
            {t('diagnoseV2.submitError')}
          </Text>
        )}
        <Pressable
          className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
            store.isSubmitting ? 'bg-primary-400' : 'bg-primary-500'
          }`}
          style={{ borderCurve: 'continuous' }}
          onPress={store.submitError ? onSubmit : onSubmit}
          disabled={store.isSubmitting}
        >
          {store.isSubmitting ? (
            <>
              <ActivityIndicator size="small" color={palette.white} />
              <Text className="text-white font-semibold text-base">
                {t('diagnoseV2.analyzing')}
              </Text>
            </>
          ) : store.submitError ? (
            <Text className="text-white font-semibold text-base">{t('diagnoseV2.tryAgain')}</Text>
          ) : (
            <>
              <Sparkles size={18} color={palette.white} strokeWidth={2} />
              <Text className="text-white font-semibold text-base">{t('diagnoseV2.analyze')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
