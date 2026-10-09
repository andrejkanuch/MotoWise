import type { MotorcycleModelsQuery } from '@motovault/graphql';
import { Check, Plus, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { radius, space, type } from '../../../theme/type';
import { useOnboardingColors } from '../onboarding-colors';

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

  // Selected model confirmation chip
  if (selectedModel) {
    return (
      <Animated.View entering={FadeIn.duration(280)}>
        <Text style={[labelStyle, { color: oc.textLabel }]}>
          {t('onboarding.v2ModelPickerLabel')}
        </Text>
        <View
          style={{
            padding: 14,
            paddingHorizontal: space.md,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: oc.cardBgSelected,
            borderWidth: 1.5,
            borderColor: oc.warm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: oc.warm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={14} color={oc.textOnAccent} strokeWidth={3} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[type.bodyStrong, { color: oc.textPrimary, marginBottom: 2 }]}
            >
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
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: oc.surfaceDismiss,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} color={oc.iconDismiss} />
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(150).duration(380)}>
      <Text style={[labelStyle, { color: oc.textLabel }]}>
        {t('onboarding.v2ModelPickerLabel')}{' '}
        <Text style={[type.caption, { color: oc.textMuted }]}>
          {t('onboarding.v2ModelPickerOptional')}
        </Text>
      </Text>

      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: oc.surfaceInput,
          borderWidth: 1,
          borderColor: oc.borderSubtle,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Search size={15} color={oc.textMutedIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            isCustomMake
              ? t('onboarding.v2ModelPickerSearchCustom')
              : t('onboarding.v2ModelPickerSearchPlaceholder', { makeName })
          }
          placeholderTextColor={oc.textDimmed}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={50}
          style={{
            flex: 1,
            minHeight: 44,
            paddingVertical: space.sm,
            color: oc.textPrimary,
            ...type.body,
          }}
        />
      </View>

      {isLoading && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={oc.warm} />
        </View>
      )}

      {/* Model chips */}
      {!isCustomMake && !isLoading && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {filtered.length === 0 && !query && models.length === 0 && (
            <Text style={[type.caption, { color: oc.textMuted, padding: space.xxs }]}>
              {t('onboarding.v2ModelPickerNoCatalog', { makeName })}
            </Text>
          )}
          {filtered.map((m) => (
            <Pressable
              key={m.modelId}
              onPress={() => onSelect(m)}
              accessibilityRole="button"
              accessibilityLabel={m.modelName}
              style={{
                minHeight: 36,
                justifyContent: 'center',
                paddingHorizontal: space.sm,
                borderRadius: radius.pill,
                backgroundColor: oc.surfaceInput,
                borderWidth: 1,
                borderColor: oc.borderSubtle,
              }}
            >
              <Text style={[type.label, { color: oc.textPrimary }]}>{m.modelName}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Custom model option */}
      {showCustom && (
        <Pressable
          onPress={() => onSelect({ modelId: 0, modelName: query.trim() })}
          style={{
            marginTop: 8,
            minHeight: 44,
            paddingHorizontal: 14,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: oc.surface2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Plus size={16} color={oc.warm2} />
          <Text style={[type.subhead, { color: oc.textPrimary }]}>
            {t('onboarding.v2ModelPickerUseCustom', { model: query.trim() })}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const labelStyle = {
  ...type.label,
  marginBottom: space.sm,
  paddingLeft: 2,
};
