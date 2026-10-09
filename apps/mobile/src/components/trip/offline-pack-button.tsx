import { CheckCircle, CloudDownload, Loader, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, View } from 'react-native';
import type { OfflineStatus } from '../../hooks/use-offline-trip';
import { formatBytes } from '../../lib/offline-trips';
import { useEditorialTheme } from '../../theme/editorial';
import { type } from '../../theme/type';

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
  const { t: theme } = useEditorialTheme();
  const { t, i18n } = useTranslation();
  const titleColor = theme.ink;
  const subColor = theme.ink3;
  const cardBg = theme.surface2;

  const confirmRemove = () => {
    Alert.alert(t('offlinePack.removeTitle'), t('offlinePack.removeBody'), [
      { text: t('offlinePack.keep'), style: 'cancel' },
      { text: t('offlinePack.remove'), style: 'destructive', onPress: onRemove },
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
        <Loader size={18} color={theme.warm} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: titleColor }]}>
            {t('offlinePack.downloading')}
          </Text>
          <Text style={[type.caption, { color: subColor, marginTop: 2 }]}>
            {t('offlinePack.progress', {
              percent: Math.round(progress?.percentage ?? 0),
              size: formatBytes(progress?.completedResourceSize ?? 0),
            })}
          </Text>
          {/* Progress bar */}
          <View
            style={{
              marginTop: 6,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.line2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress?.percentage ?? 0))}%`,
                backgroundColor: theme.warm,
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
        <CheckCircle size={18} color={theme.success} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: titleColor }]}>{t('offlinePack.ready')}</Text>
          <Text style={[type.caption, { color: subColor, marginTop: 2 }]}>
            {t('offlinePack.readyMeta', {
              size: formatBytes(meta.sizeBytes),
              date: dl.toLocaleDateString(i18n.language),
            })}
          </Text>
        </View>
        <Pressable
          onPress={confirmRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('offlinePack.removeA11y')}
          style={{ padding: 6 }}
        >
          <Trash2 size={16} color={theme.danger} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onDownload}
      accessibilityRole="button"
      accessibilityLabel={t('offlinePack.downloadA11y')}
      accessibilityHint={t('offlinePack.downloadHint')}
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
      <CloudDownload size={18} color={theme.warm} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: titleColor }]}>{t('offlinePack.downloadPro')}</Text>
        <Text style={[type.caption, { color: subColor, marginTop: 2 }]}>
          {t('offlinePack.downloadBody')}
        </Text>
      </View>
    </Pressable>
  );
}
