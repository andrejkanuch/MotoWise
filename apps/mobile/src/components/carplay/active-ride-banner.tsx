// Persistent active-ride banner shown above the tab bar while a CarPlay ride is
// live (design spec §5 Screen 4a). A confirmation surface, not a control mirror —
// tapping opens the ride; the controls live on the head unit.

import { ChevronUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { layout, space } from '../../theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '../../theme/type';
import { PulseDot, StaticDot } from './primitives';
import { type RideStateKey, stateTint } from './state-indicator';

export type BannerState =
  | 'recording'
  | 'autoPaused'
  | 'paused'
  | 'interrupted'
  | 'acquiring'
  | 'saved'
  | 'armedAuto'
  | 'manualIdle';

// Banner state → canonical glyph-state, word + sub copy keys, whether metrics show.
const BANNER = {
  recording: {
    state: 'recording',
    word: 'carplay.banner.wordRecording',
    sub: 'carplay.banner.subRecording',
    metrics: true,
    pulse: true,
  },
  autoPaused: {
    state: 'autoPaused',
    word: 'carplay.banner.wordAutoPaused',
    sub: 'carplay.banner.subAutoPaused',
    metrics: true,
    pulse: false,
  },
  paused: {
    state: 'paused',
    word: 'carplay.banner.wordPaused',
    sub: 'carplay.banner.subPaused',
    metrics: true,
    pulse: false,
  },
  saved: {
    state: 'saved',
    word: 'carplay.banner.wordSaved',
    sub: 'carplay.banner.subSaved',
    metrics: true,
    pulse: false,
  },
  interrupted: {
    state: 'stop',
    word: 'carplay.banner.wordNotRecording',
    sub: 'carplay.banner.subInterrupted',
    metrics: true,
    pulse: false,
  },
  acquiring: {
    state: 'acquiring',
    word: 'carplay.banner.wordAcquiring',
    sub: 'carplay.banner.subAcquiring',
    metrics: true,
    pulse: false,
  },
  armedAuto: {
    state: 'recording',
    word: 'carplay.banner.wordReady',
    sub: 'carplay.banner.subArmedAuto',
    metrics: false,
    pulse: false,
  },
  manualIdle: {
    state: 'recording',
    word: 'carplay.banner.wordNotRecording',
    sub: 'carplay.banner.subManualIdle',
    metrics: false,
    pulse: false,
  },
} as const satisfies Record<
  BannerState,
  { state: RideStateKey; word: string; sub: string; metrics: boolean; pulse: boolean }
>;

const NO_METRICS = '— · —:—';

export function ActiveRideBanner({
  state,
  distance,
  time,
  onPress,
}: {
  state: BannerState;
  distance: string;
  time: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { t: c } = useEditorialTheme();
  const cfg = BANNER[state];
  const word = t(cfg.word).toLocaleUpperCase();
  const sub = t(cfg.sub);
  const tintColor =
    state === 'armedAuto' || state === 'manualIdle' ? c.ink3 : stateTint(cfg.state, c);
  const metrics = state === 'acquiring' ? NO_METRICS : `${distance} · ${time}`;
  const a11yLabel = [word, cfg.metrics ? metrics : '', sub].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={sub}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: c.surface,
        borderRadius: radius.card,
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
              ...type.label,
              ...SYSTEM_WEIGHT.semibold,
              color: tintColor,
            }}
          >
            {word}
          </Text>
          {cfg.metrics && (
            <Text style={{ ...type.label, fontVariant: ['tabular-nums'], color: c.ink2 }}>
              {metrics}
            </Text>
          )}
        </View>
        <Text style={{ ...type.caption, color: c.ink3, marginTop: layout.titleGap }}>{sub}</Text>
      </View>
      <ChevronUp size={18} color={c.ink4} strokeWidth={2} />
    </Pressable>
  );
}
