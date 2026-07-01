// CarPlay Companion — Confirmation cues (design spec §5 Screen 2 / CuesScreen).
// The cue is the trust mechanism behind silent auto-start (R9). Two independent
// channels (audio/haptic), tone character, a test button, and a legend.
// TODO(carplay): persist prefs (U10) and fire real cue previews via the earcon module.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Bell, ChevronLeft, Headphones, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CardGroup,
  CautionRow,
  INK_ON_COPPER,
  MONO,
  SectionLabel,
} from '../../../components/carplay/primitives';
import { type RideStateKey, StateGlyph } from '../../../components/carplay/state-indicator';
import { NativeToggle } from '../../../components/ui/native-toggle';
import { type CueTone, useCarPlayStore } from '../../../stores/carplay.store';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

const LEGEND: { state: RideStateKey; labelKey: string; labelDefault: string; sound: string }[] = [
  {
    state: 'recording',
    labelKey: 'carplay.cues.legendStart',
    labelDefault: 'Start / Resume',
    sound: 'Rising two-tone',
  },
  {
    state: 'autoPaused',
    labelKey: 'carplay.cues.legendPause',
    labelDefault: 'Auto-pause',
    sound: 'Single descending',
  },
  {
    state: 'saved',
    labelKey: 'carplay.cues.legendSaved',
    labelDefault: 'Saved',
    sound: 'Long descending',
  },
];

export default function CarPlayCuesScreen() {
  const { t } = useTranslation();
  const { t: c } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const audioOn = useCarPlayStore((s) => s.audioCue);
  const hapticOn = useCarPlayStore((s) => s.hapticCue);
  const tone = useCarPlayStore((s) => s.tone);
  const setAudioCue = useCarPlayStore((s) => s.setAudioCue);
  const setHapticCue = useCarPlayStore((s) => s.setHapticCue);
  const setTone = useCarPlayStore((s) => s.setTone);

  const toggleAudio = (v: boolean) => {
    setAudioCue(v);
    if (v) triggerImpact(); // TODO(carplay): play the selected earcon preview
  };
  const toggleHaptic = (v: boolean) => {
    setHapticCue(v);
    if (v) triggerNotification(Haptics.NotificationFeedbackType.Success);
  };

  const tones: { key: CueTone; label: string }[] = [
    { key: 'mechanical', label: t('carplay.cues.mechanical', { defaultValue: 'Mechanical' }) },
    { key: 'chime', label: t('carplay.cues.chime', { defaultValue: 'Chime' }) },
    { key: 'voice', label: t('carplay.cues.voice', { defaultValue: 'Voice' }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('carplay.a11y.back', { defaultValue: 'Back' })}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            borderCurve: 'continuous',
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={18} color={c.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={{ fontSize: 19, fontWeight: '700', letterSpacing: -0.3, color: c.ink }}>
          {t('carplay.cues.title', { defaultValue: 'Confirmation cues' })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 28 }}
      >
        <Text
          style={{
            fontSize: 13.5,
            color: c.ink2,
            lineHeight: 20,
            paddingHorizontal: 4,
            paddingTop: 2,
          }}
        >
          {t('carplay.cues.intro', {
            defaultValue:
              'How a silent auto-start tells you it began. Both on by default — they cover each other.',
          })}
        </Text>

        <View style={{ marginTop: 12 }}>
          <CardGroup>
            <ToggleRow
              icon={<Headphones size={18} color={c.ink2} strokeWidth={1.9} />}
              title={t('carplay.cues.audio', { defaultValue: 'Audio tone' })}
              sub={t('carplay.cues.audioSub', {
                defaultValue: 'Ducks nav voice ~0.5s · plays on lock',
              })}
              value={audioOn}
              onValueChange={toggleAudio}
              first
            />
            <View style={{ height: 1, backgroundColor: c.line2, marginLeft: 63 }} />
            <ToggleRow
              icon={<Bell size={18} color={c.ink2} strokeWidth={1.9} />}
              title={t('carplay.cues.haptic', { defaultValue: 'Haptic' })}
              sub={t('carplay.cues.hapticSub', { defaultValue: 'Phone + Apple Watch tap' })}
              value={hapticOn}
              onValueChange={toggleHaptic}
            />
          </CardGroup>
        </View>

        {!audioOn && !hapticOn && (
          <CautionRow>
            {t('carplay.cues.caution', {
              defaultValue:
                "With both off, auto-start is silent. You won't know a ride began until you glance at the tile.",
            })}
          </CautionRow>
        )}

        <SectionLabel>
          {t('carplay.cues.toneCharacter', { defaultValue: 'Tone character' })}
        </SectionLabel>
        <View style={{ flexDirection: 'row', gap: 9, opacity: audioOn ? 1 : 0.4 }}>
          {tones.map((tn) => {
            const sel = tone === tn.key;
            return (
              <Pressable
                key={tn.key}
                disabled={!audioOn}
                accessibilityState={{ disabled: !audioOn }}
                onPress={() => {
                  triggerImpact();
                  setTone(tn.key);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 13,
                  paddingHorizontal: 6,
                  borderRadius: 13,
                  borderCurve: 'continuous',
                  backgroundColor: sel ? tint(c.warm, 0.14) : c.surface,
                  borderWidth: 1.5,
                  borderColor: sel ? c.warm : c.line,
                }}
              >
                <Text style={{ color: sel ? c.warm2 : c.ink2, fontSize: 13.5, fontWeight: '600' }}>
                  {tn.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ fontSize: 12, color: c.ink3, paddingHorizontal: 4, paddingTop: 8 }}>
          {t('carplay.cues.mechanicalDesc', {
            defaultValue: 'Mechanical — a rugged, brand-true click. Default.',
          })}
        </Text>

        <Pressable
          onPress={() => triggerImpact()} // TODO(carplay): play start ▸ pause ▸ resume sequence
          style={{
            width: '100%',
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            height: 52,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: c.warm,
          }}
        >
          <Play size={18} color={INK_ON_COPPER} strokeWidth={2} fill={INK_ON_COPPER} />
          <Text style={{ color: INK_ON_COPPER, fontSize: 15.5, fontWeight: '700' }}>
            {t('carplay.cues.test', { defaultValue: 'Test this cue' })}
          </Text>
        </Pressable>

        <SectionLabel>{t('carplay.cues.legend', { defaultValue: 'Legend' })}</SectionLabel>
        <CardGroup>
          {LEGEND.map((r, i) => (
            <View
              key={r.state}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 13,
                paddingHorizontal: 16,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: c.line2,
              }}
            >
              <StateGlyph state={r.state} size={20} />
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: c.ink }}>
                {t(r.labelKey, { defaultValue: r.labelDefault })}
              </Text>
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: c.ink3, letterSpacing: 0.3 }}>
                {r.sound}
              </Text>
            </View>
          ))}
        </CardGroup>
      </ScrollView>
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  sub,
  value,
  onValueChange,
  first,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  first?: boolean;
}) {
  const { t: c } = useEditorialTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line2,
      }}
    >
      <View
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          borderCurve: 'continuous',
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '600', color: c.ink }}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 2 }}>{sub}</Text>
      </View>
      <NativeToggle value={value} onValueChange={onValueChange} tint={c.warm} />
    </View>
  );
}
