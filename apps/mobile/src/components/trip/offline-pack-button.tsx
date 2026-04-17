import { palette } from '@motovault/design-system';
import { CheckCircle, CloudDownload, Loader, Trash2 } from 'lucide-react-native';
import { Alert, Pressable, Text, useColorScheme, View } from 'react-native';
import { formatBytes } from '../../lib/offline-trips';
import type { OfflineStatus } from '../../hooks/use-offline-trip';

interface OfflinePackButtonProps {
  status: OfflineStatus;
  progress: { percentage: number; completedResourceSize: number } | null;
  meta: { sizeBytes?: number; downloadedAt: string } | null;
  onDownload: () => void;
  onRemove: () => void;
}

export function OfflinePackButton({
  status,
  progress,
  meta,
  onDownload,
  onRemove,
}: OfflinePackButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subColor = isDark ? palette.neutral400 : palette.neutral500;
  const cardBg = isDark ? palette.surfaceElevated : palette.neutral50;

  const confirmRemove = () => {
    Alert.alert('Remove offline download?', 'Frees up the tiles this trip saved for offline use.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  };

  if (status === 'downloading') {
    return (
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 12,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Loader size={18} color={palette.accent500} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: titleColor }}>
            Downloading offline pack…
          </Text>
          <Text style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {Math.round(progress?.percentage ?? 0)}% ·{' '}
            {formatBytes(progress?.completedResourceSize ?? 0)}
          </Text>
          {/* Progress bar */}
          <View
            style={{
              marginTop: 6,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress?.percentage ?? 0))}%`,
                backgroundColor: palette.accent500,
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  if (status === 'ready' && meta) {
    const dl = new Date(meta.downloadedAt);
    return (
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 12,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <CheckCircle size={18} color={palette.success500} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: titleColor }}>
            Available offline
          </Text>
          <Text style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {formatBytes(meta.sizeBytes)} · downloaded {dl.toLocaleDateString()}
          </Text>
        </View>
        <Pressable
          onPress={confirmRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove offline download"
          style={{ padding: 6 }}
        >
          <Trash2 size={16} color={palette.danger500} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onDownload}
      accessibilityRole="button"
      accessibilityLabel="Download for offline"
      accessibilityHint="Caches tiles and trip data so you can use it without signal"
      style={{
        backgroundColor: cardBg,
        borderRadius: 12,
        borderCurve: 'continuous',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <CloudDownload size={18} color={palette.accent500} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: titleColor }}>
          Download for offline
        </Text>
        <Text style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
          Map tiles + trip data saved to this device.
        </Text>
      </View>
    </Pressable>
  );
}
