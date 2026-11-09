import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import { useRideStore } from '../../stores/ride.store';
import { editorialThemes } from '../../theme/editorial';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { useGpsPermissionRecovery } from './use-gps-permission-recovery';

const HUD_THEME = editorialThemes.dark;
/** Below the HUD's floating layout switcher. */
const BANNER_TOP = 110;

/**
 * Shown on the HUD when location permission was revoked mid-ride: the ride is no
 * longer recording, and until now only a notification said so. Offers the two
 * ways out — turn location back on (recording then restarts on return), or end
 * the ride with what was recorded.
 */
export function GpsLostBanner({ onEndRide }: { onEndRide: () => void }) {
  const { t } = useTranslation();
  const lost = useRideStore((s) => s.gpsPermissionLost);
  useGpsPermissionRecovery();
  if (!lost) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: BANNER_TOP,
        left: space.md,
        right: space.md,
        zIndex: 30,
        gap: space.xs,
        padding: space.md,
        backgroundColor: HUD_THEME.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: HUD_THEME.danger,
      }}
    >
      <Text style={{ ...type.bodyStrong, color: HUD_THEME.ink }}>{t('rideHud.gpsLostTitle')}</Text>
      <Text style={{ ...type.subhead, color: HUD_THEME.ink2 }}>
        {t('rideHud.gpsLostBannerBody')}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xxs }}>
        <BannerButton
          label={t('startRide.openSettings')}
          onPress={() => void Linking.openSettings()}
          background={HUD_THEME.surface2}
          color={HUD_THEME.ink}
        />
        <BannerButton
          label={t('rideHud.actionEndRide')}
          onPress={onEndRide}
          background={HUD_THEME.danger}
          color={HUD_THEME.onPlate}
        />
      </View>
    </View>
  );
}

function BannerButton({
  label,
  onPress,
  background,
  color,
}: {
  label: string;
  onPress: () => void;
  background: string;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: space.sm,
        backgroundColor: background,
        borderRadius: radius.control,
        borderCurve: 'continuous',
      }}
    >
      <Text style={{ ...type.bodyStrong, color }}>{label}</Text>
    </Pressable>
  );
}
