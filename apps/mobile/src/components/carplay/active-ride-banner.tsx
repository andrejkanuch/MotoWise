// Persistent active-ride banner shown above the tab bar while a CarPlay ride is
// live (design spec §5 Screen 4a). A confirmation surface, not a control mirror —
// tapping opens the status sheet; the only control there is a guarded stop.
// TODO(carplay): wire `state`/`distance`/`time` to the carplay-coordinator snapshot
// (U12); currently driven by props/mock for the static build.

import { ChevronUp } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { MONO, PulseDot, StaticDot } from './primitives';
import { type RideStateKey, stateTint, stateWord } from './state-indicator';

export type BannerState = 'recording' | 'autoPaused' | 'acquiring' | 'armedAuto' | 'manualIdle';

// maps banner state → canonical glyph-state + copy + whether metrics show.
const BANNER: Record<
  BannerState,
  { state: RideStateKey; sub: string; metrics: boolean; pulse: boolean }
> = {
  recording: { state: 'recording', sub: 'controls on your head unit', metrics: true, pulse: true },
  autoPaused: { state: 'autoPaused', sub: 'resumes when you move', metrics: true, pulse: false },
  acquiring: { state: 'acquiring', sub: 'waiting for GPS lock', metrics: true, pulse: false },
  armedAuto: { state: 'recording', sub: 'auto-start armed', metrics: false, pulse: false },
  manualIdle: { state: 'recording', sub: 'start from the head unit', metrics: false, pulse: false },
};

export function ActiveRideBanner({
  state = 'recording',
  distance = '42.3 km',
  time = '1:12:40',
  onPress,
}: {
  state?: BannerState;
  distance?: string;
  time?: string;
  onPress?: () => void;
}) {
  const { t: c } = useEditorialTheme();
  const cfg = BANNER[state];
  // armed/manual idle states show "READY" / their sub instead of a live word.
  const word =
    state === 'armedAuto'
      ? 'READY'
      : state === 'manualIdle'
        ? 'NOT RECORDING'
        : stateWord(cfg.state);
  const tintColor =
    state === 'armedAuto' || state === 'manualIdle' ? c.ink3 : stateTint(cfg.state, c);
  const isAcquiring = state === 'acquiring';

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: c.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: tint(tintColor, 0.3),
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      {cfg.pulse ? <PulseDot color={tintColor} /> : <StaticDot color={tintColor} />}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 1,
              color: tintColor,
            }}
          >
            {word}
          </Text>
          {cfg.metrics && (
            <Text style={{ fontFamily: MONO, fontSize: 12, color: c.ink2 }}>
              {isAcquiring ? '— km · —:—' : `${distance} · ${time}`}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 11.5, color: c.ink3, marginTop: 2 }}>{cfg.sub}</Text>
      </View>
      <ChevronUp size={18} color={c.ink4} strokeWidth={2} />
    </Pressable>
  );
}
