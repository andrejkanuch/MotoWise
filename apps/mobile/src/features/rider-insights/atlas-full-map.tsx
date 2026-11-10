import MapboxGL from '@rnmapbox/maps';
import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { MAP_STYLES } from '@/utils/map-styles';
import { RouteLayers, routesShape } from './atlas-hero';
import { fitViewport } from './region-tiles';
import type { RiderInsightsRegion } from './use-rider-insights';

/** Room around the routes the map opens on. */
const MAP_PADDING = space.xxl;
const CLOSE_BUTTON = 44;
const CLOSE_ICON = 22;

/** Every region's routes, in one list: the full map draws the whole season. */
export function seasonRoutes(regions: readonly RiderInsightsRegion[]): string[] {
  return regions.flatMap((region) => region.routes);
}

interface AtlasFullMapProps {
  visible: boolean;
  /** Every region of the season; the first is the one on the hero, the map opens on it. */
  regions: readonly RiderInsightsRegion[];
  onClose: () => void;
}

/**
 * The season's map full screen: every route from every region in the hero's
 * copper, free to pinch, pan and rotate. It opens framed on the region the
 * hero shows. A plain full-screen Modal over the page, like the share sheet:
 * the regions and the region shown are already in the page's hands.
 */
export function AtlasFullMap({ visible, regions, onClose }: AtlasFullMapProps) {
  const { t: i18n } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Decoded only once the map is opened: most visits never open it.
  const shape = useMemo(
    () => routesShape(visible ? seasonRoutes(regions) : []),
    [visible, regions],
  );
  const bounds = regions.find((region) => region.bounds)?.bounds ?? null;
  const styleURL = isDark ? MAP_STYLES.dark : MAP_STYLES.light;
  const viewport = bounds ? fitViewport(bounds, width, height, MAP_PADDING) : null;
  const ornamentTop = insets.top + space.sm;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View testID="atlas-full-map" style={{ flex: 1, backgroundColor: t.bg }}>
        {viewport ? (
          <MapboxGL.MapView
            key={styleURL}
            testID="atlas-full-map-view"
            style={{ flex: 1 }}
            styleURL={styleURL}
            surfaceView={process.env.EXPO_OS !== 'android'}
            scaleBarEnabled={false}
            compassEnabled
            compassPosition={{ top: ornamentTop, left: space.md }}
            logoPosition={{ bottom: insets.bottom + space.xs, left: space.md }}
            attributionPosition={{ bottom: insets.bottom + space.xs, right: space.md }}
            pitchEnabled={false}
          >
            <MapboxGL.Camera
              defaultSettings={{ centerCoordinate: viewport.center, zoomLevel: viewport.zoom }}
              animationDuration={0}
            />
            <RouteLayers id="insights-full-routes" shape={shape} styleURL={styleURL} />
          </MapboxGL.MapView>
        ) : null}
        <Pressable
          testID="atlas-full-map-close"
          accessibilityRole="button"
          accessibilityLabel={i18n('riderInsights.map.close')}
          onPress={onClose}
          hitSlop={space.xs}
          style={({ pressed }) => ({
            position: 'absolute',
            top: ornamentTop,
            right: space.md,
            width: CLOSE_BUTTON,
            height: CLOSE_BUTTON,
            borderRadius: CLOSE_BUTTON / 2,
            borderCurve: 'continuous',
            backgroundColor: t.surface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <X size={CLOSE_ICON} color={t.ink} strokeWidth={2} />
        </Pressable>
      </View>
    </Modal>
  );
}
