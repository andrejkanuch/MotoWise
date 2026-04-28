import type { TripTemplatesQuery } from '@motovault/graphql';
import * as Haptics from 'expo-haptics';
import { Plus, Star, X } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../../theme/editorial';

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

interface AddableRouteRowProps {
  trip: TripNode;
  added: boolean;
  contextLabel?: string;
  /** Called with trip.id — use a stable Zustand action or useCallback */
  onToggle: (id: string) => void;
  /** Called with trip.id — use a stable useCallback */
  onPress: (id: string) => void;
}

export const AddableRouteRow = memo(function AddableRouteRow({
  trip,
  added,
  contextLabel,
  onToggle,
  onPress,
}: AddableRouteRowProps) {
  const { t } = useEditorialTheme();

  const handleToggle = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(trip.id);
  }, [onToggle, trip.id]);

  const surfaceLabel =
    trip.surfaceType === 'paved'
      ? 'Paved'
      : trip.surfaceType === 'mixed'
        ? 'Mixed'
        : trip.surfaceType === 'off_road'
          ? 'Off-road'
          : null;

  const handlePress = useCallback(() => {
    onPress(trip.id);
  }, [onPress, trip.id]);

  return (
    <Pressable
      onPress={handlePress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: added ? tint(t.warm, 0.07) : t.surface,
        borderWidth: 1,
        borderColor: added ? tint(t.warm, 0.22) : t.line,
      }}
    >
      {/* Thumbnail placeholder */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          borderCurve: 'continuous',
          backgroundColor: t.surface2,
        }}
      />

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 13.5,
            fontWeight: '600',
            color: t.ink,
            letterSpacing: -0.1,
            lineHeight: 16,
          }}
          numberOfLines={1}
        >
          {trip.title}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
          {trip.distanceM != null && (
            <Text style={{ fontSize: 10.5, color: t.ink3 }}>
              {Math.round(trip.distanceM / 1000)} km
            </Text>
          )}
          {surfaceLabel && (
            <>
              <Text style={{ fontSize: 10.5, color: t.ink3, opacity: 0.4 }}>{'·'}</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3 }}>{surfaceLabel}</Text>
            </>
          )}
          {trip.averageRating != null && (
            <>
              <Text style={{ fontSize: 10.5, color: t.ink3, opacity: 0.4 }}>{'·'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Star size={9} color={t.warm} fill={t.warm} />
                <Text style={{ fontSize: 10.5, color: t.ink3 }}>
                  {trip.averageRating.toFixed(1)}
                </Text>
              </View>
            </>
          )}
        </View>

        {contextLabel && (
          <Text
            style={{
              fontFamily: 'GeistMono',
              fontSize: 9.5,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: t.warm,
              marginTop: 5,
              fontWeight: '600',
            }}
          >
            {contextLabel}
          </Text>
        )}
      </View>

      {/* Add/Remove toggle */}
      <Pressable
        onPress={handleToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: added ? t.warm : t.surface2,
          borderWidth: added ? 0 : 1,
          borderColor: t.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {added ? <X size={15} color="#1a1208" /> : <Plus size={15} color={t.ink2} />}
      </Pressable>
    </Pressable>
  );
});
