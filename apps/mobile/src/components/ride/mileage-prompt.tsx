import { palette } from '@motovault/design-system';
import { AlertTriangle } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface MileagePromptProps {
  currentMileage: number;
  rideDistance: number;
  mileageUnit: 'mi' | 'km';
  gpsQuality: number;
  onAccept: () => void;
  onEdit: () => void;
  onSkip: () => void;
}

export function MileagePrompt({
  currentMileage,
  rideDistance,
  mileageUnit,
  gpsQuality,
  onAccept,
  onEdit,
  onSkip,
}: MileagePromptProps) {
  const newMileage = Math.round(currentMileage + rideDistance);
  const showGpsWarning = gpsQuality < 0.5;

  return (
    <Animated.View
      entering={FadeInUp.duration(280)}
      style={{
        backgroundColor: palette.neutral900,
        borderRadius: 24,
        borderCurve: 'continuous',
        padding: 24,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '700', color: palette.white }}>
        Update odometer?
      </Text>

      <Text style={{ fontSize: 15, color: palette.neutral300, lineHeight: 22 }}>
        Current: {currentMileage.toLocaleString()} {mileageUnit} {'  \u2192  '}
        New: {newMileage.toLocaleString()} {mileageUnit}
      </Text>

      {showGpsWarning && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: palette.warningBgDark,
            borderRadius: 12,
            borderCurve: 'continuous',
            padding: 12,
          }}
        >
          <AlertTriangle size={16} color={palette.warning500} />
          <Text style={{ fontSize: 13, color: palette.warning500, flex: 1 }}>
            GPS accuracy was poor for this ride. Distance may be inaccurate.
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* Accept */}
        <Pressable
          onPress={onAccept}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: palette.accent500,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>Accept</Text>
        </Pressable>

        {/* Edit */}
        <Pressable
          onPress={onEdit}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: palette.neutral600,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.neutral300 }}>Edit</Text>
        </Pressable>
      </View>

      {/* Skip */}
      <Pressable onPress={onSkip} style={{ alignSelf: 'center', paddingVertical: 8 }}>
        <Text style={{ fontSize: 14, color: palette.neutral500 }}>Skip</Text>
      </Pressable>
    </Animated.View>
  );
}
