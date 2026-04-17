import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

export interface MarkerActionOptions {
  title: string;
  lat: number;
  lng: number;
  /** Additional custom actions that appear before "Copy coordinates". */
  extraActions?: Array<{ label: string; onPress: () => void }>;
  /** Shown as the action-sheet message below the title. Defaults to formatted coords. */
  message?: string;
}

const formatCoords = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/**
 * Guards against NaN / Infinity / out-of-range pins that can sneak in via
 * deep links or stale GeoJSON — without this a bogus marker still opens Maps
 * at the equator and copies garbage to the clipboard.
 */
function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

const openAppleMaps = async (lat: number, lng: number, title?: string) => {
  if (!isValidCoord(lat, lng)) return;
  const q = title ? `&q=${encodeURIComponent(title)}` : '';
  const url = `maps://?ll=${lat},${lng}${q}`;
  const ok = await Linking.canOpenURL(url);
  if (ok) {
    Linking.openURL(url);
  } else {
    Linking.openURL(`https://maps.apple.com/?ll=${lat},${lng}${q}`);
  }
};

/**
 * Show an action-sheet for a tapped map marker.
 *
 * Keeps parity between route-detail, trip-detail and discover so every marker
 * tap offers the same verbs: open in maps, copy coordinates, plus any
 * screen-specific actions (e.g. "Add to trip", "View details").
 */
export function showMarkerActionSheet(opts: MarkerActionOptions) {
  const { title, lat, lng, extraActions = [], message } = opts;
  if (!isValidCoord(lat, lng)) return;
  if (Platform.OS === 'ios') Haptics.selectionAsync().catch(() => {});

  const coords = formatCoords(lat, lng);

  const actions: Array<{ label: string; onPress: () => void }> = [
    ...extraActions,
    { label: 'Open in Apple Maps', onPress: () => openAppleMaps(lat, lng, title) },
    {
      label: 'Copy coordinates',
      onPress: () => {
        Clipboard.setStringAsync(coords).catch(() => {});
      },
    },
  ];

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message: message ?? coords,
        options: [...actions.map((a) => a.label), 'Cancel'],
        cancelButtonIndex: actions.length,
      },
      (idx) => {
        if (idx < actions.length) actions[idx]?.onPress();
      },
    );
    return;
  }

  Alert.alert(title, message ?? coords, [
    ...actions.map((a) => ({ text: a.label, onPress: a.onPress })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
