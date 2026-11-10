import { RIDE_PURPOSE, type RidePurpose } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { type Ref, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { NativeToggle } from '../../components/ui/native-toggle';
import { formatOdometer, hasOdometer, toHubUnit } from '../../lib/bike-hub/format';
import { validateReading } from '../../lib/bike-hub/odometer-input';
import { QUERY_META } from '../../lib/query-meta';
import { motorcyclesOptions } from '../../lib/query-options';
import { useEditorialTheme } from '../../theme/editorial';
import { layout, space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { triggerSelection } from '../../utils/haptics';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

const PURPOSE_LABEL_KEY = {
  [RIDE_PURPOSE.LEISURE]: 'ridePurposeSheet.purpose.leisure',
  [RIDE_PURPOSE.COMMUTE]: 'ridePurposeSheet.purpose.commute',
  [RIDE_PURPOSE.TOUR]: 'ridePurposeSheet.purpose.tour',
  [RIDE_PURPOSE.ERRAND]: 'ridePurposeSheet.purpose.errand',
  [RIDE_PURPOSE.TRACK]: 'ridePurposeSheet.purpose.track',
  [RIDE_PURPOSE.OFFROAD]: 'ridePurposeSheet.purpose.offroad',
  [RIDE_PURPOSE.OTHER]: 'ridePurposeSheet.purpose.other',
} as const satisfies Record<RidePurpose, string>;

const PURPOSES = Object.keys(PURPOSE_LABEL_KEY) as RidePurpose[];

/** Rows and chips are touch targets for a gloved hand (DESIGN.md: 44pt). */
const TOUCH_TARGET = 44;
const ROW_HEIGHT = 52;
const CHIP_BORDER = 1.5;
/** The card enters after the summary's stat grid. */
const ENTER_DELAY_MS = 550;
const ENTER_DURATION_MS = 250;

/** Seven digits: up to 9,999,999, the server's limit, so a typo cannot overflow it. */
const ODOMETER_MAX_DIGITS = 7;

/** The digits of an odometer the rider typed ("12,463" → "12463"), capped at seven. */
function odometerDigits(text: string): string {
  return text.replace(/\D/g, '').slice(0, ODOMETER_MAX_DIGITS);
}

type RideAnswers = { purpose?: RidePurpose | null; passenger?: boolean; odometerAtEnd?: number };

function sendAnswers(rideId: string, answers: RideAnswers): void {
  void enqueueOrExecute('updateRide', { variables: { input: { rideId, ...answers } } });
}

/**
 * Whether an odometer at the end of a ride needs the rider's confirmation before
 * it is sent: the bike hub's check (`validateReading`) for a reading taken now.
 * A value below the bike's odometer is usually the trip meter, and the server
 * would set the bike to it. An equal value is harmless here and is sent.
 */
export function rideOdometerNeedsConfirm(
  value: number,
  currentMileage: number | null | undefined,
  today: Date = new Date(),
): boolean {
  const lastValue = hasOdometer(currentMileage) ? currentMileage : null;
  const validation = validateReading({
    value,
    lastValue,
    recordedAt: today,
    lastRecordedAt: null,
    today,
  });
  return !validation.ok && 'needsConfirm' in validation;
}

export interface RidePurposeSheetHandle {
  /**
   * Sends an odometer the rider typed but did not send yet, after the same
   * confirmation as the sheet's own Save. Resolves `false` when the rider chose
   * to fix it, so the summary stays open; `true` otherwise (also when nothing is pending).
   */
  sendPendingOdometer: () => Promise<boolean>;
}

interface RidePurposeSheetProps {
  rideId: string;
  /** The ride's bike; without one there is no odometer to log. */
  motorcycleId: string;
  ref?: Ref<RidePurposeSheetHandle>;
}

/**
 * Optional answers about a ride, on its summary: what it was for, whether a
 * passenger rode along, and the odometer at the end in the bike's own unit.
 * Each answer is sent on its own through the ride sync queue the moment it is
 * given, so the summary's Save and Discard work exactly as before and a rider
 * who skips the card saves the ride as it is. The odometer is sent once; one
 * typed but not sent goes with the summary's Save (`sendPendingOdometer`).
 */
export function RidePurposeSheet({ rideId, motorcycleId, ref }: RidePurposeSheetProps) {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const [purpose, setPurpose] = useState<RidePurpose | null>(null);
  const [passenger, setPassenger] = useState(false);
  const [odometerText, setOdometerText] = useState('');
  const [odometerSaved, setOdometerSaved] = useState(false);
  // Synchronous: the field's submit, the Save link and the summary's Save can race.
  const odometerSentRef = useRef(false);

  const { data: bike } = useQuery({
    ...motorcyclesOptions(),
    select: (list) => list.myMotorcycles.find((m) => m.id === motorcycleId) ?? null,
    enabled: !!motorcycleId,
    meta: QUERY_META.OWN_ERROR_UI,
  });
  const unit = toHubUnit(bike?.distanceUnit);
  const odometer = odometerText ? Number(odometerText) : null;

  const pickPurpose = (next: RidePurpose) => {
    triggerSelection();
    const value = purpose === next ? null : next;
    setPurpose(value);
    sendAnswers(rideId, { purpose: value });
  };

  const togglePassenger = (value: boolean) => {
    setPassenger(value);
    sendAnswers(rideId, { passenger: value });
  };

  // The bike hub's lower-reading prompt, with its strings.
  const confirmLower = (value: number) =>
    new Promise<boolean>((resolve) => {
      const last = formatOdometer(bike?.currentMileage ?? 0, i18n.language);
      const valueText = formatOdometer(value, i18n.language);
      Alert.alert(
        t('bikeHub.odometer.lowerThan', { last, unit }),
        t('bikeHub.odometer.lowerOneLine'),
        [
          { text: t('bikeHub.odometer.fixIt'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t('bikeHub.odometer.save', { value: valueText, unit }),
            onPress: () => resolve(true),
          },
        ],
        { onDismiss: () => resolve(false) },
      );
    });

  const saveOdometer = async (): Promise<boolean> => {
    if (odometer == null || odometerSentRef.current) return true;
    odometerSentRef.current = true;
    if (
      rideOdometerNeedsConfirm(odometer, bike?.currentMileage) &&
      !(await confirmLower(odometer))
    ) {
      odometerSentRef.current = false;
      return false;
    }
    triggerSelection();
    setOdometerSaved(true);
    sendAnswers(rideId, { odometerAtEnd: odometer });
    return true;
  };

  useImperativeHandle(ref, () => ({ sendPendingOdometer: saveOdometer }));

  const rowStyle = {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  } as const;

  return (
    <Animated.View entering={FadeInUp.delay(ENTER_DELAY_MS).duration(ENTER_DURATION_MS)}>
      <Text
        accessibilityRole="header"
        style={[type.caption, { color: theme.ink3, marginBottom: layout.labelGap }]}
      >
        {t('ridePurposeSheet.title')}
      </Text>
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          overflow: 'hidden',
        }}
      >
        <View style={{ padding: space.md, gap: layout.labelGap }}>
          <Text style={[type.subhead, { color: theme.ink2 }]}>
            {t('ridePurposeSheet.purposeLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {PURPOSES.map((value) => {
              const selected = purpose === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => pickPurpose(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    minHeight: TOUCH_TARGET,
                    justifyContent: 'center',
                    paddingHorizontal: space.md,
                    borderRadius: radius.chip,
                    borderCurve: 'continuous',
                    borderWidth: CHIP_BORDER,
                    borderColor: selected ? theme.warm : theme.line,
                    backgroundColor: theme.surface2,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={[type.label, { color: selected ? theme.warm2 : theme.ink2 }]}>
                    {t(PURPOSE_LABEL_KEY[value])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={rowStyle}>
          <Text style={[type.body, { color: theme.ink, flex: 1 }]}>
            {t('ridePurposeSheet.passenger')}
          </Text>
          <NativeToggle value={passenger} onValueChange={togglePassenger} />
        </View>

        {motorcycleId ? (
          <View style={[rowStyle, { flexWrap: 'wrap', paddingVertical: space.xs }]}>
            <Text style={[type.body, { color: theme.ink, flexGrow: 1 }]}>
              {t('ridePurposeSheet.odometer')}
            </Text>
            {odometerSaved ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
                <Check size={16} color={theme.success} />
                <Text style={[type.label, { color: theme.ink2 }]}>
                  {t('ridePurposeSheet.odometerSaved')}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <TextInput
                  value={odometerText}
                  onChangeText={(text) => setOdometerText(odometerDigits(text))}
                  maxLength={ODOMETER_MAX_DIGITS}
                  onSubmitEditing={() => void saveOdometer()}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel={t('ridePurposeSheet.odometerLabel')}
                  placeholder={
                    bike?.currentMileage != null
                      ? formatOdometer(bike.currentMileage, i18n.language)
                      : undefined
                  }
                  placeholderTextColor={theme.ink4}
                  style={[
                    type.body,
                    {
                      minWidth: 96,
                      minHeight: TOUCH_TARGET,
                      textAlign: 'right',
                      color: theme.ink,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                />
                <Text style={[type.body, { color: theme.ink3 }]}>{unit}</Text>
                <Pressable
                  onPress={() => void saveOdometer()}
                  disabled={odometer == null}
                  accessibilityRole="button"
                  hitSlop={space.xs}
                  style={({ pressed }) => ({
                    minHeight: TOUCH_TARGET,
                    justifyContent: 'center',
                    opacity: odometer == null ? 0.4 : pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={[type.bodyStrong, { color: theme.warm2 }]}>
                    {t('ridePurposeSheet.odometerSave')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
