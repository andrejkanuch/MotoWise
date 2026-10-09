import { palette } from '@motovault/design-system';
import { CheckCircle2, Undo2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { SYSTEM_WEIGHT, type } from '../../theme/type';
import { useLatestReceiptSaveUndo } from './receipt-scan-undo-store';
import { SAVE_SNACKBAR_FRESH_MS, SAVE_SNACKBAR_TIMEOUT_MS } from './scan-flow-constants';
import { useUndoReceiptSave } from './use-receipt-scan-save';

/**
 * Post-save "Saved to {bike} — Undo" snackbar (U7d).
 *
 * Mounted once at the app root so it survives the scan modal's dismissal — the
 * toast appears on whatever screen the rider lands back on. It reads the durable
 * undo store: a fresh entry auto-pops the toast for `SAVE_SNACKBAR_TIMEOUT_MS`,
 * but the entry itself lives on past the toast (the home card in U8 offers undo
 * later). Stale entries (older than `SAVE_SNACKBAR_FRESH_MS`) never re-pop on a
 * cold launch.
 */
export function ReceiptScanSaveSnackbar() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const entry = useLatestReceiptSaveUndo();
  const { undo, undoing } = useUndoReceiptSave();

  const [visibleScanId, setVisibleScanId] = useState<string | null>(null);
  const seenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!entry || seenRef.current === entry.scanId) return;
    // Only auto-pop for a freshly-written entry, not a still-undoable stale one.
    if (Date.now() - new Date(entry.savedAt).getTime() > SAVE_SNACKBAR_FRESH_MS) return;

    seenRef.current = entry.scanId;
    setVisibleScanId(entry.scanId);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisibleScanId(null), SAVE_SNACKBAR_TIMEOUT_MS);
    return () => clearTimeout(timerRef.current);
  }, [entry]);

  if (!entry || visibleScanId !== entry.scanId) return null;

  const handleUndo = async () => {
    if (undoing) return;
    clearTimeout(timerRef.current);
    setVisibleScanId(null);
    await undo(entry);
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutDown.duration(200)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 200 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: theme.line,
          shadowColor: palette.black,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <CheckCircle2 size={22} color={theme.success} strokeWidth={2.5} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.bodyStrong, color: theme.ink }} numberOfLines={1}>
            {t('receiptScan.saved.toast', { bike: entry.bikeName })}
          </Text>
          {entry.freeScansLeft != null && (
            <Text style={{ ...type.caption, color: theme.ink3, marginTop: 2 }}>
              {t('receiptScan.saved.freeScansLeft', { count: entry.freeScansLeft })}
            </Text>
          )}
        </View>
        <Pressable
          onPress={handleUndo}
          disabled={undoing}
          accessibilityRole="button"
          accessibilityLabel={t('receiptScan.saved.undo')}
          hitSlop={8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: tint(theme.warm, 0.12),
          }}
        >
          {undoing ? (
            <ActivityIndicator size="small" color={theme.warm} />
          ) : (
            <Undo2 size={16} color={theme.warm} strokeWidth={2.5} />
          )}
          <Text style={{ ...type.subhead, ...SYSTEM_WEIGHT.semibold, color: theme.warm }}>
            {t('receiptScan.saved.undo')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
