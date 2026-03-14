import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument } from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Bike, Check, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useMotorcycleMakes } from '../../hooks/use-motorcycle-makes';
import { detectTypeFromModel, useMotorcycleModels } from '../../hooks/use-motorcycle-models';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useDiagnosticFlowStore } from '../../stores/diagnostic-flow.store';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';
import { WizardOptionChip } from './wizard-option-chip';

/** Inline NHTSA-powered "Different Bike" sub-flow */
function ManualBikeForm() {
  const { t } = useTranslation();

  const store = useDiagnosticFlowStore(
    useShallow((s) => ({
      manualBikeInfo: s.manualBikeInfo,
      setManualBikeInfo: s.setManualBikeInfo,
    })),
  );

  const [manualStep, setManualStep] = useState<'year' | 'make' | 'model'>('year');
  const [yearInput, setYearInput] = useState(store.manualBikeInfo?.year?.toString() ?? '');
  const [makeSearch, setMakeSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [debouncedMakeSearch, setDebouncedMakeSearch] = useState('');
  const [debouncedModelSearch, setDebouncedModelSearch] = useState('');
  const [selectedMakeForSearch, setSelectedMakeForSearch] = useState<{
    makeId: number;
    makeName: string;
  } | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 400ms debounce for make search
  const makeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMakeSearchChange = useCallback((text: string) => {
    setMakeSearch(text);
    if (makeDebounceRef.current) clearTimeout(makeDebounceRef.current);
    makeDebounceRef.current = setTimeout(() => setDebouncedMakeSearch(text), 400);
  }, []);

  // 400ms debounce for model search
  const modelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleModelSearchChange = useCallback((text: string) => {
    setModelSearch(text);
    if (modelDebounceRef.current) clearTimeout(modelDebounceRef.current);
    modelDebounceRef.current = setTimeout(() => setDebouncedModelSearch(text), 400);
  }, []);

  const parsedYear = yearInput ? Number.parseInt(yearInput, 10) : 0;
  const makeId = selectedMakeForSearch?.makeId ?? 0;

  const {
    popularMakes,
    filteredMakes,
    isLoading: makesLoading,
  } = useMotorcycleMakes(debouncedMakeSearch);

  const { filteredModels, isLoading: modelsLoading } = useMotorcycleModels(
    makeId,
    parsedYear,
    debouncedModelSearch,
  );

  // Start 5s fallback timer when loading
  useEffect(() => {
    if ((manualStep === 'make' && makesLoading) || (manualStep === 'model' && modelsLoading)) {
      setShowManualFallback(false);
      fallbackTimerRef.current = setTimeout(() => setShowManualFallback(true), 5000);
    } else {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    }
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [manualStep, makesLoading, modelsLoading]);

  // Restore step from existing manualBikeInfo
  useEffect(() => {
    if (store.manualBikeInfo?.model) {
      setManualStep('model');
    } else if (store.manualBikeInfo?.make) {
      setManualStep('make');
    }
  }, [store.manualBikeInfo?.model, store.manualBikeInfo?.make]);

  const handleTypeSelect = (type: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store.setManualBikeInfo({ ...store.manualBikeInfo, type } as {
      type: string;
    });
  };

  const handleYearConfirm = () => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const year = yearInput ? Number.parseInt(yearInput, 10) : undefined;
    store.setManualBikeInfo({
      ...store.manualBikeInfo,
      type: store.manualBikeInfo?.type ?? '',
      year,
    });
    setManualStep('make');
  };

  const handleMakeSelect = (make: { makeId: number; makeName: string }) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMakeForSearch(make);
    setMakeSearch('');
    setDebouncedMakeSearch('');
    store.setManualBikeInfo({
      ...store.manualBikeInfo,
      type: store.manualBikeInfo?.type ?? '',
      make: make.makeName,
    });
    setManualStep('model');
  };

  const handleModelSelect = (model: { modelId: number; modelName: string }) => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const detectedType = detectTypeFromModel(model.modelName);
    store.setManualBikeInfo({
      ...store.manualBikeInfo,
      type: detectedType ?? store.manualBikeInfo?.type ?? '',
      model: model.modelName,
    });
    setModelSearch('');
    setDebouncedModelSearch('');
  };

  const handleStepBack = () => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (manualStep === 'model') {
      setManualStep('make');
      setSelectedMakeForSearch(null);
      store.setManualBikeInfo({
        ...store.manualBikeInfo,
        type: store.manualBikeInfo?.type ?? '',
        make: undefined,
        model: undefined,
      });
    } else if (manualStep === 'make') {
      setManualStep('year');
      store.setManualBikeInfo({
        ...store.manualBikeInfo,
        type: store.manualBikeInfo?.type ?? '',
        make: undefined,
      });
    }
  };

  // Manual fallback state
  const [manualMakeText, setManualMakeText] = useState('');
  const [manualModelText, setManualModelText] = useState('');
  const [usingManualMakeFallback, setUsingManualMakeFallback] = useState(false);
  const [usingManualModelFallback, setUsingManualModelFallback] = useState(false);

  const handleManualMakeFallback = () => {
    setUsingManualMakeFallback(true);
  };

  const handleManualModelFallback = () => {
    setUsingManualModelFallback(true);
  };

  const inputStyle = {
    backgroundColor: DIAGNOSTIC_COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: DIAGNOSTIC_COLORS.textPrimary,
    borderWidth: 1,
    borderColor: DIAGNOSTIC_COLORS.cardBorder,
    borderCurve: 'continuous' as const,
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      style={{ marginHorizontal: 20, marginTop: 16 }}
    >
      {/* Bike type selection (always visible) */}
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
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
      >
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

      {/* Step breadcrumb */}
      {manualStep !== 'year' && (
        <Pressable
          onPress={handleStepBack}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 12,
          }}
        >
          <ChevronLeft size={16} color={DIAGNOSTIC_COLORS.accent} />
          <Text
            style={{
              fontSize: 13,
              color: DIAGNOSTIC_COLORS.accent,
              fontWeight: '500',
            }}
          >
            {manualStep === 'make'
              ? t('diagnoseV2.bikeYear')
              : (store.manualBikeInfo?.make ?? t('diagnoseV2.bikeMake'))}
          </Text>
        </Pressable>
      )}

      {/* Summary of prior selections */}
      {manualStep !== 'year' && yearInput ? (
        <Text
          style={{
            fontSize: 13,
            color: DIAGNOSTIC_COLORS.textMuted,
            marginBottom: 4,
          }}
        >
          {yearInput}
          {store.manualBikeInfo?.make ? ` ${store.manualBikeInfo.make}` : ''}
          {store.manualBikeInfo?.model ? ` ${store.manualBikeInfo.model}` : ''}
        </Text>
      ) : null}

      {/* --- YEAR STEP --- */}
      {manualStep === 'year' && (
        <View>
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
            style={{ ...inputStyle, marginBottom: 12 }}
            placeholder={t('diagnoseV2.iDontKnow')}
            placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            value={yearInput}
            onChangeText={setYearInput}
          />
          <Pressable
            onPress={handleYearConfirm}
            style={{
              backgroundColor: DIAGNOSTIC_COLORS.accent,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              borderCurve: 'continuous',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
              {t('diagnoseV2.next')}
            </Text>
            <ChevronRight size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* --- MAKE STEP --- */}
      {manualStep === 'make' && !usingManualMakeFallback && (
        <View>
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

          {/* Search input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Search size={16} color={DIAGNOSTIC_COLORS.textMuted} />
            <TextInput
              style={{ ...inputStyle, flex: 1 }}
              placeholder={t('diagnoseV2.searchMakes')}
              placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
              value={makeSearch}
              onChangeText={handleMakeSearchChange}
              autoFocus
            />
          </View>

          {/* Loading */}
          {makesLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ActivityIndicator color={DIAGNOSTIC_COLORS.accent} />
              {showManualFallback && (
                <Pressable onPress={handleManualMakeFallback} style={{ marginTop: 12 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: DIAGNOSTIC_COLORS.accent,
                    }}
                  >
                    {t('diagnoseV2.cantLoadTypeManually')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Popular makes (when not searching) */}
          {!makesLoading && debouncedMakeSearch.length === 0 && popularMakes.length > 0 && (
            <View style={{ marginTop: 4, marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: DIAGNOSTIC_COLORS.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                {t('diagnoseV2.popularMakes')}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {popularMakes.map((make) => (
                  <Pressable
                    key={make.makeId}
                    onPress={() => handleMakeSelect(make)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed
                        ? DIAGNOSTIC_COLORS.cardBgSelected
                        : DIAGNOSTIC_COLORS.cardBg,
                      borderWidth: 1,
                      borderColor: DIAGNOSTIC_COLORS.cardBorder,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: DIAGNOSTIC_COLORS.textPrimary,
                        fontWeight: '500',
                      }}
                    >
                      {make.makeName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Filtered makes (when searching) */}
          {!makesLoading && debouncedMakeSearch.length > 0 && filteredMakes.length > 0 && (
            <View
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.cardBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                maxHeight: 200,
                overflow: 'hidden',
              }}
            >
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredMakes.slice(0, 20).map((make) => (
                  <Pressable
                    key={make.makeId}
                    onPress={() => handleMakeSelect(make)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: DIAGNOSTIC_COLORS.cardBorder,
                      backgroundColor: pressed ? DIAGNOSTIC_COLORS.cardBgSelected : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: DIAGNOSTIC_COLORS.textPrimary,
                      }}
                    >
                      {make.makeName}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* No results */}
          {!makesLoading && debouncedMakeSearch.length > 0 && filteredMakes.length === 0 && (
            <View style={{ paddingVertical: 8 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: DIAGNOSTIC_COLORS.textMuted,
                }}
              >
                {t('diagnoseV2.noMakesFound')}
              </Text>
              <Pressable onPress={handleManualMakeFallback} style={{ marginTop: 8 }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: DIAGNOSTIC_COLORS.accent,
                  }}
                >
                  {t('diagnoseV2.cantLoadTypeManually')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* --- MAKE FALLBACK (manual text input) --- */}
      {manualStep === 'make' && usingManualMakeFallback && (
        <View>
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
            style={{ ...inputStyle, marginBottom: 12 }}
            placeholder={t('diagnoseV2.iDontKnow')}
            placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
            value={manualMakeText}
            onChangeText={setManualMakeText}
            autoFocus
          />
          <Pressable
            onPress={() => {
              if (!manualMakeText.trim()) return;
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              store.setManualBikeInfo({
                ...store.manualBikeInfo,
                type: store.manualBikeInfo?.type ?? '',
                make: manualMakeText.trim(),
              });
              setManualStep('model');
              setUsingManualModelFallback(true);
            }}
            style={{
              backgroundColor: manualMakeText.trim()
                ? DIAGNOSTIC_COLORS.accent
                : 'rgba(255,255,255,0.08)',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              borderCurve: 'continuous',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
            disabled={!manualMakeText.trim()}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: manualMakeText.trim() ? '#FFFFFF' : DIAGNOSTIC_COLORS.textMuted,
              }}
            >
              {t('diagnoseV2.next')}
            </Text>
            <ChevronRight
              size={16}
              color={manualMakeText.trim() ? '#FFFFFF' : DIAGNOSTIC_COLORS.textMuted}
            />
          </Pressable>
        </View>
      )}

      {/* --- MODEL STEP --- */}
      {manualStep === 'model' && !usingManualModelFallback && (
        <View>
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

          {/* Already selected model chip */}
          {store.manualBikeInfo?.model ? (
            <Pressable
              onPress={() => {
                store.setManualBikeInfo({
                  ...store.manualBikeInfo,
                  type: store.manualBikeInfo?.type ?? '',
                  model: undefined,
                });
              }}
              style={{
                backgroundColor: DIAGNOSTIC_COLORS.cardBgSelected,
                borderWidth: 1,
                borderColor: DIAGNOSTIC_COLORS.accent,
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: DIAGNOSTIC_COLORS.textPrimary,
                  fontWeight: '600',
                }}
              >
                {store.manualBikeInfo.model}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: DIAGNOSTIC_COLORS.textMuted,
                }}
              >
                {t('diagnoseV2.tapToChange')}
              </Text>
            </Pressable>
          ) : (
            <>
              {/* Search input */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Search size={16} color={DIAGNOSTIC_COLORS.textMuted} />
                <TextInput
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={t('diagnoseV2.searchModel')}
                  placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
                  value={modelSearch}
                  onChangeText={handleModelSearchChange}
                  autoFocus
                />
              </View>

              {/* Loading */}
              {modelsLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <ActivityIndicator color={DIAGNOSTIC_COLORS.accent} />
                  {showManualFallback && (
                    <Pressable onPress={handleManualModelFallback} style={{ marginTop: 12 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          color: DIAGNOSTIC_COLORS.accent,
                        }}
                      >
                        {t('diagnoseV2.cantLoadTypeManually')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Filtered models list */}
              {!modelsLoading && filteredModels.length > 0 && (
                <View
                  style={{
                    backgroundColor: DIAGNOSTIC_COLORS.cardBg,
                    borderWidth: 1,
                    borderColor: DIAGNOSTIC_COLORS.cardBorder,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    maxHeight: 200,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredModels.slice(0, 30).map((model) => (
                      <Pressable
                        key={model.modelId}
                        onPress={() => handleModelSelect(model)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: DIAGNOSTIC_COLORS.cardBorder,
                          backgroundColor: pressed
                            ? DIAGNOSTIC_COLORS.cardBgSelected
                            : 'transparent',
                        })}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            color: DIAGNOSTIC_COLORS.textPrimary,
                          }}
                        >
                          {model.modelName}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* No results */}
              {!modelsLoading && debouncedModelSearch.length > 0 && filteredModels.length === 0 && (
                <View style={{ paddingVertical: 8 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: DIAGNOSTIC_COLORS.textMuted,
                    }}
                  >
                    {t('diagnoseV2.noModelsFound')}
                  </Text>
                  <Pressable onPress={handleManualModelFallback} style={{ marginTop: 8 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: DIAGNOSTIC_COLORS.accent,
                      }}
                    >
                      {t('diagnoseV2.cantLoadTypeManually')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* --- MODEL FALLBACK (manual text input) --- */}
      {manualStep === 'model' && usingManualModelFallback && !store.manualBikeInfo?.model && (
        <View>
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
            style={{ ...inputStyle, marginBottom: 12 }}
            placeholder={t('diagnoseV2.iDontKnow')}
            placeholderTextColor={DIAGNOSTIC_COLORS.textMuted}
            value={manualModelText}
            onChangeText={setManualModelText}
            autoFocus
          />
          <Pressable
            onPress={() => {
              if (!manualModelText.trim()) return;
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const detectedType = detectTypeFromModel(manualModelText.trim());
              store.setManualBikeInfo({
                ...store.manualBikeInfo,
                type: detectedType ?? store.manualBikeInfo?.type ?? '',
                model: manualModelText.trim(),
              });
            }}
            style={{
              backgroundColor: manualModelText.trim()
                ? DIAGNOSTIC_COLORS.accent
                : 'rgba(255,255,255,0.08)',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              borderCurve: 'continuous',
            }}
            disabled={!manualModelText.trim()}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: manualModelText.trim() ? '#FFFFFF' : DIAGNOSTIC_COLORS.textMuted,
              }}
            >
              {t('diagnoseV2.confirmModel')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Model fallback - already selected */}
      {manualStep === 'model' && usingManualModelFallback && store.manualBikeInfo?.model && (
        <View>
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
          <Pressable
            onPress={() => {
              setManualModelText(store.manualBikeInfo?.model ?? '');
              store.setManualBikeInfo({
                ...store.manualBikeInfo,
                type: store.manualBikeInfo?.type ?? '',
                model: undefined,
              });
            }}
            style={{
              backgroundColor: DIAGNOSTIC_COLORS.cardBgSelected,
              borderWidth: 1,
              borderColor: DIAGNOSTIC_COLORS.accent,
              borderRadius: 12,
              borderCurve: 'continuous',
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                color: DIAGNOSTIC_COLORS.textPrimary,
                fontWeight: '600',
              }}
            >
              {store.manualBikeInfo.model}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: DIAGNOSTIC_COLORS.textMuted,
              }}
            >
              {t('diagnoseV2.tapToChange')}
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

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

  const canProceed = store.selectedMotorcycleId || store.manualBikeInfo?.type;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step header */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 8,
            marginBottom: 24,
          }}
        >
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
          <Text
            style={{
              fontSize: 14,
              color: DIAGNOSTIC_COLORS.textMuted,
              marginTop: 4,
            }}
          >
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
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                    }}
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
                  <Text
                    style={{
                      fontSize: 14,
                      color: DIAGNOSTIC_COLORS.textSecondary,
                    }}
                  >
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

        {/* Manual bike form -- NHTSA-powered inline search */}
        {store.showManualForm && <ManualBikeForm />}
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
