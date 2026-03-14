import type { MileageUnit } from '@motovault/types';
import Slider from '@react-native-community/slider';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { triggerImpact } from '../../utils/haptics';
import { ONBOARDING_COLORS } from './onboarding-colors';

const MILEAGE_FORMAT = new Intl.NumberFormat('en-US');

interface MileageSliderProps {
  value: number;
  unit: MileageUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: MileageUnit) => void;
}

const UNIT_CONFIG = {
  mi: { max: 80_000, step: 1_000 },
  km: { max: 130_000, step: 1_500 },
} as const;

export function MileageSlider({ value, unit, onValueChange, onUnitChange }: MileageSliderProps) {
  const { t } = useTranslation();
  const lastHapticBucket = useRef(Math.floor(value / 5000));
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
        backgroundColor: ONBOARDING_COLORS.cardBg,
        borderWidth: 1,
        borderColor: ONBOARDING_COLORS.cardBorder,
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
          backgroundColor: ONBOARDING_COLORS.cardBorderDefault,
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
              paddingHorizontal: 24,
              paddingVertical: 8,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: unit === u ? ONBOARDING_COLORS.textMuted : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: unit === u ? '700' : '500',
                color: unit === u ? ONBOARDING_COLORS.textPrimary : ONBOARDING_COLORS.textMuted,
              }}
            >
              {u}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Large number display */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: ONBOARDING_COLORS.textPrimary,
          textAlign: 'center',
          marginBottom: 16,
          fontVariant: ['tabular-nums'],
        }}
      >
        {MILEAGE_FORMAT.format(value)} {unit}
      </Text>

      {/* Slider */}
      <Slider
        minimumValue={0}
        maximumValue={config.max}
        step={config.step}
        value={value}
        onValueChange={handleValueChange}
        minimumTrackTintColor={ONBOARDING_COLORS.accent}
        maximumTrackTintColor={ONBOARDING_COLORS.textMuted}
        thumbTintColor={ONBOARDING_COLORS.textPrimary}
      />

      {/* Range labels */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: ONBOARDING_COLORS.textDimmed }}>0 {unit}</Text>
        <Text style={{ fontSize: 12, color: ONBOARDING_COLORS.textDimmed }}>
          {MILEAGE_FORMAT.format(config.max)} {unit}
        </Text>
      </View>

      {/* Not sure link */}
      <Pressable
        onPress={handleNotSure}
        style={({ pressed }) => ({
          alignSelf: 'center',
          marginTop: 16,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: ONBOARDING_COLORS.textMuted,
            textDecorationLine: 'underline',
          }}
        >
          {t('onboarding.mileageNotSureShort')}
        </Text>
      </Pressable>
    </View>
  );
}
