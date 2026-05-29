import { Image, type ImageStyle } from 'expo-image';
import { Route } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';
import { buildMapboxStaticUrl } from '../../utils/mapbox-static';

interface RideMapThumbnailProps {
  rideId: string;
  routePolyline?: string | null;
  routeThumbnailUri?: string | null;
  style?: ViewStyle;
}

export const RideMapThumbnail = memo(function RideMapThumbnail({
  rideId,
  routePolyline,
  routeThumbnailUri,
  style,
}: RideMapThumbnailProps) {
  const { t, isDark } = useEditorialTheme();

  const staticUrl = useMemo(() => {
    if (!routePolyline) return null;
    return buildMapboxStaticUrl({
      style: isDark ? 'dark-v11' : 'light-v11',
      routePolyline,
      width: 400,
      height: 200,
      strokeColor: 'D4622E',
      strokeWidth: 3,
      padding: 40,
    });
  }, [routePolyline, isDark]);

  const imageUri = staticUrl ?? routeThumbnailUri;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[{ backgroundColor: t.surface2 }, style as ImageStyle]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={rideId}
        transition={180}
      />
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Route size={28} color={t.ink4} />
    </View>
  );
});
