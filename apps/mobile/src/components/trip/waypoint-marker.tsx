/**
 * WaypointMarker — the small circular type-coloured pin rendered on trip maps for
 * each waypoint. Renders as a Pressable when `onPress` is supplied (trip detail),
 * otherwise a static View (create-trip editor).
 */

import { palette } from '@motovault/design-system';
import { Pressable, View } from 'react-native';
import { getWaypointIcon } from './waypoint-type-picker';

export function WaypointMarker({ type, onPress }: { type: string; onPress?: () => void }) {
  const wt = getWaypointIcon(type);

  const style = {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    backgroundColor: wt.color,
    borderWidth: 2.5,
    borderColor: palette.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  const icon = <wt.Icon size={14} color={palette.white} />;

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={style}>
        {icon}
      </Pressable>
    );
  }
  return <View style={style}>{icon}</View>;
}
