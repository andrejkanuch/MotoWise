import { palette } from '@motovault/design-system';
import {
  DeleteMotorcycleDocument,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Camera, Trash2 } from 'lucide-react-native';
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
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { haptic } from '../../../lib/haptics';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../lib/image-upload';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
export default function EditBikeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
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
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageUnit, setMileageUnit] = useState<'mi' | 'km'>('mi');
  const [isPrimary, setIsPrimary] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Keep initial values for dirty detection
  const initialValues = useRef({
    nickname: '',
    year: '',
    make: '',
    model: '',
    mileage: '',
    mileageUnit: 'mi' as string,
    isPrimary: false,
    photoUrl: null as string | null,
  });

  useEffect(() => {
    if (bike && !initialized) {
      const vals = {
        nickname: bike.nickname ?? '',
        year: String(bike.year),
        make: bike.make,
        model: bike.model,
        mileage: bike.currentMileage != null ? String(bike.currentMileage) : '',
        mileageUnit: (bike.mileageUnit as string) ?? 'mi',
        isPrimary: bike.isPrimary,
        photoUrl: bike.primaryPhotoUrl ?? null,
      };
      initialValues.current = vals;
      setNickname(vals.nickname);
      setYear(vals.year);
      setMake(vals.make);
      setModel(vals.model);
      setMileage(vals.mileage);
      setMileageUnit(vals.mileageUnit as 'mi' | 'km');
      setIsPrimary(vals.isPrimary);
      setPhotoUrl(vals.photoUrl);
      setInitialized(true);
    }
  }, [bike, initialized]);

  // --- Dirty detection ---
  const isDirty = useMemo(() => {
    if (!initialized) return false;
    const init = initialValues.current;
    return (
      nickname !== init.nickname ||
      year !== init.year ||
      make !== init.make ||
      model !== init.model ||
      mileage !== init.mileage ||
      mileageUnit !== init.mileageUnit ||
      isPrimary !== init.isPrimary ||
      photoUrl !== init.photoUrl
    );
  }, [nickname, year, make, model, mileage, mileageUnit, isPrimary, photoUrl, initialized]);

  const isValid = make.trim().length > 0 && model.trim().length > 0;

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
      const mileageNum = mileage.trim() ? Number.parseInt(mileage, 10) : undefined;
      return gqlFetcher(UpdateMotorcycleDocument, {
        id,
        input: {
          nickname: nickname.trim() || null,
          year: Number.isNaN(yearNum) ? undefined : yearNum,
          make: make.trim(),
          model: model.trim(),
          isPrimary,
          ...(mileageNum != null && !Number.isNaN(mileageNum)
            ? { currentMileage: mileageNum }
            : {}),
          mileageUnit,
          ...(photoUrl !== initialValues.current.photoUrl && photoUrl
            ? { primaryPhotoUrl: photoUrl }
            : {}),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.all });
      isDirtyRef.current = false;
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.all });
      isDirtyRef.current = false;
      router.dismiss(2);
    },
  });

  // --- Save handler ---
  const handleSave = useCallback(() => {
    if (!isDirty || !isValid || updateMutation.isPending) return;
    haptic();
    updateMutation.mutate();
  }, [isDirty, isValid, updateMutation]);

  // --- Photo picker ---
  const handlePickPhoto = () => {
    haptic();
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
    haptic();
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
  const bgColor = isDark ? palette.neutral950 : palette.neutral50;
  const cardBg = isDark ? palette.neutral800 : palette.white;
  const textColor = isDark ? palette.neutral50 : palette.neutral950;
  const secondaryText = palette.neutral500;

  const inputStyle = {
    backgroundColor: isDark ? palette.neutral800 : palette.white,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: textColor,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: secondaryText,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  };

  const sectionTitleStyle = {
    fontSize: 13,
    fontWeight: '700' as const,
    color: secondaryText,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  };

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={!isDirty || !isValid || updateMutation.isPending}
              hitSlop={8}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.primary500} />
              ) : (
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: isDirty && isValid ? palette.primary500 : palette.neutral400,
                  }}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
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
        <Animated.View entering={FadeInUp.duration(350)}>
          <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto}>
            {photoUrl ? (
              <View style={{ height: 200, position: 'relative' }}>
                <Image
                  source={{ uri: photoUrl }}
                  style={{ width: '100%', height: 200 }}
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
              <LinearGradient
                colors={
                  isDark
                    ? [palette.neutral800, palette.neutral900]
                    : [palette.neutral200, palette.neutral300]
                }
                style={{
                  height: 200,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="large" color={palette.primary500} />
                ) : (
                  <>
                    <Camera size={36} color={secondaryText} strokeWidth={1.5} />
                    <Text style={{ fontSize: 15, color: secondaryText, fontWeight: '500' }}>
                      {t('garage.addPhoto', { defaultValue: 'Add Photo' })}
                    </Text>
                  </>
                )}
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>

        <View style={{ padding: 20, gap: 32 }}>
          {/* ─── Identity Section ─── */}
          <Animated.View entering={FadeInUp.delay(50).duration(350)} style={{ gap: 16 }}>
            <Text style={sectionTitleStyle}>
              {t('garage.identitySection', { defaultValue: 'Identity' })}
            </Text>

            <View>
              <Text style={labelStyle}>{t('garage.nickname', { defaultValue: 'Nickname' })}</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder={t('garage.nicknamePlaceholder', {
                  defaultValue: 'e.g. "Black Beauty"',
                })}
                placeholderTextColor={palette.neutral400}
                style={inputStyle}
              />
            </View>

            <View>
              <Text style={labelStyle}>{t('garage.year', { defaultValue: 'Year' })}</Text>
              <TextInput
                value={year}
                onChangeText={(text) => setYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                placeholder="2024"
                placeholderTextColor={palette.neutral400}
                maxLength={4}
                style={inputStyle}
              />
            </View>

            <View>
              <Text style={labelStyle}>{t('garage.make', { defaultValue: 'Make' })}</Text>
              <TextInput
                value={make}
                onChangeText={setMake}
                placeholder="Honda"
                placeholderTextColor={palette.neutral400}
                autoCapitalize="words"
                style={inputStyle}
              />
            </View>

            <View>
              <Text style={labelStyle}>{t('garage.model', { defaultValue: 'Model' })}</Text>
              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="CB650R"
                placeholderTextColor={palette.neutral400}
                autoCapitalize="words"
                style={inputStyle}
              />
            </View>
          </Animated.View>

          {/* ─── Odometer Section ─── */}
          <Animated.View entering={FadeInUp.delay(100).duration(350)} style={{ gap: 16 }}>
            <Text style={sectionTitleStyle}>
              {t('garage.odometerSection', { defaultValue: 'Odometer' })}
            </Text>

            <View>
              <Text style={labelStyle}>
                {t('garage.currentMileage', { defaultValue: 'Current Mileage' })}
              </Text>
              <TextInput
                value={mileage}
                onChangeText={(text) => setMileage(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={palette.neutral400}
                style={inputStyle}
              />
            </View>

            <View>
              <Text style={labelStyle}>{t('garage.mileageUnit', { defaultValue: 'Unit' })}</Text>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  padding: 3,
                }}
              >
                {(['mi', 'km'] as const).map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => {
                      haptic();
                      setMileageUnit(unit);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      backgroundColor:
                        mileageUnit === unit
                          ? isDark
                            ? palette.neutral700
                            : palette.white
                          : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: mileageUnit === unit ? '700' : '500',
                        color: mileageUnit === unit ? textColor : secondaryText,
                      }}
                    >
                      {unit === 'mi'
                        ? t('garage.miles', { defaultValue: 'Miles' })
                        : t('garage.kilometers', { defaultValue: 'Kilometers' })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* ─── Settings Section ─── */}
          <Animated.View entering={FadeInUp.delay(150).duration(350)} style={{ gap: 12 }}>
            <Text style={sectionTitleStyle}>
              {t('garage.settingsSection', { defaultValue: 'Settings' })}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: cardBg,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontSize: 16, color: textColor }}>
                {t('garage.setPrimary', { defaultValue: 'Primary Motorcycle' })}
              </Text>
              <Switch
                value={isPrimary}
                onValueChange={(v) => {
                  haptic();
                  setIsPrimary(v);
                }}
                trackColor={{ false: palette.neutral300, true: palette.primary500 }}
                thumbColor={palette.white}
              />
            </View>
            <Text
              style={{
                fontSize: 13,
                color: secondaryText,
                marginLeft: 4,
                lineHeight: 18,
              }}
            >
              {t('garage.primaryExplanation', {
                defaultValue: 'When set as primary, this bike appears first in your garage',
              })}
            </Text>
          </Animated.View>

          {/* ─── Danger Zone ─── */}
          <Animated.View entering={FadeInUp.delay(200).duration(350)} style={{ gap: 12 }}>
            <Text
              style={{
                ...sectionTitleStyle,
                color: palette.danger500,
              }}
            >
              {t('garage.dangerZone', { defaultValue: 'Danger Zone' })}
            </Text>

            <Pressable
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              style={{
                backgroundColor: palette.danger500,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: deleteMutation.isPending ? 0.6 : 1,
              }}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Trash2 size={18} color={palette.white} strokeWidth={2} />
              )}
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                {deleteMutation.isPending
                  ? t('garage.deleting', { defaultValue: 'Deleting...' })
                  : t('garage.deleteMotorcycle', { defaultValue: 'Delete Motorcycle' })}
              </Text>
            </Pressable>

            <Text
              style={{
                fontSize: 13,
                color: secondaryText,
                marginLeft: 4,
                lineHeight: 18,
              }}
            >
              {t('garage.deleteExplanation', {
                defaultValue:
                  'This will permanently delete all maintenance tasks, expenses, and photos',
              })}
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
