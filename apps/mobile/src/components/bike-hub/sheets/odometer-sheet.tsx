import { isSameDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, type DimensionValue, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DELTA_DIRECTION,
  type HubUnit,
  ODOMETER_ENTRY_PLACEHOLDER,
  ODOMETER_ERROR,
  ODOMETER_QUICK_ADD,
  type OdometerKey,
  SHEET_EXIT,
  type SheetExit,
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
import { restorableOdometerDraft, useSheetDraftStore } from '../../../stores/sheet-draft.store';
import { triggerNotification, triggerSelection } from '../../../utils/haptics';
import type { HubBike } from '../shell/use-bike-hub-data';
import { useToday } from '../shell/use-today';
import { HUB_CHROME_MAX_FONT_SCALE, HUB_FONT, HUB_HEIGHT, HUB_RADIUS, hub } from '../ui/tokens';
import { DraftRestoredNotice } from './draft-restored-notice';
import { OdometerDateChip } from './odometer-date-chip';
import { OdometerKeypad } from './odometer-keypad';
import {
  SHEET_CANCEL_PLACEMENT,
  SHEET_LOCKED_OPACITY,
  SheetGrabber,
  SheetHeader,
} from './sheet-header';
import { SheetScroll, sheetBottomPadding } from './sheet-scroll';
import { useLogOdometer, useOdometerContext } from './use-log-odometer';
import { useParkDraftOnExit } from './use-park-draft';

const CHIP_HEIGHT = 40;
/**
 * The rides chip's share of the row: its label wraps onto two lines so the
 * quick-add chips stay beside it (the design's single row). Wider text pushes
 * the quick-add chips onto the next line instead of squeezing anything.
 */
const RIDES_CHIP_MAX_WIDTH = '45%';
const CHIP_LINE_HEIGHT = 17;

/** The entry's size (DESIGN.md "numeral display"). */
const ENTRY_SIZE = 44;
const ENTRY_TRACKING = -0.88;
/**
 * A mono separator takes a full digit cell, so "38,550" read as "38 , 550".
 * The digit before it and the separator itself give back this much each.
 */
const SEPARATOR_PULL = 7;
const CARET = { width: 2, height: 36 } as const;
const LINE_HEIGHT = 18;

interface EntryRun {
  text: string;
  tight: boolean;
}

const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9';

/**
 * The formatted entry split into runs, so the grouping separator (",", ".", a
 * narrow space — whatever the locale uses) can sit closer to its digits.
 */
export function entryRuns(text: string): EntryRun[] {
  const runs: EntryRun[] = [];
  [...text].forEach((char, index, chars) => {
    const tight = !isDigit(char) || !isDigit(chars[index + 1] ?? '0');
    const last = runs[runs.length - 1];
    if (last && last.tight === tight) last.text += char;
    else runs.push({ text: char, tight });
  });
  return runs;
}

interface DeltaContext {
  t: TFunction;
  unit: HubUnit;
  since: string | null;
  language: string;
}

interface Line {
  text: string;
  warn: boolean;
}

const NO_LINE: Line = { text: '', warn: false };

/**
 * The line under "Last · …": what the typed reading means against the last one.
 * Empty when there is nothing to compare — and for an unchanged value, which
 * the footer explains instead (it is why Save is off).
 */
function deltaLine(delta: OdometerDelta | null, context: DeltaContext): Line {
  const { t, unit, since, language } = context;
  if (!delta) return NO_LINE;
  const amount = formatOdometer(delta.amount, language);
  const copy: Record<typeof delta.direction, () => Line> = {
    [DELTA_DIRECTION.UP]: () => ({
      text: since
        ? t('bikeHub.odometer.deltaSince', { delta: amount, unit, date: since })
        : t('bikeHub.odometer.deltaPlus', { delta: amount, unit }),
      warn: false,
    }),
    [DELTA_DIRECTION.DOWN]: () => ({
      text: t('bikeHub.odometer.deltaBelow', { delta: amount, unit }),
      warn: true,
    }),
    [DELTA_DIRECTION.FLAT]: () => NO_LINE,
  };
  return copy[delta.direction]();
}

interface OdometerSheetProps {
  bike: HubBike;
  /** After a successful save. */
  onClose: () => void;
  /** Cancel. Defaults to `onClose`; the route passes its discard guard. */
  onCancel?: () => void;
  /** Whether something was typed or a date picked — the route guards dismissal on it. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Whether the reading is saving — the route locks dismissal while it is. */
  onSavingChange?: (saving: boolean) => void;
  /**
   * How the sheet was left (the route's discard guard). Set = a reading left
   * behind by a dismissal nobody could ask about (Android drag-down) is parked
   * and restored the next time the sheet opens for this bike. Without it the
   * sheet neither parks nor restores.
   */
  exit?: () => SheetExit;
  /** Tests pin the date; the screen omits it. */
  now?: Date;
}

/**
 * Odometer sheet: the only place the bike's odometer is edited, on both
 * platforms. The entry starts empty, the last reading sits on its own line, and
 * a numeric pad, quick-add chips and a date chip fill it in. A reading lower
 * than the last one is confirmed first. Every save is an `odometer_readings`
 * row; nothing is converted between units.
 */
export function OdometerSheet({
  bike,
  onClose,
  onCancel,
  onDirtyChange,
  onSavingChange,
  exit,
  now,
}: OdometerSheetProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = i18n.language;
  const unit = toHubUnit(bike.distanceUnit);
  const today = useToday(now);
  const { latest, readingsLoading, readingsError, refetchReadings, pendingRides } =
    useOdometerContext(bike.id);
  const logOdometer = useLogOdometer(bike.id);

  const parksDrafts = exit !== undefined;
  // Read once: the sheet opens either empty or with what a dismissal left behind.
  const [restored] = useState(() => (parksDrafts ? restorableOdometerDraft(bike.id) : null));
  const [showRestored, setShowRestored] = useState(restored !== null);
  const [digits, setDigits] = useState(restored?.digits ?? '');
  // `null` = the rider has not picked a date: the reading is for today.
  const [pickedDate, setPickedDate] = useState<Date | null>(() =>
    restored?.pickedDate == null ? null : new Date(restored.pickedDate),
  );
  const recordedAt = pickedDate ?? today;
  const [usedQuickAdd, setUsedQuickAdd] = useState(restored?.usedQuickAdd ?? false);
  const [saveFailed, setSaveFailed] = useState(false);

  const dirty = digits !== '' || pickedDate !== null;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // While the reading saves, nothing that changes it may be used: the value
  // saved must be the value shown.
  const saving = logOdometer.isPending;
  useEffect(() => onSavingChange?.(saving), [saving, onSavingChange]);

  // A reading still saving is parked too: `useLogOdometer` clears it when the
  // save lands, so only a failed save leaves it to be restored.
  const draftSlot = useParkDraftOnExit({
    restored: restored !== null,
    exit: exit ?? (() => SHEET_EXIT.OPEN),
    pending: () => parksDrafts && (dirty || saving),
    park: () =>
      useSheetDraftStore.getState().parkReading(bike.id, {
        digits,
        pickedDate: pickedDate?.getTime() ?? null,
        usedQuickAdd,
      }),
    clear: () => useSheetDraftStore.getState().clearReading(bike.id),
  });

  /** "Clear" on the restored line: back to an empty entry for today. */
  const clearRestored = () => {
    draftSlot.clearOwned();
    setDigits('');
    setPickedDate(null);
    setUsedQuickAdd(false);
    setSaveFailed(false);
    setShowRestored(false);
  };

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
  const isToday = isSameDay(recordedAt, today);
  const historyUnknown = readingsError && !isToday;
  const value = parseEntry(digits);
  const validation = validateReading({ value, lastValue, recordedAt, lastRecordedAt, today });
  const backdated = validation.ok && validation.backdated;
  const delta = describeDelta(value, lastValue);
  const lastText = lastValue == null ? '' : formatOdometer(lastValue, language);
  const valueText = value === null ? '' : formatOdometer(value, language);
  // The date only belongs to the baseline when the baseline IS that reading.
  const since =
    latest && latest.value === baseline
      ? formatShortDate(new Date(latest.recordedAt), language)
      : null;

  const lastLine = (): string => {
    if (lastValue == null) return t('bikeHub.odometer.first');
    return since
      ? t('bikeHub.odometer.lastLine', { last: lastText, unit, date: since })
      : t('bikeHub.odometer.lastLineNoDate', { last: lastText, unit });
  };
  // A back-dated reading is not compared with the latest one ("+250 km since
  // Oct 1" for a Sep 27 reading is wrong): the line says what happens to it.
  const detail: Line =
    value !== null && backdated
      ? { text: t('bikeHub.odometer.backdatedNotice', { last: lastText, unit }), warn: true }
      : deltaLine(delta, { t, unit, since, language });

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

  const pickDate = (date: Date) => {
    triggerSelection();
    setSaveFailed(false);
    setPickedDate(date);
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

  const saveLabel =
    value === null ? t('common.save') : t('bikeHub.odometer.save', { value: valueText, unit });

  const onSavePress = () => {
    if (validation.ok) return save();
    if (!('needsConfirm' in validation) || value === null) return;
    // A lower reading is allowed — a typo has to stay correctable — but asked first.
    Alert.alert(
      t('bikeHub.odometer.lowerThan', { last: lastText, unit }),
      t('bikeHub.odometer.lowerOneLine'),
      [
        { text: t('bikeHub.odometer.fixIt'), style: 'cancel' },
        { text: saveLabel, onPress: save },
      ],
    );
  };

  const error = !validation.ok && 'error' in validation ? validation.error : null;
  const blocked = error !== null || historyUnknown;
  const saveDisabled = blocked || readingsLoading || saving;
  const notice = noticeText({
    t,
    saveFailed,
    futureDate: error === ODOMETER_ERROR.FUTURE_DATE,
    historyUnknown,
    unchanged: error === ODOMETER_ERROR.UNCHANGED,
  });
  const noticeIsError = notice !== null && error !== ODOMETER_ERROR.UNCHANGED;
  const dateLabel = isToday ? t('bikeHub.odometer.today') : formatShortDate(recordedAt, language);
  const entryLabel =
    value === null
      ? t('bikeHub.odometer.entryEmptyA11y')
      : t('bikeHub.odometer.entryA11y', { value: valueText, unit });

  return (
    <SheetScroll
      testID="odometer-sheet-scroll"
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: sheetBottomPadding(insets.bottom),
        gap: 14,
      }}
    >
      <SheetGrabber />
      <SheetHeader
        title={t('bikeHub.odometer.title')}
        onCancel={onCancel ?? onClose}
        cancelPlacement={SHEET_CANCEL_PLACEMENT.LEADING}
        cancelDisabled={saving}
        cancelTestID="odometer-cancel"
      />
      {showRestored ? (
        <DraftRestoredNotice
          testID="odometer-restored"
          message={t('bikeHub.sheetDraft.readingRestored')}
          clearAccessibilityLabel={t('bikeHub.sheetDraft.clearReadingA11y')}
          onClear={clearRestored}
          disabled={saving}
        />
      ) : null}

      <View style={{ gap: 2 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: HUB_HEIGHT.small,
          }}
        >
          <Text
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
            style={{
              flexShrink: 1,
              fontFamily: HUB_FONT.mono,
              fontSize: 11,
              letterSpacing: 0.88,
              textTransform: 'uppercase',
              color: hub.muted,
            }}
          >
            {t('bikeHub.odometer.newReading')}
          </Text>
          <OdometerDateChip
            value={recordedAt}
            today={today}
            label={dateLabel}
            onPick={pickDate}
            disabled={saving}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            {value === null ? <Caret /> : null}
            <Text
              testID="odometer-entry"
              accessibilityLabel={entryLabel}
              accessibilityLiveRegion="polite"
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontFamily: HUB_FONT.monoMedium,
                fontSize: ENTRY_SIZE,
                lineHeight: 46,
                letterSpacing: ENTRY_TRACKING,
                color: value === null ? hub.muted : hub.text,
                marginLeft: value === null ? 4 : 0,
              }}
            >
              {value === null
                ? ODOMETER_ENTRY_PLACEHOLDER
                : entryRuns(valueText).map((run, index) => (
                    <Text
                      // Runs are positional and re-split on every key press.
                      // biome-ignore lint/suspicious/noArrayIndexKey: positional runs
                      key={index}
                      maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                      style={
                        run.tight ? { letterSpacing: ENTRY_TRACKING - SEPARATOR_PULL } : undefined
                      }
                    >
                      {run.text}
                    </Text>
                  ))}
            </Text>
            {value === null ? null : <Caret />}
          </View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
            style={{ fontFamily: HUB_FONT.mono, fontSize: 18, color: hub.muted }}
          >
            {unit}
          </Text>
        </View>

        <Text
          testID="odometer-last"
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{
            fontFamily: HUB_FONT.sans,
            fontSize: 13,
            lineHeight: LINE_HEIGHT,
            color: hub.dim,
            opacity: readingsLoading ? 0.4 : 1,
          }}
        >
          {lastLine()}
        </Text>
        {/* Always laid out, so the keypad does not jump when the first digit lands. */}
        <Text
          testID="odometer-delta"
          accessibilityLiveRegion="polite"
          accessibilityElementsHidden={detail.text === ''}
          importantForAccessibility={detail.text === '' ? 'no-hide-descendants' : 'auto'}
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{
            minHeight: LINE_HEIGHT,
            fontFamily: HUB_FONT.sansMedium,
            fontSize: 13,
            lineHeight: LINE_HEIGHT,
            color: detail.warn ? hub.soon : hub.text,
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
            disabled={saving}
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
            disabled={saving}
            onPress={() => quickAdd(amount)}
          />
        ))}
      </View>

      <OdometerKeypad onKey={onKey} disabled={saving} />

      {notice === null ? null : (
        <Text
          testID="odometer-notice"
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{
            fontFamily: HUB_FONT.sans,
            fontSize: 13,
            lineHeight: LINE_HEIGHT,
            color: noticeIsError ? hub.late : hub.dim,
          }}
          {...(historyUnknown
            ? { onPress: refetchReadings, accessibilityRole: 'button' as const }
            : {})}
        >
          {notice}
        </Text>
      )}

      <Pressable
        testID="odometer-save"
        onPress={onSavePress}
        disabled={saveDisabled}
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
        accessibilityState={{
          disabled: saveDisabled,
          busy: saving || readingsLoading,
        }}
        style={({ pressed }) => ({
          height: HUB_HEIGHT.primary,
          borderRadius: HUB_RADIUS.button,
          borderCurve: 'continuous',
          // Off = a neutral raised key, not a faded copper one (that read as broken).
          backgroundColor: saveDisabled ? hub.raised : hub.copper,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed && !saveDisabled ? 0.85 : 1,
        })}
      >
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{
            fontFamily: HUB_FONT.sansBold,
            fontSize: 16,
            color: saveDisabled ? hub.muted : hub.ink,
          }}
        >
          {saveLabel}
        </Text>
      </Pressable>
    </SheetScroll>
  );
}

function Caret() {
  return (
    <View
      testID="odometer-caret"
      style={{
        width: CARET.width,
        height: CARET.height,
        marginLeft: 2,
        backgroundColor: hub.copper,
      }}
    />
  );
}

/**
 * The footnote above Save: only there when something needs saying — an error,
 * or why Save is off. A back-dated reading is explained under the entry.
 */
function noticeText(input: {
  t: TFunction;
  saveFailed: boolean;
  futureDate: boolean;
  historyUnknown: boolean;
  unchanged: boolean;
}): string | null {
  const { t, saveFailed, futureDate, historyUnknown, unchanged } = input;
  if (saveFailed) return t('bikeHub.odometer.saveFailed');
  if (futureDate) return t('bikeHub.odometer.futureDate');
  if (historyUnknown) return t('bikeHub.odometer.historyUnavailable');
  if (unchanged) return t('bikeHub.odometer.sameAsLast');
  return null;
}

interface ChipProps {
  label: string;
  onPress: () => void;
  highlighted?: boolean;
  disabled: boolean;
  /** Set = the label wraps inside this width instead of widening the chip. */
  maxWidth?: DimensionValue;
  testID: string;
}

function Chip({ label, onPress, highlighted = false, disabled, maxWidth, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
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
        opacity: disabled ? SHEET_LOCKED_OPACITY : pressed ? 0.7 : 1,
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
