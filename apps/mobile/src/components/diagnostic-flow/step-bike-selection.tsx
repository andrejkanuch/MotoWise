import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument } from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Bike, Check, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useDiagnosticFlowStore } from '../../stores/diagnostic-flow.store';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';
import { WizardOptionChip } from './wizard-option-chip';

export function StepBikeSelection() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const store = useDiagnosticFlowStore(
    useShallow((s) => ({
      selectedMotorcycleId: s.selectedMotorcycleId,
      manualBikeInfo: s.manualBikeInfo,
      showManualForm: s.showManualForm,
      setSelectedMotorcycleId: s.setSelectedMotorcycleId,
      setManualBikeInfo: s.setManualBikeInfo,
      setShowManualForm: s.setShowManualForm,
      goNext: s.goNext,
    })),
  );

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

  const canProceed = store.selectedMotorcycleId || store.manualBikeInfo?.type;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: DIAGNOSTIC_COLORS.textMuted,
            }}
          >
            {t('diagnoseV2.stepOf', { current: 1, total: 4 })}
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '600',
              color: DIAGNOSTIC_COLORS.textPrimary,
              marginTop: 4,
            }}
          >
            {t('diagnoseV2.selectBike')}
          </Text>
          <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textMuted, marginTop: 4 }}>
            {t('diagnoseV2.whichBike')}
          </Text>
        </View>

        {/* Garage bikes */}
        {motorcycles.map((moto, index) => {
          const isSelected = store.selectedMotorcycleId === moto.id;
          return (
            <Animated.View key={moto.id} entering={FadeInUp.delay(index * 50).duration(300)}>
              <Pressable
                style={{
                  marginHorizontal: 20,
                  marginBottom: 12,
                  padding: 16,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 2,
                  borderColor: isSelected
                    ? DIAGNOSTIC_COLORS.cardBorderSelected
                    : DIAGNOSTIC_COLORS.cardBorder,
                  backgroundColor: isSelected
                    ? DIAGNOSTIC_COLORS.cardBgSelected
                    : DIAGNOSTIC_COLORS.cardBg,
                  borderCurve: 'continuous',
                }}
                onPress={() => handleSelectBike(moto.id)}
              >
                {moto.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: moto.primaryPhotoUrl }}
                    style={{ width: 56, height: 56, borderRadius: 12 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderCurve: 'continuous',
                    }}
                  >
                    <Bike size={24} color={DIAGNOSTIC_COLORS.textMuted} strokeWidth={1.5} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: DIAGNOSTIC_COLORS.textPrimary,
                    }}
                  >
                    {moto.nickname || `${moto.make} ${moto.model}`}
                  </Text>
                  <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textSecondary }}>
                    {moto.year} {moto.nickname ? `${moto.make} ${moto.model}` : ''}
                  </Text>
                </View>
                {isSelected && (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: DIAGNOSTIC_COLORS.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} color={palette.white} strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Different bike option */}
        <Animated.View entering={FadeInUp.delay(motorcycles.length * 50).duration(300)}>
          <Pressable
            style={{
              marginHorizontal: 20,
              marginTop: 8,
              padding: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 2,
              borderStyle: store.showManualForm ? 'solid' : 'dashed',
              borderColor: store.showManualForm
                ? DIAGNOSTIC_COLORS.cardBorderSelected
                : 'rgba(255,255,255,0.15)',
              backgroundColor: store.showManualForm
                ? DIAGNOSTIC_COLORS.cardBgSelected
                : 'transparent',
              borderCurve: 'continuous',
            }}
            onPress={() => {
              store.setShowManualForm(!store.showManualForm);
              store.setSelectedMotorcycleId(null);
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}
            >
              <Plus size={24} color={DIAGNOSTIC_COLORS.textMuted} strokeWidth={1.5} />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: DIAGNOSTIC_COLORS.textSecondary,
              }}
            >
              {t('diagnoseV2.differentBike')}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Manual bike form */}
        {store.showManualForm && (
          <Animated.View
            entering={FadeInUp.duration(250)}
            style={{ marginHorizontal: 20, marginTop: 16 }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: DIAGNOSTIC_COLORS.textSecondary,
                marginBottom: 12,
              }}
            >
              {t('diagnoseV2.bikeType')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
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

            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: DIAGNOSTIC_COLORS.textSecondary,
                marginBottom: 8,
              }}
            >
              {t('diagnoseV2.bikeYear')}
            </Text>
            <TextInput
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DIAGNOSTIC_COLORS.textPrimary,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.cardBorder,
                borderCurve: 'continuous',
              }}
              placeholder={t('diagnoseV2.iDontKnow')}
              placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
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

            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: DIAGNOSTIC_COLORS.textSecondary,
                marginBottom: 8,
              }}
            >
              {t('diagnoseV2.bikeMake')}
            </Text>
            <TextInput
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DIAGNOSTIC_COLORS.textPrimary,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.cardBorder,
                borderCurve: 'continuous',
              }}
              placeholder={t('diagnoseV2.iDontKnow')}
              placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
              value={store.manualBikeInfo?.make ?? ''}
              onChangeText={(text) => {
                store.setManualBikeInfo({
                  ...store.manualBikeInfo,
                  type: store.manualBikeInfo?.type ?? '',
                  make: text || undefined,
                });
              }}
            />

            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: DIAGNOSTIC_COLORS.textSecondary,
                marginBottom: 8,
              }}
            >
              {t('diagnoseV2.bikeModel')}
            </Text>
            <TextInput
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DIAGNOSTIC_COLORS.textPrimary,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.cardBorder,
                borderCurve: 'continuous',
              }}
              placeholder={t('diagnoseV2.iDontKnow')}
              placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
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
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: DIAGNOSTIC_COLORS.background,
          borderTopWidth: 1,
          borderTopColor: DIAGNOSTIC_COLORS.cardBorder,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
        }}
      >
        <Pressable
          style={{
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            backgroundColor: canProceed ? DIAGNOSTIC_COLORS.accent : 'rgba(255,255,255,0.08)',
            borderCurve: 'continuous',
          }}
          onPress={() => store.goNext()}
          disabled={!canProceed}
        >
          <Text
            style={{
              fontWeight: '600',
              fontSize: 16,
              color: canProceed ? '#FFFFFF' : DIAGNOSTIC_COLORS.textMuted,
            }}
          >
            {t('diagnoseV2.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
