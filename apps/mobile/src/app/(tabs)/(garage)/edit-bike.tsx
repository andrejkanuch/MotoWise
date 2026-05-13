import { palette } from '@motovault/design-system';
import {
  DeleteMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Bike,
  Camera,
  Check,
  DollarSign,
  Fingerprint,
  Gauge,
  Search,
  Star,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../../hooks/use-currency';
import { gqlFetcher } from '../../../lib/graphql-client';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../lib/image-upload';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';
export default function EditBikeScreen() {
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t: theme, isDark } = useEditorialTheme();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);

  // --- Data ---
  const { data } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const bike = (data?.myMotorcycles ?? []).find((m: { id: string }) => m.id === id);

  // --- Form state ---
  const [nickname, setNickname] = useState('');
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
  const [isPrimary, setIsPrimary] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [vin, setVin] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Keep initial values for dirty detection
  const initialValues = useRef({
    nickname: '',
    year: '',
    make: '',
    model: '',
    isPrimary: false,
    photoUrl: null as string | null,
    purchasePrice: '',
    vin: '',
  });

  // --- NHTSA queries ---
  const yearNum = Number.parseInt(year, 10);
  const validYear = year.length === 4 && yearNum >= 1900 && yearNum <= new Date().getFullYear() + 1;

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
  const filteredMakes = makes.filter((m: { makeName: string }) =>
    m.makeName.toLowerCase().includes(makeSearch.toLowerCase()),
  );
  const models = modelsResult.data?.motorcycleModels ?? [];
  const filteredModels = models.filter((m: { modelName: string }) =>
    m.modelName.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  // --- Initialize form from bike data ---
  useEffect(() => {
    if (bike && !initialized) {
      const vals = {
        nickname: bike.nickname ?? '',
        year: String(bike.year),
        make: bike.make,
        model: bike.model,
        isPrimary: bike.isPrimary,
        photoUrl: bike.primaryPhotoUrl ?? null,
        purchasePrice: bike.purchasePrice != null ? String(bike.purchasePrice) : '',
        vin: bike.vin ?? '',
      };
      initialValues.current = vals;
      setNickname(vals.nickname);
      setYear(vals.year);
      setIsPrimary(vals.isPrimary);
      setPhotoUrl(vals.photoUrl);
      setPurchasePrice(vals.purchasePrice);
      setVin(vals.vin);
      setInitialized(true);
    }
  }, [bike, initialized]);

  // Match make from NHTSA list once makes are loaded
  useEffect(() => {
    if (bike && initialized && makes.length > 0 && !selectedMake) {
      const found = makes.find(
        (m: { makeName: string }) => m.makeName.toLowerCase() === bike.make.toLowerCase(),
      );
      if (found) {
        setSelectedMake({ makeId: found.makeId, makeName: found.makeName });
      }
    }
  }, [bike, initialized, makes, selectedMake]);

  // Match model from NHTSA list once models are loaded
  useEffect(() => {
    if (bike && initialized && models.length > 0 && !selectedModel) {
      const found = models.find(
        (m: { modelName: string }) => m.modelName.toLowerCase() === bike.model.toLowerCase(),
      );
      if (found) {
        setSelectedModel({ modelId: found.modelId, modelName: found.modelName });
      }
    }
  }, [bike, initialized, models, selectedModel]);

  const makeName = selectedMake?.makeName ?? bike?.make ?? '';
  const modelName = selectedModel?.modelName ?? bike?.model ?? '';

  // --- Dirty detection ---
  const isDirty = useMemo(() => {
    if (!initialized) return false;
    const init = initialValues.current;
    return (
      nickname !== init.nickname ||
      year !== init.year ||
      makeName !== init.make ||
      modelName !== init.model ||
      isPrimary !== init.isPrimary ||
      photoUrl !== init.photoUrl ||
      purchasePrice !== init.purchasePrice ||
      vin !== init.vin
    );
  }, [
    nickname,
    year,
    makeName,
    modelName,
    isPrimary,
    photoUrl,
    purchasePrice,
    vin,
    initialized,
  ]);

  // MOT-142: VIN is 17 chars from {A-H,J-N,P-R,0-9} (no I, O, Q)
  const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
  const vinTrimmed = vin.trim().toUpperCase();
  const vinIsValid = vinTrimmed.length === 0 || VIN_REGEX.test(vinTrimmed);
  const isValid = makeName.length > 0 && modelName.length > 0 && vinIsValid;

  // --- Unsaved changes guard ---
  const navigation = useNavigation();
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      Alert.alert(
        t('garage.discardChangesTitle', { defaultValue: 'Discard changes?' }),
        t('garage.discardChangesMessage', {
          defaultValue: 'You have unsaved changes. Are you sure you want to leave?',
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('garage.discard', { defaultValue: 'Discard' }),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, t]);

  // --- Mutations ---
  const updateMutation = useMutation({
    mutationFn: () => {
      const yearNum = Number.parseInt(year, 10);
      return gqlFetcher(UpdateMotorcycleDocument, {
        id,
        input: {
          nickname: nickname.trim() || null,
          year: Number.isNaN(yearNum) ? undefined : yearNum,
          make: makeName,
          model: modelName,
          isPrimary,
          ...(photoUrl !== initialValues.current.photoUrl && photoUrl
            ? { primaryPhotoUrl: photoUrl }
            : {}),
          ...(purchasePrice !== initialValues.current.purchasePrice
            ? {
                purchasePrice: purchasePrice.trim() ? Number.parseFloat(purchasePrice) : null,
              }
            : {}),
          ...(vinTrimmed !== initialValues.current.vin
            ? { vin: vinTrimmed.length === 17 ? vinTrimmed : null }
            : {}),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.all });
      isDirtyRef.current = false;
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.all });
      isDirtyRef.current = false;
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
      router.dismiss(2);
    },
  });

  // --- Save handler ---
  const handleSave = useCallback(() => {
    if (!isDirty || !isValid || updateMutation.isPending) return;
    triggerImpact();
    updateMutation.mutate();
  }, [isDirty, isValid, updateMutation]);

  // --- Photo picker ---
  const handlePickPhoto = () => {
    triggerImpact();
    const userId = session?.user?.id;
    if (!userId) return;

    const upload = async (uri: string) => {
      try {
        setUploadingPhoto(true);
        const { publicUrl } = await uploadBikePhoto(uri, userId, id);
        setPhotoUrl(publicUrl);
      } catch (_e) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('garage.photoUploadFailed', { defaultValue: 'Failed to upload photo' }),
        );
      } finally {
        setUploadingPhoto(false);
      }
    };

    if (process.env.EXPO_OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t('common.cancel', { defaultValue: 'Cancel' }),
            t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
            t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
          ],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const uri = await takePhoto();
            if (uri) upload(uri);
          } else if (buttonIndex === 2) {
            const uri = await pickImage();
            if (uri) upload(uri);
          }
        },
      );
    } else {
      Alert.alert(t('garage.changePhoto', { defaultValue: 'Change Photo' }), undefined, [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) upload(uri);
          },
        },
        {
          text: t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
          onPress: async () => {
            const uri = await pickImage();
            if (uri) upload(uri);
          },
        },
      ]);
    }
  };

  // --- Delete handler ---
  const handleDelete = () => {
    triggerImpact();
    const bikeName = bike ? `${bike.year} ${bike.make} ${bike.model}` : '';
    if (process.env.EXPO_OS === 'ios') {
      Alert.prompt(
        t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
        t('garage.typeToConfirmDelete', {
          defaultValue: `This will permanently delete all maintenance tasks, expenses, and photos.\n\nType "${bikeName}" to confirm.`,
          bikeName,
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('common.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: (value: string | undefined) => {
              if (value?.trim() === bikeName) {
                deleteMutation.mutate();
              } else {
                Alert.alert(
                  t('garage.deleteNameMismatch', { defaultValue: 'Name does not match' }),
                  t('garage.deleteNameMismatchMessage', {
                    defaultValue: 'Please type the exact bike name to confirm deletion.',
                  }),
                );
              }
            },
          },
        ],
        'plain-text',
        '',
      );
    } else {
      Alert.alert(
        t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' }),
        t('garage.confirmDeletePermanent', {
          defaultValue:
            'This will permanently delete all maintenance tasks, expenses, and photos. Are you sure?',
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('common.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: () => deleteMutation.mutate(),
          },
        ],
      );
    }
  };

  // --- Styles ---
  const cardBg = theme.surface;
  const textColor = theme.ink;
  const separator = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const sectionLabel = {
    fontSize: 10 as const,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.ink3,
    marginBottom: 8,
    marginLeft: 4,
  };

  const cardStyle = {
    backgroundColor: cardBg,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    overflow: 'hidden' as const,
    boxShadow: isDark ? 'none' : ('0 1px 3px rgba(0,0,0,0.06)' as const),
  };

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  };

  const iconBadge = (bg: string) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous' as const,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });

  const rowLabel = {
    fontSize: 15,
    fontWeight: '500' as const,
    color: textColor,
    flex: 1,
  };

  const inputInRow = {
    fontSize: 15,
    fontWeight: '500' as const,
    color: textColor,
    minWidth: 100,
    paddingVertical: 4,
    textAlign: 'right' as const,
  };

  const dropdownContainer = {
    backgroundColor: cardBg,
    borderWidth: 1,
    borderColor: isDark ? palette.neutral700 : palette.neutral200,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    marginTop: 6,
    maxHeight: 220,
    overflow: 'hidden' as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={!isDirty || !isValid || updateMutation.isPending}
              hitSlop={8}
              style={{
                backgroundColor:
                  isDirty && isValid
                    ? theme.warm
                    : isDark
                      ? palette.neutral700
                      : palette.neutral200,
                paddingHorizontal: 16,
                paddingVertical: 7,
                borderRadius: 18,
                borderCurve: 'continuous',
                opacity: isDirty && isValid ? 1 : 0.5,
              }}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: isDirty && isValid ? palette.white : theme.ink3,
                  }}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Photo Section ─── */}
        <Animated.View entering={FadeIn.duration(300)}>
          <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {photoUrl ? (
              <View style={{ height: 220, position: 'relative' }}>
                <Image
                  source={{ uri: photoUrl }}
                  style={{ width: '100%', height: 220 }}
                  contentFit="cover"
                />
                {uploadingPhoto && (
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator size="large" color={palette.white} />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', theme.bg]}
                  locations={[0.5, 1]}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 80,
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: 20,
                    borderCurve: 'continuous',
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={20} color={palette.white} strokeWidth={2} />
                </View>
              </View>
            ) : (
              <View
                style={{
                  height: 180,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: theme.surface,
                }}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="large" color={theme.warm} />
                ) : (
                  <>
                    <Camera size={36} color={theme.ink3} strokeWidth={1.5} />
                    <Text style={{ fontSize: 15, color: theme.ink3, fontWeight: '500' }}>
                      {t('garage.addPhoto', { defaultValue: 'Add Photo' })}
                    </Text>
                  </>
                )}
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Editorial header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 6,
            }}
          >
            — GARAGE
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 32,
                color: theme.ink,
                letterSpacing: -0.6,
              }}
            >
              Edit{' '}
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Italic',
                fontSize: 32,
                color: theme.warm,
                letterSpacing: -0.6,
              }}
            >
              motorcycle.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 24 }}>
          {/* ─── Identity — grouped card ─── */}
          <Animated.View entering={FadeInDown.delay(50).duration(250)}>
            <Text style={sectionLabel}>
              {t('garage.identitySection', { defaultValue: 'Identity' })}
            </Text>
            <View style={cardStyle}>
              {/* Nickname */}
              <View style={rowStyle}>
                <View style={iconBadge(isDark ? palette.primary900 : palette.primary50)}>
                  <Bike size={16} color={palette.primary500} strokeWidth={2} />
                </View>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder={t('garage.nicknamePlaceholder', {
                    defaultValue: 'e.g. "Black Beauty"',
                  })}
                  placeholderTextColor={palette.neutral400}
                  style={{ ...rowLabel, paddingVertical: 2 }}
                />
              </View>

              <View style={{ height: 0.5, backgroundColor: separator, marginLeft: 60 }} />

              {/* Year */}
              <View style={rowStyle}>
                <View style={iconBadge(isDark ? palette.successBgDark : palette.successBgLight)}>
                  <Gauge size={16} color={palette.success500} strokeWidth={2} />
                </View>
                <Text style={rowLabel}>{t('garage.year', { defaultValue: 'Year' })}</Text>
                <TextInput
                  value={year}
                  onChangeText={(text) => {
                    setYear(text.replace(/[^0-9]/g, '').slice(0, 4));
                    setSelectedModel(null);
                    setModelSearch('');
                  }}
                  keyboardType="number-pad"
                  placeholder={t('garage.yearExamplePlaceholder')}
                  placeholderTextColor={palette.neutral400}
                  maxLength={4}
                  style={inputInRow}
                />
              </View>
            </View>
          </Animated.View>

          {/* ─── Make & Model ─── */}
          <Animated.View entering={FadeInDown.delay(100).duration(250)}>
            <Text style={sectionLabel}>
              {t('garage.makeModel', { defaultValue: 'Make & Model' })}
            </Text>

            {/* Make */}
            <View style={cardStyle}>
              {makesResult.isLoading ? (
                <View style={{ ...rowStyle, justifyContent: 'center' }}>
                  <ActivityIndicator color={theme.warm} />
                </View>
              ) : selectedMake && !makeSearch ? (
                <Pressable
                  onPress={() => {
                    setMakeSearch(selectedMake.makeName);
                    setSelectedMake(null);
                    setSelectedModel(null);
                    setModelSearch('');
                  }}
                  style={rowStyle}
                >
                  <View style={iconBadge(isDark ? palette.indigoBg : palette.primary50)}>
                    <Search size={16} color={palette.indigo500} strokeWidth={2} />
                  </View>
                  <Text style={rowLabel}>{selectedMake.makeName}</Text>
                  <Text style={{ fontSize: 12, color: theme.ink3 }}>
                    {t('garage.tapToChange', { defaultValue: 'Tap to change' })}
                  </Text>
                </Pressable>
              ) : (
                <View style={rowStyle}>
                  <View style={iconBadge(isDark ? palette.indigoBg : palette.primary50)}>
                    <Search size={16} color={palette.indigo500} strokeWidth={2} />
                  </View>
                  <TextInput
                    value={makeSearch}
                    onChangeText={setMakeSearch}
                    placeholder={t('garage.searchMake', { defaultValue: 'Search make...' })}
                    placeholderTextColor={palette.neutral400}
                    autoCapitalize="words"
                    style={{ ...rowLabel, paddingVertical: 2 }}
                  />
                </View>
              )}

              <View style={{ height: 0.5, backgroundColor: separator, marginLeft: 60 }} />

              {/* Model */}
              {!selectedMake || !validYear ? (
                <View style={{ ...rowStyle, opacity: 0.4 }}>
                  <View style={iconBadge(isDark ? palette.indigoBg : palette.primary50)}>
                    <Search size={16} color={palette.indigo500} strokeWidth={2} />
                  </View>
                  <Text style={rowLabel}>
                    {t('garage.searchModel', { defaultValue: 'Search model...' })}
                  </Text>
                </View>
              ) : modelsResult.isLoading ? (
                <View style={{ ...rowStyle, justifyContent: 'center' }}>
                  <ActivityIndicator color={theme.warm} />
                </View>
              ) : selectedModel && !modelSearch ? (
                <Pressable
                  onPress={() => {
                    setModelSearch(selectedModel.modelName);
                    setSelectedModel(null);
                  }}
                  style={rowStyle}
                >
                  <View style={iconBadge(isDark ? palette.indigoBg : palette.primary50)}>
                    <Search size={16} color={palette.indigo500} strokeWidth={2} />
                  </View>
                  <Text style={rowLabel}>{selectedModel.modelName}</Text>
                  <Text style={{ fontSize: 12, color: theme.ink3 }}>
                    {t('garage.tapToChange', { defaultValue: 'Tap to change' })}
                  </Text>
                </Pressable>
              ) : (
                <View style={rowStyle}>
                  <View style={iconBadge(isDark ? palette.indigoBg : palette.primary50)}>
                    <Search size={16} color={palette.indigo500} strokeWidth={2} />
                  </View>
                  <TextInput
                    value={modelSearch}
                    onChangeText={(text) => {
                      setModelSearch(text);
                      setSelectedModel(null);
                    }}
                    placeholder={t('garage.searchModel', { defaultValue: 'Search model...' })}
                    placeholderTextColor={palette.neutral400}
                    autoCapitalize="words"
                    style={{ ...rowLabel, paddingVertical: 2 }}
                  />
                </View>
              )}
            </View>

            {/* Make dropdown */}
            {!selectedMake && makeSearch.length > 0 && filteredMakes.length > 0 && (
              <View style={dropdownContainer}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredMakes.slice(0, 20).map((m: { makeId: number; makeName: string }) => (
                    <Pressable
                      key={m.makeId}
                      onPress={() => {
                        triggerImpact();
                        setSelectedMake(m);
                        setSelectedModel(null);
                        setMakeSearch('');
                        setModelSearch('');
                      }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        borderBottomWidth: 0.5,
                        borderBottomColor: separator,
                        backgroundColor: pressed
                          ? isDark
                            ? palette.neutral700
                            : palette.neutral100
                          : 'transparent',
                      })}
                    >
                      <Text style={{ fontSize: 15, color: textColor }}>{m.makeName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {!selectedMake && makeSearch.length > 0 && filteredMakes.length === 0 && (
              <Text style={{ fontSize: 13, color: theme.ink3, marginTop: 8, marginLeft: 4 }}>
                {t('garage.noMakesFound', { defaultValue: 'No makes found' })}
              </Text>
            )}

            {/* Model dropdown */}
            {selectedMake && !selectedModel && filteredModels.length > 0 && (
              <View style={{ ...dropdownContainer, marginTop: 6 }}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredModels.slice(0, 20).map((m: { modelId: number; modelName: string }) => (
                    <Pressable
                      key={m.modelId}
                      onPress={() => {
                        triggerImpact();
                        setSelectedModel(m);
                        setModelSearch('');
                      }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        borderBottomWidth: 0.5,
                        borderBottomColor: separator,
                        backgroundColor: pressed
                          ? isDark
                            ? palette.neutral700
                            : palette.neutral100
                          : 'transparent',
                      })}
                    >
                      <Text style={{ fontSize: 15, color: textColor }}>{m.modelName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {selectedMake &&
              !selectedModel &&
              models.length > 0 &&
              modelSearch.length > 0 &&
              filteredModels.length === 0 && (
                <Text style={{ fontSize: 13, color: theme.ink3, marginTop: 8, marginLeft: 4 }}>
                  {t('garage.noModelsFound', { defaultValue: 'No models found' })}
                </Text>
              )}
          </Animated.View>

          {/* ─── Purchase Info — grouped card ─── */}
          <Animated.View entering={FadeInDown.delay(150).duration(250)}>
            <Text style={sectionLabel}>
              {t('garage.purchaseInfoSection', { defaultValue: 'Purchase Info' })}
            </Text>
            <View style={cardStyle}>
              {/* Purchase price */}
              <View style={rowStyle}>
                <View style={iconBadge(isDark ? palette.successBgDark : palette.successBgLight)}>
                  <DollarSign size={16} color={palette.success500} strokeWidth={2} />
                </View>
                <Text style={rowLabel}>{t('garage.purchasePrice', { defaultValue: 'Price' })}</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }}>
                  {currencySymbol}
                </Text>
                <TextInput
                  value={purchasePrice}
                  onChangeText={(text) => {
                    const digits = text.replace(/[^0-9.]/g, '');
                    const parts = digits.split('.');
                    if (parts.length > 2) return;
                    if (parts[1] && parts[1].length > 2) return;
                    setPurchasePrice(digits);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={t('garage.pricePlaceholder')}
                  placeholderTextColor={palette.neutral400}
                  style={inputInRow}
                />
              </View>

              <View style={{ height: 0.5, backgroundColor: separator, marginLeft: 60 }} />

              {/* VIN */}
              <View style={rowStyle}>
                <View style={iconBadge(isDark ? palette.primary900 : palette.primary50)}>
                  <Fingerprint size={16} color={palette.primary500} strokeWidth={2} />
                </View>
                <Text style={{ ...rowLabel, flex: 0, marginRight: 8 }}>VIN</Text>
                <TextInput
                  value={vin}
                  onChangeText={(text) => setVin(text.toUpperCase().slice(0, 17))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={t('garage.vinPlaceholder')}
                  placeholderTextColor={palette.neutral400}
                  maxLength={17}
                  style={{ ...inputInRow, flex: 1, textAlign: 'left' }}
                />
              </View>
            </View>
            {!vinIsValid && (
              <Text style={{ fontSize: 12, color: palette.danger500, marginTop: 6, marginLeft: 4 }}>
                {t('garage.vinInvalid', {
                  defaultValue: 'VIN must be 17 uppercase characters (no I, O, or Q)',
                })}
              </Text>
            )}
            <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 6, marginLeft: 4 }}>
              {t('garage.vinHelp', { defaultValue: 'Used for NHTSA safety recall lookups.' })}
            </Text>
          </Animated.View>

          {/* ─── Settings — grouped card ─── */}
          <Animated.View entering={FadeInDown.delay(175).duration(250)}>
            <Text style={sectionLabel}>
              {t('garage.settingsSection', { defaultValue: 'Settings' })}
            </Text>
            <View style={cardStyle}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={iconBadge(isDark ? `${theme.warm}30` : `${theme.warm}20`)}>
                    <Star size={16} color={theme.warm} strokeWidth={2} />
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: textColor,
                    }}
                  >
                    {t('garage.setPrimary', { defaultValue: 'Primary Motorcycle' })}
                  </Text>
                </View>
                <Switch
                  value={isPrimary}
                  onValueChange={(v) => {
                    triggerImpact();
                    setIsPrimary(v);
                  }}
                  trackColor={{
                    false: isDark ? palette.neutral700 : palette.neutral200,
                    true: theme.warm,
                  }}
                />
              </View>
            </View>
            <Text style={{ fontSize: 12, color: theme.ink3, marginTop: 6, marginLeft: 4 }}>
              {t('garage.primaryExplanation', {
                defaultValue: 'When set as primary, this bike appears first in your garage',
              })}
            </Text>
          </Animated.View>

          {/* ─── Save + Cancel footer ─── */}
          <Animated.View entering={FadeInDown.delay(200).duration(250)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Pressable
                onPress={() => router.back()}
                style={{ paddingVertical: 16, paddingHorizontal: 12 }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.ink2 }}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!isDirty || !isValid || updateMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor:
                    isDirty && isValid
                      ? theme.warm
                      : isDark
                        ? palette.neutral700
                        : palette.neutral300,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 16,
                  gap: 8,
                }}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Check size={18} color={palette.white} strokeWidth={2.5} />
                )}
                <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                  {updateMutation.isPending
                    ? t('common.saving', { defaultValue: 'Saving...' })
                    : t('common.save', { defaultValue: 'Save' })}
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* ─── Danger Zone ─── */}
          <Animated.View entering={FadeInDown.delay(225).duration(250)} style={{ gap: 8 }}>
            <Text style={{ ...sectionLabel, color: palette.danger500 }}>
              {t('garage.dangerZone', { defaultValue: 'Danger Zone' })}
            </Text>
            <Pressable
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={{
                backgroundColor: `${palette.danger500}18`,
                borderWidth: 1,
                borderColor: palette.danger500,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: deleteMutation.isPending ? 0.6 : 1,
              }}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.danger500} />
              ) : (
                <Trash2 size={16} color={palette.danger500} strokeWidth={2} />
              )}
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.danger500 }}>
                {deleteMutation.isPending
                  ? t('garage.deleting', { defaultValue: 'Deleting...' })
                  : t('garage.deleteMotorcycle', { defaultValue: 'Delete Motorcycle' })}
              </Text>
            </Pressable>
            <Text style={{ fontSize: 12, color: theme.ink3, marginLeft: 4, lineHeight: 18 }}>
              {t('garage.deleteExplanation', {
                defaultValue:
                  'This will permanently delete all maintenance tasks, expenses, and photos',
              })}
            </Text>
          </Animated.View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
