import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { Check, X } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type EditorialTokens, tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import type { MapStyle } from '../../utils/map-styles';

const MAP_PREVIEWS: Record<MapStyle, ImageSource> = {
  light: require('../../../assets/images/map-previews/standard.webp'),
  dark: require('../../../assets/images/map-previews/dark.webp'),
  outdoors: require('../../../assets/images/map-previews/outdoors.webp'),
  satellite: require('../../../assets/images/map-previews/satellite.webp'),
  hybrid: require('../../../assets/images/map-previews/hybrid.webp'),
  terrain: require('../../../assets/images/map-previews/terrain.webp'),
  heatmap: require('../../../assets/images/map-previews/heatmap.webp'),
};

const FREE_STYLES: { key: MapStyle; label: string }[] = [
  { key: 'light', label: 'Standard' },
  { key: 'dark', label: 'Dark' },
  { key: 'outdoors', label: 'Outdoors' },
];

const PRO_STYLES: { key: MapStyle; label: string }[] = [
  { key: 'satellite', label: 'Satellite' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'heatmap', label: 'Heatmap' },
];

interface MapPickerSheetProps {
  currentStyle: MapStyle;
  onSelectStyle: (style: MapStyle) => void;
  onClose: () => void;
}

function StyleTile({
  styleKey,
  label,
  isSelected,
  onPress,
  theme,
}: {
  styleKey: MapStyle;
  label: string;
  isSelected: boolean;
  onPress: () => void;
  theme: EditorialTokens;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center' }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: theme.surface2,
          borderWidth: isSelected ? 1.5 : 0,
          borderColor: isSelected ? theme.warm : 'transparent',
          overflow: 'hidden',
        }}
      >
        <Image
          source={MAP_PREVIEWS[styleKey]}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
        {isSelected && (
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 18,
              height: 18,
              borderRadius: 99,
              backgroundColor: theme.warm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={11} color={theme.onWarm} strokeWidth={3} />
          </View>
        )}
      </View>
      <Text style={[type.caption, { color: theme.ink2, marginTop: 7, textAlign: 'center' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const MapPickerSheet = memo(function MapPickerSheet({
  currentStyle,
  onSelectStyle,
  onClose,
}: MapPickerSheetProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();

  const handleSelect = useCallback(
    (style: MapStyle) => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSelectStyle(style);
    },
    [onSelectStyle],
  );

  const sectionLabelStyle = [type.label, { color: theme.ink3, marginBottom: 10 }];

  return (
    <>
      {/* Scrim */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tint(palette.black, 0.5),
          zIndex: 55,
        }}
      />

      {/* Sheet */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 56,
          backgroundColor: theme.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: 'continuous',
          paddingBottom: insets.bottom + space.md,
          shadowColor: palette.black,
          shadowOffset: { width: 0, height: -14 },
          shadowOpacity: 0.4,
          shadowRadius: 40,
        }}
      >
        {/* Handle */}
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            backgroundColor: theme.line2,
            alignSelf: 'center',
            marginTop: 8,
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 12,
          }}
        >
          <Text style={[type.sectionTitle, { color: theme.ink }]}>{t('mapPicker.title')}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={7}
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.pill,
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} color={theme.ink2} />
          </Pressable>
        </View>

        {/* Free section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
          <Text style={sectionLabelStyle}>Free</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {FREE_STYLES.map(({ key, label }) => (
              <StyleTile
                key={key}
                styleKey={key}
                label={label}
                isSelected={currentStyle === key}
                onPress={() => handleSelect(key)}
                theme={theme}
              />
            ))}
            <View style={{ flex: 1 }} />
          </View>
        </View>

        {/* Pro section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Text style={sectionLabelStyle}>Pro</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {PRO_STYLES.map(({ key, label }) => (
              <StyleTile
                key={key}
                styleKey={key}
                label={label}
                isSelected={currentStyle === key}
                onPress={() => handleSelect(key)}
                theme={theme}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </>
  );
});
