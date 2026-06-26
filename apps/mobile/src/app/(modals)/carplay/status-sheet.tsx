// CarPlay Companion — Status sheet (design spec §5 Screen 4b / StatusSheet).
// Opened from the active-ride banner. A confirmation surface: the ONLY control is
// a guarded End (pause/resume live on the head unit). Ending always saves.
// Guard is a two-tap confirm (no press-and-hold on mobile, per product preference).
// TODO(carplay): route end through the shared ride-controller command path (KTD2).

import { router } from 'expo-router';
import { ArrowUp, ChevronDown, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Eyebrow,
  MONO,
  PulseDot,
  SERIF,
  SERIF_ITALIC,
} from '../../../components/carplay/primitives';
import { StateGlyph } from '../../../components/carplay/state-indicator';
import { useLiveRideSnapshot } from '../../../features/carplay/use-carplay';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';

export default function CarPlayStatusSheet() {
  const { t } = useTranslation();
  const { t: c } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const ride = useLiveRideSnapshot();
  const [confirming, setConfirming] = useState(false);

  const endRide = () => {
    triggerImpact();
    router.back(); // TODO(carplay): controller.endRide('carplay')
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingHorizontal: 22,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronDown size={18} color={c.ink2} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <PulseDot color={c.warm} />
          <Eyebrow color={c.warm2} style={{ marginTop: 0 }}>
            {t('carplay.sheet.recording', { defaultValue: 'Recording' })}
          </Eyebrow>
        </View>
        <Text
          style={{
            fontFamily: SERIF,
            fontSize: 54,
            lineHeight: 56,
            letterSpacing: -1,
            color: c.ink,
            marginBottom: 26,
          }}
        >
          <Text style={{ fontFamily: SERIF_ITALIC }}>{ride.distance}</Text>
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <MetricTile
            label={t('carplay.sheet.movingTime', { defaultValue: 'Moving time' })}
            value={ride.elapsed}
          />
          <MetricTile
            label={t('carplay.sheet.climb', { defaultValue: 'Climb' })}
            value={ride.climb}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: 20,
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: c.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ArrowUp size={16} color={c.ink3} strokeWidth={2} />
            <Text style={{ fontFamily: MONO, fontSize: 13, color: c.ink2 }}>{ride.climb}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color={c.success} strokeWidth={2} />
            <Text style={{ fontFamily: MONO, fontSize: 13, color: c.ink2 }}>
              {t('carplay.sheet.gpsStrong', { defaultValue: 'GPS strong' })}
            </Text>
          </View>
        </View>
      </View>

      <Text style={{ textAlign: 'center', fontSize: 12.5, color: c.ink3, marginBottom: 10 }}>
        {t('carplay.sheet.controlsHint', { defaultValue: 'Pause & resume live on your head unit' })}
      </Text>

      {/* Two-tap confirm guard — no press-and-hold. */}
      {confirming ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => setConfirming(false)}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: c.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.ink, fontSize: 15.5, fontWeight: '700' }}>
              {t('carplay.sheet.keepRiding', { defaultValue: 'Keep riding' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={endRide}
            style={{
              flex: 1,
              height: 56,
              borderRadius: 16,
              backgroundColor: tint(c.danger, 0.18),
              borderWidth: 1.5,
              borderColor: c.danger,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
            }}
          >
            <StateGlyph state="stop" size={18} />
            <Text style={{ color: c.danger, fontSize: 15.5, fontWeight: '700' }}>
              {t('carplay.sheet.endRide', { defaultValue: 'End ride' })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            triggerImpact();
            setConfirming(true);
          }}
          style={{
            height: 56,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: c.danger,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
          }}
        >
          <StateGlyph state="stop" size={18} />
          <Text style={{ color: c.danger, fontSize: 15.5, fontWeight: '700' }}>
            {t('carplay.sheet.endRideButton', { defaultValue: 'End ride' })}
          </Text>
        </Pressable>
      )}
      <Text style={{ textAlign: 'center', fontSize: 11.5, color: c.ink4, marginTop: 8 }}>
        {t('carplay.sheet.savesNote', {
          distance: ride.distance,
          defaultValue: 'Ending always saves — {{distance}} will be kept',
        })}
      </Text>
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  const { t: c } = useEditorialTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: c.line,
        padding: 16,
      }}
    >
      <Eyebrow style={{ marginTop: 0, marginBottom: 7 }}>{label}</Eyebrow>
      <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 30, color: c.ink }}>{value}</Text>
    </View>
  );
}
