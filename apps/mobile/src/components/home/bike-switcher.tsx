import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text } from 'react-native';
import { bikeDisplayName } from '../../lib/bike-hub/format';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { GUTTER, radius, space, type } from '../../theme/type';
import { triggerSelection } from '../../utils/haptics';
import type { HomeMotorcycle } from './home-types';

const CHIP_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;
const CHIP_MAX_FONT_SCALE = 1.6;

interface BikeSwitcherProps {
  bikes: HomeMotorcycle[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAddBike: () => void;
}

/** Picks which bike's plate Home shows. Hidden with a single bike. */
export function BikeSwitcher({ bikes, selectedIndex, onSelect, onAddBike }: BikeSwitcherProps) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();

  if (bikes.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={{ gap: space.xs, paddingHorizontal: GUTTER }}
    >
      {bikes.map((bike, i) => {
        const active = i === selectedIndex;
        return (
          <Pressable
            key={bike.id}
            onPress={() => {
              if (active) return;
              triggerSelection();
              onSelect(i);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${bike.make} ${bike.model}`}
            android_ripple={{ color: tint(theme.ink, 0.08) }}
            style={{
              minHeight: CHIP_MIN_HEIGHT,
              justifyContent: 'center',
              paddingHorizontal: space.md,
              borderRadius: radius.pill,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: active ? theme.warm : theme.surface2,
            }}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={CHIP_MAX_FONT_SCALE}
              style={[type.label, { color: active ? theme.onWarm : theme.ink2 }]}
            >
              {bikeDisplayName(bike)}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={onAddBike}
        accessibilityRole="button"
        android_ripple={{ color: tint(theme.ink, 0.08) }}
        style={{
          minHeight: CHIP_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.line,
        }}
      >
        <Plus size={16} color={theme.ink3} />
        <Text
          maxFontSizeMultiplier={CHIP_MAX_FONT_SCALE}
          style={[type.label, { color: theme.ink3 }]}
        >
          {t('home.addBike', { defaultValue: 'Add bike' })}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
