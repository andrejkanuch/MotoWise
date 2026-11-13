import BottomSheet from '@gorhom/bottom-sheet';
import { type RefObject, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { editorialThemes } from '../../theme/editorial';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { rideStorage } from '../../utils/ride-storage';
import { isNoGpsRide, type RideGuardSnapshot } from './ride-guard';
import { RIDE_TEST_ID, rideGuardVariantTestId } from './ride-test-ids';

// The HUD is a riding instrument: always dark (night mode swaps to amber-red),
// in both system schemes, so its sheet uses the dark tokens directly.
const HUD_THEME = editorialThemes.dark;

/** Set once the rider has ended a short ride from the sheet; the GPS tip then stops showing. */
const GUARD_TIP_SHOWN_KEY = 'rideGuardTipShown';
const CLOSED_INDEX = -1;
/** Off the 4 pt grid on purpose: the guard buttons keep their 48 pt height. */
const BUTTON_PADDING_V = 14;

interface RideGuardSheetProps {
  sheetRef: RefObject<BottomSheet | null>;
  /** The open guard, or `null` once the rider chose; the sheet keeps its copy while it closes. */
  guard: RideGuardSnapshot | null;
  onKeepRiding: () => void;
  onEndAnyway: () => void;
}

/**
 * The minimum-ride guard sheet on the ride HUD. `accessible={false}` matters: a
 * @gorhom sheet is one accessible element by default ("Bottom Sheet"), which
 * hides its buttons from VoiceOver/TalkBack and from Maestro (issue 365, T05c).
 */
export function RideGuardSheet({
  sheetRef,
  guard,
  onKeepRiding,
  onEndAnyway,
}: RideGuardSheetProps) {
  const { t } = useTranslation();
  const snapPoints = useMemo(() => ['35%'], []);
  const [showTip] = useState(() => !rideStorage.getString(GUARD_TIP_SHOWN_KEY));
  // The content lives while the sheet is open or closing, so the copy does not
  // change under the closing animation and nothing is left in the a11y tree once closed.
  const [lastGuard, setLastGuard] = useState<RideGuardSnapshot | null>(guard);
  if (guard && guard !== lastGuard) setLastGuard(guard);
  const shown = guard ?? lastGuard;
  const handleChange = useCallback((index: number) => {
    if (index === CLOSED_INDEX) setLastGuard(null);
  }, []);

  const handleEndAnyway = useCallback(() => {
    if (showTip) rideStorage.set(GUARD_TIP_SHOWN_KEY, 'true');
    onEndAnyway();
  }, [onEndAnyway, showTip]);

  const isNoGps = shown != null && isNoGpsRide(shown.elapsed_s);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={CLOSED_INDEX}
      enablePanDownToClose
      onChange={handleChange}
      accessible={false}
      backgroundStyle={{
        backgroundColor: HUD_THEME.surface,
        borderRadius: 24,
        borderCurve: 'continuous',
      }}
      handleIndicatorStyle={{ backgroundColor: HUD_THEME.line2 }}
      enableDynamicSizing={false}
    >
      {shown && (
        <View
          testID={RIDE_TEST_ID.GUARD_SHEET}
          style={{ paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.xxl }}
        >
          <View testID={rideGuardVariantTestId(shown.variant)}>
            <Text style={{ ...type.sectionTitle, color: HUD_THEME.ink, marginBottom: space.xs }}>
              {isNoGps ? t('rideHud.noGpsTitle') : t('rideHud.endRideTitle')}
            </Text>
            <Text style={{ ...type.subhead, color: HUD_THEME.ink2, marginBottom: space.md }}>
              {isNoGps
                ? t('rideHud.noGpsBody', { minutes: Math.round(shown.elapsed_s / 60) })
                : t('rideHud.shortRideWarning', {
                    seconds: shown.elapsed_s,
                    meters: shown.distance_m,
                  })}
            </Text>

            {(showTip || isNoGps) && (
              <View
                style={{
                  backgroundColor: HUD_THEME.surface2,
                  borderRadius: radius.control,
                  borderCurve: 'continuous',
                  padding: space.sm,
                  marginBottom: space.md,
                }}
              >
                <Text style={{ ...type.label, color: HUD_THEME.dueInk }}>
                  {t('rideHud.gpsTip')}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Pressable
              testID={RIDE_TEST_ID.GUARD_KEEP}
              accessibilityRole="button"
              onPress={onKeepRiding}
              style={{
                flex: 1,
                backgroundColor: HUD_THEME.surface2,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                paddingVertical: BUTTON_PADDING_V,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...type.bodyStrong, color: HUD_THEME.ink }}>
                {t('rideHud.keepRiding')}
              </Text>
            </Pressable>
            <Pressable
              testID={RIDE_TEST_ID.GUARD_END_ANYWAY}
              accessibilityRole="button"
              onPress={handleEndAnyway}
              style={{
                flex: 1,
                backgroundColor: HUD_THEME.danger,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                paddingVertical: BUTTON_PADDING_V,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...type.bodyStrong, color: HUD_THEME.onPlate }}>
                {t('rideHud.endAnyway')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
