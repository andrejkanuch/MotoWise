import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Layers, X } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorialTheme } from '../../theme/editorial';

type FreeStyle = 'light' | 'dark' | 'outdoors';

const FREE_STYLES: { key: FreeStyle; label: string }[] = [
  { key: 'light', label: 'Standard' },
  { key: 'dark', label: 'Dark' },
  { key: 'outdoors', label: 'Outdoors' },
];

const PRO_STYLES = ['Satellite', 'Hybrid', 'Terrain', 'Heatmap'] as const;

interface MapPickerSheetProps {
  currentStyle: string;
  onSelectStyle: (style: FreeStyle) => void;
  onClose: () => void;
}

export const MapPickerSheet = memo(function MapPickerSheet({
  currentStyle,
  onSelectStyle,
  onClose,
}: MapPickerSheetProps) {
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();

  const handleProTap = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert('Pro Feature', 'Coming soon');
  }, []);

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
          backgroundColor: 'rgba(8,7,6,0.5)',
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
          backgroundColor: '#161412',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderCurve: 'continuous',
          paddingBottom: insets.bottom + 16,
          shadowColor: '#000',
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
            backgroundColor: 'rgba(255,255,255,0.18)',
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
          <Text
            style={{
              fontFamily: 'GeistMono-SemiBold',
              fontSize: 10.5,
              fontWeight: '600',
              letterSpacing: 2.52,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            MAP STYLE
          </Text>
          <Pressable
            onPress={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 99,
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        {/* Free section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
          <Text
            style={{
              fontFamily: 'GeistMono-SemiBold',
              fontSize: 9.5,
              fontWeight: '600',
              letterSpacing: 2.09,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 10,
            }}
          >
            FREE
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {FREE_STYLES.map(({ key, label }) => {
              const isSelected = currentStyle === key;
              return (
                <Pressable key={key} onPress={() => onSelectStyle(key)} style={{ flex: 1, alignItems: 'center' }}>
                  <View
                    style={{
                      width: '100%',
                      aspectRatio: 1,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      backgroundColor: '#2a2723',
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: isSelected ? theme.warm : 'transparent',
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Layers size={20} color={isSelected ? theme.warm : 'rgba(255,255,255,0.4)'} />
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
                        <Text style={{ color: palette.white, fontSize: 10, fontWeight: '700' }}>
                          ✓
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: 'rgba(255,255,255,0.85)',
                      marginTop: 7,
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            {/* Empty spacer for 4th column */}
            <View style={{ flex: 1 }} />
          </View>
        </View>

        {/* Pro section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Text
            style={{
              fontFamily: 'GeistMono-SemiBold',
              fontSize: 9.5,
              fontWeight: '600',
              letterSpacing: 2.09,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 10,
            }}
          >
            PRO
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {PRO_STYLES.map((label) => (
              <Pressable key={label} onPress={handleProTap} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    backgroundColor: '#2a2723',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Layers size={20} color="rgba(255,255,255,0.3)" />
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 99,
                      backgroundColor: 'rgba(15,12,8,0.6)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: palette.white, fontSize: 10 }}>🔒</Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.85)',
                    marginTop: 7,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Animated.View>
    </>
  );
});
