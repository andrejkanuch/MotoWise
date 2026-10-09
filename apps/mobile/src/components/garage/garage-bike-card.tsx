/**
 * One bike in the Garage list: an identity row (photo thumbnail, make and
 * model, nickname · primary · year, a "more" menu) over the bike's plate. The
 * plate is the object — its colour says whether the bike is ready — and the
 * photo only supports it. A single bike gets the hero plate.
 */

import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { Image } from 'expo-image';
import { Bike, MoreHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import type { PlateCopy } from '../home/home-plate';
import { BikePlate, type PlateSize } from '../ui/bike-plate';

type GarageBike = MyMotorcyclesQuery['myMotorcycles'][number];

const THUMB_SIZE = 56;
const MENU_SIZE = process.env.EXPO_OS === 'android' ? 48 : 44;
const SEPARATOR = ' · ';

interface GarageBikeCardProps {
  bike: GarageBike;
  plate: PlateCopy;
  size: PlateSize;
  onOpen: () => void;
  onMenu: () => void;
}

export function GarageBikeCard({ bike, plate, size, onOpen, onMenu }: GarageBikeCardProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const name = `${bike.make} ${bike.model}`;
  const nickname = bike.nickname?.trim();
  const detail = [nickname, bike.isPrimary ? t('garage.primary') : null, String(bike.year)]
    .filter(Boolean)
    .join(SEPARATOR);

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${name}. ${detail}`}
          accessibilityHint={t('home.plateHint')}
          android_ripple={{ color: theme.line, borderless: false }}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {bike.primaryPhotoUrl ? (
              <Image
                source={{ uri: bike.primaryPhotoUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                recyclingKey={bike.id}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Bike size={24} color={theme.ink3} strokeWidth={1.75} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[type.subhead, { color: theme.ink3 }]} numberOfLines={1}>
              {detail}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={t('garage.bikeMenuA11y', { name })}
          android_ripple={{ color: theme.line, borderless: true }}
          style={({ pressed }) => ({
            width: MENU_SIZE,
            height: MENU_SIZE,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              pressed && process.env.EXPO_OS === 'ios' ? tint(theme.ink, 0.08) : 'transparent',
          })}
        >
          <MoreHorizontal size={20} color={theme.ink2} />
        </Pressable>
      </View>

      <BikePlate
        state={plate.state}
        figure={plate.figure}
        unit={plate.unit}
        caption={plate.caption}
        stateLabel={plate.stateLabel}
        size={size}
        onPress={onOpen}
        accessibilityHint={t('home.plateHint')}
        testID={`garage-bike-plate-${bike.id}`}
      />
    </View>
  );
}
