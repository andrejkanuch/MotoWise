import Slider from '@expo/ui/community/slider';
import type { MileageUnit } from '@motovault/types';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { useOnboardingColors } from './onboarding-colors';

const MILEAGE_FORMAT = new Intl.NumberFormat('en-US');

interface MileageSliderProps {
  value: number;
  unit: MileageUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: MileageUnit) => void;
}

const UNIT_CONFIG = {
  mi: { max: 80_000, step: 100 },
  km: { max: 130_000, step: 100 },
} as const;

export function MileageSlider({ value, unit, onValueChange, onUnitChange }: MileageSliderProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const lastHapticBucket = useRef(Math.floor(value / 5000));
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const config = UNIT_CONFIG[unit];

  const handleValueChange = (raw: number) => {
    const rounded = Math.round(raw / config.step) * config.step;
    onValueChange(rounded);

    const bucket = Math.floor(rounded / 5000);
    if (bucket !== lastHapticBucket.current) {
      lastHapticBucket.current = bucket;
      triggerImpact();
    }
  };

  const handleStartEditing = () => {
    triggerImpact();
    setEditText(String(value));
    setIsEditing(true);
  };

  const handleEndEditing = () => {
    const parsed = Number.parseInt(editText.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onValueChange(Math.min(parsed, config.max));
    }
    setIsEditing(false);
  };

  const handleUnitChange = (newUnit: MileageUnit) => {
    if (newUnit === unit) return;
    triggerImpact();
    onUnitChange(newUnit);
  };

  const handleNotSure = () => {
    triggerImpact();
    onValueChange(0);
  };

  return (
    <View
      style={{
        backgroundColor: oc.cardBg,
        borderWidth: 1,
        borderColor: oc.cardBorder,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 20,
      }}
    >
      {/* Unit segmented control */}
      <View
        style={{
          flexDirection: 'row',
          alignSelf: 'center',
          backgroundColor: oc.cardBorderDefault,
          borderRadius: 12,
          borderCurve: 'continuous',
          padding: 3,
          marginBottom: 20,
        }}
      >
        {(['mi', 'km'] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => handleUnitChange(u)}
            style={{
              paddingHorizontal: space.xl,
              minHeight: 36,
              justifyContent: 'center',
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              backgroundColor: unit === u ? oc.surface3 : 'transparent',
            }}
          >
            <Text
              style={[
                unit === u ? type.bodyStrong : type.body,
                { color: unit === u ? oc.textPrimary : oc.textMuted },
              ]}
            >
              {u}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Large number display — tap to type exact value */}
      {isEditing ? (
        <TextInput
          value={editText}
          onChangeText={(text) => setEditText(text.replace(/[^0-9]/g, ''))}
          onBlur={handleEndEditing}
          onSubmitEditing={handleEndEditing}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
          style={{
            ...type.figure,
            color: oc.textPrimary,
            textAlign: 'center',
            marginBottom: space.md,
            borderBottomWidth: 2,
            borderBottomColor: oc.accent,
            paddingVertical: 4,
            alignSelf: 'center',
            minWidth: 120,
          }}
        />
      ) : (
        <Pressable onPress={handleStartEditing}>
          <Text
            style={[
              type.figure,
              {
                color: oc.textPrimary,
                textAlign: 'center',
                marginBottom: space.xxs,
              },
            ]}
          >
            {MILEAGE_FORMAT.format(value)} {unit}
          </Text>
          <Text
            style={[
              type.caption,
              { color: oc.textMuted, textAlign: 'center', marginBottom: space.xs },
            ]}
          >
            {t('onboarding.tapToTypeExact', { defaultValue: 'Tap to type exact value' })}
          </Text>
        </Pressable>
      )}

      {/* Slider */}
      <Slider
        minimumValue={0}
        maximumValue={config.max}
        step={config.step}
        value={value}
        onValueChange={handleValueChange}
        minimumTrackTintColor={oc.accent}
        maximumTrackTintColor={oc.textMuted}
        thumbTintColor={oc.textPrimary}
      />

      {/* Range labels */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={[type.caption, { color: oc.textMuted }]}>0 {unit}</Text>
        <Text style={[type.caption, { color: oc.textMuted }]}>
          {MILEAGE_FORMAT.format(config.max)} {unit}
        </Text>
      </View>

      {/* Not sure link */}
      <Pressable
        onPress={handleNotSure}
        style={({ pressed }) => ({
          alignSelf: 'center',
          minHeight: 44,
          justifyContent: 'center',
          marginTop: space.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[type.bodyStrong, { color: oc.warm2 }]}>
          {t('onboarding.mileageNotSureShort')}
        </Text>
      </Pressable>
    </View>
  );
}
