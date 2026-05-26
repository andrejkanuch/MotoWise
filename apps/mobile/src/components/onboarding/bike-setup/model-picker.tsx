import type { MotorcycleModelsQuery } from '@motovault/graphql';
import { Check, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { getBrandColor } from '../../../config/brand-dna';
import { ONBOARDING_COLORS } from '../onboarding-colors';

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
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const color = getBrandColor(makeName);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models.slice(0, 6);
    return models.filter((m) => m.modelName.toLowerCase().includes(q)).slice(0, 6);
  }, [query, models]);

  const showCustom = query.trim().length > 0 && filtered.length === 0;

  // Selected model confirmation chip
  if (selectedModel) {
    return (
      <Animated.View entering={FadeIn.duration(280)}>
        <Text style={labelStyle}>{t('onboarding.v2ModelPickerLabel')}</Text>
        <View
          style={{
            padding: 14,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: `${color}24`,
            borderWidth: 1.5,
            borderColor: color,
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
              backgroundColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={14} color={ONBOARDING_COLORS.textOnAccent} strokeWidth={3} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: ONBOARDING_COLORS.textWhite,
                letterSpacing: -0.2,
                marginBottom: 2,
              }}
            >
              {selectedModel.modelName}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 11.5,
                color: ONBOARDING_COLORS.textSoft,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              {isCustomMake ? t('onboarding.v2ModelPickerCustom') : makeName}
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Change model"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: ONBOARDING_COLORS.surfaceDismiss,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={13} color={ONBOARDING_COLORS.iconDismiss} />
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.delay(150).duration(380)}>
      <Text style={labelStyle}>
        {t('onboarding.v2ModelPickerLabel')}{' '}
        <Text
          style={{
            fontStyle: 'italic',
            textTransform: 'none',
            fontWeight: '400',
            letterSpacing: 0.4,
            color: ONBOARDING_COLORS.textFaded,
          }}
        >
          {t('onboarding.v2ModelPickerOptional')}
        </Text>
      </Text>

      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: ONBOARDING_COLORS.surfaceInput,
          borderWidth: 1,
          borderColor: ONBOARDING_COLORS.borderSubtle,
          borderRadius: 14,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Search size={15} color={ONBOARDING_COLORS.textMutedIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            isCustomMake
              ? t('onboarding.v2ModelPickerSearchCustom')
              : t('onboarding.v2ModelPickerSearchPlaceholder', { makeName })
          }
          placeholderTextColor={ONBOARDING_COLORS.textDimmed}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={50}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: ONBOARDING_COLORS.textPrimary,
            fontSize: 14,
          }}
        />
      </View>

      {isLoading && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={ONBOARDING_COLORS.warm} />
        </View>
      )}

      {/* Model chips */}
      {!isCustomMake && !isLoading && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {filtered.length === 0 && !query && models.length === 0 && (
            <Text style={{ fontSize: 12, color: ONBOARDING_COLORS.textMutedIcon, padding: 4 }}>
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
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: ONBOARDING_COLORS.surfaceInput,
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.borderSubtle,
              }}
            >
              <Text
                style={{ fontSize: 12.5, color: ONBOARDING_COLORS.textWhite, fontWeight: '500' }}
              >
                {m.modelName}
              </Text>
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
            padding: 11,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: `${color}1F`,
            borderWidth: 1,
            borderColor: color,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16, color }}>+</Text>
          <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.textWhite }}>
            {t('onboarding.v2ModelPickerUseCustom', { model: query.trim() })}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: '600' as const,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: ONBOARDING_COLORS.textLabel,
  marginBottom: 12,
  paddingLeft: 2,
};
