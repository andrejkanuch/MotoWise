import { palette } from '@motovault/design-system';
import { ArrowDown, ArrowUp, CalendarDays, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useEditorialTheme } from '../../theme/editorial';
import { getWaypointIcon } from './waypoint-type-picker';

interface StopListItemProps {
  waypoint: {
    id: string;
    sortOrder: number;
    type: string;
    name: string;
    notes?: string;
  };
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
  onMoveDay?: () => void;
  distance?: string;
  duration?: string;
}

export function StopListItem({
  waypoint,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPress,
  onMoveDay,
  distance,
  duration,
}: StopListItemProps) {
  const { t: theme } = useEditorialTheme();
  const wt = getWaypointIcon(waypoint.type);
  const textColor = theme.ink;
  const subtextColor = theme.ink3;
  const rowBg = theme.surface2;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(200)}>
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: rowBg,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: wt.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <wt.Icon size={18} color={palette.white} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }} numberOfLines={1}>
            {waypoint.name}
          </Text>
          {waypoint.notes ? (
            <Text style={{ fontSize: 12, color: subtextColor, marginTop: 2 }} numberOfLines={1}>
              {waypoint.notes}
            </Text>
          ) : null}
          {(distance || duration) && (
            <Text style={{ fontSize: 11, color: theme.warm, marginTop: 3, fontWeight: '500' }}>
              {[distance, duration].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 4 }}>
          {!isFirst && onMoveUp && (
            <Pressable onPress={onMoveUp} hitSlop={8} style={{ padding: 4 }}>
              <ArrowUp size={16} color={subtextColor} />
            </Pressable>
          )}
          {!isLast && onMoveDown && (
            <Pressable onPress={onMoveDown} hitSlop={8} style={{ padding: 4 }}>
              <ArrowDown size={16} color={subtextColor} />
            </Pressable>
          )}
          {onMoveDay && (
            <Pressable onPress={onMoveDay} hitSlop={8} style={{ padding: 4 }}>
              <CalendarDays size={16} color={subtextColor} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 4 }}>
              <Trash2 size={16} color={theme.danger} />
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
