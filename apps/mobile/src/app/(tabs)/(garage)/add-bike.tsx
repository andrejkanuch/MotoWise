import { palette } from '@motovault/design-system';
import {
  CreateMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function AddBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDark = useColorScheme() === 'dark';

  const [year, setYear] = useState('');
  const [selectedMake, setSelectedMake] = useState<{ makeId: number; makeName: string } | null>(
    null,
  );
  const [selectedModel, setSelectedModel] = useState<{
    modelId: number;
    modelName: string;
  } | null>(null);
  const [makeSearch, setMakeSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [nickname, setNickname] = useState('');

  const yearNum = Number.parseInt(year, 10);
  const validYear = year.length === 4 && yearNum >= 1900 && yearNum <= new Date().getFullYear() + 1;

  const handleYearChange = (text: string) => {
    setYear(text.replace(/[^0-9]/g, '').slice(0, 4));
    setSelectedModel(null);
    setModelSearch('');
  };

  // NHTSA queries
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const modelsResult = useQuery({
    queryKey: queryKeys.nhtsa.models({ makeId: selectedMake?.makeId ?? 0, year: yearNum }),
    queryFn: () =>
      gqlFetcher(MotorcycleModelsDocument, {
        makeId: selectedMake?.makeId ?? 0,
        year: yearNum,
      }),
    enabled: !!selectedMake && validYear,
  });

  const makes = makesResult.data?.motorcycleMakes ?? [];
  const filteredMakes = makes.filter((make: { makeName: string }) =>
    make.makeName.toLowerCase().includes(makeSearch.toLowerCase()),
  );
  const models = modelsResult.data?.motorcycleModels ?? [];
  const filteredModels = models.filter((model: { modelName: string }) =>
    model.modelName.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const handleSelectMake = (make: { makeId: number; makeName: string }) => {
    haptic();
    setSelectedMake(make);
    setSelectedModel(null);
    setMakeSearch('');
    setModelSearch('');
  };

  const handleSelectModel = (model: { modelId: number; modelName: string }) => {
    haptic();
    setSelectedModel(model);
    setModelSearch('');
  };

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (input: { year: number; make: string; model: string; nickname?: string }) =>
      gqlFetcher(CreateMotorcycleDocument, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const isValid = validYear && !!selectedMake && !!selectedModel;

  const handleSubmit = async () => {
    if (!isValid || isPending) return;

    try {
      await mutateAsync({
        year: yearNum,
        make: selectedMake.makeName,
        model: selectedModel.modelName,
        nickname: nickname.trim() || undefined,
      });
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    }
  };

  const inputStyle = {
    backgroundColor: isDark ? palette.neutral800 : palette.white,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: isDark ? palette.neutral50 : palette.neutral950,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.neutral500,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  };

  const dropdownBg = isDark ? palette.neutral800 : palette.white;
  const dropdownBorder = isDark ? palette.neutral700 : palette.neutral200;
  const pressedBg = isDark ? palette.neutral700 : palette.neutral100;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Year */}
      <Animated.View entering={FadeInUp.duration(300)} style={{ marginBottom: 20 }}>
        <Text style={labelStyle}>{t('garage.year')}</Text>
        <TextInput
          value={year}
          onChangeText={handleYearChange}
          placeholder={t('garage.yearPlaceholder')}
          placeholderTextColor={palette.neutral400}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="next"
          style={inputStyle}
        />
      </Animated.View>

      {/* Make */}
      <Animated.View entering={FadeInUp.delay(60).duration(300)} style={{ marginBottom: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          <Search size={14} color={palette.neutral500} />
          <Text style={{ ...labelStyle, marginBottom: 0, marginLeft: 0 }}>{t('garage.make')}</Text>
        </View>

        {makesResult.isLoading ? (
          <ActivityIndicator color={palette.primary500} style={{ marginVertical: 16 }} />
        ) : selectedMake && !makeSearch ? (
          <Pressable
            onPress={() => {
              setMakeSearch(selectedMake.makeName);
              setSelectedMake(null);
              setSelectedModel(null);
              setModelSearch('');
            }}
            style={{
              ...inputStyle,
              borderWidth: 1.5,
              borderColor: palette.primary500,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {selectedMake.makeName}
            </Text>
            <Text style={{ fontSize: 12, color: palette.neutral400 }}>
              {t('garage.tapToChange')}
            </Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              value={makeSearch}
              onChangeText={setMakeSearch}
              placeholder={t('garage.searchMake')}
              placeholderTextColor={palette.neutral400}
              autoCapitalize="words"
              style={inputStyle}
            />
            {makeSearch.length > 0 && filteredMakes.length > 0 ? (
              <View
                style={{
                  backgroundColor: dropdownBg,
                  borderWidth: 1,
                  borderColor: dropdownBorder,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  marginTop: 6,
                  maxHeight: 220,
                  overflow: 'hidden',
                }}
              >
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredMakes.slice(0, 20).map((make) => (
                    <Pressable
                      key={make.makeId}
                      onPress={() => handleSelectMake(make)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? palette.neutral700 : palette.neutral100,
                        backgroundColor: pressed ? pressedBg : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: isDark ? palette.neutral50 : palette.neutral950,
                        }}
                      >
                        {make.makeName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : makeSearch.length > 0 ? (
              <Text
                style={{ fontSize: 14, color: palette.neutral400, marginTop: 8, marginLeft: 4 }}
              >
                {t('garage.noMakesFound')}
              </Text>
            ) : null}
          </>
        )}
      </Animated.View>

      {/* Model */}
      <Animated.View entering={FadeInUp.delay(120).duration(300)} style={{ marginBottom: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          <Search size={14} color={palette.neutral500} />
          <Text style={{ ...labelStyle, marginBottom: 0, marginLeft: 0 }}>{t('garage.model')}</Text>
        </View>

        {!selectedMake || !validYear ? (
          <View
            style={{
              ...inputStyle,
              opacity: 0.4,
            }}
          >
            <Text style={{ fontSize: 16, color: palette.neutral400 }}>
              {t('garage.searchModel')}
            </Text>
          </View>
        ) : modelsResult.isLoading ? (
          <ActivityIndicator color={palette.primary500} style={{ marginVertical: 16 }} />
        ) : selectedModel && !modelSearch ? (
          <Pressable
            onPress={() => {
              setModelSearch(selectedModel.modelName);
              setSelectedModel(null);
            }}
            style={{
              ...inputStyle,
              borderWidth: 1.5,
              borderColor: palette.primary500,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {selectedModel.modelName}
            </Text>
            <Text style={{ fontSize: 12, color: palette.neutral400 }}>
              {t('garage.tapToChange')}
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
              placeholder={t('garage.searchModel')}
              placeholderTextColor={palette.neutral400}
              autoCapitalize="words"
              style={inputStyle}
            />
            {filteredModels.length > 0 ? (
              <View
                style={{
                  backgroundColor: dropdownBg,
                  borderWidth: 1,
                  borderColor: dropdownBorder,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  marginTop: 6,
                  maxHeight: 220,
                  overflow: 'hidden',
                }}
              >
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredModels.slice(0, 20).map((model) => (
                    <Pressable
                      key={model.modelId}
                      onPress={() => handleSelectModel(model)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? palette.neutral700 : palette.neutral100,
                        backgroundColor: pressed ? pressedBg : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: isDark ? palette.neutral50 : palette.neutral950,
                        }}
                      >
                        {model.modelName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : models.length > 0 && modelSearch.length > 0 ? (
              <Text
                style={{ fontSize: 14, color: palette.neutral400, marginTop: 8, marginLeft: 4 }}
              >
                {t('garage.noModelsFound')}
              </Text>
            ) : null}
          </>
        )}
      </Animated.View>

      {/* Nickname */}
      <Animated.View entering={FadeInUp.delay(180).duration(300)} style={{ marginBottom: 24 }}>
        <Text style={labelStyle}>{t('garage.nickname')}</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder={t('garage.nickname')}
          placeholderTextColor={palette.neutral400}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          style={inputStyle}
        />
      </Animated.View>

      {/* Submit */}
      <Animated.View entering={FadeInUp.delay(240).duration(300)}>
        <Pressable
          onPress={() => {
            haptic();
            handleSubmit();
          }}
          disabled={!isValid || isPending}
          style={{
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            opacity: !isValid || isPending ? 0.5 : 1,
          }}
        >
          <LinearGradient
            colors={[palette.primary600, palette.primary500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              gap: 8,
            }}
          >
            {isPending && <ActivityIndicator size="small" color={palette.white} />}
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
              {isPending ? t('garage.saving') : t('garage.addBike')}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}
