import { colors } from '@motolearn/design-system';
import {
  CreateMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motolearn/graphql';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useMutation, useQuery } from 'urql';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { ProgressBar } from './progress-bar';

export default function SelectBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);

  const [year, setYear] = useState('');
  const [selectedMake, setSelectedMake] = useState<{
    makeId: number;
    makeName: string;
  } | null>(null);
  const [selectedModel, setSelectedModel] = useState<{
    modelId: number;
    modelName: string;
  } | null>(null);
  const [makeSearch, setMakeSearch] = useState('');
  const [nickname, setNickname] = useState('');

  const handleYearChange = (text: string) => {
    setYear(text);
    setSelectedModel(null);
  };

  const [makesResult] = useQuery({ query: MotorcycleMakesDocument });
  const yearNum = Number.parseInt(year, 10);
  const validYear = year.length === 4 && yearNum >= 1900 && yearNum <= new Date().getFullYear() + 1;

  const [modelsResult] = useQuery({
    query: MotorcycleModelsDocument,
    variables: { makeId: selectedMake?.makeId ?? 0, year: yearNum },
    pause: !selectedMake || !validYear,
  });

  const [, createMotorcycle] = useMutation(CreateMotorcycleDocument);

  const makes = makesResult.data?.motorcycleMakes ?? [];
  const filteredMakes = makes.filter((make) =>
    make.makeName.toLowerCase().includes(makeSearch.toLowerCase()),
  );
  const models = modelsResult.data?.motorcycleModels ?? [];

  const handleSelectMake = (make: { makeId: number; makeName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMake(make);
    setSelectedModel(null);
  };

  const handleSelectModel = (model: { modelId: number; modelName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedModel(model);
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleContinue = async () => {
    if (!selectedMake || !selectedModel || !validYear) return;
    setIsCreating(true);
    const result = await createMotorcycle({
      input: {
        make: selectedMake.makeName,
        model: selectedModel.modelName,
        year: yearNum,
        nickname: nickname.trim() || undefined,
      },
    });
    setIsCreating(false);

    if (!result.error) {
      setBikeData({
        year: yearNum,
        make: selectedMake.makeName,
        makeId: selectedMake.makeId,
        model: selectedModel.modelName,
        nickname: nickname.trim() || undefined,
      });
      router.push('/(onboarding)/riding-goals');
    }
  };

  const handleSkip = () => {
    router.push('/(onboarding)/riding-goals');
  };

  const canContinue = selectedMake && selectedModel && validYear && !isCreating;

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary[950] }}>
      <ProgressBar step={2} total={4} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInDown.duration(500)}
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: 8,
          }}
        >
          {t('onboarding.addBikeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(500)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 32,
          }}
        >
          {t('onboarding.addBikeSubtitle')}
        </Animated.Text>

        {/* Year input */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <TextInput
            value={year}
            onChangeText={handleYearChange}
            placeholder={t('onboarding.yearPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="number-pad"
            maxLength={4}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
              marginBottom: 20,
            }}
          />
        </Animated.View>

        {/* Make search */}
        <Animated.View entering={FadeInUp.delay(280).duration(400)}>
          <TextInput
            value={makeSearch}
            onChangeText={setMakeSearch}
            placeholder={t('onboarding.searchMake')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
              marginBottom: 12,
            }}
          />
        </Animated.View>

        {/* Makes chip grid */}
        <Animated.View entering={FadeInUp.delay(360).duration(400)}>
          {makesResult.fetching ? (
            <ActivityIndicator color={colors.primary[400]} style={{ marginVertical: 20 }} />
          ) : makesResult.error ? (
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
              {t('onboarding.makesLoadError')}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {filteredMakes.map((make) => {
                const isSelected = selectedMake?.makeId === make.makeId;
                return (
                  <Pressable
                    key={make.makeId}
                    onPress={() => handleSelectMake(make)}
                    style={({ pressed }) => ({
                      backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: isSelected ? colors.primary[950] : '#FFFFFF',
                      }}
                    >
                      {make.makeName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Model selector */}
        <Animated.View entering={FadeInUp.delay(440).duration(400)}>
          {selectedMake && validYear ? (
            modelsResult.fetching ? (
              <ActivityIndicator color={colors.primary[400]} style={{ marginVertical: 20 }} />
            ) : models.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {models.map((model) => {
                  const isSelected = selectedModel?.modelId === model.modelId;
                  return (
                    <Pressable
                      key={model.modelId}
                      onPress={() => handleSelectModel(model)}
                      style={({ pressed }) => ({
                        backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: isSelected ? colors.primary[950] : '#FFFFFF',
                        }}
                      >
                        {model.modelName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
                  {t('onboarding.noModelsFound')}
                </Text>
              </View>
            )
          ) : (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                marginBottom: 20,
                opacity: 0.4,
              }}
            >
              <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.35)' }}>
                {t('onboarding.selectModel')}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Nickname */}
        <Animated.View entering={FadeInUp.delay(520).duration(400)}>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('onboarding.nicknamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
            }}
          />
        </Animated.View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 12 }}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={({ pressed }) => ({
            backgroundColor: canContinue ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          })}
        >
          {isCreating && <ActivityIndicator color={colors.primary[950]} size="small" />}
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: canContinue ? colors.primary[950] : 'rgba(255,255,255,0.4)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => ({
            paddingVertical: 12,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {t('onboarding.skipForNow')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
