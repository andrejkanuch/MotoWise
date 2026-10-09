import { palette } from '@motovault/design-system';
import {
  DeleteMotorcycleDocument,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import { MotorcycleVariant } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import {
  Bike,
  Calendar,
  Camera,
  Check,
  DollarSign,
  Fingerprint,
  Gauge,
  Search,
  Star,
  Trash2,
} from 'lucide-react-native';
import { PostHogMaskView } from 'posthog-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import {
  IconInputRow,
  PickerDisabledRow,
  PickerEmptyRow,
  PickerLoadingRow,
  PickerResults,
  PickerValueRow,
} from '../../../components/garage/bike-picker-rows';
import { NativeToggle } from '../../../components/ui/native-toggle';
import {
  ChoiceChip,
  FormDivider,
  FormRow,
  FormSection,
  ROW_DIVIDER_INSET,
  RowNumberInput,
  SHEET_CONTENT_STYLE,
  SHEET_CONTROL_HEIGHT,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '../../../components/ui/sheet-form';
import { BIKE_YEAR, sanitizeBikeYear, useBikePicker } from '../../../hooks/use-bike-picker';
import { useCurrency } from '../../../hooks/use-currency';
import { useHydratedFormState } from '../../../hooks/use-hydrated-form-state';
import { useMileageUnit } from '../../../hooks/use-mileage-unit';
import { gqlFetcher } from '../../../lib/graphql-client';
import { pickImage, takePhoto, uploadBikePhoto } from '../../../lib/image-upload';
import { cancelDocumentNotificationsForBike } from '../../../lib/notifications';
import { queryKeys } from '../../../lib/query-keys';
import { maybeRequestReview, REVIEW_MILESTONE } from '../../../lib/store-review';
import { useAuthStore } from '../../../stores/auth.store';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { radius, space, type } from '../../../theme/type';
import { showActionSheet } from '../../../utils/action-sheet';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

/** Stable anchors for tests and Maestro. */
const TEST_ID = {
  PHOTO: 'edit-bike-photo',
  NICKNAME: 'edit-bike-nickname',
  YEAR: 'edit-bike-year',
  MAKE_SEARCH: 'edit-bike-make-search',
  MAKE_VALUE: 'edit-bike-make',
  MAKE_OPTION: 'edit-bike-make-option',
  MODEL_SEARCH: 'edit-bike-model-search',
  MODEL_VALUE: 'edit-bike-model',
  MODEL_OPTION: 'edit-bike-model-option',
  VARIANT: 'edit-bike-variant',
  MILEAGE: 'edit-bike-mileage',
  PRICE: 'edit-bike-price',
  VIN: 'edit-bike-vin',
  PRIMARY: 'edit-bike-primary',
  SAVE: 'edit-bike-save',
  DELETE: 'edit-bike-delete',
} as const;

const PHOTO_HEIGHT = 200;
const PHOTO_EMPTY_HEIGHT = 140;
const PHOTO_BADGE_SIZE = 40;
const PHOTO_SCRIM_ALPHA = 0.4;
const PHOTO_BADGE_ALPHA = 0.5;
const SECTION_STAGGER_MS = 40;
const SECTION_ENTER_MS = 250;
const VIN_LENGTH = 17;

/** How the sheet closes once a save or delete has landed. */
const EXIT = { SAVED: 'saved', DELETED: 'deleted' } as const;
type Exit = (typeof EXIT)[keyof typeof EXIT];
/** Deleting closes the sheet and the bike screen under it (the bike is gone). */
const EXIT_NAVIGATION: Record<Exit, () => void> = {
  [EXIT.SAVED]: () => router.back(),
  [EXIT.DELETED]: () => router.dismiss(2),
};

const VARIANT_OPTIONS = [
  {
    value: MotorcycleVariant.DCT,
    labelKey: 'onboarding.v2BikeSetupVariantDct',
    fallback: 'DCT',
  },
  {
    value: MotorcycleVariant.MT,
    labelKey: 'onboarding.v2BikeSetupVariantMt',
    fallback: 'Manual',
  },
  {
    value: null,
    labelKey: 'onboarding.v2BikeSetupVariantNone',
    fallback: 'N/A',
  },
] as const;
const VARIANT_NONE_KEY = 'none';

const sectionEntering = (index: number) =>
  FadeInUp.delay(index * SECTION_STAGGER_MS).duration(SECTION_ENTER_MS);

/** A caption under a section (helper text or a validation message). */
function SectionNote({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  const { t: theme } = useEditorialTheme();
  return (
    <Text
      style={[
        type.caption,
        {
          color: danger ? theme.danger : theme.ink3,
          marginTop: space.xs,
          marginHorizontal: space.xxs,
        },
      ]}
    >
      {children}
    </Text>
  );
}

/** A section's caption, card and the notes under it, entering together. */
function Section({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={sectionEntering(index)}>{children}</Animated.View>;
}

export default function EditBikeScreen() {
  const { t } = useTranslation();
  const { symbol: currencySymbol } = useCurrency();
  // Mileage unit is a profile-level preference (not per-bike) — read-only here.
  const mileageUnit = useMileageUnit();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t: theme } = useEditorialTheme();
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
  const [mileage, setMileage] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [vin, setVin] = useState('');
  // Minimal variant capture (U7). null = "Not applicable" / baseline schedule rows.
  // Seeded from bike.variant and persisted via the update mutation (the Motorcycle
  // type + Update/CreateMotorcycleInput now carry `variant`).
  const [variant, setVariant] = useState<MotorcycleVariant | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Keep initial values for dirty detection
  const initialValues = useRef({
    nickname: '',
    year: '',
    make: '',
    model: '',
    mileage: '',
    isPrimary: false,
    photoUrl: null as string | null,
    purchasePrice: '',
    vin: '',
    variant: null as MotorcycleVariant | null,
  });

  // --- NHTSA make / model ---
  const picker = useBikePicker(year);
  const { selectedMake, selectedModel, makeSearch, makes, models } = picker;

  // --- Initialize form from bike data (once) ---
  const { isHydrated } = useHydratedFormState(bike, (b) => {
    const vals = {
      nickname: b.nickname ?? '',
      year: String(b.year),
      make: b.make,
      model: b.model,
      mileage: b.currentMileage != null ? String(b.currentMileage) : '',
      isPrimary: b.isPrimary,
      photoUrl: b.primaryPhotoUrl ?? null,
      purchasePrice: b.purchasePrice != null ? String(b.purchasePrice) : '',
      vin: b.vin ?? '',
      variant: (b.variant as MotorcycleVariant | null) ?? null,
    };
    initialValues.current = vals;
    setNickname(vals.nickname);
    setYear(vals.year);
    setMileage(vals.mileage);
    setIsPrimary(vals.isPrimary);
    setPhotoUrl(vals.photoUrl);
    setPurchasePrice(vals.purchasePrice);
    setVin(vals.vin);
    setVariant(vals.variant);
  });

  // Match make/model from the NHTSA list ONCE on initial load. These must not
  // depend on selectedMake/selectedModel: re-running when the selection clears
  // would silently re-select the bike's original value while the user is editing
  // the search field — and then deleting the last character flips the row back
  // to its read-only state, unmounting the TextInput and dismissing the keyboard.
  const didAutoMatchMake = useRef(false);
  const didAutoMatchModel = useRef(false);
  const { setSelectedMake, setSelectedModel } = picker;

  useEffect(() => {
    if (!bike || !isHydrated || makes.all.length === 0 || didAutoMatchMake.current) return;
    didAutoMatchMake.current = true;
    const found = makes.all.find((m) => m.makeName.toLowerCase() === bike.make.toLowerCase());
    if (found) {
      setSelectedMake({ makeId: found.makeId, makeName: found.makeName });
    }
  }, [bike, isHydrated, makes.all, setSelectedMake]);

  useEffect(() => {
    if (!bike || !isHydrated || models.all.length === 0 || didAutoMatchModel.current) return;
    didAutoMatchModel.current = true;
    const found = models.all.find((m) => m.modelName.toLowerCase() === bike.model.toLowerCase());
    if (found) {
      setSelectedModel({ modelId: found.modelId, modelName: found.modelName });
    }
  }, [bike, isHydrated, models.all, setSelectedModel]);

  const makeName = selectedMake?.makeName ?? bike?.make ?? '';
  const modelName = selectedModel?.modelName ?? bike?.model ?? '';

  // --- Dirty detection ---
  const isDirty = useMemo(() => {
    if (!isHydrated) return false;
    const init = initialValues.current;
    return (
      nickname !== init.nickname ||
      year !== init.year ||
      makeName !== init.make ||
      modelName !== init.model ||
      mileage !== init.mileage ||
      isPrimary !== init.isPrimary ||
      photoUrl !== init.photoUrl ||
      purchasePrice !== init.purchasePrice ||
      vin !== init.vin ||
      variant !== init.variant
    );
  }, [
    nickname,
    year,
    makeName,
    modelName,
    mileage,
    isPrimary,
    photoUrl,
    purchasePrice,
    vin,
    variant,
    isHydrated,
  ]);

  // MOT-142: VIN is 17 chars from {A-H,J-N,P-R,0-9} (no I, O, Q)
  const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
  const vinTrimmed = vin.trim().toUpperCase();
  const vinIsValid = vinTrimmed.length === 0 || VIN_REGEX.test(vinTrimmed);
  const isValid = makeName.length > 0 && modelName.length > 0 && vinIsValid;

  // --- Unsaved changes guard ---
  // usePreventRemove (not a bare beforeRemove listener) so the native stack
  // also holds the sheet when the rider swipes it down with unsaved edits.
  const navigation = useNavigation();
  const [exit, setExit] = useState<Exit | null>(null);

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
          make: makeName,
          model: modelName,
          isPrimary,
          ...(mileageNum != null && !Number.isNaN(mileageNum)
            ? { currentMileage: mileageNum }
            : {}),
          ...(photoUrl !== initialValues.current.photoUrl && photoUrl
            ? { primaryPhotoUrl: photoUrl }
            : {}),
          ...(purchasePrice !== initialValues.current.purchasePrice
            ? {
                purchasePrice: purchasePrice.trim() ? Number.parseFloat(purchasePrice) : null,
              }
            : {}),
          ...(vinTrimmed !== initialValues.current.vin
            ? { vin: vinTrimmed.length === VIN_LENGTH ? vinTrimmed : null }
            : {}),
          ...(variant !== initialValues.current.variant ? { variant } : {}),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      // An edited mileage is logged as an odometer reading (00181 trigger).
      queryClient.invalidateQueries({ queryKey: queryKeys.odometer.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.all });
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      maybeRequestReview(REVIEW_MILESTONE.BIKE_EDITED);
      setExit(EXIT.SAVED);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.all });
      // Soft-deleting a bike hides its documents — stop their expiry reminders.
      void cancelDocumentNotificationsForBike(id);
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
      // A no-op if the sheet is already gone; the bike screen then leaves on its
      // own once the refetched garage list no longer has the bike.
      setExit(EXIT.DELETED);
    },
  });

  // Leave only after the render that lifts the guard, so it never holds a
  // finished save or delete.
  useEffect(() => {
    if (exit) EXIT_NAVIGATION[exit]();
  }, [exit]);

  // A delete in flight holds the sheet: swiped away mid-request, it unmounted
  // before `dismiss(2)` and left the bike screen open on a deleted bike. Lifted
  // by `exit`, which the success handler sets in the same update.
  const deleting = deleteMutation.isPending && exit === null;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !deleting });
  }, [navigation, deleting]);

  usePreventRemove(
    deleting ||
      (isDirty && exit === null && !updateMutation.isPending && !deleteMutation.isPending),
    ({ data }) => {
      // Back / swipe while deleting: stay; the delete's own exit closes the sheet.
      if (deleting) return;
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
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      );
    },
  );

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

    showActionSheet(t('garage.changePhoto', { defaultValue: 'Change Photo' }), [
      {
        label: t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) upload(uri);
        },
      },
      {
        label: t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
        onPress: async () => {
          const uri = await pickImage();
          if (uri) upload(uri);
        },
      },
      {
        label: t('common.cancel', { defaultValue: 'Cancel' }),
        onPress: () => {},
        style: 'cancel',
      },
    ]);
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

  // --- Make / model rows ---
  const renderMake = () => {
    if (makes.isLoading) return <PickerLoadingRow />;
    if (selectedMake && !makeSearch) {
      return (
        <PickerValueRow
          testID={TEST_ID.MAKE_VALUE}
          icon={Search}
          value={selectedMake.makeName}
          onPress={picker.reopenMake}
        />
      );
    }
    return (
      <>
        <IconInputRow
          testID={TEST_ID.MAKE_SEARCH}
          icon={Search}
          value={makeSearch}
          onChangeText={picker.setMakeSearch}
          // A make NHTSA does not list stays saved; show it until the rider types.
          placeholder={makeName || t('garage.searchMake', { defaultValue: 'Search make...' })}
          accessibilityLabel={t('garage.make')}
          autoCapitalize="words"
        />
        {makes.filtered.length > 0 ? (
          <PickerResults
            items={makes.filtered}
            keyOf={(m) => m.makeId}
            labelOf={(m) => m.makeName}
            onSelect={(m) => {
              triggerImpact();
              picker.selectMake(m);
            }}
            testIDPrefix={TEST_ID.MAKE_OPTION}
          />
        ) : null}
        {makeSearch.length > 0 && makes.filtered.length === 0 ? (
          <PickerEmptyRow label={t('garage.noMakesFound', { defaultValue: 'No makes found' })} />
        ) : null}
      </>
    );
  };

  const renderModel = () => {
    if (!picker.modelUnlocked) {
      return (
        <PickerDisabledRow
          icon={Search}
          label={modelName || t('garage.searchModel', { defaultValue: 'Search model...' })}
        />
      );
    }
    if (models.isLoading) return <PickerLoadingRow />;
    if (selectedModel && !picker.modelSearch) {
      return (
        <PickerValueRow
          testID={TEST_ID.MODEL_VALUE}
          icon={Search}
          value={selectedModel.modelName}
          onPress={picker.reopenModel}
        />
      );
    }
    return (
      <>
        <IconInputRow
          testID={TEST_ID.MODEL_SEARCH}
          icon={Search}
          value={picker.modelSearch}
          onChangeText={picker.searchModel}
          placeholder={modelName || t('garage.searchModel', { defaultValue: 'Search model...' })}
          accessibilityLabel={t('garage.model')}
          autoCapitalize="words"
        />
        {models.filtered.length > 0 ? (
          <PickerResults
            items={models.filtered}
            keyOf={(m) => m.modelId}
            labelOf={(m) => m.modelName}
            onSelect={(m) => {
              triggerImpact();
              picker.selectModel(m);
            }}
            testIDPrefix={TEST_ID.MODEL_OPTION}
          />
        ) : null}
        {models.all.length > 0 && picker.modelSearch.length > 0 && models.filtered.length === 0 ? (
          <PickerEmptyRow label={t('garage.noModelsFound', { defaultValue: 'No models found' })} />
        ) : null}
      </>
    );
  };

  const canSave = isDirty && isValid && !updateMutation.isPending;
  const primaryState = canSave ? SHEET_PRIMARY_STATE.READY : SHEET_PRIMARY_STATE.DISABLED;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={20}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={SHEET_CONTENT_STYLE}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetTitle>{t('garage.editBike', { defaultValue: 'Edit Motorcycle' })}</SheetTitle>

        {/* ─── Photo ─── */}
        <Animated.View entering={FadeIn.duration(SECTION_ENTER_MS)}>
          <Pressable
            testID={TEST_ID.PHOTO}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            accessibilityRole="button"
            accessibilityLabel={
              photoUrl
                ? t('garage.changePhoto', { defaultValue: 'Change Photo' })
                : t('garage.addPhoto', { defaultValue: 'Add Photo' })
            }
            android_ripple={{ color: theme.line2 }}
            style={{
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: theme.surface,
            }}
          >
            {photoUrl ? (
              <View style={{ height: PHOTO_HEIGHT }}>
                <Image
                  source={{ uri: photoUrl }}
                  style={{ width: '100%', height: PHOTO_HEIGHT }}
                  contentFit="cover"
                  recyclingKey={id}
                />
                {uploadingPhoto ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      backgroundColor: tint(palette.plateG0, PHOTO_SCRIM_ALPHA),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator size="large" color={palette.plateInk} />
                  </View>
                ) : null}
                {/* Over the photo in both schemes: the plate's dark ground and bone ink. */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: space.sm,
                    right: space.sm,
                    width: PHOTO_BADGE_SIZE,
                    height: PHOTO_BADGE_SIZE,
                    borderRadius: radius.pill,
                    borderCurve: 'continuous',
                    backgroundColor: tint(palette.plateG0, PHOTO_BADGE_ALPHA),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={20} color={palette.plateInk} strokeWidth={2} />
                </View>
              </View>
            ) : (
              <View
                style={{
                  height: PHOTO_EMPTY_HEIGHT,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space.xs,
                }}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="large" color={theme.ink3} />
                ) : (
                  <>
                    <Camera size={28} color={theme.ink3} strokeWidth={1.75} />
                    <Text style={[type.subhead, { color: theme.ink3 }]}>
                      {t('garage.addPhoto', { defaultValue: 'Add Photo' })}
                    </Text>
                  </>
                )}
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* ─── Identity ─── */}
        <Section index={1}>
          <FormSection label={t('garage.identitySection', { defaultValue: 'Identity' })}>
            <IconInputRow
              testID={TEST_ID.NICKNAME}
              icon={Bike}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('garage.nicknamePlaceholder', {
                defaultValue: 'e.g. "Black Beauty"',
              })}
              accessibilityLabel={t('garage.nickname')}
            />
            <FormDivider inset={ROW_DIVIDER_INSET} />
            <FormRow icon={Calendar} label={t('garage.year', { defaultValue: 'Year' })}>
              <RowNumberInput
                testID={TEST_ID.YEAR}
                value={year}
                onChangeText={(text) => {
                  setYear(sanitizeBikeYear(text));
                  picker.resetModel();
                }}
                placeholder={t('garage.yearExamplePlaceholder')}
                maxLength={BIKE_YEAR.LENGTH}
                accessibilityLabel={t('garage.year', { defaultValue: 'Year' })}
              />
            </FormRow>
          </FormSection>
        </Section>

        {/* ─── Make, then model ─── */}
        <Section index={2}>
          <FormSection label={t('garage.make')}>{renderMake()}</FormSection>
        </Section>
        <Section index={3}>
          <FormSection label={t('garage.model')}>{renderModel()}</FormSection>
        </Section>

        {/* ─── Transmission / variant (U7 minimal capture) ─── */}
        <Section index={4}>
          <FormSection
            label={t('onboarding.v2BikeSetupVariantLabel', { defaultValue: 'Transmission' })}
            card={false}
          >
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {VARIANT_OPTIONS.map((opt) => (
                <ChoiceChip
                  key={opt.value ?? VARIANT_NONE_KEY}
                  testID={`${TEST_ID.VARIANT}-${opt.value ?? VARIANT_NONE_KEY}`}
                  grow
                  label={t(opt.labelKey, { defaultValue: opt.fallback })}
                  selected={variant === opt.value}
                  onPress={() => setVariant(opt.value)}
                />
              ))}
            </View>
          </FormSection>
          <SectionNote>
            {t('onboarding.v2BikeSetupVariantHelper', {
              defaultValue:
                'Some models offer a dual-clutch (DCT) gearbox with its own service schedule.',
            })}
          </SectionNote>
        </Section>

        {/* ─── Odometer ─── */}
        <Section index={5}>
          <FormSection label={t('garage.odometerSection', { defaultValue: 'Odometer' })}>
            <FormRow icon={Gauge} label={t('garage.currentMileage', { defaultValue: 'Mileage' })}>
              {/* Unit is a profile-level preference (Settings), shown read-only. */}
              <RowNumberInput
                testID={TEST_ID.MILEAGE}
                value={mileage}
                onChangeText={(text) => setMileage(text.replace(/[^0-9]/g, ''))}
                placeholder={t('garage.odometerPlaceholder')}
                unit={mileageUnit}
                accessibilityLabel={t('garage.odometerInputA11y', {
                  defaultValue: 'Odometer reading',
                })}
              />
            </FormRow>
          </FormSection>
        </Section>

        {/* ─── Purchase info ─── */}
        <Section index={6}>
          <FormSection label={t('garage.purchaseInfoSection', { defaultValue: 'Purchase Info' })}>
            <FormRow icon={DollarSign} label={t('garage.purchasePrice', { defaultValue: 'Price' })}>
              <Text style={[type.subhead, { color: theme.ink3 }]}>{currencySymbol}</Text>
              <RowNumberInput
                testID={TEST_ID.PRICE}
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
                accessibilityLabel={t('garage.purchasePrice', { defaultValue: 'Price' })}
              />
            </FormRow>
            <FormDivider inset={ROW_DIVIDER_INSET} />
            {/* VIN — masked from session replay. The TextInput is covered by
                `maskAllTextInputs`, but wrap the whole row so the value stays
                masked regardless of that config. (todo 186) */}
            <PostHogMaskView>
              <FormRow icon={Fingerprint} label="VIN">
                <TextInput
                  testID={TEST_ID.VIN}
                  value={vin}
                  onChangeText={(text) => setVin(text.toUpperCase().slice(0, VIN_LENGTH))}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={t('garage.vinPlaceholder')}
                  placeholderTextColor={theme.ink4}
                  maxLength={VIN_LENGTH}
                  accessibilityLabel="VIN"
                  textAlign="right"
                  style={[type.body, { flex: 2, color: theme.ink, paddingVertical: space.xxs }]}
                />
              </FormRow>
            </PostHogMaskView>
          </FormSection>
          {!vinIsValid ? (
            <SectionNote danger>
              {t('garage.vinInvalid', {
                defaultValue: 'VIN must be 17 uppercase characters (no I, O, or Q)',
              })}
            </SectionNote>
          ) : null}
          <SectionNote>
            {t('garage.vinHelp', { defaultValue: 'Used for NHTSA safety recall lookups.' })}
          </SectionNote>
        </Section>

        {/* ─── Settings ─── */}
        <Section index={7}>
          <FormSection label={t('garage.settingsSection', { defaultValue: 'Settings' })}>
            <FormRow
              testID={TEST_ID.PRIMARY}
              icon={Star}
              label={t('garage.setPrimary', { defaultValue: 'Primary Motorcycle' })}
            >
              <NativeToggle
                value={isPrimary}
                onValueChange={(v) => {
                  triggerImpact();
                  setIsPrimary(v);
                }}
                tint={theme.warm}
              />
            </FormRow>
          </FormSection>
          <SectionNote>
            {t('garage.primaryExplanation', {
              defaultValue: 'When set as primary, this bike appears first in your garage',
            })}
          </SectionNote>
        </Section>

        {/* ─── Danger zone ─── */}
        <Section index={8}>
          <FormSection label={t('garage.dangerZone', { defaultValue: 'Danger Zone' })}>
            <Pressable
              testID={TEST_ID.DELETE}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              accessibilityRole="button"
              accessibilityState={{ disabled: deleteMutation.isPending }}
              android_ripple={{ color: theme.line2 }}
              style={({ pressed }) => ({
                minHeight: SHEET_CONTROL_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xs,
                paddingHorizontal: space.md,
                opacity: deleteMutation.isPending
                  ? 0.6
                  : pressed && process.env.EXPO_OS === 'ios'
                    ? 0.7
                    : 1,
              })}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <Trash2 size={18} color={theme.danger} strokeWidth={2} />
              )}
              <Text style={[type.bodyStrong, { color: theme.danger }]}>
                {deleteMutation.isPending
                  ? t('garage.deleting', { defaultValue: 'Deleting...' })
                  : t('garage.deleteMotorcycle', { defaultValue: 'Delete Motorcycle' })}
              </Text>
            </Pressable>
          </FormSection>
          <SectionNote>
            {t('garage.deleteExplanation', {
              defaultValue:
                'This will permanently delete all maintenance tasks, expenses, and photos',
            })}
          </SectionNote>
        </Section>
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID={TEST_ID.SAVE}
        primaryState={primaryState}
        primaryIcon={Check}
        primaryLabel={
          updateMutation.isPending
            ? t('common.saving', { defaultValue: 'Saving...' })
            : t('common.save', { defaultValue: 'Save' })
        }
        onPrimary={handleSave}
        onCancel={() => router.back()}
        cancelDisabled={updateMutation.isPending || deleting}
      />
    </View>
  );
}
