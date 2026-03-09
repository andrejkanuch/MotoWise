import { MotorcycleModelsDocument } from '@motolearn/graphql';
import { MotorcycleType } from '@motolearn/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, ChevronRight, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { TOTAL_SCREENS } from './config';

function detectTypeFromModel(modelName: string): MotorcycleType | null {
  const lower = modelName.toLowerCase();
  if (/ninja|cbr|yzf-r|gsxr|gsx-r|zx|rc\d|panigale|rsv|daytona/i.test(lower))
    return MotorcycleType.SPORTBIKE;
  if (/vulcan|shadow|rebel|scout|sportster|fatboy|softail|dyna|iron\s?\d/i.test(lower))
    return MotorcycleType.CRUISER;
  if (/goldwing|gold wing|electra|road king|road glide|voyager|k\s?1600/i.test(lower))
    return MotorcycleType.TOURING;
  if (/dr-z|drz|klx|crf|wr\d|xr\d|rally|tenere|versys|v-strom|vstrom|tiger|adventure/i.test(lower))
    return MotorcycleType.DUAL_SPORT;
  if (/crf\d+f|yz\d+f|kx\d+|rm-z|rmz|tc\d|fc\d|sx|exc/i.test(lower))
    return MotorcycleType.DIRT_BIKE;
  if (/scooter|vespa|pcx|nmax|xmax|burgman|forza|metropolitan|scoopy/i.test(lower))
    return MotorcycleType.SCOOTER;
  return null;
}

export default function BikeModelScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);

  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<{
    modelId: number;
    modelName: string;
  } | null>(
    existingBikeData?.model && existingBikeData.model !== ''
      ? { modelId: 0, modelName: existingBikeData.model }
      : null,
  );
  const [customModel, setCustomModel] = useState('');

  const makeId = existingBikeData?.makeId ?? 0;
  const year = existingBikeData?.year ?? 0;

  const modelsResult = useQuery({
    queryKey: queryKeys.nhtsa.models({ makeId, year }),
    queryFn: () =>
      gqlFetcher(MotorcycleModelsDocument, {
        makeId,
        year,
      }),
    enabled: makeId > 0 && year > 0,
  });

  const models = modelsResult.data?.motorcycleModels ?? [];

  const filteredModels =
    search.length > 0
      ? models.filter((model) => model.modelName.toLowerCase().includes(search.toLowerCase()))
      : models;

  const noApiResults = modelsResult.isSuccess && models.length === 0;
  const noSearchResults = search.length > 0 && filteredModels.length === 0 && models.length > 0;

  const handleSelectModel = (model: { modelId: number; modelName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedModel(model);
    setSearch('');
    setCustomModel('');
  };

  const handleContinue = () => {
    if (!existingBikeData) return;

    const modelName = selectedModel?.modelName || customModel.trim();
    if (!modelName) return;

    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const detectedType = detectTypeFromModel(modelName);

    setBikeData({
      ...existingBikeData,
      model: modelName,
      ...(detectedType ? { type: detectedType } : {}),
    });
    router.replace('/(onboarding)/bike-type');
  };

  const canContinue = !!(selectedModel?.modelName || customModel.trim());

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <OnboardingProgress screenIndex={4} totalScreens={TOTAL_SCREENS} />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48 }}>
        <Animated.Text
          entering={FadeInDown.duration(300)}
          style={{
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          {t('onboarding.bikeModelTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(300)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 24,
            marginBottom: 32,
          }}
        >
          {existingBikeData?.year} {existingBikeData?.make}
        </Animated.Text>

        {/* Selected model chip */}
        {selectedModel && !search ? (
          <Animated.View entering={FadeInUp.delay(150).duration(300)}>
            <Pressable
              onPress={() => {
                setSearch(selectedModel.modelName);
                setSelectedModel(null);
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: '#818CF8',
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                marginBottom: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 17, color: '#FFFFFF', fontWeight: '600' }}>
                {selectedModel.modelName}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {t('onboarding.tapToChange')}
              </Text>
            </Pressable>
          </Animated.View>
        ) : !noApiResults ? (
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('onboarding.searchModel')}
              </Text>
            </View>
            <TextInput
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                setSelectedModel(null);
                setCustomModel('');
              }}
              placeholder={t('onboarding.searchModel')}
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoFocus
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                fontSize: 17,
                color: '#FFFFFF',
                marginBottom: 12,
              }}
            />
          </Animated.View>
        ) : null}

        {/* Loading */}
        {modelsResult.isLoading && (
          <ActivityIndicator color="#818CF8" style={{ marginVertical: 20 }} />
        )}

        {/* Error with retry */}
        {modelsResult.isError && (
          <View style={{ alignItems: 'center', marginVertical: 20, gap: 12 }}>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
              {t('onboarding.modelsLoadError')}
            </Text>
            <Pressable
              onPress={() => modelsResult.refetch()}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#818CF8' }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Models list */}
        {!selectedModel && filteredModels.length > 0 && !modelsResult.isLoading && (
          <Animated.View entering={FadeInUp.duration(200)} style={{ flex: 1 }}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                borderRadius: 16,
                borderCurve: 'continuous',
                flex: 1,
                maxHeight: 340,
                overflow: 'hidden',
              }}
            >
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredModels.slice(0, 30).map((model) => (
                  <Pressable
                    key={model.modelId}
                    onPress={() => handleSelectModel(model)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                      backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
                    })}
                  >
                    <Text style={{ fontSize: 16, color: '#FFFFFF' }}>{model.modelName}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* No search results within existing models */}
        {noSearchResults && (
          <Text
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.4)',
              marginTop: 4,
            }}
          >
            {t('onboarding.noModelsFound')}
          </Text>
        )}

        {/* No API results — free-text input */}
        {noApiResults && !selectedModel && (
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Bike size={18} color="rgba(255,255,255,0.4)" />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t('onboarding.enterModelManually')}
              </Text>
            </View>
            <TextInput
              value={customModel}
              onChangeText={setCustomModel}
              placeholder={t('onboarding.modelPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoFocus
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                fontSize: 17,
                color: '#FFFFFF',
                marginBottom: 12,
              }}
            />
            <Text
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.4)',
                fontStyle: 'italic',
              }}
            >
              {t('onboarding.modelNotInDatabase')}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Continue button */}
      {canContinue && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
          <Animated.View entering={FadeInUp.duration(250)}>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => ({
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}>
                {t('onboarding.continue')}
              </Text>
              <ChevronRight size={20} color="#0F172A" />
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
