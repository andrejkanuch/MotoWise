import {
  CreateMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motolearn/graphql';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, Calendar, ChevronRight, Search, SkipForward, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useMutation, useQuery } from 'urql';
import { ProgressBar } from '../../components/progress-bar';
import { useOnboardingStore } from '../../stores/onboarding.store';

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
  const [modelSearch, setModelSearch] = useState('');
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

  const filteredModels = models.filter((model) =>
    model.modelName.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const handleSelectMake = (make: { makeId: number; makeName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMake(make);
    setSelectedModel(null);
    setModelSearch('');
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

    if (result.error) {
      Alert.alert(t('common.error'), result.error.message);
      return;
    }
    setBikeData({
      year: yearNum,
      make: selectedMake.makeName,
      makeId: selectedMake.makeId,
      model: selectedModel.modelName,
      nickname: nickname.trim() || undefined,
    });
    router.push('/(onboarding)/riding-goals');
  };

  const handleSkip = () => {
    router.push('/(onboarding)/riding-goals');
  };

  const canContinue = selectedMake && selectedModel && validYear && !isCreating;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
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
            fontSize: 36,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}
        >
          {t('onboarding.addBikeTitle')}
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(500)}
          style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 24,
            marginBottom: 32,
          }}
        >
          {t('onboarding.addBikeSubtitle')}
        </Animated.Text>

        {/* Year input */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Calendar size={18} color="rgba(255,255,255,0.4)" />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('onboarding.yearPlaceholder')}
            </Text>
          </View>
          <TextInput
            value={year}
            onChangeText={handleYearChange}
            placeholder={t('onboarding.yearPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="number-pad"
            maxLength={4}
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 16,
              fontSize: 17,
              color: '#FFFFFF',
              marginBottom: 24,
            }}
          />
        </Animated.View>

        {/* Make search */}
        <Animated.View entering={FadeInUp.delay(280).duration(400)}>
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
              {t('onboarding.searchMake')}
            </Text>
          </View>
          <TextInput
            value={makeSearch}
            onChangeText={setMakeSearch}
            placeholder={t('onboarding.searchMake')}
            placeholderTextColor="rgba(255,255,255,0.25)"
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

        {/* Makes dropdown */}
        <Animated.View entering={FadeInUp.delay(360).duration(400)}>
          {makesResult.fetching ? (
            <ActivityIndicator color="#818CF8" style={{ marginVertical: 20 }} />
          ) : makesResult.error ? (
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
              {t('onboarding.makesLoadError')}
            </Text>
          ) : selectedMake && !makeSearch ? (
            <Pressable
              onPress={() => {
                setMakeSearch(selectedMake.makeName);
                setSelectedMake(null);
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
                {selectedMake.makeName}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {t('onboarding.tapToChange')}
              </Text>
            </Pressable>
          ) : makeSearch.length > 0 && filteredMakes.length > 0 ? (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                borderRadius: 16,
                borderCurve: 'continuous',
                marginBottom: 24,
                maxHeight: 220,
                overflow: 'hidden',
              }}
            >
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredMakes.slice(0, 20).map((make) => (
                  <Pressable
                    key={make.makeId}
                    onPress={() => {
                      handleSelectMake(make);
                      setMakeSearch('');
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                      backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
                    })}
                  >
                    <Text style={{ fontSize: 16, color: '#FFFFFF' }}>{make.makeName}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : makeSearch.length > 0 ? (
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              {t('onboarding.noMakesFound')}
            </Text>
          ) : (
            <View style={{ marginBottom: 24 }} />
          )}
        </Animated.View>

        {/* Model selector */}
        <Animated.View entering={FadeInUp.delay(440).duration(400)}>
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
              {t('onboarding.selectModel')}
            </Text>
          </View>
          {selectedMake && validYear ? (
            modelsResult.fetching ? (
              <ActivityIndicator color="#818CF8" style={{ marginVertical: 20 }} />
            ) : selectedModel && !modelSearch ? (
              <Pressable
                onPress={() => {
                  setModelSearch(selectedModel.modelName);
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
            ) : (
              <>
                <TextInput
                  value={modelSearch}
                  onChangeText={(text) => {
                    setModelSearch(text);
                    setSelectedModel(null);
                  }}
                  placeholder={t('onboarding.searchModel')}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.10)',
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 16,
                    fontSize: 17,
                    color: '#FFFFFF',
                    marginBottom: filteredModels.length > 0 ? 0 : 24,
                  }}
                />
                {filteredModels.length > 0 ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      marginTop: 8,
                      marginBottom: 24,
                      maxHeight: 220,
                      overflow: 'hidden',
                    }}
                  >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredModels.slice(0, 20).map((model) => (
                        <Pressable
                          key={model.modelId}
                          onPress={() => {
                            handleSelectModel(model);
                            setModelSearch('');
                          }}
                          style={({ pressed }) => ({
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.06)',
                            backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
                          })}
                        >
                          <Text style={{ fontSize: 16, color: '#FFFFFF' }}>
                            {model.modelName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : models.length > 0 && modelSearch.length > 0 ? (
                  <Text
                    style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.4)',
                      marginTop: 8,
                      marginBottom: 24,
                    }}
                  >
                    {t('onboarding.noModelsFound')}
                  </Text>
                ) : null}
              </>
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
                marginBottom: 24,
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <Tag size={18} color="rgba(255,255,255,0.4)" />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('onboarding.nicknamePlaceholder')}
            </Text>
          </View>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('onboarding.nicknamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
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
            backgroundColor: canContinue ? '#FFFFFF' : 'rgba(255,255,255,0.15)',
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
          {isCreating && <ActivityIndicator color="#0F172A" size="small" />}
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: canContinue ? '#0F172A' : 'rgba(255,255,255,0.4)',
            }}
          >
            {t('onboarding.continue')}
          </Text>
          {!isCreating && (
            <ChevronRight size={20} color={canContinue ? '#0F172A' : 'rgba(255,255,255,0.4)'} />
          )}
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => ({
            paddingVertical: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <SkipForward size={16} color="rgba(255,255,255,0.5)" />
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
