import {
  CreateMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useProGate } from '../../../hooks/use-pro-gate';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { GRAPHQL_ERROR_CODE } from '../../../lib/graphql-error-classification';
import {
  extractGraphQLMessage,
  hasGraphQLCode,
  userFriendlyError,
} from '../../../lib/graphql-errors';
import { MetaAnalytics } from '../../../lib/meta-analytics';
import { queryKeys } from '../../../lib/query-keys';
import { useEditorialTheme } from '../../../theme/editorial';
import { radius, space, type } from '../../../theme/type';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

const isBikeLimitRejection = (error: unknown) =>
  hasGraphQLCode(error, GRAPHQL_ERROR_CODE.FORBIDDEN);

export default function AddBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t: theme } = useEditorialTheme();
  const { requireAccess } = useProGate();

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
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');
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
    enabled: !!selectedMake && validYear && !customMake,
    // NHTSA models for a (makeId, year) never change — cached 7 days server-side.
    // Match the makes query so re-entering the flow doesn't re-hit the API.
    staleTime: Number.POSITIVE_INFINITY,
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
    onError: () => {}, // handled in handleSubmit try/catch
    // The free-tier bike limit comes back as FORBIDDEN and handleSubmit turns it into
    // the paywall — expected product behaviour, not a failure. FORBIDDEN stays
    // reportable everywhere else, where it would mean an authorization anomaly.
    // (MOTO-VAULT-REACT-NATIVE-2Y)
    meta: { skipSentryCapture: isBikeLimitRejection },
  });

  const isValid =
    validYear &&
    (!!selectedMake || !!customMake.trim()) &&
    (!!selectedModel || !!customModel.trim());

  const handleSubmit = async () => {
    if (!isValid || isPending) return;

    try {
      const make = customMake || selectedMake?.makeName || '';
      const model = customModel || selectedModel?.modelName || '';
      await mutateAsync({
        year: yearNum,
        make,
        model,
        nickname: nickname.trim() || undefined,
      });
      trackEvent(AnalyticsEvent.GARAGE_BIKE_ADDED, { make, model, year: yearNum });
      MetaAnalytics.trackAddToGarage(make, model, yearNum);
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch (e: unknown) {
      // requireAccess shows the paywall and returns false. It returns true when the
      // app already believes the rider is Pro (e.g. entitlement not yet synced to the
      // server's tier), and then the rider must still be told why nothing was saved.
      if (isBikeLimitRejection(e)) {
        if (!requireAccess('MAX_BIKES', Number.POSITIVE_INFINITY)) return;
        // The server's own wording says why ("Your free plan includes 1 motorcycle…");
        // the generic FORBIDDEN text would read as a permissions bug.
        Alert.alert(t('common.error'), extractGraphQLMessage(e) || userFriendlyError(e));
        return;
      }
      Alert.alert(t('common.error'), userFriendlyError(e));
    }
  };

  const inputStyle = {
    ...type.body,
    backgroundColor: theme.surface,
    borderRadius: radius.control,
    borderCurve: 'continuous' as const,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    color: theme.ink,
  };

  const labelStyle = {
    ...type.label,
    color: theme.ink2,
    marginBottom: space.xs,
    marginLeft: space.xxs,
  };

  const dropdownBg = theme.surface;
  const dropdownBorder = theme.line;
  const pressedBg = theme.surface2;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxxl }}
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
          placeholderTextColor={theme.ink3}
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
          <Search size={14} color={theme.ink3} />
          <Text style={{ ...labelStyle, marginBottom: 0, marginLeft: 0 }}>{t('garage.make')}</Text>
        </View>

        {makesResult.isLoading ? (
          <ActivityIndicator color={theme.warm} style={{ marginVertical: 16 }} />
        ) : customMake && !makeSearch ? (
          <Pressable
            onPress={() => {
              setMakeSearch(customMake);
              setCustomMake('');
              setSelectedModel(null);
              setModelSearch('');
              setCustomModel('');
            }}
            style={{
              ...inputStyle,
              borderWidth: 1.5,
              borderColor: theme.warm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.warm2,
                  fontWeight: '600',
                  marginBottom: 2,
                }}
              >
                {t('garage.customEntry', { defaultValue: 'Custom' })}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.ink,
                }}
              >
                {customMake}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: theme.ink3 }}>{t('garage.tapToChange')}</Text>
          </Pressable>
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
              borderColor: theme.warm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.ink,
              }}
            >
              {selectedMake.makeName}
            </Text>
            <Text style={{ fontSize: 12, color: theme.ink3 }}>{t('garage.tapToChange')}</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              value={makeSearch}
              onChangeText={setMakeSearch}
              placeholder={t('garage.searchMake')}
              placeholderTextColor={theme.ink3}
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
                        borderBottomColor: theme.line2,
                        backgroundColor: pressed ? pressedBg : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: theme.ink,
                        }}
                      >
                        {make.makeName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : makeSearch.length > 1 && filteredMakes.length === 0 ? (
              <>
                <Text style={{ fontSize: 14, color: theme.ink3, marginTop: 8, marginLeft: 4 }}>
                  {t('garage.noMakesFound')}
                </Text>
                <Pressable
                  onPress={() => {
                    haptic();
                    setCustomMake(makeSearch);
                    setSelectedMake(null);
                    setMakeSearch('');
                    setSelectedModel(null);
                    setModelSearch('');
                    setCustomModel('');
                  }}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    backgroundColor: pressed ? pressedBg : theme.surface,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: theme.warm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: theme.warm2,
                      fontWeight: '600',
                      flex: 1,
                    }}
                  >
                    {t('garage.useCustomMake', {
                      defaultValue: `Use "${makeSearch}"`,
                      make: makeSearch,
                    })}
                  </Text>
                </Pressable>
              </>
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
          <Search size={14} color={theme.ink3} />
          <Text style={{ ...labelStyle, marginBottom: 0, marginLeft: 0 }}>{t('garage.model')}</Text>
        </View>

        {(!selectedMake && !customMake) || !validYear ? (
          <View
            style={{
              ...inputStyle,
              opacity: 0.4,
            }}
          >
            <Text style={{ fontSize: 16, color: theme.ink3 }}>{t('garage.searchModel')}</Text>
          </View>
        ) : customMake ? (
          // Free-text model entry when using a custom make
          customModel && !modelSearch ? (
            <Pressable
              onPress={() => {
                setModelSearch(customModel);
                setCustomModel('');
              }}
              style={{
                ...inputStyle,
                borderWidth: 1.5,
                borderColor: theme.warm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.warm2,
                    fontWeight: '600',
                    marginBottom: 2,
                  }}
                >
                  {t('garage.customEntry', { defaultValue: 'Custom' })}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.ink,
                  }}
                >
                  {customModel}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.ink3 }}>{t('garage.tapToChange')}</Text>
            </Pressable>
          ) : (
            <TextInput
              value={modelSearch}
              onChangeText={(text) => {
                setModelSearch(text);
                setCustomModel(text);
              }}
              onBlur={() => {
                if (modelSearch.trim()) {
                  setCustomModel(modelSearch.trim());
                  setModelSearch('');
                }
              }}
              placeholder={t('garage.searchModel')}
              placeholderTextColor={theme.ink3}
              autoCapitalize="words"
              returnKeyType="done"
              style={inputStyle}
            />
          )
        ) : modelsResult.isLoading ? (
          <ActivityIndicator color={theme.warm} style={{ marginVertical: 16 }} />
        ) : selectedModel && !modelSearch ? (
          <Pressable
            onPress={() => {
              setModelSearch(selectedModel.modelName);
              setSelectedModel(null);
            }}
            style={{
              ...inputStyle,
              borderWidth: 1.5,
              borderColor: theme.warm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.ink,
              }}
            >
              {selectedModel.modelName}
            </Text>
            <Text style={{ fontSize: 12, color: theme.ink3 }}>{t('garage.tapToChange')}</Text>
          </Pressable>
        ) : customModel && !modelSearch ? (
          <Pressable
            onPress={() => {
              setModelSearch(customModel);
              setCustomModel('');
              setSelectedModel(null);
            }}
            style={{
              ...inputStyle,
              borderWidth: 1.5,
              borderColor: theme.warm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.warm2,
                  fontWeight: '600',
                  marginBottom: 2,
                }}
              >
                {t('garage.customEntry', { defaultValue: 'Custom' })}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.ink,
                }}
              >
                {customModel}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: theme.ink3 }}>{t('garage.tapToChange')}</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              value={modelSearch}
              onChangeText={(text) => {
                setModelSearch(text);
                setSelectedModel(null);
                setCustomModel('');
              }}
              placeholder={t('garage.searchModel')}
              placeholderTextColor={theme.ink3}
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
                        borderBottomColor: theme.line2,
                        backgroundColor: pressed ? pressedBg : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: theme.ink,
                        }}
                      >
                        {model.modelName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : modelSearch.length > 1 && filteredModels.length === 0 ? (
              <>
                {models.length > 0 && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: theme.ink3,
                      marginTop: 8,
                      marginLeft: 4,
                    }}
                  >
                    {t('garage.noModelsFound')}
                  </Text>
                )}
                <Pressable
                  onPress={() => {
                    haptic();
                    setCustomModel(modelSearch);
                    setSelectedModel(null);
                    setModelSearch('');
                  }}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    backgroundColor: pressed ? pressedBg : theme.surface,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: theme.warm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: theme.warm2,
                      fontWeight: '600',
                      flex: 1,
                    }}
                  >
                    {t('garage.useCustomModel', {
                      defaultValue: `Use "${modelSearch}"`,
                      model: modelSearch,
                    })}
                  </Text>
                </Pressable>
              </>
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
          placeholderTextColor={theme.ink3}
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
          <View
            style={{
              backgroundColor: theme.warm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
              gap: 8,
            }}
          >
            {isPending && <ActivityIndicator size="small" color={theme.onWarm} />}
            <Text style={{ ...type.bodyStrong, color: theme.onWarm }}>
              {isPending ? t('garage.saving') : t('garage.addBike')}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}
