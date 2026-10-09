import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight, ScanLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useReceiptScanEntry } from '../../features/receipt-scan/receipt-scan-entry';
import type { ScanEntrySurface } from '../../features/receipt-scan/scan-flow-constants';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

/** Material minimum on Android, a little taller on iOS so icon + label breathe. */
const ACTION_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 64 : 68;
const ROW_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;
const ACTION_ICON_SIZE = 22;
/** Four labels share the row: they stop growing here and shrink to fit past it. */
const ACTION_LABEL_MAX_SCALE = 1.4;
const ACTION_LABEL_MIN_SCALE = 0.8;

export interface HomeAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  testID?: string;
}

/** Ride, Expense, Task, Diagnose — four equal actions directly under the plate. */
export function HomeActionRow({ actions }: { actions: readonly HomeAction[] }) {
  const { t: theme } = useEditorialTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }}>
      {actions.map(({ key, icon: Icon, label, onPress, testID }) => (
        <Pressable
          key={key}
          testID={testID}
          onPress={() => {
            triggerImpact();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          android_ripple={{ color: tint(theme.ink, 0.08), borderless: false }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: ACTION_MIN_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.xxs,
            paddingVertical: space.sm,
            paddingHorizontal: space.xxs,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor:
              pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : theme.surface,
          })}
        >
          <Icon size={ACTION_ICON_SIZE} color={theme.ink} strokeWidth={1.9} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={ACTION_LABEL_MIN_SCALE}
            maxFontSizeMultiplier={ACTION_LABEL_MAX_SCALE}
            style={[type.label, { color: theme.ink2, maxWidth: '100%' }]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * "Scan a receipt" as one quiet row (U8). Same behaviour as the banner it
 * replaces — quota badge, paywall once the free scans are used — drawn as a
 * plain row so it does not compete with the action row above it.
 */
export function ReceiptScanRow({
  motorcycleId,
  surface,
}: {
  motorcycleId?: string;
  surface: ScanEntrySurface;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { open, remaining, showFreeBadge, showUpsellBadge } = useReceiptScanEntry({
    motorcycleId,
    surface,
  });

  const badge = showFreeBadge
    ? t('receiptScan.entry.freeBadge', { count: remaining })
    : showUpsellBadge
      ? t('receiptScan.entry.upsellBadge')
      : null;

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t('receiptScan.entry.title')}
      accessibilityHint={t('receiptScan.entry.subtitle')}
      android_ripple={{ color: tint(theme.ink, 0.08) }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: space.xs,
        paddingHorizontal: space.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : theme.surface,
      })}
    >
      <ScanLine size={20} color={theme.ink2} strokeWidth={1.9} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.body, { color: theme.ink }]} numberOfLines={1}>
          {t('receiptScan.entry.title')}
        </Text>
        <Text style={[type.caption, { color: theme.ink3 }]} numberOfLines={2}>
          {t('receiptScan.entry.subtitle')}
        </Text>
      </View>
      {badge ? (
        <Text
          maxFontSizeMultiplier={ACTION_LABEL_MAX_SCALE}
          style={[type.label, { color: showUpsellBadge ? theme.warm2 : theme.ink3 }]}
        >
          {badge}
        </Text>
      ) : null}
      <ChevronRight size={17} color={theme.ink4} strokeWidth={2} />
    </Pressable>
  );
}
