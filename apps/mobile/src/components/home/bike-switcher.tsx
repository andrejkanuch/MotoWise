import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';
import type { HomeMotorcycle } from './home-types';

interface BikeSwitcherProps {
  bikes: HomeMotorcycle[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAddBike: () => void;
}

export function BikeSwitcher({ bikes, selectedIndex, onSelect, onAddBike }: BikeSwitcherProps) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();

  if (bikes.length <= 1) return null;

  return (
    <View style={{ paddingBottom: 2 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 2 }}
      >
        {bikes.map((bike, i) => {
          const active = i === selectedIndex;
          return (
            <Pressable
              key={bike.id}
              onPress={() => onSelect(i)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 6,
                paddingLeft: 6,
                paddingRight: 14,
                borderRadius: 999,
                backgroundColor: active ? theme.surface2 : 'transparent',
                borderWidth: 1,
                borderColor: active ? theme.line : 'transparent',
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  overflow: 'hidden',
                  borderWidth: 1.5,
                  borderColor: active ? theme.warm : theme.line,
                  backgroundColor: theme.surface2,
                }}
              >
                {bike.primaryPhotoUrl ? (
                  <Image
                    source={{ uri: bike.primaryPhotoUrl }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.ink3 }}>
                      {bike.make.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: active ? theme.ink : theme.ink2,
                    letterSpacing: -0.05,
                    lineHeight: 14,
                  }}
                  numberOfLines={1}
                >
                  {bike.make}
                </Text>
                <Text style={{ fontSize: 10, color: theme.ink3, lineHeight: 13 }} numberOfLines={1}>
                  {bike.model}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* Add bike chip */}
        <Pressable
          onPress={onAddBike}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <Plus size={14} color={theme.ink3} />
          <Text style={{ fontSize: 12, fontWeight: '500', color: theme.ink3 }}>
            {t('home.addBike', { defaultValue: 'Add bike' })}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
