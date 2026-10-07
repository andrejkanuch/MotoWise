import DateTimePicker from '@expo/ui/community/datetime-picker';
import * as Haptics from 'expo-haptics';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, type DimensionValue, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DELTA_DIRECTION,
  type HubUnit,
  ODOMETER_ERROR,
  ODOMETER_QUICK_ADD,
  type OdometerKey,
} from '../../../lib/bike-hub/constants';
import {
  formatOdometer,
  formatShortDate,
  hasOdometer,
  toHubUnit,
} from '../../../lib/bike-hub/format';
import {
  applyKey,
  applyQuickAdd,
  baselineRecordedAt,
  describeDelta,
  type OdometerDelta,
  odometerBaseline,
  parseEntry,
  validateReading,
} from '../../../lib/bike-hub/odometer-input';
import { triggerNotification, triggerSelection } from '../../../utils/haptics';
import type { HubBike } from '../shell/use-bike-hub-data';
import { useToday } from '../shell/use-today';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_FONT, HUB_HEIGHT, HUB_RADIUS, hub } from '../ui/tokens';
import { OdometerKeypad } from './odometer-keypad';
import { SheetGrabber, SheetHeader } from './sheet-header';
import { SheetScroll } from './sheet-scroll';
import { useLogOdometer, useOdometerContext } from './use-log-odometer';

const CHIP_HEIGHT = 40;
/**
 * The rides chip's share of the row: its label wraps onto two lines so the
 * quick-add chips stay beside it (the design's single row). Wider text pushes
 * the quick-add chips onto the next line instead of squeezing anything.
 */
const RIDES_CHIP_MAX_WIDTH = '45%';
const CHIP_LINE_HEIGHT = 17;

interface DeltaContext {
  t: TFunction;
  unit: HubUnit;
  last: string;
  since: string | null;
  language: string;
}

/** The line under the entry: what the new reading means against the last one. */
function deltaLine(
  delta: OdometerDelta | null,
  context: DeltaContext,
): { text: string; warn: boolean } {
  const { t, unit, last, since, language } = context;
  if (!delta) return { text: t('bikeHub.odometer.first'), warn: false };
  const amount = formatOdometer(delta.amount, language);
  const copy: Record<typeof delta.direction, () => { text: string; warn: boolean }> = {
    [DELTA_DIRECTION.UP]: () => ({
      text: since
        ? t('bikeHub.odometer.deltaUp', { delta: amount, unit, date: since, last })
        : t('bikeHub.odometer.deltaUpNoDate', { delta: amount, unit, last }),
      warn: false,
    }),
    [DELTA_DIRECTION.DOWN]: () => ({
      text: t('bikeHub.odometer.deltaDown', { delta: amount, unit, last }),
      warn: true,
    }),
    [DELTA_DIRECTION.FLAT]: () => ({
      text: t('bikeHub.odometer.unchanged', { last }),
      warn: false,
    }),
  };
  return copy[delta.direction]();
}

interface OdometerSheetProps {
  bike: HubBike;
  onClose: () => void;
  /** Tests pin the date; the screen omits it. */
  now?: Date;
}

/**
 * Odometer sheet: the only place the bike's odometer is edited, on both
 * platforms. A numeric pad, quick-add chips, a date, and a confirmation before
 * a reading lower than the last one is saved. Every save is an
 * `odometer_readings` row; nothing is converted between units.
 */
export function OdometerSheet({ bike, onClose, now }: OdometerSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = i18n.language;
  const unit = toHubUnit(bike.distanceUnit);
  const today = useToday(now);
  const { latest, readingsLoading, readingsError, refetchReadings, pendingRides } =
    useOdometerContext(bike.id);
  const logOdometer = useLogOdometer(bike.id);

  const [digits, setDigits] = useState('');
  // `null` = the rider has not picked a date: the reading is for today.
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const recordedAt = pickedDate ?? today;
  const [pickingDate, setPickingDate] = useState(false);
  const [usedQuickAdd, setUsedQuickAdd] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // The baseline is the higher of the latest logged reading and the bike's
  // odometer: a ride end or receipt scan can move `currentMileage` before the
  // readings query refetches. 0 (or nothing) means the odometer was never set.
  const baseline = odometerBaseline(latest?.value, bike.currentMileage);
  const lastValue = hasOdometer(baseline) ? baseline : null;
  const lastRecordedAt = baselineRecordedAt({
    latest,
    currentMileage: bike.currentMileage,
    mileageUpdatedAt: bike.mileageUpdatedAt,
    now: today,
  });
  // Back-dating is judged against the latest reading's time. With no history
  // loaded that is unknown, so only a today reading (stamped "now", always the
  // latest) is safe to save; a past date waits for the history.
  const historyUnknown = readingsError && !isSameCalendarDay(recordedAt, today);
  const value = parseEntry(digits);
  const validation = validateReading({ value, lastValue, recordedAt, lastRecordedAt, today });
  const backdated = validation.ok && validation.backdated;
  const delta = describeDelta(value, lastValue);
  const lastText = lastValue == null ? '' : formatOdometer(lastValue, language);
  // The date only belongs to the baseline when the baseline IS that reading.
  const since =
    latest && latest.value === baseline
      ? formatShortDate(new Date(latest.recordedAt), language)
      : null;

  const emptyDetail = (): string => {
    if (lastValue == null) return t('bikeHub.odometer.first');
    return since
      ? t('bikeHub.odometer.lastReading', { last: lastText, unit, date: since })
      : t('bikeHub.odometer.lastReadingNoDate', { last: lastText, unit });
  };
  // A back-dated reading is not compared with the latest one ("+250 km since
  // Oct 1" for a Sep 27 reading is wrong): the line says what happens to it.
  const detail =
    value === null
      ? { text: emptyDetail(), warn: false }
      : backdated
        ? { text: t('bikeHub.odometer.backdatedNotice', { last: lastText, unit }), warn: true }
        : deltaLine(delta, { t, unit, last: lastText, since, language });

  const onKey = (key: OdometerKey) => {
    setSaveFailed(false);
    setDigits((current) => applyKey(current, key));
  };

  const quickAdd = (amount: number) => {
    triggerSelection();
    setSaveFailed(false);
    setUsedQuickAdd(true);
    setDigits(String(applyQuickAdd(value, lastValue, amount)));
  };

  // Unlike +50 / +100 / +250, the rides chip does not add to what is typed: it
  // SETS the entry to the last reading plus the distance of the rides that are
  // not on the odometer yet — the same result however often it is tapped.
  const addTrackedRides = (distance: number) => {
    triggerSelection();
    setSaveFailed(false);
    setUsedQuickAdd(true);
    setDigits(String(applyQuickAdd(null, lastValue, distance)));
  };

  const save = () => {
    if (value === null) return;
    setSaveFailed(false);
    logOdometer.mutate(
      {
        value,
        recordedAt,
        today,
        delta: lastValue == null ? null : value - lastValue,
        backdated,
        usedQuickAdd,
      },
      {
        onSuccess: () => {
          triggerNotification(Haptics.NotificationFeedbackType.Success);
          onClose();
        },
        // The sheet stays open and the entry is kept.
        onError: () => setSaveFailed(true),
      },
    );
  };

  const onSavePress = () => {
    if (validation.ok) return save();
    if (!('needsConfirm' in validation) || value === null) return;
    // A lower reading is allowed — a typo has to stay correctable — but asked first.
    Alert.alert(
      t('bikeHub.odometer.lowerTitle'),
      t('bikeHub.odometer.lowerMessage', {
        last: lastText,
        value: formatOdometer(value, language),
        unit,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.save'), onPress: save },
      ],
    );
  };

  const blocked = (!validation.ok && 'error' in validation) || historyUnknown;
  const saveDisabled = blocked || readingsLoading || logOdometer.isPending;
  const futureDate =
    !validation.ok && 'error' in validation && validation.error === ODOMETER_ERROR.FUTURE_DATE;
  const entryText = value === null ? lastText || '0' : formatOdometer(value, language);
  const dateLabel = isSameCalendarDay(recordedAt, today)
    ? t('bikeHub.odometer.dateToday')
    : t('bikeHub.odometer.dateOn', { date: formatShortDate(recordedAt, language) });
  const saveLabel =
    value === null
      ? t('common.save')
      : t('bikeHub.odometer.save', { value: formatOdometer(value, language), unit });

  return (
    <SheetScroll
      testID="odometer-sheet-scroll"
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
        gap: 14,
      }}
    >
      <SheetGrabber />
      <SheetHeader title={t('bikeHub.odometer.title')} onCancel={onClose} />

      <View style={{ gap: 4, paddingVertical: 6 }}>
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{
            fontFamily: HUB_FONT.mono,
            fontSize: 11,
            letterSpacing: 0.88,
            textTransform: 'uppercase',
            color: hub.muted,
          }}
        >
          {t('bikeHub.odometer.newReading')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              testID="odometer-entry"
              accessibilityLabel={`${entryText} ${unit}`}
              style={{
                fontFamily: HUB_FONT.monoMedium,
                fontSize: 44,
                lineHeight: 46,
                letterSpacing: -0.88,
                color: value === null ? hub.muted : hub.text,
              }}
            >
              {entryText}
            </Text>
            <View style={{ width: 2, height: 36, marginLeft: 2, backgroundColor: hub.copper }} />
          </View>
          <Text
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
            style={{ fontFamily: HUB_FONT.mono, fontSize: 18, color: hub.muted }}
          >
            {unit}
          </Text>
        </View>
        <Text
          testID="odometer-delta"
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{
            fontFamily: HUB_FONT.sans,
            fontSize: 13,
            color: detail.warn ? hub.soon : hub.dim,
            opacity: readingsLoading ? 0.4 : 1,
          }}
        >
          {detail.text}
        </Text>
      </View>

      {/* A plain wrapping row, not a horizontal ScrollView: a form sheet adopts
          the first scroll view inside it as "the sheet's scroller" and lifts it
          out of the column (it rendered over the title). */}
      <View testID="odometer-chips" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {pendingRides && pendingRides.rideCount > 0 ? (
          <Chip
            testID="chip-rides"
            highlighted
            maxWidth={RIDES_CHIP_MAX_WIDTH}
            label={t('bikeHub.odometer.ridesChip', {
              count: pendingRides.rideCount,
              distance: formatOdometer(pendingRides.distance, language),
            })}
            onPress={() => addTrackedRides(pendingRides.distance)}
          />
        ) : null}
        {ODOMETER_QUICK_ADD.map((amount) => (
          <Chip
            key={amount}
            testID={`chip-${amount}`}
            label={`+${amount}`}
            onPress={() => quickAdd(amount)}
          />
        ))}
      </View>

      {pickingDate ? (
        <View style={{ gap: 8 }}>
          <DateTimePicker
            value={recordedAt}
            mode="date"
            maximumDate={today}
            display={process.env.EXPO_OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selected) => {
              if (process.env.EXPO_OS === 'android') setPickingDate(false);
              if (event.type === 'set' && selected) setPickedDate(selected);
            }}
            style={process.env.EXPO_OS === 'ios' ? { height: 320 } : undefined}
          />
          <Pressable
            onPress={() => setPickingDate(false)}
            accessibilityRole="button"
            style={{
              height: HUB_HEIGHT.secondary,
              borderRadius: HUB_RADIUS.button,
              borderCurve: 'continuous',
              backgroundColor: hub.raised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.text }}
            >
              {t('common.done')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <OdometerKeypad
          onKey={onKey}
          dateLabel={dateLabel}
          onDatePress={() => setPickingDate(true)}
        />
      )}

      <Text
        testID="odometer-notice"
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        style={{
          fontFamily: HUB_FONT.sans,
          fontSize: 12,
          lineHeight: 16,
          color: saveFailed || futureDate || historyUnknown ? hub.late : hub.muted,
        }}
        {...(historyUnknown
          ? { onPress: refetchReadings, accessibilityRole: 'button' as const }
          : {})}
      >
        {noticeText({ t, saveFailed, futureDate, historyUnknown })}
      </Text>

      <Pressable
        testID="odometer-save"
        onPress={onSavePress}
        disabled={saveDisabled}
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
        accessibilityState={{
          disabled: saveDisabled,
          busy: logOdometer.isPending || readingsLoading,
        }}
        style={({ pressed }) => ({
          height: HUB_HEIGHT.primary,
          borderRadius: HUB_RADIUS.button,
          borderCurve: 'continuous',
          backgroundColor: hub.copper,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: saveDisabled ? 0.4 : pressed ? 0.85 : 1,
        })}
      >
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{ fontFamily: HUB_FONT.sansBold, fontSize: 16, color: hub.ink }}
        >
          {saveLabel}
        </Text>
      </Pressable>
    </SheetScroll>
  );
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** The footnote. A back-dated reading is explained on the detail line under the entry. */
function noticeText(input: {
  t: TFunction;
  saveFailed: boolean;
  futureDate: boolean;
  historyUnknown: boolean;
}): string {
  const { t, saveFailed, futureDate, historyUnknown } = input;
  if (saveFailed) return t('bikeHub.odometer.saveFailed');
  if (futureDate) return t('bikeHub.odometer.futureDate');
  if (historyUnknown) return t('bikeHub.odometer.historyUnavailable');
  return t('bikeHub.odometer.helper');
}

interface ChipProps {
  label: string;
  onPress: () => void;
  highlighted?: boolean;
  /** Set = the label wraps inside this width instead of widening the chip. */
  maxWidth?: DimensionValue;
  testID: string;
}

function Chip({ label, onPress, highlighted = false, maxWidth, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        minHeight: CHIP_HEIGHT,
        maxWidth,
        paddingHorizontal: 14,
        paddingVertical: 3,
        borderRadius: 11,
        borderCurve: 'continuous',
        backgroundColor: hub.ground,
        borderWidth: 1,
        borderColor: highlighted ? hub.chipOnBorder : hub.ripple,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        style={{
          fontFamily: HUB_FONT.mono,
          fontSize: 13,
          lineHeight: CHIP_LINE_HEIGHT,
          textAlign: 'center',
          color: highlighted ? hub.copperText : hub.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
