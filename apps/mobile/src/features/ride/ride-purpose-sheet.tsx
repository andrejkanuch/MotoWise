import { RIDE_PURPOSE, type RidePurpose } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { NativeToggle } from '../../components/ui/native-toggle';
import { formatOdometer, toHubUnit } from '../../lib/bike-hub/format';
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

/** The whole units of an odometer the rider typed ("12,463" → 12463); null when there are none. */
function parseOdometer(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

type RideAnswers = { purpose?: RidePurpose | null; passenger?: boolean; odometerAtEnd?: number };

function sendAnswers(rideId: string, answers: RideAnswers): void {
  void enqueueOrExecute('updateRide', { variables: { input: { rideId, ...answers } } });
}

interface RidePurposeSheetProps {
  rideId: string;
  /** The ride's bike; without one there is no odometer to log. */
  motorcycleId: string;
}

/**
 * Optional answers about a ride, on its summary: what it was for, whether a
 * passenger rode along, and the odometer at the end in the bike's own unit.
 * Each answer is sent on its own through the ride sync queue the moment it is
 * given, so the summary's Save and Discard work exactly as before and a rider
 * who skips the card saves the ride as it is. The odometer is sent once.
 */
export function RidePurposeSheet({ rideId, motorcycleId }: RidePurposeSheetProps) {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const [purpose, setPurpose] = useState<RidePurpose | null>(null);
  const [passenger, setPassenger] = useState(false);
  const [odometerText, setOdometerText] = useState('');
  const [odometerSaved, setOdometerSaved] = useState(false);

  const { data: bike } = useQuery({
    ...motorcyclesOptions(),
    select: (list) => list.myMotorcycles.find((m) => m.id === motorcycleId) ?? null,
    enabled: !!motorcycleId,
    meta: QUERY_META.OWN_ERROR_UI,
  });
  const unit = toHubUnit(bike?.distanceUnit);
  const odometer = parseOdometer(odometerText);

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

  const saveOdometer = () => {
    if (odometer == null || odometerSaved) return;
    triggerSelection();
    setOdometerSaved(true);
    sendAnswers(rideId, { odometerAtEnd: odometer });
  };

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
                  onChangeText={setOdometerText}
                  onSubmitEditing={saveOdometer}
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
                  onPress={saveOdometer}
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
