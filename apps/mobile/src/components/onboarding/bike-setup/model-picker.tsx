import type { MotorcycleModelsQuery } from '@motovault/graphql';
import { Check, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { radius, space, type } from '../../../theme/type';
import { useOnboardingColors } from '../onboarding-colors';
import { PickerGroup, PickerLabel, PickerRow, PickerSearchField } from './picker-ui';

type Model = MotorcycleModelsQuery['motorcycleModels'][number];

interface ModelPickerProps {
  makeName: string;
  isCustomMake: boolean;
  models: Model[];
  isLoading: boolean;
  selectedModel: { modelId: number; modelName: string } | null;
  onSelect: (model: { modelId: number; modelName: string }) => void;
  onDismiss: () => void;
}

export function ModelPicker({
  makeName,
  isCustomMake,
  models,
  isLoading,
  selectedModel,
  onSelect,
  onDismiss,
}: ModelPickerProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return models.slice(0, 6);
    // Normalize away spaces/punctuation so rider-typed variants match the
    // catalog's canonical names: "goldwing"/"gold-wing"/"GOLD WING" all match
    // "Gold Wing". (Model codes like "GL1800" still won't match — NHTSA's
    // motorcycle catalog has no GL codes — so those fall through to the
    // "Use '<typed>'" manual entry below.)
    const nq = raw.replace(/[^a-z0-9]/g, '');
    return models
      .filter((m) => {
        const name = m.modelName.toLowerCase();
        return name.includes(raw) || name.replace(/[^a-z0-9]/g, '').includes(nq);
      })
      .slice(0, 6);
  }, [query, models]);

  const showCustom = query.trim().length > 0 && filtered.length === 0;

  // Selected model — one row with a copper check and a change control.
  if (selectedModel) {
    return (
      <Animated.View entering={FadeIn.duration(240)}>
        <PickerLabel>{t('onboarding.v2ModelPickerLabel')}</PickerLabel>
        <View
          style={{
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingLeft: space.md,
            paddingRight: space.xxs,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: oc.surface,
            borderWidth: 2,
            borderColor: oc.warm,
          }}
        >
          <Check size={18} strokeWidth={3} color={oc.warm} />
          <View style={{ flex: 1, minWidth: 0, paddingVertical: space.xs }}>
            <Text numberOfLines={1} style={[type.bodyStrong, { color: oc.textPrimary }]}>
              {selectedModel.modelName}
            </Text>
            <Text style={[type.caption, { color: oc.textMuted }]}>
              {isCustomMake ? t('onboarding.v2ModelPickerCustom') : makeName}
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Change model"
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color={oc.textMuted} />
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(240)}>
      <PickerLabel>
        {t('onboarding.v2ModelPickerLabel')} · {t('onboarding.v2ModelPickerOptional')}
      </PickerLabel>

      <View style={{ gap: space.xs }}>
        <PickerSearchField
          value={query}
          onChangeText={setQuery}
          maxLength={50}
          placeholder={
            isCustomMake
              ? t('onboarding.v2ModelPickerSearchCustom')
              : t('onboarding.v2ModelPickerSearchPlaceholder', { makeName })
          }
        />

        {isLoading && (
          <View style={{ padding: space.md, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={oc.textMuted} />
          </View>
        )}

        {!isCustomMake && !isLoading && filtered.length === 0 && !query && models.length === 0 && (
          <Text style={[type.caption, { color: oc.textMuted, marginLeft: space.xxs }]}>
            {t('onboarding.v2ModelPickerNoCatalog', { makeName })}
          </Text>
        )}

        {/* Model rows — the row text is exactly the model name. */}
        {!isCustomMake && !isLoading && filtered.length > 0 && (
          <PickerGroup>
            {filtered.map((m) => (
              <PickerRow key={m.modelId} title={m.modelName} onPress={() => onSelect(m)} />
            ))}
          </PickerGroup>
        )}

        {/* Custom model option */}
        {showCustom && (
          <PickerGroup>
            <PickerRow
              title={t('onboarding.v2ModelPickerUseCustom', { model: query.trim() })}
              leading={<Plus size={18} color={oc.warm2} />}
              accent
              onPress={() => onSelect({ modelId: 0, modelName: query.trim() })}
            />
          </PickerGroup>
        )}
      </View>
    </Animated.View>
  );
}
