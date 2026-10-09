import { CreateMotorcycleDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  IconInputRow,
  PickerCustomRow,
  PickerDisabledRow,
  PickerEmptyRow,
  PickerLoadingRow,
  PickerResults,
  PickerValueRow,
} from '../../../components/garage/bike-picker-rows';
import {
  FormSection,
  inputTextStyle,
  SHEET_CONTENT_STYLE,
  SHEET_CONTROL_HEIGHT,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '../../../components/ui/sheet-form';
import { BIKE_YEAR, sanitizeBikeYear, useBikePicker } from '../../../hooks/use-bike-picker';
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
import { space } from '../../../theme/type';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

/** Maestro anchors (add-bike.yaml). */
const TEST_ID = {
  YEAR: 'add-bike-year',
  MAKE_SEARCH: 'add-bike-make-search',
  MAKE_VALUE: 'add-bike-make',
  MAKE_OPTION: 'add-bike-make-option',
  MAKE_CUSTOM: 'add-bike-make-custom',
  MODEL_SEARCH: 'add-bike-model-search',
  MODEL_VALUE: 'add-bike-model',
  MODEL_OPTION: 'add-bike-model-option',
  MODEL_CUSTOM: 'add-bike-model-custom',
  NICKNAME: 'add-bike-nickname',
  SUBMIT: 'add-bike-submit',
} as const;

const SECTION_STAGGER_MS = 50;
const SECTION_ENTER_MS = 250;
/** A search this long with no match offers the typed text as a custom entry. */
const CUSTOM_ENTRY_MIN_CHARS = 2;

const isBikeLimitRejection = (error: unknown) =>
  hasGraphQLCode(error, GRAPHQL_ERROR_CODE.FORBIDDEN);

const sectionEntering = (index: number) =>
  FadeInUp.delay(index * SECTION_STAGGER_MS).duration(SECTION_ENTER_MS);

export default function AddBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t: theme } = useEditorialTheme();
  const { requireAccess } = useProGate();

  const [year, setYear] = useState('');
  const [nickname, setNickname] = useState('');
  const picker = useBikePicker(year);
  const {
    yearNum,
    selectedMake,
    selectedModel,
    makeSearch,
    modelSearch,
    customMake,
    customModel,
    makes,
    models,
  } = picker;

  const handleYearChange = (text: string) => {
    setYear(sanitizeBikeYear(text));
    picker.resetModel();
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
    picker.validYear &&
    (!!selectedMake || !!customMake.trim()) &&
    (!!selectedModel || !!customModel.trim());

  const handleSubmit = async () => {
    if (!isValid || isPending) return;

    try {
      const make = picker.makeName;
      const model = picker.modelName;
      await mutateAsync({
        year: yearNum,
        make,
        model,
        nickname: nickname.trim() || undefined,
      });
      trackEvent(AnalyticsEvent.GARAGE_BIKE_ADDED, { make, model, year: yearNum });
      MetaAnalytics.trackAddToGarage(make, model, yearNum);
      triggerNotification(Haptics.NotificationFeedbackType.Success);
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

  // ── Make: loading → chosen (custom or NHTSA) → search with matches ──
  const renderMake = () => {
    if (makes.isLoading) return <PickerLoadingRow />;
    if (customMake && !makeSearch) {
      return (
        <PickerValueRow
          testID={TEST_ID.MAKE_VALUE}
          icon={Search}
          value={customMake}
          custom
          onPress={picker.reopenCustomMake}
        />
      );
    }
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
    const noMatch = makeSearch.length >= CUSTOM_ENTRY_MIN_CHARS && makes.filtered.length === 0;
    return (
      <>
        <IconInputRow
          testID={TEST_ID.MAKE_SEARCH}
          icon={Search}
          value={makeSearch}
          onChangeText={picker.setMakeSearch}
          placeholder={t('garage.searchMake')}
          accessibilityLabel={t('garage.make')}
          autoCapitalize="words"
        />
        {makes.filtered.length > 0 ? (
          <PickerResults
            items={makes.filtered}
            keyOf={(make) => make.makeId}
            labelOf={(make) => make.makeName}
            onSelect={(make) => {
              triggerImpact();
              picker.selectMake(make);
            }}
            testIDPrefix={TEST_ID.MAKE_OPTION}
          />
        ) : null}
        {noMatch ? (
          <>
            <PickerEmptyRow label={t('garage.noMakesFound')} />
            <PickerCustomRow
              testID={TEST_ID.MAKE_CUSTOM}
              label={t('garage.useCustomMake', {
                defaultValue: `Use "${makeSearch}"`,
                make: makeSearch,
              })}
              onPress={picker.chooseTypedMake}
            />
          </>
        ) : null}
      </>
    );
  };

  // ── Model: locked until a make and a valid year; free text for a custom make ──
  const renderModel = () => {
    if (!picker.modelUnlocked) {
      return <PickerDisabledRow icon={Search} label={t('garage.searchModel')} />;
    }
    if (customMake) {
      if (customModel && !modelSearch) {
        return (
          <PickerValueRow
            testID={TEST_ID.MODEL_VALUE}
            icon={Search}
            value={customModel}
            custom
            onPress={picker.reopenCustomModel}
          />
        );
      }
      return (
        <IconInputRow
          testID={TEST_ID.MODEL_SEARCH}
          icon={Search}
          value={modelSearch}
          onChangeText={picker.typeCustomModel}
          onBlur={picker.commitCustomModel}
          placeholder={t('garage.searchModel')}
          accessibilityLabel={t('garage.model')}
          autoCapitalize="words"
          returnKeyType="done"
        />
      );
    }
    if (models.isLoading) return <PickerLoadingRow />;
    if (selectedModel && !modelSearch) {
      return (
        <PickerValueRow
          testID={TEST_ID.MODEL_VALUE}
          icon={Search}
          value={selectedModel.modelName}
          onPress={picker.reopenModel}
        />
      );
    }
    if (customModel && !modelSearch) {
      return (
        <PickerValueRow
          testID={TEST_ID.MODEL_VALUE}
          icon={Search}
          value={customModel}
          custom
          onPress={picker.reopenCustomModel}
        />
      );
    }
    const noMatch = modelSearch.length >= CUSTOM_ENTRY_MIN_CHARS && models.filtered.length === 0;
    return (
      <>
        <IconInputRow
          testID={TEST_ID.MODEL_SEARCH}
          icon={Search}
          value={modelSearch}
          onChangeText={picker.searchModel}
          placeholder={t('garage.searchModel')}
          accessibilityLabel={t('garage.model')}
          autoCapitalize="words"
        />
        {models.filtered.length > 0 ? (
          <PickerResults
            items={models.filtered}
            keyOf={(model) => model.modelId}
            labelOf={(model) => model.modelName}
            onSelect={(model) => {
              triggerImpact();
              picker.selectModel(model);
            }}
            testIDPrefix={TEST_ID.MODEL_OPTION}
          />
        ) : null}
        {noMatch ? (
          <>
            {models.all.length > 0 ? <PickerEmptyRow label={t('garage.noModelsFound')} /> : null}
            <PickerCustomRow
              testID={TEST_ID.MODEL_CUSTOM}
              label={t('garage.useCustomModel', {
                defaultValue: `Use "${modelSearch}"`,
                model: modelSearch,
              })}
              onPress={picker.chooseTypedModel}
            />
          </>
        ) : null}
      </>
    );
  };

  const primaryState =
    isValid && !isPending ? SHEET_PRIMARY_STATE.READY : SHEET_PRIMARY_STATE.DISABLED;

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
        <SheetTitle>{t('garage.addBike')}</SheetTitle>

        <Animated.View entering={sectionEntering(0)}>
          <FormSection label={t('garage.year')}>
            <TextInput
              testID={TEST_ID.YEAR}
              value={year}
              onChangeText={handleYearChange}
              placeholder={t('garage.yearExamplePlaceholder')}
              placeholderTextColor={theme.ink4}
              accessibilityLabel={t('garage.year')}
              keyboardType="number-pad"
              maxLength={BIKE_YEAR.LENGTH}
              returnKeyType="next"
              style={[
                inputTextStyle(theme),
                { minHeight: SHEET_CONTROL_HEIGHT, paddingHorizontal: space.md },
              ]}
            />
          </FormSection>
        </Animated.View>

        <Animated.View entering={sectionEntering(1)}>
          <FormSection label={t('garage.make')}>{renderMake()}</FormSection>
        </Animated.View>

        <Animated.View entering={sectionEntering(2)}>
          <FormSection label={t('garage.model')}>{renderModel()}</FormSection>
        </Animated.View>

        <Animated.View entering={sectionEntering(3)}>
          <FormSection label={t('garage.nickname')}>
            <TextInput
              testID={TEST_ID.NICKNAME}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('garage.nicknamePlaceholder')}
              placeholderTextColor={theme.ink4}
              accessibilityLabel={t('garage.nickname')}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              style={[
                inputTextStyle(theme),
                { minHeight: SHEET_CONTROL_HEIGHT, paddingHorizontal: space.md },
              ]}
            />
          </FormSection>
        </Animated.View>
      </KeyboardAwareScrollView>

      <SheetFooter
        primaryTestID={TEST_ID.SUBMIT}
        primaryState={primaryState}
        primaryIcon={Plus}
        primaryLabel={isPending ? t('garage.saving') : t('garage.addBike')}
        onPrimary={() => {
          triggerImpact();
          handleSubmit();
        }}
        onCancel={() => router.back()}
        cancelDisabled={isPending}
      />
    </View>
  );
}
