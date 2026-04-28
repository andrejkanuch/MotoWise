import type { TripTemplatesQuery } from '@motovault/graphql';
import * as Haptics from 'expo-haptics';
import { ArrowRight, Route, X } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorialTheme } from '../../../theme/editorial';

type TripNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

interface TripBasketProps {
  items: TripNode[];
  onOpen: () => void;
  onRemove: (id: string) => void;
}

export function TripBasket({ items, onOpen, onRemove }: TripBasketProps) {
  const { t } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const totalKm = items.reduce((acc, item) => acc + (item.distanceM ?? 0) / 1000, 0);
  const totalElev = items.reduce((acc, item) => acc + (item.elevationGainM ?? 0), 0);
  const fuelStops = Math.max(1, Math.ceil(totalKm / 280));

  const handleOpen = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onOpen();
  }, [onOpen]);

  if (items.length === 0) return null;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : SlideInDown.duration(300).springify()}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 76,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 20,
        borderCurve: 'continuous',
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
        boxShadow: '0 18px 40px rgba(26,21,16,0.22), 0 4px 10px rgba(26,21,16,0.06)',
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: t.ink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Route size={13} color={t.bg} />
            {/* Badge count */}
            <View
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 4,
                borderRadius: 8,
                backgroundColor: t.warm,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: t.surface,
              }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#1a1208' }}>
                {items.length}
              </Text>
            </View>
          </View>

          <View style={{ gap: 2, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '600',
                color: t.ink,
                lineHeight: 14,
              }}
            >
              Your trip · {items.length} roads
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={{ fontSize: 10.5, color: t.ink3 }}>{Math.round(totalKm)} km</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3, opacity: 0.4 }}>{'·'}</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3 }}>+{Math.round(totalElev)}m</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3, opacity: 0.4 }}>{'·'}</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3 }}>{fuelStops} fuel</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleOpen}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: t.warm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1a1208' }}>Open</Text>
          <ArrowRight size={11} color="#1a1208" />
        </Pressable>
      </View>

      {/* Mini route strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {items.map((item) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 5,
              paddingLeft: 5,
              paddingRight: 9,
              backgroundColor: t.bg2,
              borderRadius: 10,
              borderCurve: 'continuous',
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: t.surface2 }} />
            <Text style={{ fontSize: 11, fontWeight: '500', color: t.ink }} numberOfLines={1}>
              {item.title}
            </Text>
            <Pressable onPress={() => onRemove(item.id)} hitSlop={6}>
              <X size={10} color={t.ink3} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
