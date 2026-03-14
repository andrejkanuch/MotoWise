import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument } from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Bike, ChevronRight, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useDiagnosticFlowStore } from '../../stores/diagnostic-flow.store';
import { WizardOptionChip } from './wizard-option-chip';

export function StepBikeSelection() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const store = useDiagnosticFlowStore();

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesData?.myMotorcycles ?? [];

  // Pre-select primary bike if nothing selected yet
  if (
    !store.selectedMotorcycleId &&
    !store.manualBikeInfo &&
    !store.showManualForm &&
    motorcycles.length > 0
  ) {
    const primary = motorcycles.find((m) => m.isPrimary) ?? motorcycles[0];
    if (primary) store.setSelectedMotorcycleId(primary.id);
  }

  const handleSelectBike = (id: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.setSelectedMotorcycleId(id);
    store.setShowManualForm(false);
  };

  const handleTypeSelect = (type: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.setManualBikeInfo({ ...store.manualBikeInfo, type } as { type: string });
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-2">
          <Text className="text-xl font-bold text-neutral-950 dark:text-neutral-50 mb-1">
            {t('diagnoseV2.selectBike')}
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
            {t('diagnoseV2.whichBike')}
          </Text>
        </View>

        {/* Garage bikes */}
        {motorcycles.map((moto, index) => (
          <Animated.View key={moto.id} entering={FadeInUp.delay(index * 50).duration(300)}>
            <Pressable
              className={`mx-5 mb-3 p-4 rounded-2xl flex-row items-center gap-3 border-2 ${
                store.selectedMotorcycleId === moto.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
              }`}
              style={{ borderCurve: 'continuous' }}
              onPress={() => handleSelectBike(moto.id)}
            >
              {moto.primaryPhotoUrl ? (
                <Image
                  source={{ uri: moto.primaryPhotoUrl }}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
              ) : (
                <View
                  className="w-14 h-14 rounded-xl bg-neutral-100 dark:bg-neutral-700 items-center justify-center"
                  style={{ borderCurve: 'continuous' }}
                >
                  <Bike size={24} color={palette.neutral400} strokeWidth={1.5} />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
                  {moto.nickname || `${moto.make} ${moto.model}`}
                </Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                  {moto.year} {moto.nickname ? `${moto.make} ${moto.model}` : ''}
                </Text>
              </View>
              {store.selectedMotorcycleId === moto.id && (
                <View className="w-6 h-6 rounded-full bg-primary-500 items-center justify-center">
                  <ChevronRight size={14} color={palette.white} strokeWidth={2.5} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        ))}

        {/* Different bike option */}
        <Animated.View entering={FadeInUp.delay(motorcycles.length * 50).duration(300)}>
          <Pressable
            className={`mx-5 mt-2 p-4 rounded-2xl flex-row items-center gap-3 border-2 ${
              store.showManualForm
                ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-850'
                : 'border-dashed border-neutral-300 dark:border-neutral-600'
            }`}
            style={{ borderCurve: 'continuous' }}
            onPress={() => {
              store.setShowManualForm(!store.showManualForm);
              store.setSelectedMotorcycleId(null);
            }}
          >
            <View
              className="w-14 h-14 rounded-xl bg-neutral-100 dark:bg-neutral-700 items-center justify-center"
              style={{ borderCurve: 'continuous' }}
            >
              <Plus size={24} color={palette.neutral400} strokeWidth={1.5} />
            </View>
            <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
              {t('diagnoseV2.differentBike')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Manual bike form */}
        {store.showManualForm && (
          <Animated.View entering={FadeInUp.duration(250)} className="mx-5 mt-4">
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              {t('diagnoseV2.bikeType')}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {Object.values(MotorcycleType).map((type: string) => (
                <WizardOptionChip
                  key={type}
                  // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key
                  label={t(`diagnoseV2.option.${type}` as any)}
                  selected={store.manualBikeInfo?.type === type}
                  onPress={() => handleTypeSelect(type)}
                />
              ))}
            </View>

            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('diagnoseV2.bikeYear')}
            </Text>
            <TextInput
              className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-950 dark:text-neutral-50 mb-4"
              style={{ borderCurve: 'continuous' }}
              placeholder={t('diagnoseV2.iDontKnow')}
              placeholderTextColor={palette.neutral400}
              keyboardType="number-pad"
              maxLength={4}
              value={store.manualBikeInfo?.year?.toString() ?? ''}
              onChangeText={(text) => {
                const year = text ? Number.parseInt(text, 10) : undefined;
                store.setManualBikeInfo({
                  ...store.manualBikeInfo,
                  type: store.manualBikeInfo?.type ?? '',
                  year,
                });
              }}
            />

            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('diagnoseV2.bikeMake')}
            </Text>
            <TextInput
              className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-950 dark:text-neutral-50 mb-4"
              style={{ borderCurve: 'continuous' }}
              placeholder={t('diagnoseV2.iDontKnow')}
              placeholderTextColor={palette.neutral400}
              value={store.manualBikeInfo?.make ?? ''}
              onChangeText={(text) => {
                store.setManualBikeInfo({
                  ...store.manualBikeInfo,
                  type: store.manualBikeInfo?.type ?? '',
                  make: text || undefined,
                });
              }}
            />

            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              {t('diagnoseV2.bikeModel')}
            </Text>
            <TextInput
              className="bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-3 text-base text-neutral-950 dark:text-neutral-50"
              style={{ borderCurve: 'continuous' }}
              placeholder={t('diagnoseV2.iDontKnow')}
              placeholderTextColor={palette.neutral400}
              value={store.manualBikeInfo?.model ?? ''}
              onChangeText={(text) => {
                store.setManualBikeInfo({
                  ...store.manualBikeInfo,
                  type: store.manualBikeInfo?.type ?? '',
                  model: text || undefined,
                });
              }}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* Next button */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-5"
        style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
      >
        <Pressable
          className={`rounded-2xl py-4 items-center ${
            store.selectedMotorcycleId || store.manualBikeInfo?.type
              ? 'bg-primary-500'
              : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
          style={{ borderCurve: 'continuous' }}
          onPress={() => store.goNext()}
          disabled={!store.selectedMotorcycleId && !store.manualBikeInfo?.type}
        >
          <Text
            className={`font-semibold text-base ${
              store.selectedMotorcycleId || store.manualBikeInfo?.type
                ? 'text-white'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            {t('diagnoseV2.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
