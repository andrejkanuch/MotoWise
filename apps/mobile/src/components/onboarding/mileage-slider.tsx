import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

const MILEAGE_FORMAT = new Intl.NumberFormat('en-US');

interface MileageSliderProps {
  value: number;
  unit: 'mi' | 'km';
  onValueChange: (value: number) => void;
  onUnitChange: (unit: 'mi' | 'km') => void;
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
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleUnitChange = (newUnit: 'mi' | 'km') => {
    if (newUnit === unit) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onUnitChange(newUnit);
  };

  const handleNotSure = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onValueChange(0);
  };

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
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
          backgroundColor: 'rgba(255,255,255,0.08)',
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
              backgroundColor: unit === u ? 'rgba(255,255,255,0.15)' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: unit === u ? '700' : '500',
                color: unit === u ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
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
          color: '#FFFFFF',
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
        minimumTrackTintColor="#818CF8"
        maximumTrackTintColor="rgba(255,255,255,0.15)"
        thumbTintColor="#FFFFFF"
      />

      {/* Range labels */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>0 {unit}</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
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
            color: 'rgba(255,255,255,0.45)',
            textDecorationLine: 'underline',
          }}
        >
          {t('onboarding.mileageNotSureShort')}
        </Text>
      </Pressable>
    </View>
  );
}
