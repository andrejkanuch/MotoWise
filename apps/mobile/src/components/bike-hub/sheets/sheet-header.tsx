import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SYSTEM_WEIGHT, type } from '@/theme/type';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_TOUCH_TARGET, useHubTheme } from '../ui/tokens';

/** Grabber for Android, where the form sheet draws none of its own. */
export function SheetGrabber() {
  const hub = useHubTheme();
  if (process.env.EXPO_OS !== 'android') return null;
  return (
    <View
      style={{
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: hub.track,
        alignSelf: 'center',
        marginBottom: 6,
      }}
    />
  );
}

/**
 * Where "Cancel" sits. A sheet that also has a Save button puts it LEADING (the
 * iOS convention: Cancel left, title centred, the confirming action elsewhere);
 * a chooser with no Save (Log) keeps it TRAILING beside a left-aligned title.
 */
export const SHEET_CANCEL_PLACEMENT = {
  LEADING: 'leading',
  TRAILING: 'trailing',
} as const;
export type SheetCancelPlacement =
  (typeof SHEET_CANCEL_PLACEMENT)[keyof typeof SHEET_CANCEL_PLACEMENT];

/** Controls of a hub sheet that cannot be used while it saves (or after it saved). */
export const SHEET_LOCKED_OPACITY = 0.45;

const TITLE_LINES = 2;
/** Dimmed Cancel while it cannot be used (a save in flight). */
const DISABLED_OPACITY = 0.4;
const PRESSED_OPACITY = 0.6;

interface SheetHeaderProps {
  title: string;
  onCancel: () => void;
  /** Defaults to trailing (Log and Odometer sheets). */
  cancelPlacement?: SheetCancelPlacement;
  /** Cancel does nothing and reads as disabled (e.g. while a save is in flight). */
  cancelDisabled?: boolean;
  cancelTestID?: string;
}

/** One header design for every hub sheet: condensed title plus "Cancel". */
export function SheetHeader({
  title,
  onCancel,
  cancelPlacement = SHEET_CANCEL_PLACEMENT.TRAILING,
  cancelDisabled = false,
  cancelTestID,
}: SheetHeaderProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  const leading = cancelPlacement === SHEET_CANCEL_PLACEMENT.LEADING;
  // With Cancel leading, the title is centred on the sheet: a spacer as wide as
  // Cancel (measured, so a long translation or a larger text size stays centred)
  // balances the row.
  const [cancelWidth, setCancelWidth] = useState(0);

  const cancel = (
    <Pressable
      testID={cancelTestID}
      onPress={onCancel}
      disabled={cancelDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: cancelDisabled }}
      onLayout={leading ? (event) => setCancelWidth(event.nativeEvent.layout.width) : undefined}
      style={({ pressed }) => ({
        minHeight: HUB_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: 4,
        opacity: cancelDisabled ? DISABLED_OPACITY : pressed ? PRESSED_OPACITY : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        numberOfLines={1}
        style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: hub.dim }]}
      >
        {t('common.cancel')}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 2,
      }}
    >
      {leading ? cancel : null}
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        accessibilityRole="header"
        numberOfLines={TITLE_LINES}
        style={[
          type.sheetTitle,
          { flex: 1, textAlign: leading ? 'center' : 'left', color: hub.text },
        ]}
      >
        {title}
      </Text>
      {leading ? <View style={{ width: cancelWidth }} /> : cancel}
    </View>
  );
}
