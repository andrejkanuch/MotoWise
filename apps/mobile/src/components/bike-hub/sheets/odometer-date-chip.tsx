import DateTimePicker from '@expo/ui/community/datetime-picker';
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, environment, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { EDITORIAL_SCHEME, useEditorialTheme } from '@/theme/editorial';
import { type } from '@/theme/type';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_HEIGHT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  useHubTheme,
} from '../ui/tokens';
import { SHEET_LOCKED_OPACITY } from './sheet-header';

export interface OdometerDateChipProps {
  /** The reading's day. */
  value: Date;
  /** Latest selectable day. */
  today: Date;
  /** "Today" / "Oct 3" — what the chip says. */
  label: string;
  onPick: (date: Date) => void;
  /** Locked while the reading saves. */
  disabled?: boolean;
}

const CHIP_HIT_SLOP = (HUB_TOUCH_TARGET - HUB_HEIGHT.small) / 2;

/**
 * iOS: the system's compact date control. It sits in the reading's row, and
 * its calendar opens as a popover over the sheet — the keypad never moves.
 */
export function IosOdometerDateChip({
  value,
  today,
  onPick,
  disabled = false,
}: OdometerDateChipProps) {
  const hub = useHubTheme();
  const { isDark } = useEditorialTheme();
  const { i18n } = useTranslation();
  return (
    // The native control has no RN `disabled`: a locked chip takes no touches.
    <View
      testID="odometer-date-lock"
      accessibilityState={{ disabled }}
      style={{
        opacity: disabled ? SHEET_LOCKED_OPACITY : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <Host matchContents>
        <DatePicker
          testID="odometer-date"
          selection={value}
          range={{ end: today }}
          displayedComponents={['date']}
          onDateChange={onPick}
          modifiers={[
            datePickerStyle('compact'),
            labelsHidden(),
            tint(hub.copperText),
            environment('colorScheme', isDark ? EDITORIAL_SCHEME.DARK : EDITORIAL_SCHEME.LIGHT),
            environment('locale', i18n.language),
          ]}
        />
      </Host>
    </View>
  );
}

/**
 * Android: a chip ("Today ▾") that opens the Material date dialog over the
 * sheet. The dialog confirms or cancels on its own — no "Done" in the sheet.
 */
export function AndroidOdometerDateChip({
  value,
  today,
  label,
  onPick,
  disabled = false,
}: OdometerDateChipProps) {
  const hub = useHubTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID="odometer-date"
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('bikeHub.odometer.dateA11y', { date: label })}
        accessibilityState={{ disabled }}
        hitSlop={CHIP_HIT_SLOP}
        android_ripple={{ color: hub.ripple, borderless: false }}
        style={{
          height: HUB_HEIGHT.small,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 12,
          paddingRight: 8,
          borderRadius: HUB_RADIUS.chip,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: hub.ripple,
          backgroundColor: hub.ground,
          overflow: 'hidden',
          opacity: disabled ? SHEET_LOCKED_OPACITY : 1,
        }}
      >
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          numberOfLines={1}
          style={[type.label, { color: hub.text }]}
        >
          {label}
        </Text>
        <ChevronDown size={14} color={hub.muted} strokeWidth={2} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={today}
          presentation="dialog"
          onValueChange={(_event, date) => {
            setOpen(false);
            onPick(date);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** The reading's date, beside the reading. Platform-native picker on each OS. */
export function OdometerDateChip(props: OdometerDateChipProps) {
  if (process.env.EXPO_OS === 'android') return <AndroidOdometerDateChip {...props} />;
  return <IosOdometerDateChip {...props} />;
}
